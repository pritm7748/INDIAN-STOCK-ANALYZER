// src/app/page.tsx
"use client";

import { useState } from "react";
import { STOCK_LIST, StockSymbol } from "@/lib/stockList";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { ArrowUp, ArrowDown, Activity, BarChart2, Zap, TrendingUp } from 'lucide-react';

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
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysis(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-emerald-400";
    if (score <= 40) return "text-rose-400";
    return "text-yellow-400";
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl">
          <p className="text-slate-400 text-xs mb-1">{label}</p>
          <p className="text-white font-bold text-lg">
            ₹{payload[0].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <main className="min-h-screen bg-[#050505] text-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navbar */}
        <div className="flex flex-col md:flex-row justify-between items-center border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 p-2 rounded-lg">
                <TrendingUp size={24} className="text-white" />
             </div>
             <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  TradeSense AI
                </h1>
                <p className="text-gray-500 text-xs uppercase tracking-wider">Pro Market Analytics</p>
             </div>
          </div>
          
          <div className="flex gap-3 mt-4 md:mt-0 w-full md:w-auto bg-white/5 p-1 rounded-xl">
             <select
              value={selectedStock}
              onChange={(e) => setSelectedStock(e.target.value)}
              className="bg-transparent text-white text-sm px-4 py-2 outline-none w-full md:w-48 cursor-pointer [&>option]:bg-slate-900"
            >
              {STOCK_LIST.map((stock: StockSymbol) => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.name}
                </option>
              ))}
            </select>
            <div className="w-px bg-white/10 my-2"></div>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-transparent text-white text-sm px-4 py-2 outline-none cursor-pointer [&>option]:bg-slate-900"
            >
              <option value="1M">1 Month</option>
              <option value="3M">3 Months</option>
              <option value="6M">6 Months</option>
              <option value="1Y">1 Year</option>
            </select>

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg transition-all text-sm shadow-lg shadow-blue-500/20"
            >
              {loading ? "Analysing..." : "Run Analysis"}
            </button>
          </div>
        </div>

        {/* DASHBOARD CONTENT */}
        {analysis && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500">
            
            {/* MAIN CHART SECTION (Left - 8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Price Banner */}
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1">{analysis.symbol}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-light text-white">₹{analysis.price.toFixed(2)}</span>
                    <span className={`flex items-center px-2 py-1 rounded-md text-sm font-medium ${analysis.change >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {analysis.change >= 0 ? <ArrowUp size={16} className="mr-1" /> : <ArrowDown size={16} className="mr-1" />}
                      {Math.abs(analysis.change).toFixed(2)} ({analysis.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className={`px-6 py-2 rounded-xl text-sm font-bold tracking-wide border ${
                    analysis.recommendation.includes('BUY') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    analysis.recommendation.includes('SELL') ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                    'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  }`}>
                    {analysis.recommendation}
                </div>
              </div>

              {/* Advanced Chart */}
              <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 h-112.5 shadow-2xl relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 left-0 w-full h-full bg-blue-500/5 blur-3xl pointer-events-none"></div>
                
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analysis.history}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#666" 
                      fontSize={12} 
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="#666" 
                      fontSize={12} 
                      domain={['auto', 'auto']} 
                      tickLine={false}
                      axisLine={false}
                      dx={-10}
                      tickFormatter={(value) => `₹${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorPrice)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* SIDEBAR METRICS (Right - 4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Score Gauge */}
              <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none"></div>
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6">AI Technical Score</h3>
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="80" cy="80" r="70" stroke="#1f2937" strokeWidth="12" fill="none" />
                    <circle 
                      cx="80" cy="80" r="70" 
                      stroke={analysis.score >= 60 ? "#10b981" : analysis.score <= 40 ? "#f43f5e" : "#eab308"} 
                      strokeWidth="12" 
                      fill="none" 
                      strokeDasharray={440} 
                      strokeDashoffset={440 - (440 * analysis.score) / 100}
                      className="transition-all duration-1000 ease-out"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-bold ${getScoreColor(analysis.score)}`}>
                      {analysis.score}
                    </span>
                    <span className="text-xs text-gray-500 uppercase mt-1">out of 100</span>
                  </div>
                </div>
              </div>

              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <Activity size={14} /> <span className="text-xs font-medium uppercase">RSI (14)</span>
                  </div>
                  <p className={`text-2xl font-bold ${
                    analysis.metrics.rsi > 70 ? 'text-rose-400' : 
                    analysis.metrics.rsi < 30 ? 'text-emerald-400' : 'text-white'
                  }`}>
                    {analysis.metrics.rsi.toFixed(1)}
                  </p>
                </div>
                
                <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <BarChart2 size={14} /> <span className="text-xs font-medium uppercase">MACD</span>
                  </div>
                  <p className={`text-2xl font-bold ${
                    analysis.metrics.macdHistogram > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {analysis.metrics.macdHistogram > 0 ? 'Bullish' : 'Bearish'}
                  </p>
                </div>
              </div>

              {/* Signals List */}
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl grow">
                <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                  <Zap size={14} className="text-yellow-400" /> Active Signals
                </h3>
                <div className="space-y-3">
                  {analysis.details.map((detail: string, index: number) => (
                    <div key={index} className="flex gap-3 items-start text-sm p-3 bg-white/5 rounded-lg border border-white/5">
                      <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        detail.includes("Bullish") || detail.includes("Uptrend") || detail.includes("BUY") ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                        detail.includes("Bearish") || detail.includes("Downtrend") || detail.includes("SELL") ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : 
                        "bg-gray-400"
                      }`} />
                      <span className="text-gray-300 leading-snug">{detail}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </main>
  );
}