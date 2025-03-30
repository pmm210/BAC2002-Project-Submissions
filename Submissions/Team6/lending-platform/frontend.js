const { ethers } = require("ethers");
const inquirer = require("inquirer");
require("dotenv").config();

// Import contract ABIs
const forwarderABI = require("./artifacts/contracts/LendingForwarder.sol/LendingForwarder.json").abi;
const lendingABI = require("./artifacts/contracts/LendingPlatform.sol/LendingPlatform.json").abi;

const MIN_COLLATERAL_RATIO = 150n;


// ------------------------
// Helper Functions for Each Action
// ------------------------

// Request a new loan via meta-transaction
async function requestLoan(forwarderContract, lendingContract, wallet, interestRate, duration, collateralBNB) {
  try {
    const collateralValue = ethers.parseEther(collateralBNB); // returns a BigInt
    // // Calculate principal using BigInt arithmetic
    // const principal = (collateralValue * 100n) / MIN_COLLATERAL_RATIO;
    
    // // Get the latest price and convert it to BigInt
    // const priceBigInt = BigInt(await lendingContract.getLatestPrice());
    // // Here, we assume your normalization factor is 1e26
    // const normalizationFactor = 100000000000000000000000000n; // 1e26 as a BigInt
    
    // // Calculate principal in USD (both principal and price are now BigInts)
    // const principalUSD = (principal * priceBigInt) / normalizationFactor;
    
    // if (principalUSD < 1n) {
    //   console.log("Warning: The resulting principal is too small (below $1). Please increase your collateral.");
    //   return;
    // }
    
    const encodedFunctionData = lendingContract.interface.encodeFunctionData("requestLoan", [
      interestRate,
      duration,
    ]);

    const nonceBigInt = await forwarderContract.nonces(wallet.address);
    const nonce = Number(nonceBigInt);
    console.log("RequestLoan - Current Nonce:", nonce);

    const deadlineTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const message = {
      from: ethers.getAddress(wallet.address),
      to: lendingContract.target,
      value: collateralValue,
      gas: 2_000_000,
      nonce: nonce,
      deadline: deadlineTimestamp,
      data: encodedFunctionData,
    };

    const domain = {
      name: "LendingForwarder",
      version: "1",
      chainId: 97,
      verifyingContract: forwarderContract.target,
    };

    const types = {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint48" },
        { name: "data", type: "bytes" },
      ],
    };

    const signature = await wallet.signTypedData(domain, types, message);
    const requestObj = { ...message, signature };

    console.log("RequestLoan - Message:", message);
    console.log("RequestLoan - Signature:", signature);

    const isValid = await forwarderContract.verify(requestObj, signature);
    console.log("RequestLoan - Signature is valid?", isValid);
    if (!isValid) {
      console.log("RequestLoan - Invalid signature — aborting.");
      return;
    }

    const callData = forwarderContract.interface.encodeFunctionData("execute", [requestObj, signature]);
    const txRequest = { to: forwarderContract.target, data: callData, value: collateralValue };

    let estimatedGas;
    try {
      estimatedGas = await wallet.provider.estimateGas(txRequest);
      console.log("RequestLoan - Estimated Gas:", estimatedGas.toString());
    } catch (err) {
      console.error("RequestLoan - Error estimating gas:", err);
      return;
    }
    const gasLimit = estimatedGas + 6000000n;
    const gasPrice = ethers.parseUnits("2", "gwei");

    console.log("RequestLoan - Using Gas Limit:", gasLimit.toString());
    console.log("RequestLoan - Using Gas Price:", gasPrice.toString());

    const tx = await forwarderContract.execute(requestObj, signature, { gasLimit, gasPrice, value: collateralValue });
    const receipt = await tx.wait();
    console.log("✅ Loan request meta-transaction successful! Tx Hash:", receipt.hash);
  } catch (err) {
    console.error("RequestLoan - Unhandled error:", err);
  }
}

