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
  CheckCircle,
  Sparkles
} from 'lucide-react'

export default async function LandingPage() {

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If authenticated, redirect to dashboard
  if (user) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-[#0e0e0e] text-gray-100">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0e0e0e]/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="bg-gradient-to-br from-[#8455ef] to-[#ba9eff] p-2 rounded-xl">
                  <TrendingUp size={20} className="text-white" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-br from-[#8455ef] to-[#ba9eff] rounded-xl blur opacity-20" />
              </div>
              <span className="text-xl font-bold text-white font-display">TradeSense</span>
              <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#8455ef] to-[#ba9eff] font-display">AI</span>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-[#adaaaa] hover:text-white transition-colors duration-400 text-sm font-medium"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="px-5 py-2 bg-gradient-to-r from-[#8455ef] to-[#ba9eff] text-white text-sm font-medium rounded-full transition-all duration-400 shadow-lg shadow-[#8455ef]/25 hover:shadow-[#8455ef]/40 hover:-translate-y-0.5"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#8455ef]/10 border border-[#8455ef]/20 rounded-full text-[#ba9eff] text-sm mb-8">
            <Sparkles size={14} />
            <span>AI-Powered Market Intelligence</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white mb-6 leading-tight font-display tracking-tight">
            AI-Powered Stock
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8455ef] via-[#ba9eff] to-[#69f6b8]">
              Analysis for Indian
            </span>
            <br />
            Markets
          </h1>

          <p className="text-lg text-[#adaaaa] max-w-2xl mx-auto mb-10 leading-relaxed">
            Unlock insights across 500+ stocks with 15+ real-time indicators,
            ML predictions, and advanced backtesting — built for the NSE & BSE.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-[#8455ef] to-[#ba9eff] text-white font-semibold rounded-full transition-all duration-400 text-lg shadow-lg shadow-[#8455ef]/30 hover:shadow-[#8455ef]/50 hover:-translate-y-1"
            >
              Start Analyzing Free
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform duration-400" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-transparent border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.04)] text-white font-medium rounded-full transition-all duration-400 text-lg"
            >
              Sign In
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-8 mt-14 text-sm text-[#777575]">
            <span className="flex items-center gap-2">
              <CheckCircle size={16} className="text-[#69f6b8]" />
              500+ Stocks Supported
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle size={16} className="text-[#69f6b8]" />
              Real-time Data
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle size={16} className="text-[#69f6b8]" />
              No Credit Card Required
            </span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 font-display">
              Engineered for Precision
            </h2>
            <p className="text-[#adaaaa] max-w-2xl mx-auto">
              Advanced analytical tools designed to give you an unfair advantage in the Indian markets
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Activity,
                title: "Technical Indicators",
                description: "RSI, MACD, Bollinger Bands, Stochastic RSI, Ichimoku Cloud, Supertrend, ADX, and more — tuned for NSE.",
                accent: "#8455ef"
              },
              {
                icon: Brain,
                title: "AI Predictions",
                description: "ML models analyzing market data to predict probabilities with high accuracy and confidence intervals.",
                accent: "#ba9eff"
              },
              {
                icon: Target,
                title: "Backtesting Engine",
                description: "Test your strategies against decades of historical data with detailed performance reports and Sharpe ratios.",
                accent: "#69f6b8"
              },
              {
                icon: Shield,
                title: "Risk Analytics",
                description: "Real-time Beta, Alpha, VaR, Max Drawdown, and portfolio risk tracking to protect your capital.",
                accent: "#ff6e84"
              },
              {
                icon: BarChart2,
                title: "Volume Analysis",
                description: "Identify smart money footprints through advanced volume profiles, OBV, and VWAP analysis.",
                accent: "#fbbf24"
              },
              {
                icon: Gauge,
                title: "Smart Scoring",
                description: "AI-driven composite scores combining fundamentals, technicals, and sentiment for actionable insights.",
                accent: "#22d3ee"
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-7 bg-[#131313] rounded-2xl hover:bg-[#1a1919] transition-all duration-500 relative overflow-hidden"
              >
                {/* Subtle top-left glow */}
                <div
                  className="absolute -top-20 -left-20 w-40 h-40 rounded-full blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity duration-700"
                  style={{ background: feature.accent }}
                />
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 relative"
                  style={{ background: `${feature.accent}15` }}
                >
                  <feature.icon size={24} style={{ color: feature.accent }} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 font-display">{feature.title}</h3>
                <p className="text-[#adaaaa] text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Indicators Showcase */}
      <section className="py-24 px-4 relative">
        {/* Atmospheric gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#8455ef]/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 font-display">
              Advanced Indicators Suite
            </h2>
            <p className="text-[#adaaaa]">
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
              <div key={i} className="p-5 bg-[#131313] rounded-xl text-center hover:bg-[#1a1919] transition-all duration-500 group">
                <indicator.icon size={24} className="mx-auto mb-3 text-[#ba9eff] group-hover:text-[#8455ef] transition-colors duration-400" />
                <p className="text-white font-medium font-display">{indicator.name}</p>
                <p className="text-xs text-[#777575] mt-1">{indicator.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center relative">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#8455ef]/10 via-[#ba9eff]/5 to-[#69f6b8]/10 rounded-3xl blur-3xl -z-10" />
          <div className="bg-[#131313] rounded-3xl p-12 sm:p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-60 h-60 bg-[#8455ef]/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#69f6b8]/8 rounded-full blur-[100px]" />
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 relative font-display">
              Ready to Elevate
              <br />Your Trading?
            </h2>
            <p className="text-[#adaaaa] mb-8 relative">
              Join thousands of Indian traders who leverage TradeSense AI to make data-driven decisions.
            </p>
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#8455ef] to-[#ba9eff] text-white font-semibold rounded-full transition-all duration-400 text-lg shadow-lg shadow-[#8455ef]/30 hover:shadow-[#8455ef]/50 hover:-translate-y-1 relative"
            >
              Get Started Now
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform duration-400" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-br from-[#8455ef] to-[#ba9eff] p-1.5 rounded-lg">
              <TrendingUp size={16} className="text-white" />
            </div>
            <span className="text-sm text-[#777575]">© 2025 TradeSense AI</span>
          </div>
          <p className="text-xs text-[#494847]">
            Data from Yahoo Finance • For educational purposes • Not financial advice
          </p>
        </div>
      </footer>

      {/* Background Organic Blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-[#8455ef]/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] bg-[#ba9eff]/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-[#69f6b8]/4 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-[400px] h-[400px] bg-[#8455ef]/5 rounded-full blur-[120px]" />
      </div>
    </main>
  )
}