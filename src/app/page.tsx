// src/app/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { STOCK_LIST, StockSymbol } from "@/lib/stockList";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, ComposedChart, Bar, Line
} from 'recharts';
import { 
  ArrowUp, ArrowDown, Activity, BarChart2, Zap, TrendingUp, TrendingDown,
  ScanEye, Newspaper, Briefcase, History, BrainCircuit, Volume2, 
  Shield, Target, AlertTriangle, Bookmark, BookmarkCheck, RefreshCw,
  ChevronDown, ChevronUp, Info, Gauge, Waves, LineChart
} from 'lucide-react';
import { VolatilityData } from "@/lib/types";

// Types for enhanced analysis
interface AnalysisData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  recommendation: string;
  score: number;
  confidence?: number;
  details: string[];
  patterns: string[];
  news: NewsItem[];
  fundamentals: FundamentalData;
  metrics: MetricData;
  levels: LevelData;
  risk: RiskData;
  volume?: VolumeData;  // Make it optional with ?
  volatility?: VolatilityData;  // Make it optional with ?
  zigzag: ZigZagPoint[];
  history: HistoryPoint[];
  backtest: BacktestData;
  prediction: PredictionPoint[];
}

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
}

interface FundamentalData {
  marketCap: number;
  peRatio: number;
  pbRatio: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  dividendYield?: number;
  eps?: number;
}

interface MetricData {
  rsi: number;
  macdHistogram: number;
  bollingerUpper: number;
  bollingerLower: number;
  bollingerMiddle?: number;
  sma50: number;
  sma200: number;
  ema9?: number;
  ema21?: number;
  atr?: number;
  adx?: number;
  supertrend?: { value: number; direction: 'UP' | 'DOWN' };
  stochRsi?: { k: number; d: number };
}

interface LevelData {
  support: number[];
  resistance: number[];
  pivot: number;
  r1: number;
  s1: number;
  r2?: number;
  s2?: number;
}

interface RiskData {
  beta: number;
  alpha: number;
  correlation: number;
  marketTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sharpeRatio?: number;
  sortinoRatio?: number;
  maxDrawdown?: number;
  maxDrawdownPercent?: number;
  volatility?: number;
  valueAtRisk?: number;
  riskGrade?: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH';
}

interface VolumeData {
  obv: number;
  obvTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  vwap: number;
  volumeSpike: boolean;
  avgVolume: number;
  currentVolume: number;
  volumeRatio: number;
  volumeTrend: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
}

interface VolatilityData {
  atr: number;
  atrPercent: number;
  supertrend: number;
  supertrendSignal: 'BUY' | 'SELL';
  adx: number;
  trendStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NO TREND';
  plusDI: number;
  minusDI: number;
}

interface ZigZagPoint {
  date: string;
  price: number;
  type: 'HIGH' | 'LOW';
}

interface HistoryPoint {
  date: string;
  price: number;
  volume?: number;
  sma50?: number;
  sma200?: number;
}

interface BacktestData {
  results: BacktestResult[];
  accuracy: number;
  totalReturn: number;
  winRate?: number;
  avgWin?: number;
  avgLoss?: number;
  profitFactor?: number;
}

interface BacktestResult {
  date: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  priceAtSignal: number;
  priceAfter: number;
  returnPct: number;
  isWin: boolean;
}

interface PredictionPoint {
  date: string;
  price: number;
  upper: number;
  lower: number;
  isFuture: boolean;
}

// Watchlist Hook
function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('stockWatchlist');
    if (saved) {
      setWatchlist(JSON.parse(saved));
    }
  }, []);

  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => {
      const updated = prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol];
      localStorage.setItem('stockWatchlist', JSON.stringify(updated));
      return updated;
    });
  };

  const isInWatchlist = (symbol: string) => watchlist.includes(symbol);

  return { watchlist, toggleWatchlist, isInWatchlist };
}

// Metric Card Component
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  color = 'white',
  tooltip 
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  subValue?: string;
  color?: string;
  tooltip?: string;
}) {
  const colorClasses: Record<string, string> = {
    white: 'text-white',
    green: 'text-emerald-400',
    red: 'text-rose-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
  };

  return (
    <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-xl hover:border-white/10 transition-colors group relative">
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-xs text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
          {tooltip}
        </div>
      )}
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        <Icon size={14} /> 
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>
        {value}
      </p>
      {subValue && (
        <p className="text-xs text-gray-500 mt-1">{subValue}</p>
      )}
    </div>
  );
}