// Repay an existing loan via meta-transaction
async function repayLoan(forwarderContract, lendingContract, wallet, loanId, repaymentBNB) {
  try {
    const repaymentValue = ethers.parseEther(repaymentBNB);
    const encodedFunctionData = lendingContract.interface.encodeFunctionData("repayLoan", [loanId]);

    const nonceBigInt = await forwarderContract.nonces(wallet.address);
    const nonce = Number(nonceBigInt);
    console.log("RepayLoan - Current Nonce:", nonce);

    const deadlineTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const message = {
      from: ethers.getAddress(wallet.address),
      to: lendingContract.target,
      value: repaymentValue,
      gas: 2_000_000,
      nonce: nonce,
      deadline: deadlineTimestamp,
      data: encodedFunctionData,
    };

    const domain = {
      name: "LendingForwarder",
      version: "1",
      chainId: 97,
      verifyingContract: forwarderContract.target,
    };

    const types = {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint48" },
        { name: "data", type: "bytes" },
      ],
    };

    const signature = await wallet.signTypedData(domain, types, message);
    const requestObj = { ...message, signature };

    console.log("RepayLoan - Message:", message);
    console.log("RepayLoan - Signature:", signature);

    const isValid = await forwarderContract.verify(requestObj, signature);
    console.log("RepayLoan - Signature is valid?", isValid);
    if (!isValid) {
      console.log("RepayLoan - Invalid signature — aborting.");
      return;
    }

    const callData = forwarderContract.interface.encodeFunctionData("execute", [requestObj, signature]);
    const txRequest = { to: forwarderContract.target, data: callData, value: repaymentValue };

    let estimatedGas;
    try {
      estimatedGas = await wallet.provider.estimateGas(txRequest);
      console.log("RepayLoan - Estimated Gas:", estimatedGas.toString());
    } catch (err) {
      console.error("RepayLoan - Error estimating gas:", err);
      return;
    }
    const gasLimit = estimatedGas + 600000n;
    const gasPrice = ethers.parseUnits("2", "gwei");

    console.log("RepayLoan - Using Gas Limit:", gasLimit.toString());
    console.log("RepayLoan - Using Gas Price:", gasPrice.toString());

    const tx = await forwarderContract.execute(requestObj, signature, { gasLimit, gasPrice, value: repaymentValue });
    const receipt = await tx.wait();
    console.log("✅ Repay meta-transaction successful! Tx Hash:", receipt.hash);
  } catch (err) {
    console.error("RepayLoan - Unhandled error:", err);
  }
}

// Liquidate a loan via meta-transaction (admin-only)
async function liquidateLoan(forwarderContract, lendingContract, wallet, loanId) {
  try {
    const encodedFunctionData = lendingContract.interface.encodeFunctionData("liquidateLoan", [loanId]);

    const nonceBigInt = await forwarderContract.nonces(wallet.address);
    const nonce = Number(nonceBigInt);
    console.log("LiquidateLoan - Current Nonce:", nonce);

    const deadlineTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const message = {
      from: ethers.getAddress(wallet.address),
      to: lendingContract.target,
      value: 0,
      gas: 2_000_000,
      nonce: nonce,
      deadline: deadlineTimestamp,
      data: encodedFunctionData,
    };

    const domain = {
      name: "LendingForwarder",
      version: "1",
      chainId: 97,
      verifyingContract: forwarderContract.target,
    };

    const types = {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint48" },
        { name: "data", type: "bytes" },
      ],
    };

    const signature = await wallet.signTypedData(domain, types, message);
    const requestObj = { ...message, signature };

    console.log("LiquidateLoan - Message:", message);
    console.log("LiquidateLoan - Signature:", signature);

    const isValid = await forwarderContract.verify(requestObj, signature);
    console.log("LiquidateLoan - Signature is valid?", isValid);
    if (!isValid) {
      console.log("LiquidateLoan - Invalid signature — aborting.");
      return;
    }

    const callData = forwarderContract.interface.encodeFunctionData("execute", [requestObj, signature]);
    const txRequest = { to: forwarderContract.target, data: callData, value: 0 };

    let estimatedGas;
    try {
      estimatedGas = await wallet.provider.estimateGas(txRequest);
      console.log("LiquidateLoan - Estimated Gas:", estimatedGas.toString());
    } catch (err) {
      console.error("LiquidateLoan - Error estimating gas:", err);
      return;
    }
    const gasLimit = estimatedGas + 600000n;
    const gasPrice = ethers.parseUnits("2", "gwei");

    console.log("LiquidateLoan - Using Gas Limit:", gasLimit.toString());
    console.log("LiquidateLoan - Using Gas Price:", gasPrice.toString());

    const tx = await forwarderContract.execute(requestObj, signature, { gasLimit, gasPrice, value: 0 });
    const receipt = await tx.wait();
    console.log("✅ Liquidate meta-transaction successful! Tx Hash:", receipt.hash);
  } catch (err) {
    console.error("LiquidateLoan - Unhandled error:", err);
  }
}

