// src/app/(auth)/layout.tsx
import { TrendingUp, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col bg-gradient-mesh relative">
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px]" />
      </div>

      {/* Header */}
      <header className="p-6 animate-fade-in-down">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="relative">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2.5 rounded-xl shadow-lg group-hover:shadow-blue-500/30 transition-all duration-300">
              <TrendingUp size={22} className="text-white" />
            </div>
            <div className="absolute -inset-1 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white">TradeSense</span>
            <span className="text-xl font-bold text-gradient">AI</span>
            <Sparkles size={14} className="text-yellow-400 animate-pulse" />
          </div>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full animate-scale-in">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center animate-fade-in-up">
        <p className="text-xs text-gray-600">
          © 2024 TradeSense AI. All rights reserved.
        </p>
      </footer>
    </div>
  )
}