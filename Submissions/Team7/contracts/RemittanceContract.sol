// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISwapRouter {
    // Simplified interface with only the needed functions
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);
    
    function getAmountsOut(
        uint amountIn, 
        address[] calldata path
    ) external view returns (uint[] memory amounts);
    
    function WETH() external view returns (address);
}

contract RemittanceContract is Ownable, ReentrancyGuard {
    // Custom Errors - more gas efficient than require statements
    error InvalidSourceToken(address token);
    error InvalidAmount(uint256 amount);
    error InvalidRecipientAddress(address recipient);
    error InsufficientAllowance(address token, uint256 required, uint256 current);
    error SwapFailed(address sourceToken, address targetToken, uint256 amount);
    error TransferFailed(address token, address to, uint256 amount);
    error NativeTransferFailed();
    error InsufficientLiquidity();

    // Contract configuration
    ISwapRouter public swapRouter;
    address public stablecoin;
    address public constant NATIVE_TOKEN = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    
    // Testing mode flag for testnets
    bool public testMode = true;
    
    // Remittance tracking - simplified to reduce gas
    struct Remittance {
        address sender;
        address recipient;
        uint256 sourceAmount;
        uint256 targetAmount;
        uint8 status; // 0: pending, 1: completed, 2: failed, 3: completed with fallback
    }
    
    // Use a counter for remittance IDs
    uint256 public remittanceCounter;
    mapping(uint256 => Remittance) public remittances;
    
    // Fee structure - reduced fee to 0.1% to make small transactions viable
    uint256 public platformFeePercentage = 10; // 0.1% (in basis points, 1% = 100)
    uint256 public constant MAX_FEE = 100; // 1% maximum fee
    
    // Fixed slippage tolerance
    uint256 public slippageTolerance = 50; // 0.5% slippage tolerance
    
    // Pause mechanism
    bool public paused;
    
    // Events
    event RemittanceSent(
        uint256 indexed remittanceId,
        address indexed sender,
        address indexed recipient,
        uint256 sourceAmount,
        uint256 targetAmount
    );
    
    event RemittanceStatusUpdated(
        uint256 indexed remittanceId,
        uint8 status
    );
    
    event FeeUpdated(uint256 newFeePercentage);

    event SwapFallbackUsed(
        uint256 indexed remittanceId,
        address sourceToken,
        address targetToken,
        uint256 sourceAmount,
        uint256 targetAmount
    );
    
    // Modifiers
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    // Receive function to accept native token
    receive() external payable {}
    
    constructor(address _swapRouter, address _stablecoin) Ownable(msg.sender) {
        if (_swapRouter == address(0)) revert InvalidSourceToken(_swapRouter);
        if (_stablecoin == address(0)) revert InvalidSourceToken(_stablecoin);
        
        swapRouter = ISwapRouter(_swapRouter);
        stablecoin = _stablecoin;
    }
    
    /**
     * Internal helper to safely transfer tokens
     */
    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
        // Check recipient is not the contract itself
        if (to == address(this)) {
            emit SwapFallbackUsed(0, address(token), address(token), amount, amount);
            return; // Don't send tokens to self
        }
        
        bool success = token.transfer(to, amount);
        if (!success) {
            revert TransferFailed(address(token), to, amount);
        }
    }
    
    /**
     * Calculate platform fee - very low for small transactions
     */
    function calculateFee(uint256 amount) public view returns (uint256) {
        // For very small transactions, use a minimal fixed fee
        if (amount < 1e16) { // Less than 0.01 tokens
            return amount / 1000; // 0.1% fee, minimum
        }
        return (amount * platformFeePercentage) / 10000;
    }
    
    /**
     * Get conversion quote (gas optimized)
     */
    function getConversionQuote(
        address sourceToken,
        uint256 amount
    ) external view returns (uint256) {
        if (sourceToken == address(0)) revert InvalidSourceToken(sourceToken);
        if (amount == 0) revert InvalidAmount(amount);

        // If source token is already stablecoin, return the amount minus fee
        if (sourceToken == stablecoin) {
            uint256 fee = calculateFee(amount);
            return amount - fee;
        }
        
        // If in test mode and not stablecoin, return simulated amount
        if (testMode) {
            uint256 fee = calculateFee(amount);
            return amount - fee; // Simulate 1:1 exchange rate for testing
        }
        
        // Handle native token special case
        address actualSourceToken;
        if (sourceToken == NATIVE_TOKEN) {
            actualSourceToken = swapRouter.WETH();
        } else {
            actualSourceToken = sourceToken;
        }
        
        // Set up the token path for getting amounts
        address[] memory path = new address[](2);
        path[0] = actualSourceToken;
        path[1] = stablecoin;
        
        try swapRouter.getAmountsOut(amount, path) returns (uint[] memory amounts) {
            if (amounts.length > 1) {
                // Subtract fee from the output amount
                uint256 fee = calculateFee(amounts[1]);
                return amounts[1] - fee;
            }
            return 0;
        } catch {
            // If getAmountsOut fails, return estimated value
            uint256 fee = calculateFee(amount);
            return amount - fee; // Assume 1:1 exchange rate if router call fails
        }
    }
    
    /**
     * Send with conversion - optimized for gas efficiency
     */
    function sendWithConversion(
        address sourceToken,
        uint256 amount,
        address recipient
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        if (sourceToken == address(0)) revert InvalidSourceToken(sourceToken);
        if (amount == 0) revert InvalidAmount(amount);
        if (recipient == address(0)) revert InvalidRecipientAddress(recipient);

        uint256 remittanceId = remittanceCounter++;
        remittances[remittanceId] = Remittance({
            sender: msg.sender,
            recipient: recipient,
            sourceAmount: amount,
            targetAmount: 0,
            status: 0
        });

        uint256 targetAmount;

        if (sourceToken == NATIVE_TOKEN) {
            if (msg.value != amount) revert InvalidAmount(amount);

            // Perform actual swap using router
            targetAmount = _performNativeTokenSwap(amount, recipient, remittanceId);
        } else {
            targetAmount = _performERC20TokenSwap(sourceToken, amount, recipient, remittanceId);
        }

        remittances[remittanceId].targetAmount = targetAmount;
        remittances[remittanceId].status = 1;

        emit RemittanceSent(remittanceId, msg.sender, recipient, amount, targetAmount);
        emit RemittanceStatusUpdated(remittanceId, 1);

        return remittanceId;
    }

    function _performNativeTokenSwap(
        uint256 amount,
        address recipient,
        uint256 remittanceId
    ) internal returns (uint256) {
        if (stablecoin == NATIVE_TOKEN) {
            uint256 fee = calculateFee(amount);
            uint256 targetAmount = amount - fee;

            (bool success, ) = recipient.call{value: targetAmount}("");
            if (!success) revert NativeTransferFailed();
            return targetAmount;
        }

        // Skip the swap if in test mode and directly send the native token
        if (testMode) {
            uint256 fee = calculateFee(amount);
            uint256 targetAmount = amount - fee;
            
            // Emit fallback event
            emit SwapFallbackUsed(
                remittanceId,
                NATIVE_TOKEN,
                stablecoin,
                amount,
                targetAmount
            );
            
            // Send native token to recipient
            (bool success, ) = recipient.call{value: targetAmount}("");
            if (!success) revert NativeTransferFailed();
            
            return targetAmount;
        }

        // Declare the path properly
        address[] memory path = new address[](2);
        path[0] = swapRouter.WETH();
        path[1] = stablecoin;

        uint256 minAmountOut = 1;

        try swapRouter.getAmountsOut(amount, path) returns (uint[] memory amounts) {
            if (amounts.length > 1) {
                minAmountOut = (amounts[1] * (10000 - slippageTolerance)) / 10000;
            }
        } catch {
            revert InsufficientLiquidity();
        }

        try swapRouter.swapExactETHForTokens{value: amount}(
            minAmountOut,
            path,
            recipient,  // Send directly to recipient
            block.timestamp + 1800
        ) returns (uint[] memory amounts) {
            return amounts[1];
        } catch {
            revert SwapFailed(NATIVE_TOKEN, stablecoin, amount);
        }
    }

    function _performERC20TokenSwap(
        address sourceToken,
        uint256 amount,
        address recipient,
        uint256 remittanceId
    ) internal returns (uint256) {
        IERC20 token = IERC20(sourceToken);

        bool transferSuccess = token.transferFrom(msg.sender, address(this), amount);
        if (!transferSuccess) {
            revert TransferFailed(sourceToken, address(this), amount);
        }

        if (sourceToken == stablecoin) {
            uint256 fee = calculateFee(amount);
            uint256 targetAmount = amount - fee;
            _safeTransfer(token, recipient, targetAmount);
            return targetAmount;
        }

        // Skip the swap if in test mode and directly send the ERC20 token
        if (testMode) {
            uint256 fee = calculateFee(amount);
            uint256 targetAmount = amount - fee;
            
            // Emit fallback event
            emit SwapFallbackUsed(
                remittanceId,
                sourceToken,
                stablecoin,
                amount,
                targetAmount
            );
            
            // Send ERC20 token to recipient
            _safeTransfer(token, recipient, targetAmount);
            
            return targetAmount;
        }

        // Approve the router to spend the tokens
        token.approve(address(swapRouter), amount);

        // Declare the path properly
        address[] memory path = new address[](2);
        path[0] = sourceToken;
        path[1] = stablecoin;

        uint256 minAmountOut = 1;

        try swapRouter.getAmountsOut(amount, path) returns (uint[] memory amounts) {
            if (amounts.length > 1) {
                minAmountOut = (amounts[1] * (10000 - slippageTolerance)) / 10000;
            }
        } catch {
            revert InsufficientLiquidity();
        }

        try swapRouter.swapExactTokensForTokens(
            amount,
            minAmountOut,
            path,
            recipient,  // Send directly to recipient
            block.timestamp + 1800
        ) returns (uint[] memory amounts) {
            return amounts[1];
        } catch {
            revert SwapFailed(sourceToken, stablecoin, amount);
        }
    }
    
    /**
     * Get remittance status by ID
     */
    function getRemittanceStatus(uint256 remittanceId) external view returns (uint8) {
        if (remittanceId >= remittanceCounter) revert InvalidAmount(remittanceId);
        return remittances[remittanceId].status;
    }
    
    /**
     * Get remittance details by ID
     */
    function getRemittance(uint256 remittanceId) external view returns (Remittance memory) {
        if (remittanceId >= remittanceCounter) revert InvalidAmount(remittanceId);
        return remittances[remittanceId];
    }
    
    /**
     * Add stablecoin liquidity - for testnet simulation
     */
    function addStablecoinLiquidity(uint256 amount) external onlyOwner {
        IERC20 stablecoinToken = IERC20(stablecoin);
        bool success = stablecoinToken.transferFrom(msg.sender, address(this), amount);
        if (!success) {
            revert TransferFailed(stablecoin, address(this), amount);
        }
    }
    
    // Owner functions
    
    /**
     * Toggle test mode
     */
    function setTestMode(bool _testMode) external onlyOwner {
        testMode = _testMode;
    }
    
    /**
     * Withdraw accumulated fees
     */
    function withdrawFees(address token) external onlyOwner {
        if (token == NATIVE_TOKEN) {
            uint256 nativeBalance = address(this).balance;
            if (nativeBalance == 0) revert InvalidAmount(nativeBalance);

            (bool success, ) = owner().call{value: nativeBalance}("");
            require(success, "Native token withdrawal failed");
            return;
        }

        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        if (tokenBalance == 0) revert InvalidAmount(tokenBalance);

        bool success = IERC20(token).transfer(owner(), tokenBalance);
        if (!success) {
            revert TransferFailed(token, owner(), tokenBalance);
        }
    }

    /**
     * Set platform fee percentage
     */
    function setPlatformFee(uint256 _feePercentage) external onlyOwner {
        if (_feePercentage > MAX_FEE) revert InvalidAmount(_feePercentage);
        platformFeePercentage = _feePercentage;
        emit FeeUpdated(_feePercentage);
    }
    
    /**
     * Set the slippage tolerance
     */
    function setSlippageTolerance(uint256 _slippageTolerance) external onlyOwner {
        if (_slippageTolerance > 1000) revert InvalidAmount(_slippageTolerance); // Max 10%
        slippageTolerance = _slippageTolerance;
    }
    
    /**
     * Pause the contract
     */
    function pause() external onlyOwner {
        paused = true;
    }
    
    /**
     * Unpause the contract
     */
    function unpause() external onlyOwner {
        paused = false;
    }
}