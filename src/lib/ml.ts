// src/lib/ml.ts

export interface PredictionPoint {
  date: string;
  price: number;
  upper: number;
  lower: number;
  isFuture: boolean;
}

// Helper: Calculate Linear Regression with Safety Checks
function linearRegression(data: number[]) {
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumXX += i * i;
  }
  
  const denominator = (n * sumXX - sumX * sumX);
  
  // SAFETY CHECK: Prevent division by zero
  if (denominator === 0) {
    return { slope: 0, intercept: 0 };
  }
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

// Helper: Calculate Logarithmic Regression
function logRegression(data: number[]) {
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  // We use ln(index) as X. Start from 1 to avoid log(0).
  for (let i = 0; i < n; i++) {
    const x = Math.log(i + 1); 
    const y = data[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  
  const denominator = (n * sumXX - sumX * sumX);
  
  // SAFETY CHECK
  if (denominator === 0) {
    return { slope: 0, intercept: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

export function predictFutureTrends(
  history: { date: string; price: number }[], 
  timeframe: string
) {
  // 1. DYNAMIC SETTINGS BASED ON TIMEFRAME
  let lookback = 50;   
  let forecastDays = 14; 
  
  switch (timeframe) {
    case '1W': 
      lookback = 30;   // Short term memory
      forecastDays = 5; // Next trading week
      break;
    case '1M': 
      lookback = 60;
      forecastDays = 10;
      break;
    case '3M': 
      lookback = 90;
      forecastDays = 20;
      break;
    case '6M': 
    case '1Y': 
      lookback = 200;  // Long term trend
      forecastDays = 45; // Next 1.5 months
      break;
  }

  // Slice data to respect the lookback window
  const data = history.slice(-lookback);
  const prices = data.map(d => d.price);
  const n = prices.length;
  
  // Insufficient data check
  if (n < 10) return [];

  // 2. ENSEMBLE MODELING
  
  // Model A: Linear (Baseline Trend)
  const lin = linearRegression(prices);
  
  // Model B: Logarithmic (Curved Trend)
  const log = logRegression(prices);

  // Model C: Momentum (Recent Slope)
  // We take the slope of the last 10 days to capture immediate momentum
  const shortTerm = linearRegression(prices.slice(-10));

  // 3. VOLATILITY CALCULATION (Standard Error)
  let sumSquaredDiff = 0;
  for (let i = 0; i < n; i++) {
    const predicted = lin.slope * i + lin.intercept;
    sumSquaredDiff += Math.pow(prices[i] - predicted, 2);
  }
  const stdDev = Math.sqrt(sumSquaredDiff / n);

  // 4. GENERATE FORECAST
  const predictions: PredictionPoint[] = [];
  const lastDate = new Date(data[n - 1].date);

  for (let i = 1; i <= forecastDays; i++) {
    const futureIdx = n - 1 + i;
    
    // Calculate 3 projections
    const predLin = lin.slope * futureIdx + lin.intercept;
    const predLog = log.slope * Math.log(futureIdx + 1) + log.intercept;
    
    // For momentum, we project from the last price using the short-term slope
    // We dampen it over time so it doesn't go to infinity (decay factor)
    const lastPrice = prices[n-1];
    const decay = Math.max(0, 1 - (i * 0.05)); 
    const predMom = lastPrice + (shortTerm.slope * i * decay);

    // WEIGHTED AVERAGE (Ensemble)
    // 40% Linear (Stability), 30% Log (Growth), 30% Momentum (Current Action)
    const finalPrice = (predLin * 0.4) + (predLog * 0.3) + (predMom * 0.3);

    // CONE CALCULATION
    // Uncertainty grows with time (square root of time)
    const uncertainty = stdDev * Math.sqrt(i) * 1.5; 

    const futureDate = new Date(lastDate);
    futureDate.setDate(lastDate.getDate() + i);

    predictions.push({
      date: futureDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      price: finalPrice,
      upper: finalPrice + uncertainty,
      lower: finalPrice - uncertainty,
      isFuture: true
    });
  }

  return predictions;
}