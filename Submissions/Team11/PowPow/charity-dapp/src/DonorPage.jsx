import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Contract } from "zksync-ethers";
import * as snarkjs from "snarkjs";
import "./styles/donor.css";
import { contractABI, tokenABI } from "./abis.js";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS;

function DonorPage() {
  const [tab, setTab] = useState("donate");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCharity, setSelectedCharity] = useState("");
  const [charities, setCharities] = useState([]);
  const [allCharities, setAllCharities] = useState([]); 
  const [status, setStatus] = useState("");
  const [signer, setSigner] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loadingCharities, setLoadingCharities] = useState(true);
  const [loadingAllCharities, setLoadingAllCharities] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [newCharityAddress, setNewCharityAddress] = useState("");
  const [newCharityName, setNewCharityName] = useState("");
  const [charityToRemove, setCharityToRemove] = useState("");
  const [errors, setErrors] = useState({ name: "", email: "", amount: "" });
  const [selectedHistoryCharity, setSelectedHistoryCharity] = useState("");
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    connectWallet();
  }, []);

  useEffect(() => {
    if (signer) {
      fetchCharities();
      fetchAllCharities();
      checkIfOwner();
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

  const checkIfOwner = async () => {
    try {
      const contract = new Contract(CONTRACT_ADDRESS, contractABI, signer);
      const owner = await contract.owner();
      const currentAddress = await signer.getAddress();
      setIsOwner(owner.toLowerCase() === currentAddress.toLowerCase());
    } catch (error) {
      console.error("Failed to check owner status:", error);
    }
  };

  // Update fetchCharities to handle full struct
  const fetchCharities = async () => {
    if (!signer) return;
    setLoadingCharities(true);
    try {
      const contract = new Contract(CONTRACT_ADDRESS, contractABI, signer);
      const charityList = await contract.getActiveCharities();

      // Properly destructure the returned tuple
      const formattedCharities = charityList.map((charity) => ({
        wallet: charity.wallet,
        name: charity.name,
        exists: charity.exists,
        active: charity.active,
        balance: charity.balance.toString(), 
      }));

      setCharities(formattedCharities);

      if (formattedCharities.length > 0) {
        setSelectedCharity(formattedCharities[0].wallet);
      }
    } catch (error) {
      console.error("Failed to fetch charities:", error);
      setStatus("❌ Failed to load charities");
    } finally {
      setLoadingCharities(false);
    }
  };

  // Update fetchAllCharities to handle full struct
  const fetchAllCharities = async () => {
    if (!signer) return;
    setLoadingAllCharities(true);
    try {
      const contract = new Contract(CONTRACT_ADDRESS, contractABI, signer);
      const charityList = await contract.getCharities();

      // Properly destructure the returned tuple
      const formattedCharities = charityList.map((charity) => ({
        wallet: charity.wallet,
        name: charity.name,
        exists: charity.exists,
        active: charity.active,
        balance: charity.balance.toString(), 
      }));

      setAllCharities(formattedCharities);

      if (formattedCharities.length > 0) {
        setSelectedHistoryCharity(formattedCharities[0].wallet);
        fetchWithdrawals(formattedCharities[0].wallet);
      }
    } catch (error) {
      console.error("Failed to fetch all charities:", error);
    } finally {
      setLoadingAllCharities(false);
    }
  };

  // Update fetchWithdrawals to handle BigNumber amounts
  const fetchWithdrawals = async (charityAddress) => {
    if (!signer || !charityAddress) return;
    try {
      const contract = new Contract(CONTRACT_ADDRESS, contractABI, signer);
      const withdrawalList = await contract.getCharityWithdrawals(
        charityAddress
      );

      // Format withdrawal data
      const formattedWithdrawals = withdrawalList.map((withdrawal) => ({
        charity: withdrawal.charity,
        amount: withdrawal.amount.toString(), 
        purpose: withdrawal.purpose,
        timestamp: withdrawal.timestamp.toString(), 
      }));

      setWithdrawals(formattedWithdrawals);
    } catch (error) {
      console.error("Failed to fetch withdrawals:", error);
    }
  };

  const addCharity = async () => {
    if (!signer) return alert("Connect wallet first");
    if (!newCharityAddress || !newCharityName)
      return alert("Please fill all fields");

    try {
      const contract = new Contract(CONTRACT_ADDRESS, contractABI, signer);
      setStatus("Adding charity...");
      const tx = await contract.addCharity(newCharityAddress, newCharityName);
      await tx.wait();
      setStatus(`✅ Charity ${newCharityName} added successfully!`);
      setNewCharityAddress("");
      setNewCharityName("");
      await Promise.all([fetchCharities(), fetchAllCharities()]);
    } catch (error) {
      console.error("Failed to add charity:", error);
      setStatus(`❌ Failed to add charity: ${error.reason || error.message}`);
    }
  };

  const removeCharity = async () => {
    if (!signer) return alert("Connect wallet first");
    if (!charityToRemove) return alert("Please select a charity to remove");

    try {
      const contract = new Contract(CONTRACT_ADDRESS, contractABI, signer);
      setStatus("Removing charity...");
      const tx = await contract.removeCharity(charityToRemove);
      await tx.wait();
      setStatus(`✅ Charity removed successfully!`);
      setCharityToRemove("");
      await Promise.all([fetchCharities(), fetchAllCharities()]);
    } catch (error) {
      console.error("Failed to remove charity:", error);
      setStatus(
        `❌ Failed to remove charity: ${error.reason || error.message}`
      );
    }
  };

  const validateDonateForm = () => {
    const newErrors = { name: "", email: "", amount: "" };
    if (!name.trim()) newErrors.name = "Name is required.";
    if (!email.trim()) newErrors.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(email))
      newErrors.email = "Invalid email format.";
    if (!amount || parseFloat(amount) <= 0)
      newErrors.amount = "Enter a valid amount.";

    setErrors(newErrors);
    return Object.values(newErrors).every((err) => err === "");
  };

  const generateZkProof = async (nameHash, emailHash, amount) => {
    try {
      setStatus("Generating ZK proof...");
      const input = {
        name_hash: nameHash.toString(),
        email_hash: emailHash.toString(),
        amount: amount.toString(),
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "zk/donation.wasm",
        "zk/donation_final.zkey"
      );

      return {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [
          [proof.pi_b[0][1], proof.pi_b[0][0]],
          [proof.pi_b[1][1], proof.pi_b[1][0]],
        ],
        c: [proof.pi_c[0], proof.pi_c[1]],
        publicInputs: publicSignals.map((x) => x.toString()),
      };
    } catch (error) {
      console.error("ZK Proof generation failed:", error);
      setStatus("❌ ZK Proof generation failed");
      throw error;
    }
  };

  const donate = async () => {
    if (!signer) return alert("Connect wallet first");
    if (!name || !email) return alert("Please enter your name and email");
    if (!selectedCharity) return alert("Please select a charity");

    try {
      const token = new Contract(TOKEN_ADDRESS, tokenABI, signer);
      const contract = new Contract(CONTRACT_ADDRESS, contractABI, signer);

      const decimals = await token.decimals();
      const value = ethers.parseUnits(amount, decimals);

      setStatus("Approving tokens...");
      const approveTx = await token.approve(CONTRACT_ADDRESS, value);
      await approveTx.wait();

      setStatus("Preparing ZK donation...");
      const nameHash = ethers.id(name);
      const emailHash = ethers.id(email);

      const { a, b, c, publicInputs } = await generateZkProof(
        nameHash,
        emailHash,
        amount
      );

      setStatus("Sending ZK donation...");
      const tx = await contract.donate(
        selectedCharity,
        value,
        a,
        b,
        c,
        publicInputs
      );
      await tx.wait();
      setTxHash(tx.hash); // ✅ Store transaction hash
      setStatus(`✅ ZK Donation of ${amount} complete!`);

      setAmount("");
      setName("");
      setEmail("");
    } catch (error) {
      console.error("Donation failed:", error);
      setStatus(`❌ Donation failed: ${error.message}`);
    }
  };

  return (
    <div className="light-blue-gradient-bg">
      {/* Wave Divider */}
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
          <span role="img" aria-label="money">
            💰
          </span>{" "}
          Donor Dashboard
        </h1>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 30,
            justifyContent: "center",
          }}
        >
          {["donate", "charity", "admin"].map((section) =>
            section !== "admin" || isOwner ? (
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
                {section === "donate"
                  ? "Donate"
                  : section === "charity"
                  ? "Charity Fund Usage"
                  : "Admin"}
              </button>
            ) : null
          )}
        </div>

        {tab === "donate" && (
          <>
            <h4 className="mb-4">Make Donation</h4>
            {loadingCharities ? (
              <p>Loading charities...</p>
            ) : (
              <div className="mb-3">
                <label className="form-label">Select Charity</label>
                <select
                  className="form-select"
                  value={selectedCharity}
                  onChange={(e) => setSelectedCharity(e.target.value)}
                >
                  {charities.map((charity) => (
                    <option key={charity.wallet} value={charity.wallet}>
                      {charity.name} ({charity.wallet.slice(0, 6)}...)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label">Your Name</label>
              <input
                type="text"
                className={`form-control ${errors.name ? "is-invalid" : ""}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                onBlur={validateDonateForm}
              />
              {errors.name && (
                <div className="invalid-feedback">{errors.name}</div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label">Your Email</label>
              <input
                type="email"
                className={`form-control ${errors.email ? "is-invalid" : ""}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your Email"
                onBlur={validateDonateForm}
              />
              {errors.email && (
                <div className="invalid-feedback">{errors.email}</div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label">Amount</label>
              <input
                type="number"
                className={`form-control ${errors.amount ? "is-invalid" : ""}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                onBlur={validateDonateForm}
              />
              {errors.amount && (
                <div className="invalid-feedback">{errors.amount}</div>
              )}
            </div>

            <button
              onClick={() => {
                if (validateDonateForm()) donate();
              }}
              className="btn btn-buttons"
            >
              🔒 Donate Privately
            </button>

            <p className="mt-3 text-muted fw-medium">{status}</p>

            
            {status.includes("✅") && txHash && (
              <div className="alert alert-info mt-2 mb-0">
                <a
                  href={`https://sepolia.explorer.zksync.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-decoration-none fw-semibold"
                >
                  🔗 View your transaction on zkSync Explorer
                </a>
              </div>
            )}
          </>
        )}

        {tab === "charity" && (
          <div className="mt-4">
            <h4 className="mb-3">Charity Fund Usage</h4>

            {loadingAllCharities ? (
              <p>Loading charities...</p>
            ) : allCharities.length === 0 ? (
              <p className="text-muted">No charities available.</p>
            ) : (
              <>
                <div className="mb-3">
                  <select
                    className="form-select"
                    value={selectedHistoryCharity}
                    onChange={(e) => {
                      setSelectedHistoryCharity(e.target.value);
                      fetchWithdrawals(e.target.value);
                    }}
                  >
                    {allCharities.map((charity) => (
                      <option key={charity.wallet} value={charity.wallet}>
                        {charity.name} ({charity.wallet.slice(0, 6)}...)
                        {!charity.active && " (Inactive)"}
                      </option>
                    ))}
                  </select>
                </div>

                {Array.isArray(withdrawals) && withdrawals.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Purpose</th>
                          <th>Amount (USDC)</th>
                          <th>Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map((withdrawal, index) => {
                          const charity = allCharities.find(
                            (c) => c.wallet === withdrawal.charity
                          );
                          return (
                            <tr key={index}>
                              <td>{withdrawal.purpose}</td>
                              <td>
                                {ethers.formatUnits(withdrawal.amount, 6)}
                              </td>
                              <td>
                                {new Date(
                                  Number(withdrawal.timestamp) * 1000
                                ).toLocaleDateString()}
                              </td>
                              <td>
                                {charity?.active ? (
                                  <span className="badge bg-success">
                                    Active
                                  </span>
                                ) : (
                                  <span className="badge bg-secondary">
                                    Inactive
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted">
                    No withdrawal data available for this charity.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {tab === "admin" && isOwner && (
          <div className="mt-4">
            <h4 className="mb-4">Admin Panel</h4>

            <div className="mb-5">
              <h5 className="mb-3">Add New Charity</h5>

              <div className="mb-3">
                <label className="form-label">Charity Wallet Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="0x..."
                  value={newCharityAddress}
                  onChange={(e) => setNewCharityAddress(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Charity Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Charity Name"
                  value={newCharityName}
                  onChange={(e) => setNewCharityName(e.target.value)}
                />
              </div>

              <button onClick={addCharity} className="btn btn-success">
                ➕ Add Charity
              </button>
            </div>

            <div>
              <h5 className="mb-3">Remove Charity</h5>
              <div className="mb-3">
                <label className="form-label">Select Charity</label>
                <select
                  className="form-select"
                  value={charityToRemove}
                  onChange={(e) => setCharityToRemove(e.target.value)}
                >
                  <option value="">Select a charity to remove</option>
                  {allCharities
                    .filter((charity) => charity.active)
                    .map((charity) => (
                      <option key={charity.wallet} value={charity.wallet}>
                        {charity.name} ({charity.wallet.slice(0, 6)}...)
                      </option>
                    ))}
                </select>
              </div>
              <button onClick={removeCharity} className="btn btn-danger">
                🗑️ Remove Charity
              </button>
            </div>

            <p className="mt-3 text-muted fw-medium">{status}</p>
          </div>
        )}
      </div>

      <div className="pt-5">
        {/* Footer */}
        <footer className="text-white text-center py-4 sticky-bottom" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
              <div className="mb-2">
              </div>
              <small>© 2025 PowPow Donation. All rights reserved.</small>
        </footer>
      </div>
    </div>
  );
}

export default DonorPage;
