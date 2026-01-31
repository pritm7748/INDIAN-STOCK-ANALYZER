// src/app/(dashboard)/alerts/page.tsx
'use client'

import { useState } from 'react'
import { useAlerts } from '@/lib/hooks/useAlerts'
import { AlertList } from '@/components/alerts/AlertList'
import { AlertForm } from '@/components/alerts/AlertForm'
import { AlertHistory } from '@/components/alerts/AlertHistory'
import { Alert } from '@/lib/supabase/types'
import {
  Bell,
  Plus,
  History,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BellOff,
  RefreshCw,
  Loader2
} from 'lucide-react'

export default function AlertsPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null)
  const [activeTab, setActiveTab] = useState<'alerts' | 'history'>('alerts')

  const {
    alerts,
    history,
    isLoading,
    stats,
    createAlert,
    updateAlert,
    toggleAlert,
    deleteAlert,
    deleteAlerts,
    fetchAlerts,
    fetchHistory
  } = useAlerts()

  // Handle form submit
  const handleFormSubmit = async (input: any) => {
    if (editingAlert) {
      await updateAlert(editingAlert.id, input)
    } else {
      await createAlert(input)
    }
  }

  // Handle edit
  const handleEdit = (alert: Alert) => {
    setEditingAlert(alert)
    setShowForm(true)
  }

  // Handle close form
  const handleCloseForm = () => {
    setShowForm(false)
    setEditingAlert(null)
  }

  // Refresh data
  const handleRefresh = async () => {
    await Promise.all([fetchAlerts(), fetchHistory()])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Price Alerts</h1>
          <p className="text-gray-500">Get notified when conditions are met</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
          >
            <Plus size={18} />
            Create Alert
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Bell size={14} />
            <span className="text-xs font-medium uppercase">Total</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <TrendingUp size={14} />
            <span className="text-xs font-medium uppercase">Active</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <CheckCircle size={14} />
            <span className="text-xs font-medium uppercase">Triggered</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{stats.triggered}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <BellOff size={14} />
            <span className="text-xs font-medium uppercase">Inactive</span>
          </div>
          <p className="text-2xl font-bold text-gray-400">
            {stats.total - stats.active - stats.triggered}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white/5 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'alerts'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Bell size={16} />
          My Alerts
          {stats.active > 0 && (
            <span className="px-1.5 py-0.5 bg-white/20 rounded text-xs">
              {stats.active}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <History size={16} />
          History
          {history.length > 0 && (
            <span className="px-1.5 py-0.5 bg-white/20 rounded text-xs">
              {history.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6">
        {activeTab === 'alerts' ? (
          <AlertList
            alerts={alerts}
            isLoading={isLoading}
            onToggle={toggleAlert}
            onEdit={handleEdit}
            onDelete={deleteAlert}
            onDeleteMultiple={deleteAlerts}
          />
        ) : (
          <AlertHistory history={history} isLoading={isLoading} />
        )}
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <AlertTriangle size={20} className="text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-300 font-medium mb-1">
            How alerts work
          </p>
          <p className="text-xs text-blue-300/70">
            Alerts are checked every 5 minutes during market hours (9:15 AM - 3:30 PM IST). 
            You'll receive notifications through your selected channels when conditions are met.
            Email and Telegram notifications are coming soon!
          </p>
        </div>
      </div>

      {/* Alert Form Modal */}
      <AlertForm
        isOpen={showForm}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
        editingAlert={editingAlert}
      />
    </div>
  )
}