// Check the current Chainlink price using the LendingPlatform's getLatestPrice function
async function checkPrice(lendingContract) {
  try {
    const price = await lendingContract.getLatestPrice();
    console.log("Chainlink BNB/USD Price (raw):", price.toString());
    console.log("Chainlink BNB/USD Price:", Number(price) / 1e8);
  } catch (err) {
    console.error("Error fetching Chainlink price:", err);
  }
}

// List all loans for your wallet
async function listLoans(lendingContract, wallet) {
  try {
    console.log("Fetching loans for wallet:", wallet.address);
    const loanIds = await lendingContract.getLoans(wallet.address);
    if (loanIds.length === 0) {
      console.log("No loans found for your wallet.");
      return;
    }
    for (const loanId of loanIds) {
      const loan = await lendingContract.loans(loanId);
      console.log(`\nLoan ID: ${loanId}`);
      console.log(`Borrower: ${loan.borrower}`);
      console.log(`Principal: ${ethers.formatEther(loan.principal)} BNB`);
      console.log(`Collateral: ${ethers.formatEther(loan.collateral)} BNB`);
      console.log(`Interest Rate: ${loan.interestRate}%`);
      console.log(`Due Date: ${new Date(Number(loan.dueDate) * 1000).toLocaleString()}`);
      console.log(`Repaid: ${loan.isRepaid}`);
    }
  } catch (err) {
    console.error("ListLoans - Unhandled error:", err);
  }
}

// Get detailed information about a specific loan.
async function getLoanDetails(lendingContract) {
  const inquirerModule = await import("inquirer");
  const inquirer = inquirerModule.default;
  const { loanId } = await inquirer.prompt([
    { type: "input", name: "loanId", message: "Enter Loan ID:" },
  ]);
  try {
    const details = await lendingContract.getLoanDetails(loanId);
    console.log(`\nLoan ID: ${loanId}`);
    console.log(`Borrower: ${details.borrower}`);
    console.log(`Principal: ${ethers.formatEther(details.principal)} BNB`);
    console.log(`Collateral: ${ethers.formatEther(details.collateral)} BNB`);
    console.log(`Interest Rate: ${details.interestRate}%`);
    console.log(`Due Date: ${new Date(Number(details.dueDate) * 1000).toLocaleString()}`);
    console.log(`Start Time: ${new Date(Number(details.startTime) * 1000).toLocaleString()}`);
    console.log(`Repaid: ${details.isRepaid}`);
  } catch (err) {
    console.error("Error getting loan details:", err);
  }
}

// Check the health of a specific loan.
async function checkLoanHealth(lendingContract, wallet) {
  const inquirerModule = await import("inquirer");
  const inquirer = inquirerModule.default;
  const { loanId } = await inquirer.prompt([
    { type: "input", name: "loanId", message: "Enter Loan ID to check:" },
  ]);
  try {
    const loan = await lendingContract.loans(loanId);
    console.log(`\nLoan ID ${loanId}:`);
    console.log(`  Principal: ${ethers.formatEther(loan.principal)} BNB`);
    console.log(`  Collateral: ${ethers.formatEther(loan.collateral)} BNB`);
    const price = await lendingContract.getLatestPrice();
    console.log(`Current BNB/USD Price: ${Number(price) / 1e8}`);
    const { status, currentRatio } = await lendingContract.checkLoanHealth(loanId);
    console.log(`Loan Health: ${status} (Collateral Ratio: ${currentRatio}%)`);
    const latestBlock = await wallet.provider.getBlock("latest");
    console.log(`Current Block Timestamp: ${latestBlock.timestamp}`);
  } catch (err) {
    console.error("Error checking loan health:", err);
  }
}

