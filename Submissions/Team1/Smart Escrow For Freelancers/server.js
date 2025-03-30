const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
require("dotenv").config();

const { JsonRpcProvider, Contract } = require("ethers"); // ✅ Ethers v6 style

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Declare constants BEFORE using them
const CONTRACT_ADDRESS = "0x8497a70FA8542Ca13B7b4007Bd0a4C1aAbe68eeD";
const CONTRACT_ABI = require("./smartEscrowAbi.json");

const provider = new JsonRpcProvider("https://rpc-amoy.polygon.technology");

const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider); // ✅ NOW safe

// ✅ CORS setup
app.use(
  cors({
    credentials: true,
    origin: "http://localhost",
  })
);

app.use(bodyParser.json());

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  })
);

// ✅ Nonce route
app.post("/auth/nonce", (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: "Address is required" });

  const nonce = `Sign this message to log in: ${Math.floor(
    Math.random() * 1000000
  )}`;
  req.session.nonce = nonce;
  req.session.address = address;

  res.json({ nonce });
});

const FREELANCER_ADDRESS = "0x783E9D210355c77646c9B9fB2256a4727f6633BE";

app.post("/auth/verify", async (req, res) => {
  const { address, signature } = req.body;
  if (!address || !signature) {
    return res.status(400).json({ error: "Missing address or signature" });
  }

  console.log("🔐 Starting verification for:", address);
  console.log("🧾 Session nonce:", req.session.nonce);

  let assignedRole = "client";

  if (address.toLowerCase() === FREELANCER_ADDRESS.toLowerCase()) {
    assignedRole = "freelancer";
  } else {
    try {
      const ownerAddress = await contract.owner(); // ✅ reuse initialized contract
      console.log("🧠 Fetched owner:", ownerAddress);

      if (address.toLowerCase() === ownerAddress.toLowerCase()) {
        assignedRole = "owner";
      }
    } catch (err) {
      console.error("❌ Error fetching contract owner:", err);
      return res.status(500).json({ error: "Owner check failed" });
    }
  }

  if (req.session.nonce && req.session.address === address) {
    req.session.loggedIn = true;
    req.session.role = assignedRole;

    console.log(`✅ Authenticated: ${address} as ${assignedRole}`);
    return res.json({
      success: true,
      message: "User authenticated",
      role: assignedRole,
    });
  } else {
    console.warn("❌ Session missing or mismatched");
    return res.status(401).json({ error: "Invalid session" });
  }
});

// ✅ Logout
app.post("/auth/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: "Logged out successfully" });
});

// ✅ Session check
app.get("/auth/session", (req, res) => {
  if (req.session.loggedIn && req.session.address) {
    res.json({
      loggedIn: true,
      address: req.session.address,
      role: req.session.role,
    });
  } else {
    res.json({ loggedIn: false });
  }
});
const fs = require("fs");
const path = require("path");
const disputeFilePath = path.join(__dirname, "disputes.json");

let disputes = {};

if (fs.existsSync(disputeFilePath)) {
  try {
    const data = fs.readFileSync(disputeFilePath, "utf8");
    disputes = JSON.parse(data);
    console.log("📂 Loaded disputes from disputes.json");
  } catch (err) {
    console.error("❌ Failed to read disputes.json:", err);
  }
}

app.post("/dispute", (req, res) => {
  const { transactionId, reason, hash } = req.body;

  if (
    transactionId === undefined ||
    reason === undefined ||
    hash === undefined
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  disputes[transactionId] = {
    reason,
    hash,
    submittedAt: new Date().toISOString(),
  };

  fs.writeFile(disputeFilePath, JSON.stringify(disputes, null, 2), (err) => {
    if (err) {
      console.error("❌ Failed to write to disputes.json:", err);
      return res.status(500).json({ error: "Dispute not saved" });
    }

    console.log("💬 Dispute saved to disputes.json:", disputes[transactionId]);
    res.json({ success: true });
  });
});

// Fetch all disputes
app.get("/disputes", (req, res) => {
  res.json(disputes);
});

app.get("/dispute/:id", (req, res) => {
  if (req.session.role !== "owner") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const transactionId = req.params.id;
  const dispute = disputes[transactionId];
  if (!dispute) {
    return res.status(404).json({ error: "Dispute not found" });
  }

  res.json(dispute);
});

app.delete("/dispute/:id", (req, res) => {
  const transactionId = req.params.id;

  if (req.session.role !== "owner") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!disputes[transactionId]) {
    return res.status(404).json({ error: "Dispute not found" });
  }

  delete disputes[transactionId];

  fs.writeFile(disputeFilePath, JSON.stringify(disputes, null, 2), (err) => {
    if (err) {
      console.error("❌ Failed to update disputes.json:", err);
      return res.status(500).json({ error: "Failed to delete dispute" });
    }

    console.log(`🗑️ Dispute ID ${transactionId} removed.`);
    res.json({ success: true });
  });
});


// ✅ Start server
app.listen(PORT, () =>
  console.log(`✅ Backend running on http://localhost:${PORT}`)
);
