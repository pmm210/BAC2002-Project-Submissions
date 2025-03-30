// dashboard.js - Main functionality for the user dashboard

// Add these chart variables at the top of your dashboard.js file
let priceChart = null;
let collateralHealthChart = null;
let fullPriceChart = null;

document.addEventListener('DOMContentLoaded', function() {
  // Get template variables passed from HTML
  const userWalletAddress = document.getElementById('userDataContainer').dataset.walletAddress;
  const contractBalance = parseFloat(document.getElementById('userDataContainer').dataset.contractBalance);
  
  // Credit Score API
  testCreditScoreAPI();
  
  // Add event listener for the refresh button
  document.getElementById('refreshCreditScore').addEventListener('click', function() {
    testCreditScoreAPI();
  });
  
  // Load Chainlink price feed data
  loadPriceFeed();
  document.getElementById('refreshPriceFeed').addEventListener('click', loadPriceFeed);
  
  // Load platform statistics
  loadPlatformStats(contractBalance);
  document.getElementById('refreshStats').addEventListener('click', function() {
    loadPlatformStats(contractBalance);
  });
  
  // Check loan health for all displayed loans
  checkAllLoanHealth();
  
  // Add event listener for the price trend refresh button
  document.getElementById('refreshPriceTrend').addEventListener('click', loadPriceTrend);
  loadPriceTrend();
  
  // Add event listener for the loan health refresh button
  document.getElementById('refreshLoanHealth').addEventListener('click', analyzeAllLoansHealth);
  analyzeAllLoansHealth();
  
  // Simple function to test and display credit score
  async function testCreditScoreAPI() {
    // Show loading state
    document.getElementById('creditScoreLoading').classList.remove('d-none');
    document.getElementById('creditScoreContent').classList.add('d-none');
    document.getElementById('creditScoreError').classList.add('d-none');
    
    try {
      if (!userWalletAddress) {
        throw new Error("No wallet address available for the current user.");
      }
      
      const response = await fetch(`/meta/get-credit-score?borrower=${userWalletAddress}`);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      // Get the text first
      const responseText = await response.text();
      console.log("Raw API response:", responseText);
      
      // Parse the JSON response
      const data = JSON.parse(responseText);
      console.log("Parsed response:", data);
      
      if (!data.creditScore) {
        throw new Error("No credit score found in response");
      }
      
      // Convert credit score to a number
      const score = parseInt(data.creditScore);
      console.log("Credit score:", score);
      
      // Hide loading, show content
      document.getElementById('creditScoreLoading').classList.add('d-none');
      document.getElementById('creditScoreContent').classList.remove('d-none');
      
      // Update the score value
      document.getElementById('scoreValue').textContent = score;
      
      // Update the progress bar
      const progressBar = document.getElementById('scoreProgressBar');
      progressBar.style.width = `${score}%`;
      progressBar.setAttribute('aria-valuenow', score);
      
      // Set the appropriate color and description
      if (score >= 81) {
        progressBar.className = 'progress-bar bg-success';
        document.getElementById('scoreDescription').textContent = 
          "Excellent! You qualify for the highest loan amounts with the best interest rates.";
      } else if (score >= 61) {
        progressBar.className = 'progress-bar bg-primary';
        document.getElementById('scoreDescription').textContent = 
          "Good! You qualify for standard loan terms with favorable rates.";
      } else if (score >= 41) {
        progressBar.className = 'progress-bar bg-info';
        document.getElementById('scoreDescription').textContent = 
          "Fair. You qualify for loans with moderate terms and interest rates.";
      } else if (score >= 21) {
        progressBar.className = 'progress-bar bg-warning';
        document.getElementById('scoreDescription').textContent = 
          "Poor. You may qualify for smaller loans with higher collateral requirements.";
      } else {
        progressBar.className = 'progress-bar bg-danger';
        document.getElementById('scoreDescription').textContent = 
          "Very poor. You may need to improve your credit score to qualify for loans.";
      }
      
    } catch (error) {
      console.error("Error fetching credit score:", error);
      document.getElementById('creditScoreLoading').classList.add('d-none');
      document.getElementById('creditScoreError').classList.remove('d-none');
      document.getElementById('scoreErrorMessage').textContent = error.message;
    }
  }
  
  // Load Chainlink price feed data
  async function loadPriceFeed() {
    // Show loading state
    document.getElementById('priceFeedLoading').classList.remove('d-none');
    document.getElementById('priceFeedContent').classList.add('d-none');
    document.getElementById('priceFeedError').classList.add('d-none');
    
    try {
      // Get the latest price
      const priceResponse = await fetch('/meta/get-latest-price');
      if (!priceResponse.ok) {
        throw new Error(`API returned ${priceResponse.status}: ${priceResponse.statusText}`);
      }
      
      const priceData = await priceResponse.json();
      console.log("Price data:", priceData);
      
      // Get additional price feed info
      const infoResponse = await fetch('/meta/get-price-feed-info');
      if (!infoResponse.ok) {
        throw new Error(`API returned ${infoResponse.status}: ${infoResponse.statusText}`);
      }
      
      const infoData = await infoResponse.json();
      console.log("Price feed info:", infoData);
      
      // Hide loading, show content
      document.getElementById('priceFeedLoading').classList.add('d-none');
      document.getElementById('priceFeedContent').classList.remove('d-none');
      
      // Format and display the price (divided by 10^8 for proper decimal places)
      const bnbPrice = (Number(priceData.price) / 1e8).toFixed(2);
      document.getElementById('bnbPrice').textContent = '$' + bnbPrice;
      
      // Display additional information
      document.getElementById('roundId').textContent = infoData.roundId;
      
      // Format timestamps
      const updateTimestamp = Number(infoData.updatedAt);
      const startTimestamp = Number(infoData.startedAt);
      
      const updateDate = new Date(updateTimestamp * 1000);
      const startDate = new Date(startTimestamp * 1000);
      
      document.getElementById('priceUpdateTime').textContent = formatTime(updateDate);
      document.getElementById('startedAt').textContent = formatDate(startDate);
      document.getElementById('answeredInRound').textContent = infoData.answeredInRound;
      
    } catch (error) {
      console.error("Error loading price feed:", error);
      document.getElementById('priceFeedLoading').classList.add('d-none');
      document.getElementById('priceFeedError').classList.remove('d-none');
      document.getElementById('priceFeedErrorMessage').textContent = error.message;
    }
  }
  
  // Load platform statistics
  async function loadPlatformStats(contractBalance) {
    try {
      // Get contract balance
      const response = await fetch('/meta/get-latest-price');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      // Count user's active loans
      const loanCells = document.querySelectorAll('.loan-health-cell');
      document.getElementById('totalActiveLoans').textContent = loanCells.length;
      
      // Use passed contract balance instead of Jinja template variable
      document.getElementById('totalLiquidity').textContent = contractBalance + ' BNB';
      
    } catch (error) {
      console.error("Error loading platform stats:", error);
    }
  }
  
  // Check health for all loans
  function checkAllLoanHealth() {
    const loanHealthCells = document.querySelectorAll('.loan-health-cell');
    loanHealthCells.forEach(cell => {
      const loanId = cell.getAttribute('data-loan-id');
      checkLoanHealth(loanId, cell);
    });
  }
  
  // Check individual loan health
  async function checkLoanHealth(loanId, cell) {
    try {
      const response = await fetch(`/meta/check-loan-health?loanId=${loanId}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Loan ${loanId} health:`, data);
      
      // Clear loading spinner
      cell.innerHTML = '';
      
      // Get the ratio and status - handle both boolean and string response formats
      const ratio = Number(data.currentRatio);
      
      // Handle different API response formats - your API returns "healthy" as a string
      // rather than true/false
      let isHealthy = false;
      
      if (typeof data.status === 'boolean') {
        isHealthy = data.status;
      } else if (typeof data.status === 'string') {
        isHealthy = data.status.toLowerCase() === 'healthy';
      }
      
      if (isHealthy) {
        // Healthy loan
        cell.innerHTML = `<span class="badge bg-success">Healthy (${ratio}%)</span>`;
      } else {
        // Unhealthy loan
        cell.innerHTML = `<span class="badge bg-danger">At Risk (${ratio}%)</span>`;
      }
      
    } catch (error) {
      console.error(`Error checking loan ${loanId} health:`, error);
      cell.innerHTML = '<span class="badge bg-secondary">Error</span>';
    }
  }
  
  // Format date for better display
  function formatDate(date) {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
  
  // Format relative time (e.g., "5 minutes ago")
  function formatTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return Math.floor(diffSec / 60) + ' minutes ago';
    if (diffSec < 86400) return Math.floor(diffSec / 3600) + ' hours ago';
    return Math.floor(diffSec / 86400) + ' days ago';
  }
  
  // Function to load and display price trend using Chainlink data
  async function loadPriceTrend() {
    // Show loading, hide content and error
    document.getElementById('priceTrendLoading').classList.remove('d-none');
    document.getElementById('priceTrendContent').classList.add('d-none');
    document.getElementById('priceTrendError').classList.add('d-none');
    
    try {
      // Fetch historical price data
      const response = await fetch('/meta/get-price-history');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      const data = await response.json();
      
      // Process the data
      const prices = data.history.map(item => item.price);
      const timestamps = data.history.map(item => {
        const date = new Date(item.timestamp * 1000);
        return date.getHours() + ':00';
      });
      
      // Calculate price change
      const oldestPrice = prices[0];
      const latestPrice = prices[prices.length - 1];
      const priceChange = latestPrice - oldestPrice;
      const changePercentage = (priceChange / oldestPrice) * 100;
      
      // Update DOM elements
      document.getElementById('priceChange').textContent = '$' + latestPrice.toFixed(2);
      
      const percentageElem = document.getElementById('changePercentage');
      if (changePercentage >= 0) {
        percentageElem.textContent = '+' + changePercentage.toFixed(2) + '%';
        percentageElem.classList.add('text-success');
        percentageElem.classList.remove('text-danger');
      } else {
        percentageElem.textContent = changePercentage.toFixed(2) + '%';
        percentageElem.classList.add('text-danger');
        percentageElem.classList.remove('text-success');
      }
      
      // Draw the chart - destroy if exists
      const ctx = document.getElementById('priceChart').getContext('2d');
      
      // Destroy existing chart if it exists
      if (priceChart) {
        priceChart.destroy();
      }
      
      priceChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timestamps,
          datasets: [{
            label: 'BNB/USD',
            data: prices,
            borderColor: '#ffc107',
            backgroundColor: 'rgba(255, 193, 7, 0.1)',
            tension: 0.4,
            pointRadius: 2,
            pointHoverRadius: 4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              ticks: {
                color: '#adb5bd',
                callback: function(value) {
                  return '$' + value;
                }
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.05)'
              }
            },
            x: {
              ticks: {
                color: '#adb5bd',
                maxRotation: 0
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.05)'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
      
      // Hide loading, show content
      document.getElementById('priceTrendLoading').classList.add('d-none');
      document.getElementById('priceTrendContent').classList.remove('d-none');
      
    } catch (error) {
      console.error("Error loading price trend:", error);
      document.getElementById('priceTrendLoading').classList.add('d-none');
      document.getElementById('priceTrendError').classList.remove('d-none');
      document.getElementById('priceTrendErrorMessage').textContent = error.message;
    }
  }
  
  // Function to analyze health of all loans based on Chainlink price data
  async function analyzeAllLoansHealth() {
    // First check if we're on the health tab
    const healthTab = document.getElementById('health');
    if (!healthTab) {
      return; // Exit if the health tab doesn't exist
    }
    
    // Show loading state
    const loadingEl = document.getElementById('loanHealthLoading');
    const contentEl = document.getElementById('loanHealthContent');
    const errorEl = document.getElementById('loanHealthError');
    
    if (!loadingEl || !contentEl || !errorEl) {
      console.error("Missing required DOM elements for loan health analysis");
      return;
    }
    
    loadingEl.classList.remove('d-none');
    contentEl.classList.add('d-none');
    errorEl.classList.add('d-none');
    
    try {
      // Get the user's wallet address
      const userDataContainer = document.getElementById('userDataContainer');
      if (!userDataContainer) {
        throw new Error("User data container not found");
      }
      
      const walletAddress = userDataContainer.dataset.walletAddress;
      if (!walletAddress) {
        throw new Error("No wallet address available. Please connect your wallet first.");
      }
      
      // Call the API
      const response = await fetch(`/meta/analyze-loan-health?address=${walletAddress}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Loan health analysis:", data);
      
      // Handle no loans case
      if (data.status === "no_loans" || data.status === "no_active_loans") {
        const priceImpactMessageEl = document.getElementById('priceImpactMessage');
        if (priceImpactMessageEl) {
          priceImpactMessageEl.textContent = "You have no active loans to analyze.";
        }
        
        loadingEl.classList.add('d-none');
        contentEl.classList.remove('d-none');
        return;
      }
      
      // Update the UI with health analysis data
      const avgHealthPercentageEl = document.getElementById('avgHealthPercentage');
      const currentPriceImpactEl = document.getElementById('currentPriceImpact');
      const liquidationThresholdEl = document.getElementById('liquidationThreshold');
      const priceMarginBarEl = document.getElementById('priceMarginBar');
      const priceMarginLabelEl = document.getElementById('priceMarginLabel');
      const priceImpactMessageEl = document.getElementById('priceImpactMessage');
      
      if (avgHealthPercentageEl) {
        avgHealthPercentageEl.textContent = `${data.overall_health.avg_collateral_ratio}%`;
      }
      
      if (currentPriceImpactEl) {
        currentPriceImpactEl.textContent = `$${data.current_bnb_price}`;
      }
      
      if (liquidationThresholdEl) {
        liquidationThresholdEl.textContent = `$${data.overall_health.critical_price}`;
      }
      
      // Calculate and set safe margin
      const safeMargin = ((data.current_bnb_price - data.overall_health.critical_price) / data.current_bnb_price * 100);
      
      if (priceMarginBarEl) {
        priceMarginBarEl.style.width = `${Math.min(100, safeMargin)}%`;
        
        if (safeMargin > 20) {
          priceMarginBarEl.className = "progress-bar bg-success";
        } else if (safeMargin > 10) {
          priceMarginBarEl.className = "progress-bar bg-warning";
        } else {
          priceMarginBarEl.className = "progress-bar bg-danger";
        }
      }
      
      if (priceMarginLabelEl) {
        priceMarginLabelEl.textContent = `Safe margin: ${safeMargin.toFixed(2)}%`;
      }
      
      if (priceImpactMessageEl) {
        if (safeMargin > 20) {
          priceImpactMessageEl.textContent = "Your loans are healthy with a good safe margin above liquidation threshold.";
        } else if (safeMargin > 10) {
          priceImpactMessageEl.textContent = "Your loans have a moderate safe margin. Consider adding collateral if the price drops further.";
        } else {
          priceImpactMessageEl.textContent = "Warning: Your loans have a small safe margin. Adding more collateral is recommended.";
        }
      }
      
      // Update price scenarios
      document.getElementById('scenario-current-price').textContent = `$${data.current_bnb_price}`;
      document.getElementById('scenario-current-ratio').textContent = `${data.overall_health.avg_collateral_ratio}%`;
      
      // Calculate scenario values for small drop (-5%)
      const smallDropPrice = data.current_bnb_price * 0.95;
      const smallDropRatio = (data.overall_health.avg_collateral_ratio * data.current_bnb_price / smallDropPrice);
      document.getElementById('scenario-small-price').textContent = `$${smallDropPrice.toFixed(2)}`;
      document.getElementById('scenario-small-ratio').textContent = `${smallDropRatio.toFixed(2)}%`;
      setScenarioStatus('scenario-small-status', smallDropRatio);
      
      // Medium drop (-10%)
      const mediumDropPrice = data.current_bnb_price * 0.9;
      const mediumDropRatio = (data.overall_health.avg_collateral_ratio * data.current_bnb_price / mediumDropPrice);
      document.getElementById('scenario-medium-price').textContent = `$${mediumDropPrice.toFixed(2)}`;
      document.getElementById('scenario-medium-ratio').textContent = `${mediumDropRatio.toFixed(2)}%`;
      setScenarioStatus('scenario-medium-status', mediumDropRatio);
      
      // Large drop (-20%)
      const largeDropPrice = data.current_bnb_price * 0.8;
      const largeDropRatio = (data.overall_health.avg_collateral_ratio * data.current_bnb_price / largeDropPrice);
      document.getElementById('scenario-large-price').textContent = `$${largeDropPrice.toFixed(2)}`;
      document.getElementById('scenario-large-ratio').textContent = `${largeDropRatio.toFixed(2)}%`;
      setScenarioStatus('scenario-large-status', largeDropRatio);
      
      // Draw/Update the collateral health chart
      drawCollateralHealthChart(data.overall_health.avg_collateral_ratio);
      
      // Hide loading, show content
      loadingEl.classList.add('d-none');
      contentEl.classList.remove('d-none');
      
    } catch (error) {
      console.error("Error analyzing loan health:", error);
      if (errorEl && errorEl.querySelector('#loanHealthErrorMessage')) {
        errorEl.querySelector('#loanHealthErrorMessage').textContent = error.message;
        loadingEl.classList.add('d-none');
        errorEl.classList.remove('d-none');
      }
    }
  }
  
  // Helper function to set scenario status
  function setScenarioStatus(elementId, ratio) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let statusHtml = '';
    if (ratio > 160) {
      statusHtml = '<span class="badge bg-success">Safe</span>';
    } else if (ratio > 150) {
      statusHtml = '<span class="badge bg-warning text-dark">Caution</span>';
    } else {
      statusHtml = '<span class="badge bg-danger">At Risk</span>';
    }
    
    element.innerHTML = statusHtml;
  }
  
  // Function to draw the collateral health gauge chart
  function drawCollateralHealthChart(healthPercentage) {
    const ctx = document.getElementById('collateralHealthChart');
    if (!ctx) return;
    
    // Normalize the percentage for the chart
    const normalizedPercentage = Math.min(Math.max(healthPercentage, 100), 350);
    const healthScore = (normalizedPercentage - 100) / 250; // 0 to 1 scale (100% to 350%)
    
    // Get color based on health
    let color = '#dc3545'; // Red for danger
    if (healthPercentage > 200) {
      color = '#28a745'; // Green for good health
    } else if (healthPercentage > 160) {
      color = '#ffc107'; // Yellow for caution
    }
    
    // Destroy existing chart if it exists
    if (collateralHealthChart) {
      collateralHealthChart.destroy();
    }
    
    // Create new chart
    collateralHealthChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [healthScore, 1 - healthScore],
          backgroundColor: [color, '#2c3034'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '80%',
        circumference: 180,
        rotation: 270,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          }
        }
      }
    });
  }
});

// Keep this function global as it's called directly from HTML
async function viewLoanDetails(loanId) {
  // Show the modal
  const modal = new bootstrap.Modal(document.getElementById('loanDetailsModal'));
  modal.show();
  
  // Show loading, hide content and error
  document.getElementById('loanDetailsLoading').classList.remove('d-none');
  document.getElementById('loanDetailsContent').classList.add('d-none');
  document.getElementById('loanDetailsError').classList.add('d-none');
  
  try {
    // Use getLoanDetails endpoint directly - following the pattern from frontend.js
    const loanResponse = await fetch(`/meta/get-loan-details?loanId=${loanId}`);
    if (!loanResponse.ok) {
      throw new Error(`API returned ${loanResponse.status}: ${loanResponse.statusText}`);
    }
    
    const loanData = await loanResponse.json();
    console.log(`Loan ${loanId} details:`, loanData);
    
    // Fetch loan health
    const healthResponse = await fetch(`/meta/check-loan-health?loanId=${loanId}`);
    if (!healthResponse.ok) {
      throw new Error(`API returned ${healthResponse.status}: ${healthResponse.statusText}`);
    }
    
    const healthData = await healthResponse.json();
    console.log(`Loan ${loanId} health:`, healthData);
    
    // Fetch current price
    const priceResponse = await fetch('/meta/get-latest-price');
    if (!priceResponse.ok) {
      throw new Error(`API returned ${priceResponse.status}: ${priceResponse.statusText}`);
    }
    
    const priceData = await priceResponse.json();
    console.log("Current price:", priceData);
    
    // Hide loading, show content
    document.getElementById('loanDetailsLoading').classList.add('d-none');
    document.getElementById('loanDetailsContent').classList.remove('d-none');
    
    // Update the modal with loan details
    document.getElementById('modal-loan-id').textContent = loanId;
    
    // Handle the borrower address - check if it exists first
    if (loanData.borrower) {
      document.getElementById('modal-borrower').textContent = 
        `${loanData.borrower.substring(0, 6)}...${loanData.borrower.substring(loanData.borrower.length - 4)}`;
    } else {
      document.getElementById('modal-borrower').textContent = 'Unknown';
    }
    
    // Format numbers properly - be defensive with conversions
    try {
      document.getElementById('modal-principal').textContent = (Number(loanData.principal) / 1e18).toFixed(4);
    } catch (e) {
      document.getElementById('modal-principal').textContent = '0.0000';
      console.error("Error parsing principal:", e);
    }
    
    try {
      document.getElementById('modal-collateral').textContent = (Number(loanData.collateral) / 1e18).toFixed(4);
    } catch (e) {
      document.getElementById('modal-collateral').textContent = '0.0000';
      console.error("Error parsing collateral:", e);
    }
    
    document.getElementById('modal-interest-rate').textContent = loanData.interestRate || '0';
    
    // Format and display dates
    try {
      const startDate = new Date(Number(loanData.startTime) * 1000);
      document.getElementById('modal-start-time').textContent = 
        startDate.toLocaleDateString() + ' ' + startDate.toLocaleTimeString();
    } catch (e) {
      document.getElementById('modal-start-time').textContent = 'Invalid date';
      console.error("Error parsing start date:", e);
    }
    
    try {
      const dueDate = new Date(Number(loanData.dueDate) * 1000);
      document.getElementById('modal-due-date').textContent = 
        dueDate.toLocaleDateString() + ' ' + dueDate.toLocaleTimeString();
    } catch (e) {
      document.getElementById('modal-due-date').textContent = 'Invalid date';
      console.error("Error parsing due date:", e);
    }
    
    // Display repayment status
    if (loanData.isRepaid) {
      document.getElementById('modal-repaid').innerHTML = '<span class="badge bg-success">Repaid</span>';
      document.getElementById('repayLoanButton').classList.add('d-none');
    } else {
      document.getElementById('modal-repaid').innerHTML = '<span class="badge bg-warning text-dark">Active</span>';
      document.getElementById('repayLoanButton').classList.remove('d-none');
      document.getElementById('repayLoanButton').href = `/repay-loan?loan_id=${loanId}`;
    }
    
    // Display health status
    const ratio = Number(healthData.currentRatio);
    
    // Handle different API response formats
    let isHealthy = false;
    if (typeof healthData.status === 'boolean') {
      isHealthy = healthData.status;
    } else if (typeof healthData.status === 'string') {
      isHealthy = healthData.status.toLowerCase() === 'healthy';
    }
    
    if (isHealthy) {
      document.getElementById('modal-health-status').innerHTML = '<span class="badge bg-success">Healthy</span>';
    } else {
      document.getElementById('modal-health-status').innerHTML = '<span class="badge bg-danger">At Risk</span>';
    }
    
    document.getElementById('modal-collateral-ratio').textContent = ratio;
    
    // Display market data
    const bnbPrice = (Number(priceData.price) / 1e8).toFixed(2);
    document.getElementById('modal-bnb-price').textContent = bnbPrice;
    
    // Calculate repayment amount (principal + interest)
    try {
      const principal = Number(loanData.principal) / 1e18;
      const interestRate = Number(loanData.interestRate) / 100;
      const repaymentAmount = principal * (1 + interestRate);
      document.getElementById('modal-repayment').textContent = repaymentAmount.toFixed(4);
    } catch (e) {
      document.getElementById('modal-repayment').textContent = 'Error';
      console.error("Error calculating repayment amount:", e);
    }
    
    // Display price update time
    document.getElementById('modal-price-updated').textContent = "Just now";
    
  } catch (error) {
    console.error("Error fetching loan details:", error);
    document.getElementById('loanDetailsLoading').classList.add('d-none');
    document.getElementById('loanDetailsError').classList.remove('d-none');
    document.getElementById('loanDetailsErrorMessage').textContent = error.message;
  }
}