// Section Header Component
function SectionHeader({ icon: Icon, title, color = 'blue' }: { icon: any; title: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    red: 'text-rose-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
  };

  return (
    <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
      <Icon size={14} className={colorClasses[color]} /> {title}
    </h3>
  );
}

// Collapsible Section Component
function CollapsibleSection({ 
  title, 
  icon: Icon, 
  color = 'blue',
  defaultOpen = true, 
  children 
}: { 
  title: string; 
  icon: any;
  color?: string;
  defaultOpen?: boolean; 
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <SectionHeader icon={Icon} title={title} color={color} />
        {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {isOpen && (
        <div className="px-6 pb-6 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

// Main Component
export default function Home() {
  const [selectedStock, setSelectedStock] = useState<string>(STOCK_LIST[0].symbol);
  const [timeframe, setTimeframe] = useState<string>("1M");
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showVolume, setShowVolume] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'technicals' | 'backtest'>('chart');

  const { watchlist, toggleWatchlist, isInWatchlist } = useWatchlist();

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    
    try {
      const res = await fetch(
        `/api/analyze?symbol=${selectedStock}&timeframe=${timeframe}`
      );
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error || "Analysis failed");
      }
      
      setAnalysis(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedStock, timeframe]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleAnalyze();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleAnalyze]);

  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-emerald-400";
    if (score <= 40) return "text-rose-400";
    return "text-yellow-400";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 60) return "from-emerald-500 to-emerald-600";
    if (score <= 40) return "from-rose-500 to-rose-600";
    return "from-yellow-500 to-yellow-600";
  };

  const formatLargeNumber = (num: number) => {
    if (!num) return "N/A";
    if (num >= 1.0e+12) return (num / 1.0e+12).toFixed(2) + " T";
    if (num >= 1.0e+9) return (num / 1.0e+9).toFixed(2) + " B";
    if (num >= 1.0e+7) return (num / 1.0e+7).toFixed(2) + " Cr";
    if (num >= 1.0e+5) return (num / 1.0e+5).toFixed(2) + " L";
    return num.toLocaleString('en-IN');
  };

  const formatPercent = (num: number | undefined) => {
    if (num === undefined || num === null) return "N/A";
    return `${num >= 0 ? '+' : ''}${(num * 100).toFixed(2)}%`;
  };

  const getRSIStatus = (rsi: number) => {
    if (rsi > 70) return { text: 'Overbought', color: 'red' };
    if (rsi < 30) return { text: 'Oversold', color: 'green' };
    if (rsi > 60) return { text: 'Bullish', color: 'green' };
    if (rsi < 40) return { text: 'Bearish', color: 'red' };
    return { text: 'Neutral', color: 'yellow' };
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl">
          <p className="text-slate-400 text-xs mb-1">{label}</p>
          <p className="text-white font-bold text-lg">
            ₹{payload[0].value?.toFixed(2)}
          </p>
          {payload[0].payload.volume && (
            <p className="text-gray-400 text-xs mt-1">
              Vol: {formatLargeNumber(payload[0].payload.volume)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const selectedStockData = STOCK_LIST.find(s => s.symbol === selectedStock);

  return (
    <main className="min-h-screen bg-[#050505] text-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header/Navbar */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-linear-to-br from-blue-600 to-blue-700 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
              <TrendingUp size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                TradeSense AI
              </h1>
              <p className="text-gray-500 text-xs uppercase tracking-wider">
                Pro Market Analytics • NSE/BSE
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Stock Selector */}
            <div className="flex gap-2 bg-white/5 p-1 rounded-xl flex-1 lg:flex-initial">
              <select
                value={selectedStock}
                onChange={(e) => setSelectedStock(e.target.value)}
                className="bg-transparent text-white text-sm px-4 py-2.5 outline-none w-full lg:w-56 cursor-pointer [&>option]:bg-slate-900 rounded-lg hover:bg-white/5 transition-colors"
              >
                {watchlist.length > 0 && (
                  <optgroup label="⭐ Watchlist">
                    {STOCK_LIST.filter(s => watchlist.includes(s.symbol)).map((stock) => (
                      <option key={`wl-${stock.symbol}`} value={stock.symbol}>
                        {stock.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="All Stocks">
                  {STOCK_LIST.map((stock: StockSymbol) => (
                    <option key={stock.symbol} value={stock.symbol}>
                      {stock.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              
              <div className="w-px bg-white/10 my-2"></div>
              
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="bg-transparent text-white text-sm px-4 py-2.5 outline-none cursor-pointer [&>option]:bg-slate-900 rounded-lg hover:bg-white/5 transition-colors"
              >
                <option value="1W">1 Week</option>
                <option value="1M">1 Month</option>
                <option value="3M">3 Months</option>
                <option value="6M">6 Months</option>
                <option value="1Y">1 Year</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => toggleWatchlist(selectedStock)}
                className={`p-2.5 rounded-xl transition-all ${
                  isInWatchlist(selectedStock) 
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
                title={isInWatchlist(selectedStock) ? "Remove from Watchlist" : "Add to Watchlist"}
              >
                {isInWatchlist(selectedStock) ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
              </button>

              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-xl transition-all text-sm shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Analyze
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="text-rose-400" size={20} />
            <p className="text-rose-400 text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-400 text-sm">Analyzing {selectedStockData?.name}...</p>
            <p className="text-gray-600 text-xs">Fetching market data, calculating indicators, running backtest...</p>
          </div>
        )}

        {/* DASHBOARD CONTENT */}
        {analysis && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500">
            
            {/* LEFT COLUMN (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Price Banner */}
              <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-white">{analysis.symbol.replace('.NS', '')}</h2>
                      {selectedStockData?.sector && (
                        <span className="px-2 py-0.5 bg-white/5 text-gray-400 rounded text-xs">
                          {selectedStockData.sector}
                        </span>
                      )}
                      {analysis.risk?.marketTrend && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          analysis.risk.marketTrend === 'BULLISH' 
                            ? 'bg-emerald-500/10 text-emerald-400' 
                            : analysis.risk.marketTrend === 'BEARISH'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-gray-500/10 text-gray-400'
                        }`}>
                          Market: {analysis.risk.marketTrend}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-light text-white">
                        ₹{analysis.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className={`flex items-center px-2.5 py-1 rounded-lg text-sm font-medium ${
                        analysis.change >= 0 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {analysis.change >= 0 ? <ArrowUp size={16} className="mr-1" /> : <ArrowDown size={16} className="mr-1" />}
                        {Math.abs(analysis.change).toFixed(2)} ({analysis.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                    
                    {/* 52 Week Range Bar */}
                    {analysis.fundamentals?.fiftyTwoWeekLow && analysis.fundamentals?.fiftyTwoWeekHigh && (
                      <div className="mt-4 max-w-md">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>52W Low: ₹{analysis.fundamentals.fiftyTwoWeekLow.toFixed(2)}</span>
                          <span>52W High: ₹{analysis.fundamentals.fiftyTwoWeekHigh.toFixed(2)}</span>
                        </div>
                        <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="absolute h-full bg-linear-to-r from-rose-500 via-yellow-500 to-emerald-500 rounded-full"
                            style={{ width: '100%' }}
                          />
                          <div 
                            className="absolute w-3 h-3 bg-white rounded-full shadow-lg -top-0.5 transform -translate-x-1/2"
                            style={{ 
                              left: `${((analysis.price - analysis.fundamentals.fiftyTwoWeekLow) / 
                                (analysis.fundamentals.fiftyTwoWeekHigh - analysis.fundamentals.fiftyTwoWeekLow)) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className={`px-6 py-3 rounded-xl text-sm font-bold tracking-wide border ${
                    analysis.recommendation.includes('STRONG BUY') ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                    analysis.recommendation.includes('BUY') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    analysis.recommendation.includes('STRONG SELL') ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' :
                    analysis.recommendation.includes('SELL') ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                    'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  }`}>
                    {analysis.recommendation}
                  </div>
                </div>
              </div>

              {/* Chart Tabs */}
              <div className="flex gap-2 bg-white/5 p-1 rounded-xl w-fit">
                {[
                  { id: 'chart', label: 'Price Chart', icon: LineChart },
                  { id: 'technicals', label: 'Indicators', icon: Activity },
                  { id: 'backtest', label: 'Backtest', icon: History },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <tab.icon size={16} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Main Chart */}
              {activeTab === 'chart' && (
                <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full bg-blue-500/5 blur-3xl pointer-events-none"></div>
                  
                  {/* Chart Controls */}
                  <div className="flex justify-between items-center mb-4 relative z-10">
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-500">Show:</span>
                      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={showVolume}
                          onChange={(e) => setShowVolume(e.target.checked)}
                          className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-blue-500"
                        />
                        Volume
                      </label>
                    </div>
                    <div className="flex gap-2">
                      {analysis.levels?.support?.length > 0 && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <div className="w-3 h-0.5 bg-emerald-400"></div> Support
                        </span>
                      )}
                      {analysis.levels?.resistance?.length > 0 && (
                        <span className="text-xs text-rose-400 flex items-center gap-1">
                          <div className="w-3 h-0.5 bg-rose-400"></div> Resistance
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="h-100">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={analysis.history}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#666" 
                          fontSize={11} 
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          yAxisId="price"
                          stroke="#666" 
                          fontSize={11} 
                          domain={['auto', 'auto']} 
                          tickLine={false}
                          axisLine={false}
                          dx={-10}
                          tickFormatter={(value) => `₹${value.toFixed(0)}`}
                        />
                        {showVolume && (
                          <YAxis 
                            yAxisId="volume"
                            orientation="right"
                            stroke="#666" 
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => formatLargeNumber(value)}
                          />
                        )}
                        <Tooltip content={<CustomTooltip />} />
                        
                        {/* Support Lines */}
                        {analysis.levels?.support?.map((level: number, i: number) => (
                          <ReferenceLine 
                            key={`sup-${i}`} 
                            yAxisId="price"
                            y={level} 
                            stroke="#10b981" 
                            strokeDasharray="5 5" 
                            strokeOpacity={0.7}
                          />
                        ))}

                        {/* Resistance Lines */}
                        {analysis.levels?.resistance?.map((level: number, i: number) => (
                          <ReferenceLine 
                            key={`res-${i}`}
                            yAxisId="price" 
                            y={level} 
                            stroke="#f43f5e" 
                            strokeDasharray="5 5" 
                            strokeOpacity={0.7}
                          />
                        ))}

                        {/* SMA Lines */}
                        {analysis.history[0]?.sma50 && (
                          <Line 
                            yAxisId="price"
                            type="monotone" 
                            dataKey="sma50" 
                            stroke="#f59e0b" 
                            strokeWidth={1}
                            dot={false}
                            strokeOpacity={0.7}
                          />
                        )}
                        {analysis.history[0]?.sma200 && (
                          <Line 
                            yAxisId="price"
                            type="monotone" 
                            dataKey="sma200" 
                            stroke="#ef4444" 
                            strokeWidth={1}
                            dot={false}
                            strokeOpacity={0.7}
                          />
                        )}

                        {/* Volume Bars */}
                        {showVolume && (
                          <Bar 
                            yAxisId="volume"
                            dataKey="volume" 
                            fill="url(#colorVolume)"
                            opacity={0.5}
                          />
                        )}

                        {/* Price Area */}
                        <Area 
                          yAxisId="price"
                          type="monotone" 
                          dataKey="price" 
                          stroke="#3b82f6" 
                          strokeWidth={2.5}
                          fillOpacity={1} 
                          fill="url(#colorPrice)" 
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Technical Indicators Tab */}
              {activeTab === 'technicals' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard 
                    icon={Activity}
                    label="RSI (14)"
                    value={analysis.metrics.rsi.toFixed(1)}
                    subValue={getRSIStatus(analysis.metrics.rsi).text}
                    color={getRSIStatus(analysis.metrics.rsi).color}
                    tooltip="Relative Strength Index: >70 Overbought, <30 Oversold"
                  />
                  <MetricCard 
                    icon={BarChart2}
                    label="MACD"
                    value={analysis.metrics.macdHistogram > 0 ? 'Bullish' : 'Bearish'}
                    subValue={`Histogram: ${analysis.metrics.macdHistogram.toFixed(2)}`}
                    color={analysis.metrics.macdHistogram > 0 ? 'green' : 'red'}
                    tooltip="Moving Average Convergence Divergence"
                  />
                  <MetricCard 
                    icon={TrendingUp}
                    label="SMA 50"
                    value={`₹${analysis.metrics.sma50.toFixed(2)}`}
                    subValue={analysis.price > analysis.metrics.sma50 ? 'Price Above' : 'Price Below'}
                    color={analysis.price > analysis.metrics.sma50 ? 'green' : 'red'}
                    tooltip="50-day Simple Moving Average"
                  />
                  <MetricCard 
                    icon={TrendingDown}
                    label="SMA 200"
                    value={`₹${analysis.metrics.sma200.toFixed(2)}`}
                    subValue={analysis.price > analysis.metrics.sma200 ? 'Price Above' : 'Price Below'}
                    color={analysis.price > analysis.metrics.sma200 ? 'green' : 'red'}
                    tooltip="200-day Simple Moving Average"
                  />
                  <MetricCard 
                    icon={Waves}
                    label="BB Upper"
                    value={`₹${analysis.metrics.bollingerUpper.toFixed(2)}`}
                    color="white"
                    tooltip="Bollinger Band Upper (2 Std Dev)"
                  />
                  <MetricCard 
                    icon={Waves}
                    label="BB Lower"
                    value={`₹${analysis.metrics.bollingerLower.toFixed(2)}`}
                    color="white"
                    tooltip="Bollinger Band Lower (2 Std Dev)"
                  />
                  {analysis.metrics.atr && (
                    <MetricCard 
                      icon={Target}
                      label="ATR (14)"
                      value={`₹${analysis.metrics.atr.toFixed(2)}`}
                      subValue={`${((analysis.metrics.atr / analysis.price) * 100).toFixed(2)}% of price`}
                      color="yellow"
                      tooltip="Average True Range - Volatility Indicator"
                    />
                  )}
                  {analysis.metrics.adx && (
                    <MetricCard 
                      icon={Gauge}
                      label="ADX"
                      value={analysis.metrics.adx.toFixed(1)}
                      subValue={analysis.metrics.adx > 25 ? 'Strong Trend' : 'Weak Trend'}
                      color={analysis.metrics.adx > 25 ? 'green' : 'yellow'}
                      tooltip="Average Directional Index - Trend Strength"
                    />
                  )}
                </div>
              )}

              {/* Backtest Tab */}
              {activeTab === 'backtest' && analysis.backtest && (
                <div className="space-y-6">
                  {/* Backtest Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard 
                      icon={Target}
                      label="Win Rate"
                      value={`${analysis.backtest.accuracy.toFixed(1)}%`}
                      color={analysis.backtest.accuracy > 50 ? 'green' : 'red'}
                    />
                    <MetricCard 
                      icon={TrendingUp}
                      label="Total Return"
                      value={`${analysis.backtest.totalReturn >= 0 ? '+' : ''}${analysis.backtest.totalReturn.toFixed(1)}%`}
                      color={analysis.backtest.totalReturn >= 0 ? 'green' : 'red'}
                    />
                    <MetricCard 
                      icon={History}
                      label="Total Trades"
                      value={analysis.backtest.results.length}
                      color="white"
                    />
                    <MetricCard 
                      icon={Activity}
                      label="Wins/Losses"
                      value={`${analysis.backtest.results.filter(r => r.isWin).length}/${analysis.backtest.results.filter(r => !r.isWin).length}`}
                      color="white"
                    />
                  </div>

                  {/* Trade History */}
                  <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6">
                    <SectionHeader icon={History} title="Trade History" color="orange" />
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b border-white/5">
                            <th className="pb-3 font-medium">Date</th>
                            <th className="pb-3 font-medium">Signal</th>
                            <th className="pb-3 font-medium">Entry Price</th>
                            <th className="pb-3 font-medium">Exit Price</th>
                            <th className="pb-3 font-medium">Return</th>
                            <th className="pb-3 font-medium">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.backtest.results.slice(-10).reverse().map((trade, i) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-3 text-gray-400">{trade.date}</td>
                              <td className={`py-3 font-medium ${trade.signal === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {trade.signal}
                              </td>
                              <td className="py-3 text-white">₹{trade.priceAtSignal.toFixed(2)}</td>
                              <td className="py-3 text-white">₹{trade.priceAfter.toFixed(2)}</td>
                              <td className={`py-3 font-medium ${trade.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {trade.returnPct >= 0 ? '+' : ''}{trade.returnPct.toFixed(2)}%
                              </td>
                              <td className="py-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  trade.isWin 
                                    ? 'bg-emerald-500/10 text-emerald-400' 
                                    : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                  {trade.isWin ? 'WIN' : 'LOSS'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Patterns & Signals Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Patterns */}
                <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                  <SectionHeader icon={ScanEye} title="Detected Patterns" color="blue" />
                  {analysis.patterns.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analysis.patterns.map((pattern: string, i: number) => (
                        <div 
                          key={i} 
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                            pattern.toLowerCase().includes('bullish') || pattern.toLowerCase().includes('bottom') || pattern.toLowerCase().includes('hammer')
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : pattern.toLowerCase().includes('bearish') || pattern.toLowerCase().includes('top') || pattern.toLowerCase().includes('shooting')
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                          }`}
                        >
                          {pattern}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm italic">No patterns detected in current timeframe.</p>
                  )}
                </div>

                {/* Active Signals */}
                <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                  <SectionHeader icon={Zap} title="Active Signals" color="yellow" />
                  <div className="space-y-2 max-h-45 overflow-y-auto pr-2 custom-scrollbar">
                    {analysis.details.map((detail: string, index: number) => (
                      <div 
                        key={index} 
                        className="flex gap-2 items-start text-xs p-2.5 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                          detail.toLowerCase().includes("bullish") || 
                          detail.toLowerCase().includes("uptrend") || 
                          detail.toLowerCase().includes("positive") || 
                          detail.toLowerCase().includes("buy") ||
                          detail.toLowerCase().includes("golden") ||
                          detail.toLowerCase().includes("support") ||
                          detail.toLowerCase().includes("oversold") ||
                          detail.toLowerCase().includes("undervalued")
                            ? "bg-emerald-500" 
                            : detail.toLowerCase().includes("bearish") || 
                              detail.toLowerCase().includes("downtrend") || 
                              detail.toLowerCase().includes("negative") || 
                              detail.toLowerCase().includes("sell") ||
                              detail.toLowerCase().includes("death") ||
                              detail.toLowerCase().includes("resistance") ||
                              detail.toLowerCase().includes("overbought") ||
                              detail.toLowerCase().includes("overvalued")
                            ? "bg-rose-500" 
                            : "bg-yellow-500"
                        }`} />
                        <span className="text-gray-300 leading-snug">{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Volume Analysis */}
{analysis.volume && (
  <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
    <SectionHeader icon={Volume2} title="Volume Analysis" color="purple" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 bg-white/5 rounded-xl">
        <p className="text-xs text-gray-500 mb-1">Today's Volume</p>
        <p className="text-lg font-bold text-white">
          {formatLargeNumber(analysis.volume.currentVolume ?? 0)}
        </p>
      </div>
      <div className="p-4 bg-white/5 rounded-xl">
        <p className="text-xs text-gray-500 mb-1">Avg Volume (20D)</p>
        <p className="text-lg font-bold text-white">
          {formatLargeNumber(analysis.volume.avgVolume ?? 0)}
        </p>
      </div>
      <div className="p-4 bg-white/5 rounded-xl">
        <p className="text-xs text-gray-500 mb-1">Volume Ratio</p>
        <p className={`text-lg font-bold ${
          (analysis.volume.volumeRatio ?? 0) > 1.5 
            ? 'text-emerald-400' 
            : (analysis.volume.volumeRatio ?? 0) < 0.5 
              ? 'text-rose-400' 
              : 'text-white'
        }`}>
          {(analysis.volume.volumeRatio ?? 0).toFixed(2)}x
        </p>
        {analysis.volume.volumeSpike && (
          <span className="text-xs text-yellow-400">🔥 Volume Spike!</span>
        )}
      </div>
      <div className="p-4 bg-white/5 rounded-xl">
        <p className="text-xs text-gray-500 mb-1">OBV Trend</p>
        <p className={`text-lg font-bold ${
          analysis.volume.obvTrend === 'BULLISH' 
            ? 'text-emerald-400' 
            : analysis.volume.obvTrend === 'BEARISH' 
              ? 'text-rose-400' 
              : 'text-white'
        }`}>
          {analysis.volume.obvTrend ?? 'N/A'}
        </p>
      </div>
    </div>
    
    {/* Additional Volume Info Row */}
    <div className="grid grid-cols-2 gap-4 mt-4">
      <div className="p-4 bg-white/5 rounded-xl">
        <p className="text-xs text-gray-500 mb-1">VWAP</p>
        <p className={`text-lg font-bold ${
          analysis.price > (analysis.volume.vwap ?? 0) 
            ? 'text-emerald-400' 
            : 'text-rose-400'
        }`}>
          ₹{(analysis.volume.vwap ?? 0).toFixed(2)}
        </p>
        <p className="text-[10px] text-gray-600">
          {analysis.price > (analysis.volume.vwap ?? 0) ? 'Price Above VWAP' : 'Price Below VWAP'}
        </p>
      </div>
      <div className="p-4 bg-white/5 rounded-xl">
        <p className="text-xs text-gray-500 mb-1">Volume Trend</p>
        <p className={`text-lg font-bold ${
          analysis.volume.volumeTrend === 'ACCUMULATION' 
            ? 'text-emerald-400' 
            : analysis.volume.volumeTrend === 'DISTRIBUTION' 
              ? 'text-rose-400' 
              : 'text-white'
        }`}>
          {analysis.volume.volumeTrend ?? 'NEUTRAL'}
        </p>
      </div>
    </div>
  </div>
)}

            </div>

            {/* RIGHT COLUMN (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Score Gauge */}
              <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-b from-blue-500/5 to-transparent pointer-events-none"></div>
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6 relative z-10">AI Technical Score</h3>
                <div className="relative w-44 h-44 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="88" cy="88" r="75" stroke="#1f2937" strokeWidth="10" fill="none" />
                    <circle 
                      cx="88" cy="88" r="75" 
                      stroke={analysis.score >= 60 ? "#10b981" : analysis.score <= 40 ? "#f43f5e" : "#eab308"} 
                      strokeWidth="10" 
                      fill="none" 
                      strokeDasharray={471} 
                      strokeDashoffset={471 - (471 * analysis.score) / 100}
                      className="transition-all duration-1000 ease-out"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-5xl font-bold ${getScoreColor(analysis.score)}`}>
                      {analysis.score}
                    </span>
                    <span className="text-xs text-gray-500 uppercase mt-1">out of 100</span>
                  </div>
                </div>
                <div className="mt-6 flex gap-4 text-xs">
                  <span className="flex items-center gap-1 text-rose-400">
                    <div className="w-2 h-2 bg-rose-400 rounded-full"></div> 0-40 Sell
                  </span>
                  <span className="flex items-center gap-1 text-yellow-400">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div> 40-60 Hold
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div> 60-100 Buy
                  </span>
                </div>
              </div>

              {/* Risk Metrics */}
              {analysis.risk && (
                <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                  <SectionHeader icon={Shield} title="Risk Metrics" color="red" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Beta (vs Nifty)</p>
                      <p className={`text-lg font-bold ${
                        analysis.risk.beta > 1.2 ? 'text-rose-400' : 
                        analysis.risk.beta < 0.8 ? 'text-emerald-400' : 'text-white'
                      }`}>
                        {analysis.risk.beta.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-600">
                        {analysis.risk.beta > 1 ? 'More volatile' : 'Less volatile'}
                      </p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Alpha (Annual)</p>
                      <p className={`text-lg font-bold ${analysis.risk.alpha >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPercent(analysis.risk.alpha)}
                      </p>
                      <p className="text-[10px] text-gray-600">
                        {analysis.risk.alpha >= 0 ? 'Outperforming' : 'Underperforming'}
                      </p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Correlation</p>
                      <p className="text-lg font-bold text-white">
                        {(analysis.risk.correlation * 100).toFixed(0)}%
                      </p>
                      <p className="text-[10px] text-gray-600">with Nifty 50</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Market Context</p>
                      <p className={`text-lg font-bold ${
                        analysis.risk.marketTrend === 'BULLISH' ? 'text-emerald-400' : 
                        analysis.risk.marketTrend === 'BEARISH' ? 'text-rose-400' : 'text-yellow-400'
                      }`}>
                        {analysis.risk.marketTrend}
                      </p>
                    </div>
                    {analysis.risk.sharpeRatio !== undefined && (
                      <div className="p-3 bg-white/5 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Sharpe Ratio</p>
                        <p className={`text-lg font-bold ${
                          analysis.risk.sharpeRatio > 1 ? 'text-emerald-400' : 
                          analysis.risk.sharpeRatio < 0 ? 'text-rose-400' : 'text-yellow-400'
                        }`}>
                          {analysis.risk.sharpeRatio.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {analysis.risk.maxDrawdown !== undefined && (
                      <div className="p-3 bg-white/5 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Max Drawdown</p>
                        <p className="text-lg font-bold text-rose-400">
                          {(analysis.risk.maxDrawdown * 100).toFixed(1)}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI Forecast */}
{analysis.prediction && analysis.prediction.length > 0 && (
  <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
    <SectionHeader icon={BrainCircuit} title={`AI Forecast (${timeframe})`} color="purple" />
    
    <div className="flex items-end justify-between mb-4">
      <div>
        <p className="text-xs text-gray-500">Target (Avg)</p>
        <p className="text-2xl font-bold text-white">
          ₹{analysis.prediction[analysis.prediction.length - 1].price.toFixed(2)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500">Expected Move</p>
        <p className={`text-lg font-bold ${
          analysis.prediction[analysis.prediction.length - 1].price > analysis.price 
            ? 'text-emerald-400' 
            : 'text-rose-400'
        }`}>
          {((analysis.prediction[analysis.prediction.length - 1].price - analysis.price) / analysis.price * 100).toFixed(1)}%
        </p>
      </div>
    </div>

    <div className="h-30 w-full">
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
            formatter={(value) => {
              const numValue = typeof value === 'number' ? value : Number(value) || 0;
              return [`₹${numValue.toFixed(2)}`, ''];
            }}
            labelStyle={{ color: '#888' }}
          />
          <Area type="monotone" dataKey="upper" stroke="none" fill="#8b5cf6" fillOpacity={0.1} />
          <Area type="monotone" dataKey="lower" stroke="none" fill="#8b5cf6" fillOpacity={0.1} />
          <Area type="monotone" dataKey="price" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorCone)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <div className="mt-2 flex justify-between text-[10px] text-gray-500">
      <span>{analysis.prediction[0]?.date}</span>
      <span>{analysis.prediction[analysis.prediction.length - 1]?.date}</span>
    </div>
    
    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
      <p className="text-xs text-yellow-400 flex items-center gap-2">
        <Info size={12} />
        AI predictions are based on historical patterns and should not be used as financial advice.
      </p>
    </div>
  </div>
)}

              {/* Fundamentals */}
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                <SectionHeader icon={Briefcase} title="Fundamentals" color="green" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Market Cap</p>
                    <p className="text-sm font-bold text-white">
                      ₹{formatLargeNumber(analysis.fundamentals?.marketCap)}
                    </p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">P/E Ratio</p>
                    <p className={`text-sm font-bold ${
                      analysis.fundamentals?.peRatio && analysis.fundamentals.peRatio < 20 
                        ? 'text-emerald-400' 
                        : analysis.fundamentals?.peRatio && analysis.fundamentals.peRatio > 40
                        ? 'text-rose-400'
                        : 'text-white'
                    }`}>
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
                    <p className="text-xs text-gray-500 mb-1">52W Range</p>
                    <p className="text-sm font-bold text-white">
                      ₹{analysis.fundamentals?.fiftyTwoWeekLow?.toFixed(0)} - ₹{analysis.fundamentals?.fiftyTwoWeekHigh?.toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pivot Points */}
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                <SectionHeader icon={Target} title="Pivot Points" color="blue" />
                <div className="space-y-2">
                  {analysis.levels?.resistance?.slice().reverse().map((r: number, i: number) => (
                    <div key={`r-${i}`} className="flex justify-between items-center p-2 bg-rose-500/5 rounded border border-rose-500/10">
                      <span className="text-xs text-rose-400">R{analysis.levels.resistance.length - i}</span>
                      <span className="text-sm font-medium text-white">₹{r.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-2 bg-blue-500/10 rounded border border-blue-500/20">
                    <span className="text-xs text-blue-400">Pivot</span>
                    <span className="text-sm font-bold text-white">₹{analysis.levels?.pivot?.toFixed(2)}</span>
                  </div>
                  {analysis.levels?.support?.map((s: number, i: number) => (
                    <div key={`s-${i}`} className="flex justify-between items-center p-2 bg-emerald-500/5 rounded border border-emerald-500/10">
                      <span className="text-xs text-emerald-400">S{i + 1}</span>
                      <span className="text-sm font-medium text-white">₹{s.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* News Feed */}
              <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                <SectionHeader icon={Newspaper} title="Recent News" color="purple" />
                <div className="space-y-4">
                  {analysis.news.length > 0 ? analysis.news.map((item: NewsItem, index: number) => (
                    <a 
                      key={index} 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="block group"
                    >
                      <div className="flex gap-3 items-start">
                        <div className={`mt-1.5 w-1 min-h-7.5 rounded-full shrink-0 ${
                          item.sentiment === 'Positive' ? 'bg-emerald-500' : 
                          item.sentiment === 'Negative' ? 'bg-rose-500' : 'bg-gray-600'
                        }`} />
                        <div className="flex-1">
                          <h4 className="text-sm text-gray-300 group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              item.sentiment === 'Positive' ? 'bg-emerald-500/10 text-emerald-400' :
                              item.sentiment === 'Negative' ? 'bg-rose-500/10 text-rose-400' :
                              'bg-gray-500/10 text-gray-400'
                            }`}>
                              {item.sentiment}
                            </span>
                            <span className="text-[10px] text-gray-600">
                              {new Date(item.pubDate).toLocaleDateString('en-IN', { 
                                day: 'numeric', 
                                month: 'short' 
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </a>
                  )) : (
                    <p className="text-gray-500 text-sm italic">No recent news found.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Empty State */}
        {!analysis && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
              <BarChart2 size={40} className="text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Ready to Analyze</h2>
            <p className="text-gray-500 max-w-md mb-6">
              Select a stock from the dropdown and click "Analyze" to get comprehensive 
              technical analysis, AI predictions, and trading signals.
            </p>
            <div className="flex gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Activity size={14} /> Technical Indicators
              </span>
              <span className="flex items-center gap-1">
                <BrainCircuit size={14} /> AI Predictions
              </span>
              <span className="flex items-center gap-1">
                <History size={14} /> Backtesting
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-white/5 pt-6 mt-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-600">
              © 2024 TradeSense AI • Data from Yahoo Finance • Not financial advice
            </p>
            <div className="flex gap-4 text-xs text-gray-600">
              <span>Press <kbd className="px-1.5 py-0.5 bg-white/5 rounded">⌘</kbd> + <kbd className="px-1.5 py-0.5 bg-white/5 rounded">Enter</kbd> to analyze</span>
            </div>
          </div>
        </footer>

      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
      `}</style>
    </main>
  );
}