// Deposit liquidity into the pool
async function depositLiquidity(lendingContract, wallet) {
  const inquirerModule = await import("inquirer");
  const inquirer = inquirerModule.default;
  const { amount } = await inquirer.prompt([
    { type: "input", name: "amount", message: "Enter amount to deposit (in BNB):" },
  ]);
  try {
    const value = ethers.parseEther(amount);
    const tx = await lendingContract.depositLiquidity({ value });
    const receipt = await tx.wait();
    console.log("✅ Liquidity deposit successful! Tx Hash:", receipt.hash);
  } catch (err) {
    console.error("Error depositing liquidity:", err);
  }
}

// Withdraw liquidity from the pool (admin only)
async function withdrawLiquidity(lendingContract) {
  const inquirerModule = await import("inquirer");
  const inquirer = inquirerModule.default;
  const { amount } = await inquirer.prompt([
    { type: "input", name: "amount", message: "Enter amount to withdraw (in BNB):" },
  ]);
  try {
    const withdrawAmount = ethers.parseEther(amount);
    const tx = await lendingContract.withdrawLiquidity(withdrawAmount);
    const receipt = await tx.wait();
    console.log("✅ Liquidity withdrawal successful! Tx Hash:", receipt.hash);
  } catch (err) {
    console.error("Error withdrawing liquidity:", err);
  }
}

// Check the credit score of a borrower
async function checkCreditScore(lendingContract) {
  const inquirerModule = await import("inquirer");
  const inquirer = inquirerModule.default;
  const { borrower } = await inquirer.prompt([
    { type: "input", name: "borrower", message: "Enter borrower address:" },
  ]);
  try {
    const score = await lendingContract.getCreditScore(borrower);
    console.log(`Credit Score for ${borrower}: ${score}%`);
  } catch (err) {
    console.error("Error checking credit score:", err);
  }
}

// Get contract balance
async function getContractBalance(lendingContract) {
  try {
    const balance = await lendingContract.getContractBalance();
    console.log("Contract Balance:", ethers.formatEther(balance), "BNB");
  } catch (err) {
    console.error("Error fetching contract balance:", err);
  }
}

// ------------------------
// Interactive CLI using inquirer.js
// ------------------------
async function interactiveCLI(forwarderContract, lendingContract, wallet) {
  const inquirerModule = await import("inquirer");
  const inquirer = inquirerModule.default;
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        "Request Loan",
        "Repay Loan",
        "Liquidate Loan",
        "List Loans",
        "Check Price",
        "Check Loan Health",
        "Get Loan Details",
        "Deposit Liquidity",
        "Withdraw Liquidity",
        "Get Contract Balance",
        "Check Credit Score"
      ],
    },
  ]);

  switch (action) {
    case "Request Loan": {
      const params = await inquirer.prompt([
        { type: "input", name: "interestRate", message: "Enter interest rate (%):" },
        { type: "input", name: "duration", message: "Enter duration in seconds:" },
        { type: "input", name: "collateral", message: "Enter collateral in BNB:" },
      ]);
      await requestLoan(
        forwarderContract,
        lendingContract,
        wallet,
        parseInt(params.interestRate),
        parseInt(params.duration),
        params.collateral
      );
      break;
    }
    case "Repay Loan": {
      const params = await inquirer.prompt([
        { type: "input", name: "loanId", message: "Enter Loan ID:" },
        { type: "input", name: "repayment", message: "Enter repayment amount in BNB:" },
      ]);
      await repayLoan(forwarderContract, lendingContract, wallet, params.loanId, params.repayment);
      break;
    }
    case "Liquidate Loan": {
      const params = await inquirer.prompt([
        { type: "input", name: "loanId", message: "Enter Loan ID to liquidate:" },
      ]);
      await liquidateLoan(forwarderContract, lendingContract, wallet, params.loanId);
      break;
    }
    case "List Loans":
      await listLoans(lendingContract, wallet);
      break;
    case "Check Price":
      await checkPrice(lendingContract);
      break;
    case "Check Loan Health":
      await checkLoanHealth(lendingContract, wallet);
      break;
    case "Get Loan Details":
      await getLoanDetails(lendingContract);
      break;
    case "Deposit Liquidity":
      await depositLiquidity(lendingContract, wallet);
      break;
    case "Withdraw Liquidity":
      await withdrawLiquidity(lendingContract);
      break;
    case "Get Contract Balance":
      await getContractBalance(lendingContract);
      break;
    case "Check Credit Score":
      await checkCreditScore(lendingContract);
      break;
    default:
      console.log("Unknown action.");
  }
}

