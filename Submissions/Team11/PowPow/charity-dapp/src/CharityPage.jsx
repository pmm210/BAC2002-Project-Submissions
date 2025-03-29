import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useLocation } from "react-router-dom";
import { contractABI } from "./abis.js";
import './styles/charity.css';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

function CharityPage() {
  const [balance, setBalance] = useState("0");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [status, setStatus] = useState("");
  const [signer, setSigner] = useState(null);
  const [charityName, setCharityName] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [tab, setTab] = useState("funds");
  const [errors, setErrors] = useState({ amount: "", purpose: "" });
  const location = useLocation();

  useEffect(() => {
    if (location.state?.isActive !== undefined) {
      setIsActive(location.state.isActive);
    }
    connectWallet();
  }, []);

  useEffect(() => {
    if (signer) {
      fetchCharityInfo();
      fetchWithdrawals();
    }
  }, [signer]);

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Install MetaMask!");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setSigner(signer);
    } catch (error) {
      console.error("Wallet connection failed:", error);
      setStatus("❌ Wallet connection failed");
    }
  };

  const fetchCharityInfo = async () => {
    if (!signer) return;
    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        contractABI,
        signer
      );
      const address = await signer.getAddress();
      const charity = await contract.charities(address);

      setCharityName(charity.name);
      setBalance(ethers.formatUnits(charity.balance, 6)); 
      setIsActive(charity.active);
    } catch (error) {
      console.error("Failed to fetch charity info:", error);
      setStatus("❌ Failed to load charity info");
    }
  };

  const fetchWithdrawals = async () => {
    if (!signer) return;
    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        contractABI,
        signer
      );
      const address = await signer.getAddress();
      const withdrawalList = await contract.getCharityWithdrawals(address);

      const formattedWithdrawals = withdrawalList.map((w) => ({
        amount: ethers.formatUnits(w.amount, 6),
        purpose: w.purpose,
        timestamp: new Date(Number(w.timestamp) * 1000).toLocaleDateString(),
      }));

      setWithdrawals(formattedWithdrawals);
    } catch (error) {
      console.error("Failed to fetch withdrawals:", error);
      setStatus(`❌ Failed to fetch withdrawals: ${error.reason || error.message}`);
    }
  };

  const withdrawFunds = async () => {
    if (!signer) return alert("Connect wallet first");
    if (!withdrawAmount || !purpose) return alert("Fill all fields");

    // Check if balance is sufficient instead of active status
    const currentBalance = parseFloat(balance);
    const withdrawalAmount = parseFloat(withdrawAmount);

    if (withdrawalAmount <= 0) return alert("Amount must be positive");
    if (withdrawalAmount > currentBalance) return alert("Insufficient balance");

    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        contractABI,
        signer
      );
      const amount = ethers.parseUnits(withdrawAmount, 6); 

      setStatus("Processing withdrawal...");
      const tx = await contract.withdraw(amount, purpose);
      await tx.wait();

      setStatus("✅ Withdrawal successful!");
      setWithdrawAmount("");
      setPurpose("");
      await Promise.all([fetchCharityInfo(), fetchWithdrawals()]);
    } catch (error) {
      console.error("Withdrawal failed:", error);
      setStatus(`❌ Withdrawal failed: ${error.reason || error.message}`);
    }
  };

  const validateWithdrawForm = () => {
    const newErrors = { amount: "", purpose: "" };
  
    if (!withdrawAmount.trim()) {
      newErrors.amount = "Amount is required.";
    } else if (!/^\d+$/.test(withdrawAmount)) {
      newErrors.amount = "Only whole numbers are allowed.";
    } else if (parseInt(withdrawAmount) <= 0) {
      newErrors.amount = "Amount must be greater than 0.";
    } else if (parseInt(withdrawAmount) > parseInt(balance)) {
      newErrors.amount = "Amount exceeds your available balance.";
    }
  
    if (!purpose.trim()) {
      newErrors.purpose = "Purpose is required.";
    } else if (!/^[A-Za-z\s]+$/.test(purpose)) {
      newErrors.purpose = "Only letters and spaces are allowed.";
    }    
  
    setErrors(newErrors);
    return Object.values(newErrors).every((e) => e === "");
  };
  

  return (
    <div className="light-blue-gradient-bg">
      <div className="custom-shape-divider-top">
        <svg
          data-name="Layer 1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,
            82.39-16.72,168.19-17.73,250.45-.39C823.78,31,
            906.67,72,985.66,92.83c70.05,18.48,146.53,
            26.09,214.34,3V0H0V27.35A600.21,
            600.21,0,0,0,321.39,56.44Z"
            className="shape-fill wave-animate"
          ></path>
        </svg>
      </div>

      <div className="pt-5 pb-4"></div>
      <div className="pt-5 pb-4"></div>

      <div className="donor-box container shadow-lg p-5 bg-light rounded-4">
        <h1 className="text-center mb-4 mt-3" style={{ color: "#05668D" }}>
          🏦 Charity Dashboard
        </h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 30, justifyContent: "center" }}>
            {['funds', 'history'].map((section) => (
              <button
                key={section}
                onClick={() => setTab(section)}
                style={{
                  padding: "10px 20px",
                  background: tab === section ? "#05668D" : "#DCEEF8",
                  color: tab === section ? "#fff" : "#000004",
                  border: "1px solid transparent",
                  borderBottom: tab === section ? "none" : "2px solid #ccc",
                  borderRadius: "8px 8px 0 0",
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
              >
                {section === 'funds' ? 'Funds' : 'History'}
              </button>
          ))}
      </div>

      <span
        className={`badge px-3 py-2 mb-3 fw-semibold ${
          isActive ? "bg-success text-white" : "bg-warning text-white"
        }`}
        style={{ fontSize: "1rem" }}
      >
        {isActive ? "✅ Active Charity" : "⚠️ Inactive Charity"}
      </span>


    {tab === 'funds' && (
      <>
        <div className="card mb-4">
          <div className="card-body">
            <h2>{charityName}</h2>
            <p>Balance: {balance} USDC</p>
          </div>
        </div>

      {parseFloat(balance) > 0 && (
        <div className="card mb-4">
          <div className="card-body">
            <h4 className="mb-3">Withdraw Funds</h4>
            {!isActive && (
              <div className="alert alert-warning mb-3">
                Note: Your charity is inactive but you can withdraw remaining funds
              </div>
            )}
            <div className="mb-3">
              <label className="form-label">Amount (USDC)</label>
              <input
                type="number"
                min="1"
                step="1"
                className={`form-control ${errors.amount ? "is-invalid" : ""}`}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                onBlur={validateWithdrawForm}
                placeholder="Enter amount"
              />
              {errors.amount && <div className="invalid-feedback">{errors.amount}</div>}
            </div>

            <div className="mb-3">
              <label className="form-label">Purpose</label>
              <input
                type="text"
                className={`form-control ${errors.purpose ? "is-invalid" : ""}`}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                onBlur={validateWithdrawForm}
                placeholder="Purpose of withdrawal"
              />
              {errors.purpose && (
                <div className="invalid-feedback">{errors.purpose}</div>
              )}
            </div>

            <button
              className="btn btn-buttons"
              onClick={() => {
                if (validateWithdrawForm()) withdrawFunds();
              }}
            >
              Withdraw
            </button>

          </div>
        </div>
      )}
    </>
    )}

    {tab === 'history' && (
      <div className="card">
        <div className="card-body">
          <h4 className="mb-3">Withdrawal History</h4>
          {withdrawals.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Purpose</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w, i) => (
                    <tr key={i}>
                      <td>{w.amount} USDC</td>
                      <td>{w.purpose}</td>
                      <td>{w.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">No withdrawals yet</p>
          )}
        </div>
      </div>
    )}

    {status && (
      <div
        className={`alert ${
          status.includes("❌")
            ? "alert-danger"
            : status.includes("✅")
            ? "alert-success"
            : "alert-info"
        } mt-3`}
      >
        {status}
      </div>
    )}
  </div>

  <div className="pt-5">
      {/* Footer */}
      <footer className="text-white text-center py-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
            <div className="mb-2">
            </div>
            <small>© 2025 PowPow Donation. All rights reserved.</small>
      </footer>
    </div>
  </div>
  );
}

export default CharityPage;
