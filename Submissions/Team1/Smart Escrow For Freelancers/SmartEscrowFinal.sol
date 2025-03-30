// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract SmartEscrowContract is ERC721URIStorage {

    address public owner; // Contract owner

    struct Transaction {
        address client;
        address payable freelancer;
        uint256 totalAmount;
        uint256 milestoneAmount;
        uint8 currentMilestone;
        bool completed;
        bool disputed;
        bool gracePeriodStarted; // Tracks if the grace period has started
        uint256 releaseTime; // Timestamp for auto-release
        bytes32 disputeReasonHash; // Stores hashed reason
    }

    mapping(uint256 => Transaction) public transactions;
    uint256 public transactionCount;
    uint256 public invoiceTokenCount;
    mapping(uint256 => uint256[3]) public milestoneTimestamps;

    // uint256 public constant GRACE_PERIOD = 14 days; 
    uint256 public constant GRACE_PERIOD = 600; // ~10 mins (testing)


    event PaymentReleaseRequested(uint256 transactionId, uint8 milestone, uint256 releaseTime);
    event PaymentReleased(uint256 transactionId, uint8 milestone, uint256 amount);
    event TransactionCompleted(uint256 transactionId);
    event DisputeRaised(uint256 transactionId, address byWho);
    event DisputeResolved(uint256 transactionId, uint8 milestone, bool freelancerWins);

    constructor() ERC721("NFT Invoice", "INV") {
        owner = msg.sender;
    }

  function createTransaction(address payable freelancer) public payable {
    require(msg.value > 0, "Payment must be greater than 0");
    require(freelancer != address(0), "Invalid freelancer address");

    uint256 milestoneAmount = msg.value / 3;

    transactions[transactionCount] = Transaction({
        client: msg.sender,
        freelancer: freelancer,
        totalAmount: msg.value,
        milestoneAmount: milestoneAmount,
        currentMilestone: 0,
        completed: false,
        disputed: false,
        gracePeriodStarted: false,
        releaseTime: 0,
        disputeReasonHash: bytes32(0) // ✅ added this line
    });

    transactionCount++;
}


    //This function should be called in the FRONTEND after file upload
    function startGracePeriod(uint256 transactionId) public {
        Transaction storage txn = transactions[transactionId];
        require(msg.sender == txn.freelancer, "Only freelancer can start the grace period");
        require(!txn.completed, "Transaction already completed");
        require(txn.currentMilestone < 3, "All milestones released");
        require(!txn.gracePeriodStarted, "Grace period already started");

        txn.gracePeriodStarted = true;
        txn.releaseTime = block.timestamp + GRACE_PERIOD; // Set 2-day timer

        emit PaymentReleaseRequested(transactionId, txn.currentMilestone, txn.releaseTime);
    }

    // Auto-execute milestone release after 14 days of grace period
    function autoReleaseMilestone(uint256 transactionId) public {
        Transaction storage txn = transactions[transactionId];
        require(txn.gracePeriodStarted, "Grace period not started");
        require(block.timestamp >= txn.releaseTime, "Grace period not over");
        require(!txn.disputed, "Transaction is under dispute");
        require(!txn.completed, "Transaction already completed");
        require(txn.currentMilestone < 3, "All milestones released");

        // ✅ EFFECTS: Update state before external interaction
        milestoneTimestamps[transactionId][txn.currentMilestone] = block.timestamp;
        txn.currentMilestone++;
        txn.gracePeriodStarted = false;

        emit PaymentReleased(transactionId, txn.currentMilestone, txn.milestoneAmount);

        // ✅ INTERACTIONS: External call AFTER state changes
        (bool success, ) = txn.freelancer.call{value: txn.milestoneAmount}("");
        require(success, "Transfer failed!");

        if (txn.currentMilestone == 3) {
            txn.completed = true;

            uint256 tokenId = invoiceTokenCount;
            invoiceTokenCount++;

            _safeMint(txn.freelancer, tokenId);

            // 🔁 Rename to avoid shadowing
            string memory metadataURI = generateTokenURI(
                tokenId,
                txn.totalAmount,
                txn.milestoneAmount,
                txn.client,
                milestoneTimestamps[transactionId]
            );
            _setTokenURI(tokenId, metadataURI);

            emit TransactionCompleted(transactionId);
        }
    }

    // Dispute System 
    // function raiseDispute(uint256 transactionId) public {
    //     Transaction storage txn = transactions[transactionId];
    //     require(msg.sender == txn.client, "Only client can dispute");
    //     require(!txn.completed, "Transaction already completed");
    //     require(!txn.disputed, "Dispute already raised");

    //     txn.disputed = true;
    //     txn.gracePeriodStarted = false; // Stop the auto-release

    //     emit DisputeRaised(transactionId, msg.sender);
    // }

function raiseDispute(uint256 transactionId, bytes32 reasonHash) public {
    Transaction storage txn = transactions[transactionId];

    require(msg.sender == txn.client, "Only client can dispute");
    require(!txn.completed, "Transaction already completed");
    require(!txn.disputed, "Dispute already raised");

    txn.disputed = true;
    txn.gracePeriodStarted = false;
    txn.disputeReasonHash = reasonHash;

    emit DisputeRaised(transactionId, msg.sender);
}



