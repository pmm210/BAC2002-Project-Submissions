// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// Import Chainlink's Aggregator interface
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract LendingPlatform is ERC2771Context, ReentrancyGuard {
    address public admin;
    uint256 public constant MIN_COLLATERAL_RATIO = 150; // e.g., 150%

    // Chainlink Price Feed for BNB/USD (8 decimals)
    AggregatorV3Interface public priceFeed;
    
    // Liquidity available for disbursing loans (separate from collateral)
    uint256 public totalLiquidity;

    struct Loan {
        address borrower;
        uint256 principal;
        uint256 collateral;
        uint256 interestRate; // in %
        uint256 dueDate;
        uint256 startTime;  // timestamp when the loan was issued
        bool isRepaid;
    }
    
    // New struct for on-chain credit scoring
    struct BorrowerProfile {
        uint256 totalLoans;
        uint256 repaidLoans;
    }
    
    // Mapping of borrower address to their profile
    mapping(address => BorrowerProfile) public profiles;

    uint256 public nextLoanId = 1;
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public borrowerLoans;

    event LoanCreated(uint256 loanId, address indexed borrower, uint256 principal, uint256 collateral);
    event LoanRepaid(uint256 loanId, address indexed borrower);
    event CollateralLiquidated(uint256 loanId, address indexed borrower);
    event PriceRetrieved(int256 price);
    event CollateralRatioCalculated(uint256 collateralUSD, uint256 ratio);
    event LiquidityDeposited(address indexed sender, uint256 amount);
    event LiquidityWithdrawn(address indexed admin, uint256 amount);
    // Optional: event to log profile updates
    event CreditProfileUpdated(address indexed borrower, uint256 totalLoans, uint256 repaidLoans);

    modifier onlyAdmin() {
        require(_msgSender() == admin, "Admin only");
        _;
    }

    /// @notice Constructor accepts the trusted forwarder address and the Chainlink price feed address.
    constructor(address trustedForwarder, address _priceFeed) ERC2771Context(trustedForwarder) {
        admin = _msgSender();
        require(_priceFeed != address(0), "Invalid price feed address");
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    // ========================================
    // Liquidity Management Functions
    // ========================================

    /// @notice Allows anyone to deposit liquidity into the pool for loan disbursement.
    function depositLiquidity() external payable {
        require(msg.value > 0, "Must deposit funds");
        totalLiquidity += msg.value;
        emit LiquidityDeposited(_msgSender(), msg.value);
    }

    /// @notice Allows the admin to withdraw liquidity from the pool.
    function withdrawLiquidity(uint256 amount) external onlyAdmin {
        require(amount <= totalLiquidity, "Insufficient liquidity");
        totalLiquidity -= amount;
        (bool sent, ) = admin.call{value: amount}("");
        require(sent, "Withdrawal failed");
        emit LiquidityWithdrawn(admin, amount);
    }

    /// @notice Returns the contract's current BNB balance.
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ========================================
    // Loan Functions
    // ========================================

    /// @notice Request a new loan by sending collateral.
    /// The entire collateral remains locked. The principal is paid out from liquidity.
    function requestLoan(uint256 interestRate, uint256 duration) external payable nonReentrant returns (uint256) {
        require(msg.value > 0, "Collateral required");
        require(duration >= 1 days, "Duration too short");

        // Calculate principal from collateral
        uint256 principal = (msg.value * 100) / MIN_COLLATERAL_RATIO;
        require(principal > 0, "Principal must be greater than zero");
        require(totalLiquidity >= principal, "Insufficient liquidity to disburse loan");

        loans[nextLoanId] = Loan({
            borrower: _msgSender(),
            principal: principal,
            collateral: msg.value,
            interestRate: interestRate,
            dueDate: block.timestamp + duration,
            startTime: block.timestamp,
            isRepaid: false
        });
        borrowerLoans[_msgSender()].push(nextLoanId);

        // Update credit profile: increment totalLoans.
        profiles[_msgSender()].totalLoans += 1;
        emit CreditProfileUpdated(_msgSender(), profiles[_msgSender()].totalLoans, profiles[_msgSender()].repaidLoans);

        // Deduct principal from liquidity and transfer it to borrower.
        totalLiquidity -= principal;
        (bool sent, ) = _msgSender().call{value: principal}("");
        require(sent, "Principal transfer failed");

        emit LoanCreated(nextLoanId, _msgSender(), principal, msg.value);
        return nextLoanId++;
    }

    /// @notice Repay an active loan by sending at least the required amount.
    /// The amount includes principal and simple interest.
    function repayLoan(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower == _msgSender(), "Not borrower");
        require(!loan.isRepaid, "Already repaid");

        // Calculate interest based on elapsed time.
        uint256 timeElapsed = block.timestamp - loan.startTime;
        uint256 interest = (loan.principal * loan.interestRate * timeElapsed) / (365 days * 100);
        uint256 repaymentAmount = loan.principal + interest;
        require(msg.value >= repaymentAmount, "Insufficient repayment");

        loan.isRepaid = true;

        // Return the collateral to the borrower.
        (bool collateralReturned, ) = loan.borrower.call{value: loan.collateral}("");
        require(collateralReturned, "Collateral return failed");

        // Add repaid funds to liquidity.
        totalLiquidity += loan.principal + interest;

        // Update credit profile: increment repaidLoans.
        profiles[_msgSender()].repaidLoans += 1;
        emit CreditProfileUpdated(_msgSender(), profiles[_msgSender()].totalLoans, profiles[_msgSender()].repaidLoans);

        emit LoanRepaid(loanId, loan.borrower);

        // Refund any excess repayment.
        if (msg.value > repaymentAmount) {
            (bool refundSent, ) = _msgSender().call{value: msg.value - repaymentAmount}("");
            require(refundSent, "Refund failed");
        }
    }

    /// @notice Liquidate a loan if overdue or undercollateralized.
    /// Only admin can call this.
    function liquidateLoan(uint256 loanId) external nonReentrant onlyAdmin {
        Loan storage loan = loans[loanId];
        require(!loan.isRepaid, "Already repaid");

        uint256 currentRatio = collateralRatio(loan.collateral, loan.principal);
        emit PriceRetrieved(getLatestPrice());
        uint256 collateralUSD = (loan.collateral * uint256(getLatestPrice())) / 1e26;
        emit CollateralRatioCalculated(collateralUSD, currentRatio);

        require(block.timestamp > loan.dueDate || currentRatio < MIN_COLLATERAL_RATIO, "Loan not eligible for liquidation");

        loan.isRepaid = true;
        (bool sent, ) = admin.call{value: loan.collateral}("");
        require(sent, "Collateral transfer failed");

        emit CollateralLiquidated(loanId, loan.borrower);
    }

    // ========================================
    // View & Analytics Functions
    // ========================================

    /// @notice Returns the latest BNB/USD price from Chainlink (8 decimals).
    function getLatestPrice() public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price retrieved");
        return price;
    }

    /// @notice Calculates the collateral ratio as (collateralUSD * 100) / principal.
    /// Both collateral and principal are converted to USD.
    /// collateral: in wei (18 decimals); price: 8 decimals; normalized by 1e26.
    function collateralRatio(uint256 collateral, uint256 principal) public view returns (uint256) {
        int256 price = getLatestPrice();
        uint256 collateralUSD = (collateral * uint256(price)) / 1e26;
        uint256 principalUSD = (principal * uint256(price)) / 1e26;
        require(principalUSD > 0, "Principal cannot be zero");
        return (collateralUSD * 100) / principalUSD;
    }

    /// @notice Returns an array of loan IDs for a given borrower.
    function getLoans(address borrower) external view returns (uint256[] memory) {
        return borrowerLoans[borrower];
    }

    /// @notice Returns detailed information about a specific loan.
    function getLoanDetails(uint256 loanId) external view returns (
        address borrower,
        uint256 principal,
        uint256 collateral,
        uint256 interestRate,
        uint256 dueDate,
        uint256 startTime,
        bool isRepaid
    ) {
        Loan storage loan = loans[loanId];
        return (
            loan.borrower,
            loan.principal,
            loan.collateral,
            loan.interestRate,
            loan.dueDate,
            loan.startTime,
            loan.isRepaid
        );
    }

    /// @notice Checks and returns the health status of a loan.
    /// Returns "overdue", "undercollateralized", or "healthy" along with the current collateral ratio.
    function checkLoanHealth(uint256 loanId) external view returns (string memory status, uint256 currentRatio) {
        Loan storage loan = loans[loanId];
        currentRatio = collateralRatio(loan.collateral, loan.principal);
        if (block.timestamp > loan.dueDate) {
            status = "overdue";
        } else if (currentRatio < MIN_COLLATERAL_RATIO) {
            status = "undercollateralized";
        } else {
            status = "healthy";
        }
    }

    /// @notice Returns additional information from the Chainlink price feed.
    function getPriceFeedInfo() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) {
        (roundId, answer, startedAt, updatedAt, answeredInRound) = priceFeed.latestRoundData();
    }

    /// @notice Returns the credit score for a borrower.
    /// Credit score is defined as (repaidLoans * 100) / totalLoans.
    function getCreditScore(address borrower) external view returns (uint256) {
        BorrowerProfile memory profile = profiles[borrower];
        if (profile.totalLoans == 0) return 0;
        return (profile.repaidLoans * 100) / profile.totalLoans;
    }

    /// @notice Debug function: returns the effective sender (useful with meta-transactions).
    function testForwarder() external view returns (address) {
        return _msgSender();
    }

    // ========================================
    // Fallback and Receive
    // ========================================
    fallback() external payable {
        revert("Fallback not allowed");
    }

    receive() external payable {
        revert("Direct transfers not allowed");
    }
}
