// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract LendingForwarder is EIP712 {
    using ECDSA for bytes32;

    address public admin;
    mapping(address => uint256) public nonces;

    // This is the typehash used for the EIP-712 encoding of the forward request.
    bytes32 private constant _TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
    );

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        uint48 deadline;
        bytes data;
    }

    constructor() EIP712("LendingForwarder", "1") {
        admin = msg.sender;
    }

    /// @notice Verifies the forward request signature.
    /// @param req The forward request data.
    /// @param signature The EIP-712 signature.
    /// @return True if the signature is valid, false otherwise.
    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(_TYPEHASH, req.from, req.to, req.value, req.gas, req.nonce, req.deadline, keccak256(req.data)))
        );
        return req.from == ECDSA.recover(digest, signature) &&
               nonces[req.from] == req.nonce &&
               block.timestamp <= req.deadline;
    }

    /// @notice Executes the meta-transaction on behalf of the user.
    /// @param req The forward request data.
    /// @param signature The EIP-712 signature.
    /// @return success Boolean indicating success and returndata returned from the call.
    function execute(ForwardRequest calldata req, bytes calldata signature) public payable returns (bool success, bytes memory returndata) {
        require(verify(req, signature), "LendingForwarder: signature does not match request");
        nonces[req.from] = req.nonce + 1;

        // Append the sender's address at the end of the call data.
        bytes memory callData = abi.encodePacked(req.data, req.from);

        // solhint-disable-next-line avoid-low-level-calls
        (success, returndata) = req.to.call{gas: req.gas, value: req.value}(callData);
        // Note: We don't check for out-of-gas here as the relayer will handle that.
        return (success, returndata);
    }

    /// @notice Receive function to accept ETH.
    receive() external payable {}
}
