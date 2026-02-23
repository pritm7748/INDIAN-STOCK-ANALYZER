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
  Zap,
  Info,
} from 'lucide-react'

// Stat Card Component
function StatCard({
  icon: Icon,
  label,
  value,
  color,
  delay = 0
}: {
  icon: any
  label: string
  value: number
  color: string
  delay?: number
}) {
  const colorClasses: Record<string, { bg: string; text: string; glow: string }> = {
    blue: { bg: 'from-blue-500/20 to-cyan-500/20', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
    emerald: { bg: 'from-emerald-500/20 to-teal-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
    amber: { bg: 'from-amber-500/20 to-orange-500/20', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
    gray: { bg: 'from-gray-500/20 to-slate-500/20', text: 'text-gray-400', glow: 'shadow-gray-500/20' },
  }
  const style = colorClasses[color] || colorClasses.gray

  return (
    <div
      className={`glass-card p-4 hover:shadow-lg ${style.glow} transition-all duration-300 animate-fade-in-up`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className={`flex items-center gap-2 ${style.text} mb-2`}>
        <Icon size={14} />
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${style.text}`}>{value}</p>
    </div>
  )
}

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

  // Handle toggle
  const handleToggle = async (id: string, isActive: boolean): Promise<void> => {
    await toggleAlert(id, isActive)
  }

  // Handle delete
  const handleDelete = async (id: string): Promise<void> => {
    await deleteAlert(id)
  }

  // Handle delete multiple
  const handleDeleteMultiple = async (ids: string[]): Promise<void> => {
    await deleteAlerts(ids)
  }

  // Refresh data
  const handleRefresh = async () => {
    await Promise.all([fetchAlerts(), fetchHistory()])
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in-down">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg shadow-amber-500/20">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Price Alerts</h1>
            <p className="text-gray-500">Get notified when conditions are met</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2.5 rounded-xl glass-card text-gray-400 hover:text-white hover:bg-white/[0.07] transition-all disabled:opacity-50 group"
            title="Refresh"
          >
            <RefreshCw size={18} className={`${isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform" />
            Create Alert
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Bell} label="Total" value={stats.total} color="blue" delay={0.05} />
        <StatCard icon={TrendingUp} label="Active" value={stats.active} color="emerald" delay={0.1} />
        <StatCard icon={CheckCircle} label="Triggered" value={stats.triggered} color="amber" delay={0.15} />
        <StatCard icon={BellOff} label="Inactive" value={stats.total - stats.active - stats.triggered} color="gray" delay={0.2} />
      </div>

      {/* Tabs */}
      <div
        className="flex gap-2 p-1 bg-white/5 rounded-xl w-fit animate-fade-in-up"
        style={{ animationDelay: '0.25s' }}
      >
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'alerts'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
        >
          <Bell size={16} />
          My Alerts
          {stats.active > 0 && (
            <span className={`px-1.5 py-0.5 rounded text-xs ${activeTab === 'alerts' ? 'bg-white/20' : 'bg-emerald-500/30 text-emerald-400'}`}>
              {stats.active}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'history'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
        >
          <History size={16} />
          History
          {history.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded text-xs ${activeTab === 'history' ? 'bg-white/20' : 'bg-white/10'}`}>
              {history.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div
        className="glass-card p-6 animate-fade-in-up"
        style={{ animationDelay: '0.3s' }}
      >
        {activeTab === 'alerts' ? (
          <AlertList
            alerts={alerts}
            isLoading={isLoading}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDeleteMultiple={handleDeleteMultiple}
          />
        ) : (
          <AlertHistory history={history} isLoading={isLoading} />
        )}
      </div>

      {/* Info Banner */}
      <div
        className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl animate-fade-in-up"
        style={{ animationDelay: '0.35s' }}
      >
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Info size={16} className="text-blue-400" />
        </div>
        <div>
          <p className="text-sm text-blue-300 font-medium mb-1 flex items-center gap-2">
            How alerts work
            <Zap size={12} className="text-amber-400 animate-pulse" />
          </p>
          <p className="text-xs text-blue-300/70">
            Alerts are checked every 5 minutes during market hours (9:15 AM - 3:30 PM IST).
            You&apos;ll receive notifications through your selected channels when conditions are met.
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