function resolveDispute(uint256 transactionId, bool freelancerWins) public {
    require(msg.sender == owner, "Only contract owner can resolve disputes");

    Transaction storage txn = transactions[transactionId];
    require(txn.disputed, "No active dispute");
    require(!txn.completed, "Transaction already completed");

    txn.disputed = false;
    txn.gracePeriodStarted = false;
    txn.currentMilestone++;

    if (txn.currentMilestone == 3) {
        txn.completed = true;
        emit TransactionCompleted(transactionId);
    }

    emit DisputeResolved(transactionId, txn.currentMilestone, freelancerWins);

    if (freelancerWins) {
        (bool success, ) = txn.freelancer.call{value: txn.milestoneAmount}("");
        require(success, "Payment to freelancer failed");
    } else {
        (bool success, ) = payable(txn.client).call{value: txn.milestoneAmount}("");
        require(success, "Refund to client failed");
    }
}



    // Generates token URI metadata as JSON string. Image field is an on‑chain generated SVG.
    function generateTokenURI(
        uint256 tokenId, // NFT token ID
        uint256 totalAmount,
        uint256 milestoneAmount,
        address client,
        // address freelancer,
        uint256[3] memory milestones
    ) internal pure returns (string memory) {
        // Format milestone timestamps into a comma-separated string, left in UNIX timestamp for better accuracy
        string memory milestoneString = string(
            abi.encodePacked(
                uint2str(milestones[0]), ", ",
                uint2str(milestones[1]), ", ",
                uint2str(milestones[2])
            )
        );

        // Generate dynamic SVG image
        string memory svg = generateReceiptSVG(totalAmount, milestoneAmount, milestones);
        // string memory svg = generateReceiptSVG(tokenId, totalAmount, milestoneAmount, client, freelancer, milestones);

        // Base64 encode the SVG
        string memory imageURI = string(
            abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg)))
        );

        // Construct the JSON metadata
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "Smart Escrow Receipt #',
                        uint2str(tokenId),
                        '", "description": "This NFT receipt confirms an escrow transaction of ',
                        uint2str(totalAmount),
                        ' wei released in 3 milestone payments.", "attributes": [',
                            '{"trait_type": "Total Amount", "value": "', uint2str(totalAmount), ' wei"}, ',
                            '{"trait_type": "Milestone Amount", "value": "', uint2str(milestoneAmount), ' wei"}, ',
                            '{"trait_type": "Milestone Timestamps", "value": "', milestoneString, '"}, ', // Left in UNIX timestamp for better accuracy
                            '{"trait_type": "Client", "value": "', toAsciiString(client), '"}',
                            // '{"trait_type": "Freelancer", "value": "', toAsciiString(freelancer), '"}',
                        '], "image": "',
                        imageURI,
                        '"}'
                    )
                )
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", json));
    }


    function generateReceiptSVG(
        // uint256 tokenId,
        uint256 totalAmount,
        uint256 milestoneAmount,
        // address client,
        // address freelancer,
        uint256[3] memory milestones
    ) internal pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" style="border: 1px solid #ccc;">',
                    '<style>',
                        '.title {font-size: 14px; font-weight: bold; fill: #000; font-family: "Courier New", monospace;}',
                        '.normal {font-weight: normal;}',
                    '</style>',
                    '<rect x="0" y="0" width="100%" height="100%" fill="#f8f8f8"></rect>',
                    '<text x="20" y="30" class="title">RECEIPT</text>',
                    '<text x="20" y="100" class="title">COMPLETED ON ', uint2str(milestones[2]), '</text>', // Left in UNIX timestamp for better accuracy

                    '<line x1="20" y1="120" x2="280" y2="120" stroke="#000" stroke-dasharray="2,2" />',
                    '<text x="20"  y="145" class="title">Milestones:</text>',
                    '<text x="120"  y="145" class="title normal">3</text>',
                    '<text x="20"  y="165" class="title">Payment per Milestone:</text>',
                    '<text x="20"  y="185" class="title normal">', uint2str(milestoneAmount), ' wei</text>',

                    // Left in UNIX timestamp for better accuracy
                    '<text x="20"  y="205" class="title">Milestones Completed On </text>',
                    '<text x="20"  y="225" class="title normal">#1: ', uint2str(milestones[0]), '</text>',
                    '<text x="20"  y="245" class="title normal">#2: ', uint2str(milestones[1]), '</text>',
                    '<text x="20"  y="265" class="title normal">#3: ', uint2str(milestones[2]), '</text>',

                    '<line x1="20" y1="280" x2="280" y2="280" stroke="#000" stroke-dasharray="2,2" />',
                    '<text x="20"  y="305" class="title">Total:</text>',
                    '<text x="240" y="305" class="title normal" text-anchor="end">', uint2str(totalAmount), ' wei</text>',

                    // '<text x="50%" y="40" text-anchor="middle" class="title">Receipt #', uint2str(tokenId), '</text>',
                    // '<text x="10" y="140" class="info">Client: ', toAsciiString(client), '</text>',
                    // '<text x="10" y="170" class="info">Freelancer: ', toAsciiString(freelancer), '</text>',
                    '</svg>'
                )
            );
    }

    // Converts uint256 to string
    function uint2str(uint256 _i) internal pure returns (string memory str) {
        if (_i == 0) return "0";
            uint256 j = _i;
            uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = _i;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        str = string(bstr);
    }

    // Converts address to ASCII string
    function toAsciiString(address x) internal pure returns (string memory) {
        bytes memory s = new bytes(40);
        for (uint256 i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint160(x) / (2**(8*(19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2*i] = char(hi);
            s[2*i+1] = char(lo);
        }
        return string(s);
    }
    
    // Converts address to string
    function char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 48);
        else return bytes1(uint8(b) + 87);
    }


    function getTransaction(uint256 transactionId) public view returns (
        address client,
        address freelancer,
        uint256 totalAmount,
        uint8 currentMilestone,
        bool completed,
        bool disputed,
        bool gracePeriodStarted,
        uint256 releaseTime
    ) {
        Transaction storage txn = transactions[transactionId];
        return (txn.client, txn.freelancer, txn.totalAmount, txn.currentMilestone, txn.completed, txn.disputed, txn.gracePeriodStarted, txn.releaseTime);
    }


    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
