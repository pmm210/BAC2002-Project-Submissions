import React from 'react';

// Simple sparkline chart component that simulates a price chart
const TokenSparkline = ({ symbol, priceChange = 0, currentPrice = 100 }) => {
  // Generate sparkline path based on symbol and price change
  const generatePath = () => {
    // Use the symbol string and priceChange to generate a pseudo-random but consistent path
    // This ensures that the same symbol always gets the same sparkline shape for visual consistency
    const symbolSeed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    const pointCount = 20;
    const points = [];
    
    // Generate a series of points with some randomness but trending according to priceChange
    let lastY = 50; // Start in the middle
    
    for (let i = 0; i < pointCount; i++) {
      // Seed-based pseudo-random value for this point
      const randomFactor = Math.sin(i * 0.1 + symbolSeed * 0.01) * 10;
      
      // Trend effect increases toward the end of the chart
      const trendEffect = (i / pointCount) * priceChange * 3;
      
      // Calculate new Y with some boundaries
      const newY = Math.max(5, Math.min(95, lastY + randomFactor + trendEffect));
      
      points.push([i * (100 / (pointCount - 1)), newY]);
      lastY = newY;
    }
    
    // Generate SVG path from points
    return points.map((point, i) => 
      (i === 0 ? 'M' : 'L') + point[0] + ',' + point[1]
    ).join(' ');
  };
  
  // Determine color based on price change
  const getColor = () => {
    if (priceChange > 0) return '#28a745'; // Green for positive
    if (priceChange < 0) return '#dc3545'; // Red for negative
    return '#6c757d'; // Gray for neutral
  };
  
  const pathColor = getColor();
  const path = generatePath();
  
  return (
    <div className="token-sparkline" style={{ height: '30px', width: '100%' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
        <path 
          d={path} 
          stroke={pathColor} 
          strokeWidth="2" 
          fill="none" 
        />
      </svg>
    </div>
  );
};

export default TokenSparkline;