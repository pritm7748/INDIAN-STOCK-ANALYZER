// src/components/alerts/AlertCard.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Alert } from '@/lib/supabase/types'
import { AlertCondition } from '@/lib/hooks/useAlerts'
import {
  Bell,
  BellOff,
  Trash2,
  Edit3,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart2,
  Volume2,
  ArrowUpCircle,
  ArrowDownCircle,
  MoreHorizontal,
  Check,
  Clock,
  AlertTriangle,
  Repeat,
  ExternalLink,
  Loader2
} from 'lucide-react'

interface AlertCardProps {
  alert: Alert
  onToggle: (id: string, isActive: boolean) => Promise<void>
  onEdit: (alert: Alert) => void
  onDelete: (id: string) => Promise<void>
  currentPrice?: number
}

export function AlertCard({ 
  alert, 
  onToggle, 
  onEdit, 
  onDelete,
  currentPrice 
}: AlertCardProps) {
  const [isToggling, setIsToggling] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const condition = alert.condition as unknown as AlertCondition

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      await onToggle(alert.id, !alert.is_active)
    } finally {
      setIsToggling(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this alert?')) return
    setIsDeleting(true)
    try {
      await onDelete(alert.id)
    } finally {
      setIsDeleting(false)
    }
  }

  // Get indicator icon
  const getIndicatorIcon = () => {
    switch (condition.indicator) {
      case 'price': return TrendingUp
      case 'rsi': return Activity
      case 'score': return BarChart2
      case 'volume': return Volume2
      case 'macd': return TrendingDown
      case 'sma_cross': return ArrowUpCircle
      default: return Bell
    }
  }

  // Get indicator label
  const getIndicatorLabel = () => {
    switch (condition.indicator) {
      case 'price': return 'Price'
      case 'rsi': return 'RSI'
      case 'score': return 'AI Score'
      case 'volume': return 'Volume'
      case 'macd': return 'MACD'
      case 'sma_cross': return 'SMA Cross'
      default: return condition.indicator
    }
  }

  // Get condition description
  const getConditionText = () => {
    const value = condition.indicator === 'price' 
      ? `₹${condition.value.toLocaleString('en-IN')}`
      : condition.value

    switch (condition.operator) {
      case 'above': return `goes above ${value}`
      case 'below': return `goes below ${value}`
      case 'crosses_above': return `crosses above ${condition.compareTo || value}`
      case 'crosses_below': return `crosses below ${condition.compareTo || value}`
      default: return `${condition.operator} ${value}`
    }
  }

  // Calculate distance from trigger
  const getDistance = () => {
    if (!currentPrice || condition.indicator !== 'price') return null
    
    const distance = ((condition.value - currentPrice) / currentPrice) * 100
    return {
      percent: Math.abs(distance).toFixed(2),
      direction: distance > 0 ? 'above' : 'below',
      isClose: Math.abs(distance) < 5,
    }
  }

  const distance = getDistance()
  const IndicatorIcon = getIndicatorIcon()
  const isExpired = alert.expires_at && new Date(alert.expires_at) < new Date()

  // Status color
  const getStatusColor = () => {
    if (alert.is_triggered) return 'border-emerald-500/30 bg-emerald-500/5'
    if (isExpired) return 'border-gray-500/30 bg-gray-500/5 opacity-60'
    if (!alert.is_active) return 'border-gray-500/30 bg-gray-500/5'
    if (distance?.isClose) return 'border-yellow-500/30 bg-yellow-500/5'
    return 'border-white/10 bg-white/5'
  }

  return (
    <div className={`relative p-4 rounded-xl border transition-all ${getStatusColor()}`}>
      {/* Status Badge */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {alert.is_triggered && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
            <Check size={12} />
            Triggered
          </span>
        )}
        {isExpired && !alert.is_triggered && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">
            <Clock size={12} />
            Expired
          </span>
        )}
        {alert.is_recurring && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
            <Repeat size={12} />
            Recurring
          </span>
        )}
        {distance?.isClose && alert.is_active && !alert.is_triggered && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full animate-pulse">
            <AlertTriangle size={12} />
            Close!
          </span>
        )}
      </div>

      {/* Main Content */}
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`p-2.5 rounded-xl ${
          alert.is_triggered ? 'bg-emerald-500/20' :
          alert.is_active ? 'bg-blue-500/20' : 'bg-gray-500/20'
        }`}>
          <IndicatorIcon size={20} className={
            alert.is_triggered ? 'text-emerald-400' :
            alert.is_active ? 'text-blue-400' : 'text-gray-400'
          } />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link 
              href={`/dashboard?symbol=${alert.symbol}`}
              className="font-semibold text-white hover:text-blue-400 transition-colors"
            >
              {alert.symbol.replace('.NS', '')}
            </Link>
            <span className="text-xs text-gray-500">
              {alert.stock_name || alert.symbol}
            </span>
          </div>

          <p className="text-sm text-gray-300 mb-2">
            <span className="text-gray-500">{getIndicatorLabel()}</span>{' '}
            {getConditionText()}
          </p>

          {/* Distance indicator */}
          {distance && alert.is_active && !alert.is_triggered && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Current: ₹{currentPrice?.toLocaleString('en-IN')}</span>
              <span className={distance.isClose ? 'text-yellow-400' : 'text-gray-400'}>
                ({distance.percent}% {distance.direction})
              </span>
            </div>
          )}

          {/* Triggered info */}
          {alert.is_triggered && alert.triggered_at && (
            <div className="text-xs text-gray-500 mt-1">
              Triggered on {new Date(alert.triggered_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
              {alert.triggered_value && (
                <span> at ₹{alert.triggered_value.toLocaleString('en-IN')}</span>
              )}
            </div>
          )}

          {/* Notification channels */}
          <div className="flex items-center gap-2 mt-2">
            {alert.notification_channels?.map((channel) => (
              <span 
                key={channel}
                className="px-2 py-0.5 bg-white/5 text-gray-400 text-[10px] rounded uppercase"
              >
                {channel.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Toggle */}
          <button
            onClick={handleToggle}
            disabled={isToggling || alert.is_triggered}
            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
              alert.is_active 
                ? 'hover:bg-yellow-500/10 text-yellow-400' 
                : 'hover:bg-white/10 text-gray-400'
            }`}
            title={alert.is_active ? 'Disable alert' : 'Enable alert'}
          >
            {isToggling ? (
              <Loader2 size={18} className="animate-spin" />
            ) : alert.is_active ? (
              <Bell size={18} />
            ) : (
              <BellOff size={18} />
            )}
          </button>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
            >
              <MoreHorizontal size={18} />
            </button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-40 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
                  <button
                    onClick={() => {
                      onEdit(alert)
                      setShowMenu(false)
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <Edit3 size={14} />
                    Edit
                  </button>
                  <Link
                    href={`/dashboard?symbol=${alert.symbol}`}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                    onClick={() => setShowMenu(false)}
                  >
                    <ExternalLink size={14} />
                    Analyze
                  </Link>
                  <button
                    onClick={() => {
                      handleDelete()
                      setShowMenu(false)
                    }}
                    disabled={isDeleting}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    {isDeleting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}