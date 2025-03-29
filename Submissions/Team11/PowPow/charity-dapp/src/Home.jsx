import { useState } from "react";
import { ethers } from "ethers";
import { useNavigate } from "react-router-dom";
import "./styles/home.css";

// Get contract address from environment variable
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const CONTRACT_ABI = [
  "function charities(address) view returns (address wallet, string name, bool exists)",
  "function getCharities() view returns (tuple(address wallet, string name, bool exists)[])",
];

function Home() {
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Install MetaMask!");
    if (!CONTRACT_ADDRESS) {
      setStatus("❌ Contract address not configured");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

      const charityInfo = await contract.charities(userAddress);

      if (charityInfo.exists) {
        // Both active and inactive charities go to charity page
        setStatus(
          charityInfo.active
            ? `✅ Connected as active charity: ${charityInfo.name}`
            : `⚠️ Connected as inactive charity: ${charityInfo.name}`
        );
        navigate("/charity", { state: { isActive: charityInfo.active } });
      } else {
        setStatus("🔗 Connected as donor");
        navigate("/donor");
      }
    } catch (error) {
      console.error("Connection failed:", error);
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  return (
    <>
      <div className="light-blue-gradient-bg position-relative">
        {/* Animated Wave Divider Top */}
        <div className="custom-shape-divider-top">
          <svg
            data-name="Layer 1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
              className="shape-fill wave-animate"
            ></path>
          </svg>
        </div>
        <div className="pt-5 pb-5"></div>
        <div className="pt-2 text-center">
          {/* Logo Image */}
          <img
            src="/src/assets/powpow.png"
            alt="PowPow Charity Logo"
            style={{
              width: "180px",
              height: "auto",
              marginBottom: "1.5rem",
              borderRadius: "1rem",
            }}
          />
        </div>

        {/* Hero */}
        <div className="pt-3 pb-4 text-center">
          <h1 style={{ color: "#05668D" }} className="display-3 fw-bold mb-3">
            Welcome to PowPow Donations
          </h1>
          <p className="lead text-dark mb-4">
            Private donations with zero-knowledge proofs
          </p>
          <button
            className="btn btn-softblue btn-lg px-4 py-2 fw-semibold"
            onClick={connectWallet}
          >
            🔌 Connect with MetaMask
          </button>
          {status && <p className="mt-3 fw-semibold text-muted">{status}</p>}
        </div>

        <hr className="my-5 border-dark border-opacity-50" />

        {/* How It Works */}
        <div className="container pt-3 pb-5">
          <h2 style={{ color: "#05668D" }} className="text-center mb-5">
            How It Works
          </h2>
          <div className="row g-4">
            <div className="col-md-4">
              <div className="card soft-card h-100 text-center p-4">
                <div className="fs-1 mb-3">🔐</div>
                <h5 className="fw-bold">Connect Wallet</h5>
                <p className="text-muted">
                  Securely log in using MetaMask on zkSync.
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card soft-card h-100 text-center p-4">
                <div className="fs-1 mb-3">💖</div>
                <h5 className="fw-bold">Donate Anonymously</h5>
                <p className="text-muted">
                  Support causes without revealing your identity.
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card soft-card h-100 text-center p-4">
                <div className="fs-1 mb-3">📊</div>
                <h5 className="fw-bold">Track Funds</h5>
                <p className="text-muted">
                  View charity spending on-chain via dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>

        <hr className="my-5 border-dark border-opacity-50" />

        {/* Why ZK? */}
        <div className="container pt-3 pb-5" style={{ maxWidth: "800px" }}>
          <h2 style={{ color: "#05668D" }} className="text-center mb-5">
            Why ZK Matters
          </h2>
          <div className="accordion accordion-flush" id="zkAccordion">
            <div className="accordion-item">
              <h2 className="accordion-header" id="zkHeadingOne">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#zkCollapseOne"
                  aria-expanded="false"
                  aria-controls="zkCollapseOne"
                >
                  🕵️ Total Privacy
                </button>
              </h2>
              <div
                id="zkCollapseOne"
                className="accordion-collapse collapse"
                aria-labelledby="zkHeadingOne"
                data-bs-parent="#zkAccordion"
              >
                <div className="accordion-body">
                  Our system ensures donor identity is never exposed to the
                  public or recipient. Privacy-preserving zero-knowledge proofs
                  allow participation without compromising personal data —
                  perfect for those who value confidentiality in their
                  charitable actions.
                </div>
              </div>
            </div>

            <div className="accordion-item">
              <h2 className="accordion-header" id="zkHeadingTwo">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#zkCollapseTwo"
                  aria-expanded="false"
                  aria-controls="zkCollapseTwo"
                >
                  📖 Transparent Use
                </button>
              </h2>
              <div
                id="zkCollapseTwo"
                className="accordion-collapse collapse"
                aria-labelledby="zkHeadingTwo"
                data-bs-parent="#zkAccordion"
              >
                <div className="accordion-body">
                  All transactions are recorded on-chain and publicly
                  verifiable, ensuring that every donated token is tracked.
                  While donor identities remain private, charities remain
                  accountable for how funds are used — striking the perfect
                  balance between anonymity and transparency.
                </div>
              </div>
            </div>

            <div className="accordion-item">
              <h2 className="accordion-header" id="zkHeadingThree">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#zkCollapseThree"
                  aria-expanded="false"
                  aria-controls="zkCollapseThree"
                >
                  🧠 Cryptographic Integrity
                </button>
              </h2>
              <div
                id="zkCollapseThree"
                className="accordion-collapse collapse"
                aria-labelledby="zkHeadingThree"
                data-bs-parent="#zkAccordion"
              >
                <div className="accordion-body">
                  Zero-knowledge proofs rely on advanced cryptography to prove
                  facts without revealing the underlying data. This keeps
                  donation logic verifiable and tamper-proof, minimizing fraud
                  and reinforcing the credibility of every transaction on our
                  platform.
                </div>
              </div>
            </div>

            <div className="accordion-item">
              <h2 className="accordion-header" id="zkHeadingFour">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#zkCollapseFour"
                  aria-expanded="false"
                  aria-controls="zkCollapseFour"
                >
                  🌍 Inclusive Giving
                </button>
              </h2>
              <div
                id="zkCollapseFour"
                className="accordion-collapse collapse"
                aria-labelledby="zkHeadingFour"
                data-bs-parent="#zkAccordion"
              >
                <div className="accordion-body">
                  Anyone with a Metamask wallet — regardless of geography or
                  background — can contribute. ZK proofs remove traditional
                  identity verification barriers, empowering people from
                  underserved communities to give or receive help with dignity
                  and ease.
                </div>
              </div>
            </div>

            <div className="accordion-item">
              <h2 className="accordion-header" id="zkHeadingFive">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#zkCollapseFive"
                  aria-expanded="false"
                  aria-controls="zkCollapseFive"
                >
                  🔒 Trustless Assurance
                </button>
              </h2>
              <div
                id="zkCollapseFive"
                className="accordion-collapse collapse"
                aria-labelledby="zkHeadingFive"
                data-bs-parent="#zkAccordion"
              >
                <div className="accordion-body">
                  With smart contracts and zkSNARKs, donors don't have to rely
                  on third-party auditors or intermediaries. The system is
                  mathematically guaranteed to behave as expected — providing
                  peace of mind and reducing overhead for everyone involved.
                </div>
              </div>
            </div>
          </div>
        </div>

        <hr className="my-5 border-dark border-opacity-50" />

        {/* Quote or Social Proof */}
        <div className="pt-4 pb-5 text-center">
          <div className="quote-box mx-auto">
            <i className="bi bi-chat-quote-fill quote-icon mb-3"></i>
            <blockquote className="blockquote">
              <p className="fs-4 fst-italic text-dark">
                “Transparency and privacy can coexist — PowPow Donation proves
                that.”
              </p>
            </blockquote>
            <footer className="blockquote-footer text-muted mt-2">
              — Ms Boomchikapow
            </footer>
          </div>
        </div>

        {/* Footer */}
        <footer
          className="text-white text-center py-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
        >
          <div className="mb-2"></div>
          <small>© 2025 PowPow Donation. All rights reserved.</small>
        </footer>
      </div>
    </>
  );
}

export default Home;
