// src/app/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { 
  TrendingUp, 
  BarChart2, 
  Brain, 
  Shield, 
  Zap, 
  ArrowRight,
  Activity,
  Target,
  Gauge,
  Cloud,
  LineChart,
  CheckCircle
} from 'lucide-react'

export default async function LandingPage() {

   const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // If authenticated, redirect to dashboard
  if (user) {
    redirect('/dashboard')
    
  }
  return (
    <main className="min-h-screen bg-[#050505] text-gray-100">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-linear-to-br from-blue-600 to-blue-700 p-2 rounded-xl">
                <TrendingUp size={20} className="text-white" />
              </div>
              <span className="text-xl font-bold text-white">TradeSense AI</span>
            </div>
            
            <div className="flex items-center gap-4">
              <Link 
                href="/login"
                className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
              >
                Sign in
              </Link>
              <Link 
                href="/signup"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm mb-8">
            <Zap size={14} />
            <span>Phase 2 - Advanced Technical Analysis</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            AI-Powered Stock Analysis
            <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-purple-400">
              for Indian Markets
            </span>
          </h1>
          
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
            Get comprehensive technical analysis with 15+ indicators, ML predictions, 
            backtesting, and real-time news sentiment for NSE stocks.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium rounded-xl transition-all text-lg shadow-lg shadow-blue-500/25"
            >
              Start Analyzing Free
              <ArrowRight size={20} />
            </Link>
            <Link 
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all text-lg"
            >
              Sign In
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-6 mt-12 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              500+ Stocks Supported
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              Real-time Data
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              No Credit Card Required
            </span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Professional-Grade Analysis Tools
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Everything you need to make informed trading decisions
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Activity,
                title: "15+ Technical Indicators",
                description: "RSI, MACD, Bollinger Bands, Stochastic RSI, Ichimoku Cloud, Supertrend, ADX, and more.",
                color: "blue"
              },
              {
                icon: Brain,
                title: "AI Predictions",
                description: "Machine learning models for price forecasting with confidence intervals.",
                color: "purple"
              },
              {
                icon: Target,
                title: "Backtesting Engine",
                description: "Test strategies against historical data with win rate and return metrics.",
                color: "orange"
              },
              {
                icon: Shield,
                title: "Risk Analytics",
                description: "Beta, Alpha, Sharpe Ratio, Max Drawdown, and VaR calculations.",
                color: "red"
              },
              {
                icon: BarChart2,
                title: "Volume Analysis",
                description: "OBV, VWAP, volume spikes, and accumulation/distribution detection.",
                color: "green"
              },
              {
                icon: Gauge,
                title: "Smart Scoring",
                description: "AI-powered composite score combining all indicators with confidence levels.",
                color: "cyan"
              }
            ].map((feature, i) => (
              <div 
                key={i}
                className="p-6 bg-[#0A0A0A] border border-white/5 rounded-2xl hover:border-white/10 transition-colors"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  feature.color === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                  feature.color === 'purple' ? 'bg-purple-500/10 text-purple-400' :
                  feature.color === 'orange' ? 'bg-orange-500/10 text-orange-400' :
                  feature.color === 'red' ? 'bg-red-500/10 text-red-400' :
                  feature.color === 'green' ? 'bg-emerald-500/10 text-emerald-400' :
                  'bg-cyan-500/10 text-cyan-400'
                }`}>
                  <feature.icon size={24} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Indicators Showcase */}
      <section className="py-20 px-4 bg-linear-to-b from-transparent via-blue-500/5 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Phase 2 Advanced Indicators
            </h2>
            <p className="text-gray-400">
              Professional-grade tools trusted by serious traders
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Gauge, name: "Stochastic RSI", desc: "K/D crossovers" },
              { icon: Cloud, name: "Ichimoku Cloud", desc: "Complete system" },
              { icon: LineChart, name: "Supertrend", desc: "Trend following" },
              { icon: Activity, name: "ADX", desc: "Trend strength" },
            ].map((indicator, i) => (
              <div key={i} className="p-4 bg-[#0A0A0A] border border-white/5 rounded-xl text-center">
                <indicator.icon size={24} className="mx-auto mb-2 text-blue-400" />
                <p className="text-white font-medium">{indicator.name}</p>
                <p className="text-xs text-gray-500">{indicator.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Elevate Your Trading?
          </h2>
          <p className="text-gray-400 mb-8">
            Join thousands of traders using AI-powered analysis for Indian markets.
          </p>
          <Link 
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium rounded-xl transition-all text-lg shadow-lg shadow-blue-500/25"
          >
            Get Started Free
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-linear-to-br from-blue-600 to-blue-700 p-1.5 rounded-lg">
              <TrendingUp size={16} className="text-white" />
            </div>
            <span className="text-sm text-gray-400">© 2024 TradeSense AI</span>
          </div>
          <p className="text-xs text-gray-600">
            Data from Yahoo Finance • For educational purposes • Not financial advice
          </p>
        </div>
      </footer>

      {/* Background Effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
      </div>
    </main>
  )
}