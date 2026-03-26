// src/app/(auth)/layout.tsx
import { TrendingUp, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0e0e0e] flex flex-col relative">
      {/* Organic Background Blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#8455ef]/12 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#ba9eff]/10 rounded-full blur-[120px] animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-2/3 w-[300px] h-[300px] bg-[#69f6b8]/6 rounded-full blur-[120px] animate-float" style={{ animationDelay: '3s' }} />
      </div>

      {/* Header */}
      <header className="p-6 animate-fade-in-down">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="relative">
            <div className="bg-gradient-to-br from-[#8455ef] to-[#ba9eff] p-2.5 rounded-xl shadow-lg group-hover:shadow-[#8455ef]/30 transition-all duration-500">
              <TrendingUp size={22} className="text-white" />
            </div>
            <div className="absolute -inset-1 bg-gradient-to-br from-[#8455ef] to-[#ba9eff] rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white font-display">TradeSense</span>
            <span className="text-xl font-bold text-gradient font-display">AI</span>
            <Sparkles size={14} className="text-[#ba9eff] animate-pulse" />
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
        <p className="text-xs text-[#494847]">
          © 2025 TradeSense AI. All rights reserved.
        </p>
      </footer>
    </div>
  )
}