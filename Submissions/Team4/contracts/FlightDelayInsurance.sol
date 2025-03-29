// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FlightDelayInsurance is ChainlinkClient, AutomationCompatibleInterface, Ownable, ReentrancyGuard {
    using Chainlink for Chainlink.Request;

    // Flight Status Enum for better state tracking
    enum FlightStatus {
        Pending,    // Not yet checked
        OnTime,     // Checked and on time
        Delayed,    // Checked and delayed
        Claimed     // Payout processed
    }

    struct Policy {
        address policyholder;
        string flightIata;
        uint256 premium;
        uint256 purchaseDate;
        uint256 flightDate;
        uint256 lastCheckedTimestamp;  // New field to track last check time
        uint256 delayMinutes;          // Track actual delay minutes
        FlightStatus status;           // Replace boolean flags with enum
    }

    // Maps policyIds to Policy structs
    mapping(bytes32 => Policy) public policies;
    
    // Maps Chainlink requestIds to policyIds (crucial fix)
    mapping(bytes32 => bytes32) private requestToPolicyId;
    
    // Maps users to their policyIds
    mapping(address => bytes32[]) public userPolicies;
    
    // Track unique flight policies for each user
    mapping(address => mapping(string => mapping(uint256 => bool))) public userFlightPolicies;
    
    // Array of all policy IDs for iteration by Keepers
    bytes32[] public allPolicyIds;
    
    // Track last checked index for Keepers to batch process
    uint256 public lastCheckedIndex;

    uint256 public totalPoolFunds;
    uint256 public totalRevenueFunds;  // Track protocol revenue separately
    uint256 public totalClaimedFunds;
    uint256 public totalPoliciesSold;
    uint256 public constant MIN_DELAY_MINUTES = 120; // 2 hours
    uint256 public constant PAYOUT_PERCENTAGE = 300; // 300% of premium as payout
    uint256 public constant PROTOCOL_FEE_PERCENTAGE = 20; // 20% of premium as protocol fee
    uint256 public recheckInterval = 30 minutes;
    uint256 public checkInterval = 1 hours; 
    uint256 public lastCheckTimestamp;

    address private oracle;
    bytes32 private jobId;
    uint256 private fee;
    
    address public immutable ADMIN_WALLET;

    // Events
    event PolicyPurchased(
        address indexed user,
        bytes32 policyId, 
        string flightNumber
    );

    event PolicyCreated(
        bytes32 policyId, 
        address policyholder, 
        string flightIata, 
        uint256 premium,
        uint256 protocolFee
    );
    
    event PolicyClaimed(
        bytes32 policyId, 
        address policyholder, 
        uint256 payoutAmount
    );
    
    event FlightStatusChecked(
        bytes32 policyId, 
        string flightIata, 
        FlightStatus status,
        uint256 delayMinutes
    );
    
    event FundsWithdrawn(
        address indexed admin, 
        uint256 amount, 
        uint256 timestamp
    );

    event InitialDeposit(
        address indexed depositor,
        uint256 amount
    );

    constructor() Ownable(msg.sender) {
        ADMIN_WALLET = 0xF51EE95f3cEA7D1f474fE678720D3E126FED364B;
        
        // Amoy Testnet LINK token
        setChainlinkToken(0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904);
        
        // LinkWell Nodes Chainlink Oracle configuration for Polygon Amoy Testnet
        oracle = 0xd36c6B1777c7f3Db1B3201bDD87081A9045B7b46;
        jobId = bytes32(bytes("a8356f48569c434eaa4ac5fcb4db5cc0"));
        fee = 0.01 * 10**18; // 0.01 LINK
        
        lastCheckTimestamp = block.timestamp;

        // Initial deposit of 1 MATIC to the contract's revenue funds
        uint256 initialDeposit = 1 ether; // 1 MATIC
        totalRevenueFunds += initialDeposit;
        
        // Emit an event for the initial deposit
        emit InitialDeposit(msg.sender, initialDeposit);
        emit FundsWithdrawn(msg.sender, initialDeposit, block.timestamp);
    }

    // Function for backward compatibility with frontend
    function buyInsurance(
        string memory flightNumber,
        uint256 departureDate,
        uint256 /* premium */,
        string memory /* currency */
    ) external payable nonReentrant {
        _createPolicy(flightNumber, departureDate);
    }

    // Public function for direct calls
    function purchasePolicy(
        string memory flightIata, 
        uint256 flightDate
    ) public payable nonReentrant {
        _createPolicy(flightIata, flightDate);
    }
    
    // Internal function to handle the actual policy creation
    function _createPolicy(
        string memory flightIata, 
        uint256 flightDate
    ) internal {
        require(msg.value > 0, "Premium must be greater than 0");
        require(flightDate > block.timestamp, "Flight date must be in the future");

        // Check for duplicate policy
        require(
            !userFlightPolicies[msg.sender][flightIata][flightDate], 
            "Policy for this flight already exists"
        );

        bytes32 policyId = keccak256(
            abi.encodePacked(msg.sender, flightIata, flightDate, block.timestamp)
        );

        // Mark this flight policy as purchased
        userFlightPolicies[msg.sender][flightIata][flightDate] = true;

        // Calculate protocol fee
        uint256 protocolFee = (msg.value * PROTOCOL_FEE_PERCENTAGE) / 100;
        uint256 poolAllocation = msg.value - protocolFee;

        policies[policyId] = Policy({
            policyholder: msg.sender,
            flightIata: flightIata,
            premium: msg.value,
            purchaseDate: block.timestamp,
            flightDate: flightDate,
            lastCheckedTimestamp: 0,      
            delayMinutes: 0,              
            status: FlightStatus.Pending  
        });

        userPolicies[msg.sender].push(policyId);
        allPolicyIds.push(policyId);

        // Split premium between pool and protocol revenue
        totalPoolFunds += poolAllocation;
        totalRevenueFunds += protocolFee;
        totalPoliciesSold++;

        // Emit both events for compatibility
        emit PolicyPurchased(msg.sender, policyId, flightIata);
        emit PolicyCreated(policyId, msg.sender, flightIata, msg.value, protocolFee);
    }

    // Helper function to check if a policy exists
    function hasPolicyForFlight(
        address user, 
        string memory flightIata, 
        uint256 flightDate
    ) public view returns (bool) {
        return userFlightPolicies[user][flightIata][flightDate];
    }

    // Modified to allow rechecking after interval has passed
    function requestFlightData(bytes32 policyId) public {
        Policy storage policy = policies[policyId];
        require(policy.policyholder != address(0), "Policy not found");
        require(block.timestamp >= policy.flightDate, "Flight date not reached");
        
        // Allow checking if never checked or if recheck interval has passed
        // Also, never recheck if already claimed
        require(
            policy.status != FlightStatus.Claimed && 
            (policy.lastCheckedTimestamp == 0 || 
             block.timestamp >= policy.lastCheckedTimestamp + recheckInterval),
            "Too soon to recheck or already claimed"
        );

        // Update last checked timestamp immediately
        policy.lastCheckedTimestamp = block.timestamp;

        Chainlink.Request memory req = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfill.selector
        );

        // Convert flight date to formatted string
        string memory formattedDate = _formatDate(policy.flightDate);
        
        // API URL
        string memory url = string(
            abi.encodePacked(
                "https://decentraflightapi.onrender.com/api/flight-delay?flight_iata=",
                policy.flightIata,
                "&departure_date=",
                formattedDate
            )
        );

        req.add("method", "GET");
        req.add("url", url);
        req.add("headers", ""); 
        req.add("body", ""); 
        req.add("path", "delay_minutes"); 
        req.addInt("multiplier", 1); 
        req.add("contact", ""); 

        // Store policyId for the request
        bytes32 requestId = sendChainlinkRequestTo(oracle, req, fee);
        requestToPolicyId[requestId] = policyId;
    }

    // Fixed to use the requestToPolicyId mapping
    function fulfill(bytes32 _requestId, uint256 _delayMinutes) public recordChainlinkFulfillment(_requestId) {
        // Get the correct policyId using the mapping
        bytes32 policyId = requestToPolicyId[_requestId];
        require(policyId != bytes32(0), "Unknown request ID");
        
        Policy storage policy = policies[policyId];
        
        // Update delay minutes
        policy.delayMinutes = _delayMinutes;
        
        // Update status based on delay
        if (_delayMinutes >= MIN_DELAY_MINUTES) {
            policy.status = FlightStatus.Delayed;
            emit FlightStatusChecked(policyId, policy.flightIata, FlightStatus.Delayed, _delayMinutes);
            _processClaim(policyId);
        } else {
            policy.status = FlightStatus.OnTime;
            emit FlightStatusChecked(policyId, policy.flightIata, FlightStatus.OnTime, _delayMinutes);
        }
        
        // Clean up the mapping
        delete requestToPolicyId[_requestId];
    }

    function _processClaim(bytes32 policyId) internal {
        Policy storage policy = policies[policyId];
        require(policy.status == FlightStatus.Delayed, "Flight not delayed");
        
        uint256 payoutAmount = (policy.premium * PAYOUT_PERCENTAGE) / 100;

        // Update status to Claimed
        policy.status = FlightStatus.Claimed;

        // Reduce pool funds by the amount allocated to the pool
        uint256 protocolFee = (policy.premium * PROTOCOL_FEE_PERCENTAGE) / 100;
        uint256 poolAllocation = policy.premium - protocolFee;
        
        totalPoolFunds -= poolAllocation;
        totalClaimedFunds += payoutAmount;

        (bool success, ) = policy.policyholder.call{value: payoutAmount}("");
        require(success, "Payout transfer failed");

        emit PolicyClaimed(policyId, policy.policyholder, payoutAmount);
    }
    
    // Admin function to force a recheck for any policy
    function forceRecheck(bytes32 policyId) external onlyOwner {
        Policy storage policy = policies[policyId];
        require(policy.policyholder != address(0), "Policy not found");
        require(policy.status != FlightStatus.Claimed, "Policy already claimed");
        
        // Reset last checked timestamp to allow immediate recheck
        policy.lastCheckedTimestamp = 0;
        
        // Request flight data
        requestFlightData(policyId);
    }

    // Chainlink Keepers checkUpkeep function - modified for new status tracking
    function checkUpkeep(
        bytes calldata /* checkData */
    ) external view override returns (bool upkeepNeeded, bytes memory performData) {
        bool timeToCheck = (block.timestamp - lastCheckTimestamp) >= checkInterval;
        bool policiesExist = allPolicyIds.length > 0;
        
        upkeepNeeded = timeToCheck && policiesExist;
        
        if (!upkeepNeeded) return (false, "");
        
        uint256 batchSize = 10;
        uint256 startIdx = lastCheckedIndex % allPolicyIds.length;
        uint256 endIdx = startIdx + batchSize;
        if (endIdx > allPolicyIds.length) {
            endIdx = allPolicyIds.length;
        }
        
        bytes32[] memory policyBatch = new bytes32[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            policyBatch[i - startIdx] = allPolicyIds[i];
        }
        
        return (upkeepNeeded, abi.encode(policyBatch, endIdx % allPolicyIds.length));
    }

    // Chainlink Keepers performUpkeep function
    function performUpkeep(bytes calldata performData) external override {
        (bytes32[] memory policyBatch, uint256 nextIndex) = abi.decode(performData, (bytes32[], uint256));
        
        for (uint i = 0; i < policyBatch.length; i++) {
            bytes32 policyId = policyBatch[i];
            Policy storage policy = policies[policyId];
            
            // Check policies that meet these criteria:
            // 1. Valid policy
            // 2. Flight date has passed
            // 3. Not yet claimed
            // 4. Either never checked or recheck interval has passed
            if (policy.policyholder != address(0) && 
                block.timestamp >= policy.flightDate && 
                policy.status != FlightStatus.Claimed &&
                (policy.lastCheckedTimestamp == 0 || 
                 block.timestamp >= policy.lastCheckedTimestamp + recheckInterval)) {
            
                requestFlightData(policyId);
            }
        }
        
        lastCheckedIndex = nextIndex;
        lastCheckTimestamp = block.timestamp;
    }

    // For testing purposes
    function updateFlightDateForTesting(bytes32 policyId, uint256 newFlightDate) external onlyOwner {
        Policy storage policy = policies[policyId];
        require(policy.policyholder != address(0), "Policy not found");
        policy.flightDate = newFlightDate;
    }

    // Admin function to set check interval
    function setCheckInterval(uint256 newInterval) external onlyOwner {
        require(newInterval >= 1 minutes, "Interval too short");
        checkInterval = newInterval;
    }
    
    // Admin function to set recheck interval
    function setRecheckInterval(uint256 newInterval) external onlyOwner {
        require(newInterval >= 5 minutes, "Interval too short");
        recheckInterval = newInterval;
    }
    
    // Withdraw function for excess revenue funds
    function withdrawExcessFunds(uint256 amount) external nonReentrant {
        require(msg.sender == ADMIN_WALLET, "Only admin can withdraw");
        require(amount <= totalRevenueFunds, "Cannot withdraw more than available revenue funds");

        totalRevenueFunds -= amount;

        (bool success, ) = ADMIN_WALLET.call{value: amount}("");
        require(success, "Withdrawal transfer failed");

        emit FundsWithdrawn(ADMIN_WALLET, amount, block.timestamp);
    }

    // Function to get all policies for a user
    function getPoliciesByOwner(address _owner) public view returns (bytes32[] memory) {
        return userPolicies[_owner];
    }
    
    // Function to get total number of policies
    function totalPolicies() public view returns (uint256) {
        return totalPoliciesSold;
    }
    
    // Get policy details including status information
    function getPolicyDetails(bytes32 policyId) public view returns (
        address policyholder,
        string memory flightIata,
        uint256 premium,
        uint256 flightDate,
        uint256 lastChecked,
        uint256 delayMinutes,
        FlightStatus status
    ) {
        Policy storage policy = policies[policyId];
        return (
            policy.policyholder,
            policy.flightIata,
            policy.premium,
            policy.flightDate,
            policy.lastCheckedTimestamp,
            policy.delayMinutes,
            policy.status
        );
    }
    
    // Function to get available revenue to withdraw
    function getAvailableRevenue() public view returns (uint256) {
        return totalRevenueFunds;
    }

    // Helper function to convert timestamp to YYYY-MM-DD format
    function _formatDate(uint256 timestamp) internal pure returns (string memory) {
        (uint256 year, uint256 month, uint256 day) = _timestampToDate(timestamp);
        
        // Convert to string with leading zeros
        string memory yearStr = _toString(year);
        string memory monthStr = month < 10 ? string(abi.encodePacked("0", _toString(month))) : _toString(month);
        string memory dayStr = day < 10 ? string(abi.encodePacked("0", _toString(day))) : _toString(day);
        
        return string(abi.encodePacked(yearStr, "-", monthStr, "-", dayStr));
    }

    // Timestamp to date conversion
    function _timestampToDate(uint256 timestamp) internal pure returns (uint256 year, uint256 month, uint256 day) {
        uint256 buf;
        uint256 totalDays = timestamp / 86400;

        // Year calculation
        year = 1970 + totalDays / 365;
        for (buf = 0; totalDays >= (buf = _leapYearsBefore(year)) + 365; year++) {
            totalDays -= buf + 365;
        }

        // Month and day calculation
        uint256[12] memory monthDays = [
            uint256(31), 
            uint256(28), 
            uint256(31), 
            uint256(30), 
            uint256(31), 
            uint256(30), 
            uint256(31), 
            uint256(31), 
            uint256(30), 
            uint256(31), 
            uint256(30), 
            uint256(31)
        ];
        
        // Adjust for leap years
        if (_isLeapYear(year)) {
            monthDays[1] = 29;
        }

        for (month = 0; month < 12; month++) {
            if (totalDays < monthDays[month]) {
                break;
            }
            totalDays -= monthDays[month];
        }

        month += 1;
        day = totalDays + 1;

        return (year, month, day);
    }

    // Check if it's a leap year
    function _isLeapYear(uint256 year) internal pure returns (bool) {
        return ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0));
    }

    // Count leap years before a given year
    function _leapYearsBefore(uint256 year) internal pure returns (uint256) {
        year--;
        return year / 4 - year / 100 + year /400;
    }

    // Convert uint to string
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }

    receive() external payable {
        totalRevenueFunds += msg.value;
    }
}