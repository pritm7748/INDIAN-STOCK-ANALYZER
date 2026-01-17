// src/app/(dashboard)/screener/page.tsx
import { Search, Filter } from 'lucide-react'

export default function ScreenerPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Stock Screener</h1>
          <p className="text-gray-500">Find stocks matching your criteria</p>
        </div>
      </div>

      {/* Coming Soon State */}
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
          <Search size={40} className="text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Coming Soon</h2>
        <p className="text-gray-500 max-w-md">
          Screen stocks by technical indicators, fundamentals, and AI score. 
          Find the best opportunities in the market.
        </p>
      </div>
    </div>
  )
}