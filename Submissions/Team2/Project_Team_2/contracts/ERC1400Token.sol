// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import OpenZeppelin libraries for security
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ERC1400Token is ERC20Burnable, AccessControl, ReentrancyGuard {
    // Define roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant KYC_APPROVED_ROLE = keccak256("KYC_APPROVED_ROLE");

    // Structure to represent an artwork
    struct Artwork {
        string name;
        uint256 totalTokens;
        bool exists;
    }

    // Mapping of artwork name to partitions
    mapping(string => Artwork) private _artworks;
    string[] private _artworkNames; // To track all successfully created artworks

    // Partitioned balances mapping (Investor => Artwork Name => Balance)
    mapping(address => mapping(string => uint256)) private _partitionBalances;

    // KYC Verification
    mapping(address => bool) public isKYCVerified;

    // Events
    event ArtworkCreated(string artwork, uint256 totalTokens);
    event PartitionedTransfer(
        address indexed from,
        address indexed to,
        string artwork,
        uint256 amount
    );
    event KYCVerified(address indexed user);

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender); // Ensure deployer gets default admin role
        _grantRole(ADMIN_ROLE, msg.sender); // Ensure deployer gets admin role
    }

    /**
     * @dev Assign KYC verification to an investor.
     */
    function verifyKYC(address investor) external onlyRole(ADMIN_ROLE) {
        require(!isKYCVerified[investor], "Investor already KYC verified");
        isKYCVerified[investor] = true;
        _grantRole(KYC_APPROVED_ROLE, investor);
        emit KYCVerified(investor);
    }

    /**
     * @dev Create a new partition for an artwork.
     * Each artwork has its own fixed supply of tokens.
     */
    function createPartition(
        string memory artwork,
        uint256 totalTokens,
        address recipient
    ) external onlyRole(ADMIN_ROLE) {
        require(!_artworks[artwork].exists, "Artwork already has a partition");
        require(recipient != address(0), "Invalid recipient address");
        require(isKYCVerified[recipient], "Recipient must be KYC verified"); // ✅ Fix: Ensure recipient is KYC verified

        _artworks[artwork] = Artwork(artwork, totalTokens, true);
        _artworkNames.push(artwork); // ✅ Fix: Only add successfully created artwork

        _mint(recipient, totalTokens); // Mint tokens to the recipient
        _partitionBalances[recipient][artwork] = totalTokens; // Assign tokens to recipient's partition balance

        emit ArtworkCreated(artwork, totalTokens);
    }

    /**
     * @dev Transfer tokens within a specific artwork partition.
     */
    function transferWithinPartition(
        address to,
        string memory artwork,
        uint256 amount
    ) external nonReentrant {
        require(isKYCVerified[msg.sender], "Sender not KYC verified");
        require(isKYCVerified[to], "Recipient not KYC verified");
        require(
            _partitionBalances[msg.sender][artwork] >= amount,
            "Insufficient partition balance"
        );

        // ✅ Sync ERC-20 balances with partition transfers
        _partitionBalances[msg.sender][artwork] -= amount;
        _partitionBalances[to][artwork] += amount;

        // ✅ Make sure ERC-20 balances match partition balances
        _transfer(msg.sender, to, amount);

        emit PartitionedTransfer(msg.sender, to, artwork, amount);
    }

    /**
     * @dev Get balance of a specific artwork partition.
     */
    function getPartitionBalance(
        address investor,
        string memory artwork
    ) external view returns (uint256) {
        return _partitionBalances[investor][artwork];
    }

    /**
     * @dev Get all successfully created artwork partitions.
     */
    function getAllArtworks() external view returns (string[] memory) {
        uint256 count;
        for (uint256 i = 0; i < _artworkNames.length; i++) {
            if (_artworks[_artworkNames[i]].exists) {
                count++;
            }
        }

        string[] memory validArtworks = new string[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < _artworkNames.length; i++) {
            if (_artworks[_artworkNames[i]].exists) {
                validArtworks[index] = _artworkNames[i];
                index++;
            }
        }

        return validArtworks;
    }

    /**
     * @dev Admin burns all tokens of a specific artwork from an account.
     * The account must be KYC verified, hold 100% of the artwork's tokens, and the artwork must exist.
     */
    function burnArtworkTokensFrom(
        address account,
        string memory artwork
    ) public onlyRole(ADMIN_ROLE) {
        require(isKYCVerified[account], "Account is not KYC verified");
        require(_artworks[artwork].exists, "Artwork does not exist");
        require(
            _partitionBalances[account][artwork] ==
                _artworks[artwork].totalTokens,
            "Account does not own 100% of the artwork"
        );

        uint256 amount = _partitionBalances[account][artwork];

        // ✅ Clear partition balance before burning
        _partitionBalances[account][artwork] = 0;

        // ✅ Burn ERC-20 tokens (now correctly synchronized)
        _burn(account, amount);
    }
}
