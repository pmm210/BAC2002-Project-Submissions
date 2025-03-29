export const contractABI = [
  // Charity management
  "function addCharity(address _wallet, string memory _name) external",
  "function removeCharity(address _wallet) external",
  "function getCharities() view returns ((address wallet, string name, bool exists, bool active, uint256 balance)[])",
  "function getActiveCharities() view returns ((address wallet, string name, bool exists, bool active, uint256 balance)[])",

  // Charity info function (this was missing)
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "charities",
    outputs: [
      { internalType: "address", name: "wallet", type: "address" },
      { internalType: "string", name: "name", type: "string" },
      { internalType: "bool", name: "exists", type: "bool" },
      { internalType: "bool", name: "active", type: "bool" },
      { internalType: "uint256", name: "balance", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },

  // Donation functions
  "function donate(address _charity, uint256 amount, uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c, uint256[3] calldata publicInputs) external",

  // Withdrawal functions
  "function withdraw(uint256 amount, string memory purpose) external",
  "function getCharityWithdrawals(address charity) view returns ((address charity, uint256 amount, string purpose, uint256 timestamp)[])",

  // Info/utility functions
  "function owner() view returns (address)",
  "function getCharityBalance(address charity) external view returns (uint256)",
  "function getContractBalance() external view returns (uint256)",

  // Events
  "event DonationMade(address indexed charity, uint256 amount, bytes32 commitment)",
  "event WithdrawalMade(address indexed charity, uint256 amount, string purpose)",
  "event CharityAdded(address indexed wallet, string name)",
  "event CharityRemoved(address indexed wallet)",
];

export const tokenABI = [
  // Standard ERC20 functions
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)",
];
