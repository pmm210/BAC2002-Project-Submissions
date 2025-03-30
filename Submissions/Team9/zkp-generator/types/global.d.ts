export {}; // Ensure this file is treated as a module

declare global {
  interface Window {
    ethereum?: any; // Declare MetaMask's window.ethereum
  }
}
