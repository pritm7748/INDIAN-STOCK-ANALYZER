// src/app/page.tsx
"use client";

import { useState } from "react";
// Import the interface along with the list
import { STOCK_LIST, StockSymbol } from "@/lib/stockList";

export default function Home() {
  const [selectedStock, setSelectedStock] = useState<string>(STOCK_LIST[0].symbol);
  const [timeframe, setTimeframe] = useState<string>("1M");
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch(
        `/api/analyze?symbol=${selectedStock}&timeframe=${timeframe}`
      );
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      console.error(err);
      alert("Failed to analyze. Please check the console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-linear-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
            Indian Stock Analyzer
          </h1>
          <p className="text-slate-400">Nifty 500 & F&O Advanced Analysis</p>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 p-6 rounded-xl border border-slate-800">
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-400">Select Stock</label>
            <select
              value={selectedStock}
              onChange={(e) => setSelectedStock(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {/* We explicitly type 'stock' here */}
              {STOCK_LIST.map((stock: StockSymbol) => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-400">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="1W">1 Week (Short Term)</option>
              <option value="1M">1 Month (Short-Medium)</option>
              <option value="3M">3 Months (Medium Term)</option>
              <option value="6M">6 Months (Medium-Long)</option>
              <option value="1Y">1 Year (Long Term)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-lg transition-all"
            >
              {loading ? "Analyzing..." : "Run Analysis"}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {analysis && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-center">
                <p className="text-slate-400 mb-2">Recommendation</p>
                <h2 className={`text-3xl font-black ${
                  analysis.recommendation === 'BUY' ? 'text-green-400' : 
                  analysis.recommendation === 'SELL' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {analysis.recommendation}
                </h2>
              </div>
              
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-center">
                <p className="text-slate-400 mb-2">Technical Score</p>
                <h2 className="text-3xl font-black text-white">{analysis.score}/100</h2>
              </div>

              <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-center">
                <p className="text-slate-400 mb-2">Current Price</p>
                <h2 className="text-3xl font-black text-white">₹{analysis.price.toFixed(2)}</h2>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h3 className="text-xl font-bold mb-4 text-white">Analysis Breakdown</h3>
              <ul className="space-y-3">
                {analysis.details.map((detail: string, index: number) => (
                  <li key={index} className="flex items-start gap-3 text-slate-300">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}