// src/app/page.tsx
"use client";

import { useState } from "react";
import { STOCK_LIST, StockSymbol } from "@/lib/stockList";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { ArrowUp, ArrowDown, Activity, BarChart2, Zap, TrendingUp, ScanEye, Newspaper, Briefcase, History, BrainCircuit } from 'lucide-react';

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

  const formatLargeNumber = (num: number) => {
    if (!num) return "N/A";
    if (num >= 1.0e+7) return (num / 1.0e+7).toFixed(2) + " Cr";
    if (num >= 1.0e+5) return (num / 1.0e+5).toFixed(2) + " L";
    return num.toString();
  }

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
              <option value="1W">1 Week</option>
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
            
            {/* LEFT COLUMN (8 cols) */}
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

              {/* Chart */}
              <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 h-[400px] shadow-2xl relative overflow-hidden">
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
                    
                    {/* Support Lines (Green) */}
                    {analysis.levels?.support?.map((level: number, i: number) => (
                      <ReferenceLine 
                        key={`sup-${i}`} 
                        y={level} 
                        stroke="#10b981" 
                        strokeDasharray="3 3" 
                        label={{ value: 'SUP', position: 'insideRight', fill: '#10b981', fontSize: 10 }} 
                      />
                    ))}

                    {/* Resistance Lines (Red) */}
                    {analysis.levels?.resistance?.map((level: number, i: number) => (
                      <ReferenceLine 
                        key={`res-${i}`} 
                        y={level} 
                        stroke="#f43f5e" 
                        strokeDasharray="3 3" 
                        label={{ value: 'RES', position: 'insideRight', fill: '#f43f5e', fontSize: 10 }} 
                      />
                    ))}

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

              {/* Patterns & News Container */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Patterns */}
                <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                  <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                    <ScanEye size={14} className="text-blue-400" /> Patterns
                  </h3>
                  {analysis.patterns.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analysis.patterns.map((pattern: string, i: number) => (
                        <div key={i} className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-md text-xs font-medium">
                          {pattern}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm italic">No patterns detected.</p>
                  )}
                </div>

                {/* Signals List */}
                <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                    <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                    <Zap size={14} className="text-yellow-400" /> Active Signals
                    </h3>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                    {analysis.details.map((detail: string, index: number) => (
                        <div key={index} className="flex gap-2 items-start text-xs p-2 bg-white/5 rounded border border-white/5">
                        <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                            detail.includes("Bullish") || detail.includes("Uptrend") || detail.includes("Positive") || detail.includes("BUY") ? "bg-emerald-500" :
                            detail.includes("Bearish") || detail.includes("Downtrend") || detail.includes("Negative") || detail.includes("SELL") ? "bg-rose-500" : 
                            "bg-gray-400"
                        }`} />
                        <span className="text-gray-300 leading-snug">{detail}</span>
                        </div>
                    ))}
                    </div>
                </div>

              </div>

            </div>

            {/* RIGHT COLUMN (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Score Gauge */}
              <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
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

              {/* AI Forecast */}
              {analysis.prediction && analysis.prediction.length > 0 && (
                <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                  <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                    <BrainCircuit size={14} className="text-purple-400" /> AI Forecast ({timeframe})
                  </h3>
                  
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Target (Avg)</p>
                      <p className="text-xl font-bold text-white">
                        ₹{analysis.prediction[analysis.prediction.length - 1].price.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Trend</p>
                      <p className={`text-sm font-bold ${
                        analysis.prediction[analysis.prediction.length - 1].price > analysis.price 
                          ? 'text-emerald-400' 
                          : 'text-rose-400'
                      }`}>
                        {analysis.prediction[analysis.prediction.length - 1].price > analysis.price ? 'BULLISH' : 'BEARISH'}
                      </p>
                    </div>
                  </div>

                  <div className="h-[100px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analysis.prediction}>
                        <defs>
                          <linearGradient id="colorCone" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" hide />
                        <YAxis domain={['auto', 'auto']} hide />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: '12px' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(val: number) => `₹${val.toFixed(2)}`}
                          labelStyle={{ color: '#888' }}
                        />
                        <Area type="monotone" dataKey="upper" stroke="none" fill="#8b5cf6" fillOpacity={0.1} />
                        <Area type="monotone" dataKey="price" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorCone)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-gray-500">
                    <span>{analysis.prediction[0].date}</span>
                    <span>{analysis.prediction[analysis.prediction.length - 1].date}</span>
                  </div>
                </div>
              )}

              {/* Fundamentals Card (Crash Fixed) */}
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                  <Briefcase size={14} className="text-emerald-400" /> Fundamentals
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Market Cap</p>
                    <p className="text-sm font-bold text-white">
                        ₹{formatLargeNumber(analysis.fundamentals?.marketCap)}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">P/E Ratio</p>
                    <p className={`text-sm font-bold ${analysis.fundamentals?.peRatio < 20 ? 'text-emerald-400' : 'text-white'}`}>
                      {analysis.fundamentals?.peRatio ? analysis.fundamentals.peRatio.toFixed(2) : 'N/A'}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">P/B Ratio</p>
                    <p className="text-sm font-bold text-white">
                      {analysis.fundamentals?.pbRatio ? analysis.fundamentals.pbRatio.toFixed(2) : 'N/A'}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">52W High</p>
                    <p className="text-sm font-bold text-white">₹{analysis.fundamentals?.fiftyTwoWeekHigh || 'N/A'}</p>
                  </div>
                </div>
              </div>

               {/* Metrics Grid */}
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

              {/* Backtest Accuracy Card */}
              {analysis.backtest && (
                <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                    <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                    <History size={14} className="text-orange-400" /> Model Accuracy ({timeframe})
                    </h3>
                    
                    <div className="flex items-end justify-between mb-2">
                    <span className="text-3xl font-bold text-white">{analysis.backtest.accuracy.toFixed(1)}%</span>
                    <span className={`text-sm font-medium ${analysis.backtest.totalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {analysis.backtest.totalReturn >= 0 ? '+' : ''}{analysis.backtest.totalReturn.toFixed(1)}% Return
                    </span>
                    </div>

                    <div className="w-full bg-gray-800 rounded-full h-2 mb-6">
                    <div 
                        className={`h-2 rounded-full ${analysis.backtest.accuracy > 50 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                        style={{ width: `${analysis.backtest.accuracy}%` }}
                    ></div>
                    </div>

                    <div className="space-y-3">
                    <p className="text-xs text-gray-500 mb-2">Recent Simulated Trades</p>
                    {analysis.backtest.results.slice(-4).reverse().map((trade: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs p-2 bg-white/5 rounded border border-white/5">
                        <div className="flex gap-2">
                            <span className="text-gray-400">{trade.date}</span>
                            <span className={`font-bold ${trade.signal === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {trade.signal}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className={trade.isWin ? 'text-emerald-400' : 'text-rose-400'}>
                            {trade.isWin ? 'WIN' : 'LOSS'} ({trade.returnPct.toFixed(1)}%)
                            </span>
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
                )}

              {/* NEWS FEED */}
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl flex-grow">
                <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                  <Newspaper size={14} className="text-purple-400" /> Recent News
                </h3>
                <div className="space-y-4">
                  {analysis.news.length > 0 ? analysis.news.map((item: any, index: number) => (
                    <a key={index} href={item.link} target="_blank" rel="noopener noreferrer" className="block group">
                        <div className="flex gap-3 items-start">
                            <div className={`mt-1.5 w-1 h-full rounded-full shrink-0 ${
                                item.sentiment === 'Positive' ? 'bg-emerald-500' : 
                                item.sentiment === 'Negative' ? 'bg-rose-500' : 'bg-gray-600'
                            }`} style={{ minHeight: '30px' }} />
                            <div>
                                <h4 className="text-sm text-gray-300 group-hover:text-blue-400 transition-colors line-clamp-2">
                                    {item.title}
                                </h4>
                                <p className="text-[10px] text-gray-600 mt-1">{new Date(item.pubDate).toDateString()}</p>
                            </div>
                        </div>
                    </a>
                  )) : (
                    <p className="text-gray-500 text-sm">No recent news found.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </main>
  );
}