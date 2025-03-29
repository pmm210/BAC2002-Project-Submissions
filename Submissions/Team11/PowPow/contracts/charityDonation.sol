// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./verifier.sol";

contract CharityDonation is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public stablecoin;
    Groth16Verifier public zkVerifier;

    struct Charity {
        address wallet;
        string name;
        bool exists;
        bool active;
        uint256 balance;
    }

    struct Donation {
        address charity;
        uint256 amount;
        bytes32 commitment;
        uint256 timestamp;
    }

    struct Withdrawal {
        address charity;
        uint256 amount;
        string purpose;
        uint256 timestamp;
    }

    mapping(address => Charity) public charities;
    Donation[] public allDonations;
    Withdrawal[] public allWithdrawals;
    address[] public charityList;

    event DonationMade(address indexed charity, uint256 amount, bytes32 commitment);
    event WithdrawalMade(address indexed charity, uint256 amount, string purpose);
    event CharityAdded(address indexed wallet, string name);
    event CharityRemoved(address indexed wallet);
    event CharityDeactivated(address indexed wallet);

    constructor(address _stablecoin, address _verifier) Ownable(msg.sender) {
        stablecoin = IERC20(_stablecoin);
        zkVerifier = Groth16Verifier(_verifier);
    }

    // Add/remove charities (admin-only)
    function addCharity(address _wallet, string memory _name) external onlyOwner {
        require(_wallet != address(0), "Zero address");
        require(!charities[_wallet].exists, "Charity already exists");
        require(bytes(_name).length > 0 && bytes(_name).length <= 128, "Invalid name length");
        
        charities[_wallet] = Charity(_wallet, _name, true, true, 0);
        charityList.push(_wallet);
        emit CharityAdded(_wallet, _name);
    }

    function removeCharity(address _wallet) external onlyOwner {
        require(charities[_wallet].exists, "Charity not found");
        require(charities[_wallet].active, "Charity already inactive");
        
        charities[_wallet].active = false;
        emit CharityRemoved(_wallet);
        emit CharityDeactivated(_wallet);
    }

    function getActiveCharities() external view returns (Charity[] memory) {
        uint activeCount = 0;
        for (uint i = 0; i < charityList.length; i++) {
            if (charities[charityList[i]].active) {
                activeCount++;
            }
        }

        Charity[] memory result = new Charity[](activeCount);
        uint index = 0;
        for (uint i = 0; i < charityList.length; i++) {
            if (charities[charityList[i]].active) {
                result[index] = charities[charityList[i]];
                index++;
            }
        }
        return result;
    }

    function donate(
        address _charity,
        uint256 amount,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[3] calldata publicInputs
    ) external nonReentrant {
        require(charities[_charity].exists && charities[_charity].active, "Invalid or inactive charity");
        require(amount > 0, "Amount must be > 0");
        
        // SafeERC20 transfer - will automatically revert on failure
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);
        
        require(zkVerifier.verifyProof(a, b, c, publicInputs), "Invalid proof");

        charities[_charity].balance += amount;
        bytes32 commitment = keccak256(abi.encodePacked(
            publicInputs[0], 
            publicInputs[1], 
            publicInputs[2], 
            msg.sender
        ));
        
        allDonations.push(Donation(_charity, amount, commitment, block.timestamp));
        emit DonationMade(_charity, amount, commitment);
    }

    function withdraw(uint256 amount, string memory purpose) external nonReentrant {
        require(charities[msg.sender].exists, "Not a charity");
        require(charities[msg.sender].balance >= amount, "Insufficient allocated balance");
        require(bytes(purpose).length > 0 && bytes(purpose).length <= 256, "Invalid purpose length");

        charities[msg.sender].balance -= amount;
        
        // SafeERC20 transfer - will revert automatically on failure
        stablecoin.safeTransfer(msg.sender, amount);
        
        allWithdrawals.push(Withdrawal(msg.sender, amount, purpose, block.timestamp));
        emit WithdrawalMade(msg.sender, amount, purpose);
    }

    // Emergency withdraw for owner to recover funds
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function getCharityBalance(address charity) external view returns (uint256) {
        require(charities[charity].exists, "Charity not found");
        return charities[charity].balance;
    }

    function getContractBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }

    function getCharities() external view returns (Charity[] memory) {
        Charity[] memory result = new Charity[](charityList.length);
        for (uint i = 0; i < charityList.length; i++) {
            result[i] = charities[charityList[i]];
        }
        return result;
    }

    function getCharityWithdrawals(address charity) external view returns (Withdrawal[] memory) {
        uint count = 0;
        for (uint i = 0; i < allWithdrawals.length; i++) {
            if (allWithdrawals[i].charity == charity) count++;
        }

        Withdrawal[] memory result = new Withdrawal[](count);
        uint index = 0;
        for (uint i = 0; i < allWithdrawals.length; i++) {
            if (allWithdrawals[i].charity == charity) {
                result[index] = allWithdrawals[i];
                index++;
            }
        }
        return result;
    }
}