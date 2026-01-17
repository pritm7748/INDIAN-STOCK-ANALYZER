// src/app/(dashboard)/alerts/page.tsx
import { Bell, Plus } from 'lucide-react'

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-gray-500">Get notified when price conditions are met</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors">
          <Plus size={18} />
          Create Alert
        </button>
      </div>

      {/* Coming Soon State */}
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-yellow-500/10 rounded-2xl flex items-center justify-center mb-6">
          <Bell size={40} className="text-yellow-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Coming Soon</h2>
        <p className="text-gray-500 max-w-md">
          Set price alerts, indicator triggers, and pattern notifications. 
          Get notified via Telegram or browser push.
        </p>
      </div>
    </div>
  )
}