// ------------------------
// Main Entry: CLI or interactive mode
// ------------------------
async function mainEntry() {
  // Disable ENS by setting ensAddress: null in the network config.
  const network = { name: "bnbt", chainId: 97, ensAddress: null };
  const provider = new ethers.JsonRpcProvider(process.env.BSC_TESTNET_URL, network);
  provider.resolveName = async (name) => {
    if (typeof name === "string" && name.startsWith("0x") && name.length === 42) {
      return name;
    }
    return name;
  };

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  wallet.provider = provider;

  const forwarderAddress = "0x2364a83fBa641DC1F9b4423575940E8c9117de5D";
  const lendingAddress = "0x83DE374711DA5931b0448724e565BD5ec13983cB";

  console.log("MainEntry - Forwarder Address:", forwarderAddress);
  console.log("MainEntry - Lending Address:", lendingAddress);
  console.log("MainEntry - Wallet Address:", wallet.address);

  const forwarderContract = new ethers.Contract(forwarderAddress, forwarderABI, wallet);
  const lendingContract = new ethers.Contract(lendingAddress, lendingABI, wallet);

  console.log("Forwarder Contract Target:", forwarderContract.target);
  console.log("Lending Contract Target:", lendingContract.target);

  if (process.argv.length <= 2) {
    await interactiveCLI(forwarderContract, lendingContract, wallet);
  } else {
    const action = process.argv[2];
    switch (action) {
      case "request": {
        const interestRate = parseInt(process.argv[3]);
        const duration = parseInt(process.argv[4]);
        const collateral = process.argv[5];
        if (!interestRate || !duration || !collateral) {
          console.log("Usage: node frontend.js request <interestRate> <duration_in_seconds> <collateral_in_BNB>");
          return;
        }
        await requestLoan(forwarderContract, lendingContract, wallet, interestRate, duration, collateral);
        break;
      }
      case "repay": {
        const loanId = process.argv[3];
        const repayment = process.argv[4];
        if (!loanId || !repayment) {
          console.log("Usage: node frontend.js repay <loanId> <repayment_in_BNB>");
          return;
        }
        await repayLoan(forwarderContract, lendingContract, wallet, loanId, repayment);
        break;
      }
      case "liquidate": {
        const loanId = process.argv[3];
        if (!loanId) {
          console.log("Usage: node frontend.js liquidate <loanId>");
          return;
        }
        await liquidateLoan(forwarderContract, lendingContract, wallet, loanId);
        break;
      }
      case "list":
        await listLoans(lendingContract, wallet);
        break;
      case "checkPrice":
        await checkPrice(lendingContract);
        break;
      case "checkHealth":
        await checkLoanHealth(lendingContract, wallet);
        break;
      case "getDetails":
        await getLoanDetails(lendingContract);
        break;
      case "deposit":
        await depositLiquidity(lendingContract, wallet);
        break;
      case "withdraw":
        await withdrawLiquidity(lendingContract);
        break;
      case "balance":
        await getContractBalance(lendingContract);
        break;
      case "credit":
        await checkCreditScore(lendingContract);
        break;
      default:
        console.log("Unknown action. Use one of the following:");
        console.log("'request', 'repay', 'liquidate', 'list', 'checkPrice', 'checkHealth', 'getDetails', 'deposit', 'withdraw', 'balance', or 'credit'.");
    }
  }
}

mainEntry().catch(console.error);
