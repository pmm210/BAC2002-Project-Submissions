let walletAddress = "";

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            document.getElementById("connectWalletBtn").innerText = `Connected: ${accounts[0].slice(0, 6)}...`;
        } catch (error) {
            console.error("User rejected connection");
        }
    } else {
        alert("Please a Web3 wallet!");
    }
}


async function buyInsurance() {
    const flightId = document.getElementById("flightId").value;
    const premiumAmount = document.getElementById("premiumAmount").value;

    if (!flightId || !premiumAmount) {
        alert("Please enter flight ID and premium amount.");
        return;
    }

    const response = await fetch("http://127.0.0.1:5000/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: walletAddress, flight_id: flightId, premium: premiumAmount })
    });

    const data = await response.json();
    alert("Insurance Purchased! Transaction: " + data.transaction);
}
