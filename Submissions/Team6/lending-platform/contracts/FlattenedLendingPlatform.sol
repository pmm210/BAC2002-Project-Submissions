// Sources flattened with hardhat v2.22.19 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v5.2.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/metatx/ERC2771Context.sol@v5.2.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (metatx/ERC2771Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Context variant with ERC-2771 support.
 *
 * WARNING: Avoid using this pattern in contracts that rely in a specific calldata length as they'll
 * be affected by any forwarder whose `msg.data` is suffixed with the `from` address according to the ERC-2771
 * specification adding the address size in bytes (20) to the calldata size. An example of an unexpected
 * behavior could be an unintended fallback (or another function) invocation while trying to invoke the `receive`
 * function only accessible if `msg.data.length == 0`.
 *
 * WARNING: The usage of `delegatecall` in this contract is dangerous and may result in context corruption.
 * Any forwarded request to this contract triggering a `delegatecall` to itself will result in an invalid {_msgSender}
 * recovery.
 */
abstract contract ERC2771Context is Context {
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address private immutable _trustedForwarder;

    /**
     * @dev Initializes the contract with a trusted forwarder, which will be able to
     * invoke functions on this contract on behalf of other accounts.
     *
     * NOTE: The trusted forwarder can be replaced by overriding {trustedForwarder}.
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder_) {
        _trustedForwarder = trustedForwarder_;
    }

    /**
     * @dev Returns the address of the trusted forwarder.
     */
    function trustedForwarder() public view virtual returns (address) {
        return _trustedForwarder;
    }

    /**
     * @dev Indicates whether any particular address is the trusted forwarder.
     */
    function isTrustedForwarder(address forwarder) public view virtual returns (bool) {
        return forwarder == trustedForwarder();
    }

    /**
     * @dev Override for `msg.sender`. Defaults to the original `msg.sender` whenever
     * a call is not performed by the trusted forwarder or the calldata length is less than
     * 20 bytes (an address length).
     */
    function _msgSender() internal view virtual override returns (address) {
        uint256 calldataLength = msg.data.length;
        uint256 contextSuffixLength = _contextSuffixLength();
        if (isTrustedForwarder(msg.sender) && calldataLength >= contextSuffixLength) {
            return address(bytes20(msg.data[calldataLength - contextSuffixLength:]));
        } else {
            return super._msgSender();
        }
    }

    /**
     * @dev Override for `msg.data`. Defaults to the original `msg.data` whenever
     * a call is not performed by the trusted forwarder or the calldata length is less than
     * 20 bytes (an address length).
     */
    function _msgData() internal view virtual override returns (bytes calldata) {
        uint256 calldataLength = msg.data.length;
        uint256 contextSuffixLength = _contextSuffixLength();
        if (isTrustedForwarder(msg.sender) && calldataLength >= contextSuffixLength) {
            return msg.data[:calldataLength - contextSuffixLength];
        } else {
            return super._msgData();
        }
    }

    /**
     * @dev ERC-2771 specifies the context as being a single address (20 bytes).
     */
    function _contextSuffixLength() internal view virtual override returns (uint256) {
        return 20;
    }
}


// File @chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol@v1.3.0

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.0;

// solhint-disable-next-line interface-starts-with-i
interface AggregatorV3Interface {
  function decimals() external view returns (uint8);

  function description() external view returns (string memory);

  function version() external view returns (uint256);

  function getRoundData(
    uint80 _roundId
  ) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

  function latestRoundData()
    external
    view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}


// File @openzeppelin/contracts/utils/ReentrancyGuard.sol@v5.2.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}


// File contracts/LendingPlatform.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.20;
// Import Chainlink's Aggregator interface
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
