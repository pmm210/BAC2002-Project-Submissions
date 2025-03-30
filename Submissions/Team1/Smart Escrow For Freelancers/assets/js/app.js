let smartEscrowApp; // Declare globally

// ✅ Fetch ABI JSON first
fetch("smartEscrowAbi.json")
  .then((response) => response.json())
  .then((abi) => {
    const Contracts = {
      SmartEscrowContract: {
        abi: abi,
        address: "0x8497a70FA8542Ca13B7b4007Bd0a4C1aAbe68eeD",
      },
    };

    // ✅ Define the app class
    function SmartEscrowApp(Contract) {
      this.provider = null;
      this.signer = null;
      this.instance = null;
      this.Contract = Contract;
      this.autoReleasePrompted = false;
    }

    // ✅ Attach prototype methods
    SmartEscrowApp.prototype.init = async function (cb) {
      if (typeof window.ethereum !== "undefined") {
        this.web3 = new Web3(window.ethereum);
        try {
          await window.ethereum.request({ method: "eth_requestAccounts" });
          console.log("✅ MetaMask connected!");

          this.instance = new this.web3.eth.Contract(
            this.Contract.abi,
            this.Contract.address
          );
          console.log("✅ Contract instance initialized:", this.instance);
          cb();
        } catch (error) {
          console.error("⛔ MetaMask connection denied:", error);
          alert("MetaMask connection denied!");
        }
      } else {
        alert("❌ MetaMask not detected.");
      }
    };

    SmartEscrowApp.prototype.getOwnerAddress = async function () {
      try {
        const owner = await this.instance.methods.owner().call();
        console.log("📛 Smart contract owner address:", owner);
        return owner;
      } catch (error) {
        console.error("❌ Failed to fetch contract owner:", error);
        return null;
      }
    };

    // ✅ Create Transaction Function
    SmartEscrowApp.prototype.createTransaction = async function (
      freelancerAddress,
      amount,
      cb
    ) {
      if (!window.ethereum) {
        alert("❌ MetaMask is not installed! Please install MetaMask.");
        console.error("❌ MetaMask is not installed.");
        return;
      }

      try {
        // Auto-connect to MetaMask when function is called
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });

        if (!accounts.length) {
          alert("❌ No MetaMask account found. Please connect your wallet.");
          return;
        }

        const userAddress = accounts[0];
        const weiAmount = this.web3.utils.toWei(amount, "ether"); // Convert ETH to Wei

        console.log(
          `📤 Initiating transaction: Sending ${amount} ETH (${weiAmount} Wei) to contract from ${userAddress}`
        );

        // Validate contract instance initialization
        if (!this.instance) {
          this.instance = new this.web3.eth.Contract(
            this.Contract.abi,
            this.Contract.address
          );
          console.log("✅ Contract instance initialized.");
        }

        // Execute transaction
        const transaction = await this.instance.methods
          .createTransaction(freelancerAddress)
          .send({
            from: userAddress,
            value: weiAmount,
            gas: 5000000,
            gasPrice: await this.web3.eth.getGasPrice(),
          });

        console.log("Transaction successful!", transaction);
        alert("Transaction Successful!");

        cb(null, transaction);
      } catch (error) {
        console.error("❌ Transaction failed:", error);
        alert("Transaction failed! Please check MetaMask.");
        cb(error, null);
      }
    };

    SmartEscrowApp.prototype.checkGracePeriodStatus = async function (
      transactionId
    ) {
      try {
        const txn = await this.instance.methods
          .getTransaction(transactionId)
          .call();
        const now = Math.floor(Date.now() / 1000);
        const raiseBtn = document.querySelector(".btn-danger");

        const countdownText = document.createElement("p");
        countdownText.id = "graceCountdown";
        countdownText.style.fontWeight = "bold";

        const graceContainer = document.querySelector(".container.text-center");
        const remaining = txn.releaseTime - now;

        if (txn.gracePeriodStarted) {
          if (remaining > 0) {
            countdownText.innerHTML = `⏳ Grace period ends in: ${remaining}s`;
            raiseBtn.disabled = false;
            raiseBtn.textContent = "Raise Dispute";
          } else {
            countdownText.innerHTML = `⌛ Grace period is over.`;
            raiseBtn.disabled = true;
            raiseBtn.textContent = "Grace Period Over";
          }

          // Avoid duplicate display
          const existing = document.getElementById("graceCountdown");
          if (!existing) graceContainer.appendChild(countdownText);
          else existing.innerHTML = countdownText.innerHTML;
        } else {
          raiseBtn.disabled = false;
          raiseBtn.textContent = "Raise Dispute";
          const existing = document.getElementById("graceCountdown");
          if (existing) existing.remove();
        }
      } catch (err) {
        console.error("Error checking grace period:", err);
      }
    };

    SmartEscrowApp.prototype.startGracePeriod = async function (transactionId) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        const currentUser = accounts[0];

        const txn = await this.instance.methods
          .getTransaction(transactionId)
          .call();

        console.log("👤 Current Wallet:", currentUser);
        console.log("🎯 Transaction ID:", transactionId);
        console.log("🧾 Fetched Transaction:", txn);

        if (currentUser.toLowerCase() !== txn.freelancer.toLowerCase()) {
          alert("❌ Only the freelancer can start the grace period.");
          return;
        }

        if (txn.completed) {
          alert("❌ Transaction already completed.");
          return;
        }

        if (txn.gracePeriodStarted) {
          alert("❌ Grace period already started.");
          return;
        }

        const txReceipt = await this.instance.methods
          .startGracePeriod(transactionId)
          .send({
            from: currentUser,
            gas: 300000,
            gasPrice: await this.web3.eth.getGasPrice(), // 🛠️ optional, but keeps it dynamic
          });

        console.log("✅ Grace period started:", txReceipt);
        alert("✅ Grace period started.");
      } catch (err) {
        console.error("Failed to start grace period:", err);
        alert(
          "❌ Could not start grace period. Check transaction validity or MetaMask."
        );
      }
    };

    // Trigger auto-release
    SmartEscrowApp.prototype.tryAutoRelease = async function (transactionId) {
      try {
        const txn = await this.instance.methods
          .getTransaction(transactionId)
          .call();
        const now = Math.floor(Date.now() / 1000);

        console.log(
          "🔎 Checking auto-release eligibility for transaction:",
          transactionId
        );
        console.log("⏳ gracePeriodStarted:", txn.gracePeriodStarted);
        console.log("⌚ currentTime:", now, "| releaseTime:", txn.releaseTime);
        console.log("⚖️ disputed:", txn.disputed);
        console.log("✅ completed:", txn.completed);
        console.log("🏁 currentMilestone:", txn.currentMilestone);

        // ✅ Early exits to avoid errors
        if (txn.completed || txn.currentMilestone >= 3) return;
        if (
          !txn.gracePeriodStarted ||
          txn.disputed ||
          now < parseInt(txn.releaseTime)
        )
          return;

        // ✅ Prevent repeated MetaMask prompts
        if (this.autoReleasePrompted) return;

        this.autoReleasePrompted = true;

        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        const receipt = await this.instance.methods
          .autoReleaseMilestone(transactionId)
          .send({
            from: accounts[0],
            gas: 300000,
            gasPrice: await this.web3.eth.getGasPrice(),
          });

        console.log("✅ Auto-release executed successfully:", receipt);
        alert("✅ Funds auto-released to freelancer.");

        // ✅ Stop polling after execution
        if (this.autoReleaseInterval) clearInterval(this.autoReleaseInterval);
      } catch (err) {
        console.error("❌ Auto-release failed:", err.message || err);
        alert("❌ Auto-release failed. See console for details.");
        if (this.autoReleaseInterval) clearInterval(this.autoReleaseInterval);
      }
    };

    SmartEscrowApp.prototype.fetchMilestone = async function () {
      const transactionId = document.getElementById("transactionId").value;
      if (!transactionId) return alert("Please enter a transaction ID.");

      try {
        const result = await this.instance.methods
          .getTransaction(transactionId)
          .call();

        const currentMilestone = result.currentMilestone;
        const isCompleted = result.completed === true || currentMilestone >= 3;

        const progressPercent = (currentMilestone / 3) * 100;

        // 🔄 Update progress bar and milestone number
        document.getElementById(
          "progressBar"
        ).style.width = `${progressPercent}%`;
        document.getElementById(
          "progressBar"
        ).innerText = `${progressPercent}%`;
        document.getElementById(
          "milestoneText"
        ).innerText = `${currentMilestone}`;

        // 🔄 Set form values
        document.querySelectorAll(".milestoneNumber").forEach((field) => {
          field.value = currentMilestone;
        });
        document.querySelectorAll(".clientAddress").forEach((field) => {
          field.value = result.client;
        });

        // 🔄 Set dispute status
        document.querySelectorAll("#disputeStatus").forEach((field) => {
          field.value = result.disputed ? "🚨 Dispute Raised" : "No Dispute";
        });

        // Optional: show a message visually
        if (result.disputed) {
          const container = document.querySelector(".container.text-center");
          if (!document.getElementById("disputeBanner")) {
            const banner = document.createElement("p");
            banner.id = "disputeBanner";
            banner.className = "text-danger font-weight-bold";
            banner.innerText =
              "⚠️ A dispute has been raised for this milestone!";
            container.appendChild(banner);
          }
        }

        const freelancerSection = document.querySelector(".container.mt-4");
        const msgId = "completionMessage";

        if (isCompleted) {
          freelancerSection.style.display = "none";

          let msg = document.getElementById(msgId);
          if (!msg) {
            msg = document.createElement("p");
            msg.id = msgId;
            msg.className = "text-success font-weight-bold";
            msg.innerText =
              "🎉 Project completed. No further submissions required.";
            document.querySelector(".container.text-center").appendChild(msg);
          }
        } else {
          // ✅ Only show if user is freelancer
          const sessionRes = await fetch("http://localhost:5000/auth/session", {
            credentials: "include",
          });
          const sessionData = await sessionRes.json();

          if (sessionData.role === "freelancer") {
            freelancerSection.style.display = "block";
          } else {
            freelancerSection.style.display = "none";
          }

          const msg = document.getElementById(msgId);
          if (msg) msg.remove();
        }

        await this.checkGracePeriodStatus(transactionId);
      } catch (error) {
        console.error("Error fetching milestone:", error);
        alert("Transaction ID not found or contract error.");
      }
    };

    SmartEscrowApp.prototype.raiseDispute = async function (transactionId) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        const currentUser = accounts[0];

        const txn = await this.instance.methods
          .getTransaction(transactionId)
          .call();

        if (currentUser.toLowerCase() !== txn.client.toLowerCase()) {
          alert("❌ Only the client can raise a dispute.");
          return;
        }

        if (txn.completed) {
          alert("❌ Transaction already completed.");
          return;
        }

        if (txn.disputed) {
          alert("⚠️ Dispute already raised.");
          return;
        }

        await this.instance.methods.raiseDispute(transactionId).send({
          from: currentUser,
          gas: 200000,
          gasPrice: await this.web3.eth.getGasPrice(),
        });

        alert("🚨 Dispute raised successfully.");

        if (this.autoReleaseInterval) {
          clearInterval(this.autoReleaseInterval);
          console.log("⛔ Auto-release polling stopped due to dispute.");
        }

        // ✅ Redirect to dispute form with transactionId as a query param
        window.location.href = `disputeForm.html?transactionId=${transactionId}`;
      } catch (err) {
        console.error("❌ Failed to raise dispute:", err);
        alert("❌ Failed to raise dispute. Please check MetaMask.");
      }
    };

    // ✅ Initialize SmartEscrowApp
    smartEscrowApp = new SmartEscrowApp(Contracts.SmartEscrowContract);
    smartEscrowApp.init(() => {
      console.log("✅ SmartEscrowApp initialized.");

      // ✅ Attach event listener after initialization
      $(document).on("click", "#hireJohnDoe", async function () {
        const freelancerAddress = "0x783E9D210355c77646c9B9fB2256a4727f6633BE"; // Freelancer's address
        const fixedAmount = "0.0001"; // Default amount in POL

        console.log("🔍 Default Transaction Amount:", fixedAmount, "POL");

        try {
          await smartEscrowApp.createTransaction(
            freelancerAddress,
            fixedAmount,
            function (error, tx) {
              if (!error) {
                $("#transactionStatus").text(
                  "✅ Transaction Successful! TX Hash: ${tx.transactionHash}"
                );
              } else {
                $("#transactionStatus").text(
                  "❌ Transaction failed! Check MetaMask."
                );
              }
            }
          );
        } catch (error) {
          console.error("❌ Error executing transaction:", error);
        }
      });
    });
  });
