// src/components/alerts/AlertHistory.tsx
'use client'

import { AlertHistory as AlertHistoryType } from '@/lib/supabase/types'
import { AlertCondition } from '@/lib/hooks/useAlerts'
import Link from 'next/link'
import {
  Bell,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart2,
  Volume2,
  ArrowUpCircle,
  Clock,
  ExternalLink
} from 'lucide-react'

interface AlertHistoryProps {
  history: AlertHistoryType[]
  isLoading: boolean
}

export function AlertHistory({ history, isLoading }: AlertHistoryProps) {
  // Get icon for alert type
  const getIcon = (alertType: string) => {
    if (alertType.includes('price')) return TrendingUp
    if (alertType.includes('rsi')) return Activity
    if (alertType.includes('score')) return BarChart2
    if (alertType.includes('volume')) return Volume2
    if (alertType.includes('cross')) return ArrowUpCircle
    return Bell
  }

  // Format condition text
  const getConditionText = (condition: AlertCondition) => {
    const value = condition.indicator === 'price' 
      ? `₹${condition.value.toLocaleString('en-IN')}`
      : condition.value

    switch (condition.operator) {
      case 'above': return `went above ${value}`
      case 'below': return `went below ${value}`
      case 'crosses_above': return `crossed above ${condition.compareTo || value}`
      case 'crosses_below': return `crossed below ${condition.compareTo || value}`
      default: return `${condition.operator} ${value}`
    }
  }

  // Get indicator label
  const getIndicatorLabel = (indicator: string) => {
    switch (indicator) {
      case 'price': return 'Price'
      case 'rsi': return 'RSI'
      case 'score': return 'AI Score'
      case 'volume': return 'Volume'
      case 'sma_cross': return 'SMA Cross'
      default: return indicator
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-white/5 rounded-xl" />
        ))}
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-gray-500/10 rounded-2xl flex items-center justify-center mb-4">
          <Clock size={32} className="text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-white mb-1">No alert history</h3>
        <p className="text-gray-500 text-sm">
          Triggered alerts will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {history.map((item) => {
        const condition = item.condition as unknown as AlertCondition
        const Icon = getIcon(item.alert_type)

        return (
          <div
            key={item.id}
            className="flex items-start gap-4 p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/[0.07] transition-colors"
          >
            <div className="p-2.5 bg-emerald-500/20 rounded-xl">
              <Icon size={20} className="text-emerald-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href={`/dashboard?symbol=${item.symbol}`}
                  className="font-semibold text-white hover:text-blue-400 transition-colors"
                >
                  {item.symbol.replace('.NS', '')}
                </Link>
                <span className="text-xs text-gray-500">
                  {getIndicatorLabel(condition.indicator)}
                </span>
              </div>

              <p className="text-sm text-gray-300 mb-2">
                {getConditionText(condition)}
                {item.triggered_value && (
                  <span className="text-gray-500">
                    {' '}at ₹{item.triggered_value.toLocaleString('en-IN')}
                  </span>
                )}
              </p>

              {item.message && (
                <p className="text-xs text-gray-400 mb-2">{item.message}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(item.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                {item.notification_sent_to && item.notification_sent_to.length > 0 && (
                  <span>
                    Sent via: {item.notification_sent_to.join(', ')}
                  </span>
                )}
              </div>
            </div>

            <Link
              href={`/dashboard?symbol=${item.symbol}`}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="View analysis"
            >
              <ExternalLink size={16} />
            </Link>
          </div>
        )
      })}
    </div>
  )
}