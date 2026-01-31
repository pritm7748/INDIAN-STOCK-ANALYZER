// src/components/alerts/AlertForm.tsx
'use client'

import { useState, useEffect } from 'react'
import { Alert } from '@/lib/supabase/types'
import { AlertCondition, CreateAlertInput } from '@/lib/hooks/useAlerts'
import { STOCK_LIST } from '@/lib/stockList'
import {
  X,
  Search,
  Bell,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart2,
  Volume2,
  ArrowUpCircle,
  Loader2,
  Info,
  Smartphone,
  Mail,
  MessageCircle,
  Globe
} from 'lucide-react'

interface AlertFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: CreateAlertInput) => Promise<void>
  editingAlert?: Alert | null
  defaultSymbol?: string
}

const ALERT_TYPES = [
  { 
    id: 'price_above', 
    indicator: 'price', 
    operator: 'above',
    label: 'Price Above', 
    description: 'Trigger when price goes above a value',
    icon: TrendingUp,
    color: 'emerald'
  },
  { 
    id: 'price_below', 
    indicator: 'price', 
    operator: 'below',
    label: 'Price Below', 
    description: 'Trigger when price goes below a value',
    icon: TrendingDown,
    color: 'rose'
  },
  { 
    id: 'rsi_above', 
    indicator: 'rsi', 
    operator: 'above',
    label: 'RSI Overbought', 
    description: 'Trigger when RSI goes above a level (e.g., 70)',
    icon: Activity,
    color: 'orange'
  },
  { 
    id: 'rsi_below', 
    indicator: 'rsi', 
    operator: 'below',
    label: 'RSI Oversold', 
    description: 'Trigger when RSI goes below a level (e.g., 30)',
    icon: Activity,
    color: 'cyan'
  },
  { 
    id: 'score_above', 
    indicator: 'score', 
    operator: 'above',
    label: 'AI Score Above', 
    description: 'Trigger when AI score goes above a value',
    icon: BarChart2,
    color: 'purple'
  },
  { 
    id: 'score_below', 
    indicator: 'score', 
    operator: 'below',
    label: 'AI Score Below', 
    description: 'Trigger when AI score goes below a value',
    icon: BarChart2,
    color: 'yellow'
  },
  { 
    id: 'volume_spike', 
    indicator: 'volume', 
    operator: 'above',
    label: 'Volume Spike', 
    description: 'Trigger when volume is X times above average',
    icon: Volume2,
    color: 'blue'
  },
  { 
    id: 'golden_cross', 
    indicator: 'sma_cross', 
    operator: 'crosses_above',
    label: 'Golden Cross', 
    description: 'Trigger when SMA50 crosses above SMA200',
    icon: ArrowUpCircle,
    color: 'emerald'
  },
  { 
    id: 'death_cross', 
    indicator: 'sma_cross', 
    operator: 'crosses_below',
    label: 'Death Cross', 
    description: 'Trigger when SMA50 crosses below SMA200',
    icon: ArrowUpCircle,
    color: 'rose'
  },
]

const NOTIFICATION_CHANNELS = [
  { id: 'in_app', label: 'In-App', icon: Globe, available: true },
  { id: 'browser_push', label: 'Browser Push', icon: Smartphone, available: true },
  { id: 'email', label: 'Email', icon: Mail, available: false, comingSoon: true },
  { id: 'telegram', label: 'Telegram', icon: MessageCircle, available: false, comingSoon: true },
]

export function AlertForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editingAlert,
  defaultSymbol 
}: AlertFormProps) {
  const [step, setStep] = useState<'type' | 'details'>('type')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [selectedType, setSelectedType] = useState<typeof ALERT_TYPES[0] | null>(null)
  const [symbol, setSymbol] = useState(defaultSymbol || '')
  const [symbolSearch, setSymbolSearch] = useState('')
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false)
  const [value, setValue] = useState<string>('')
  const [channels, setChannels] = useState<string[]>(['in_app', 'browser_push'])
  const [isRecurring, setIsRecurring] = useState(false)
  const [expiresIn, setExpiresIn] = useState<string>('never')

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      if (editingAlert) {
        // Populate form with existing alert data
        const condition = editingAlert.condition as AlertCondition
        const alertType = ALERT_TYPES.find(t => 
          t.indicator === condition.indicator && t.operator === condition.operator
        )
        setSelectedType(alertType || null)
        setSymbol(editingAlert.symbol)
        setValue(condition.value.toString())
        setChannels(editingAlert.notification_channels || ['in_app'])
        setIsRecurring(editingAlert.is_recurring || false)
        setStep('details')
      } else {
        // Reset for new alert
        setSelectedType(null)
        setSymbol(defaultSymbol || '')
        setValue('')
        setChannels(['in_app', 'browser_push'])
        setIsRecurring(false)
        setExpiresIn('never')
        setStep('type')
      }
      setError(null)
    }
  }, [isOpen, editingAlert, defaultSymbol])

  // Filter stocks for search
  const filteredStocks = STOCK_LIST.filter(stock => {
    const query = symbolSearch.toLowerCase()
    return (
      stock.symbol.toLowerCase().includes(query) ||
      stock.name.toLowerCase().includes(query)
    )
  }).slice(0, 10)

  // Get default value based on type
  const getDefaultValue = (type: typeof ALERT_TYPES[0]) => {
    switch (type.indicator) {
      case 'rsi': return type.operator === 'above' ? '70' : '30'
      case 'score': return type.operator === 'above' ? '70' : '40'
      case 'volume': return '2' // 2x average
      default: return ''
    }
  }

  // Handle type selection
  const handleTypeSelect = (type: typeof ALERT_TYPES[0]) => {
    setSelectedType(type)
    setValue(getDefaultValue(type))
    setStep('details')
  }

  // Handle symbol selection
  const handleSymbolSelect = (stockSymbol: string, stockName: string) => {
    setSymbol(stockSymbol)
    setSymbolSearch(stockName)
    setShowSymbolDropdown(false)
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedType || !symbol || !value) {
      setError('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const stockData = STOCK_LIST.find(s => s.symbol === symbol)
      
      // Calculate expiry date
      let expiresAt: string | undefined
      if (expiresIn !== 'never') {
        const now = new Date()
        switch (expiresIn) {
          case '1d': now.setDate(now.getDate() + 1); break
          case '1w': now.setDate(now.getDate() + 7); break
          case '1m': now.setMonth(now.getMonth() + 1); break
          case '3m': now.setMonth(now.getMonth() + 3); break
        }
        expiresAt = now.toISOString()
      }

      const input: CreateAlertInput = {
        symbol,
        stockName: stockData?.name,
        alertType: selectedType.id,
        condition: {
          indicator: selectedType.indicator as AlertCondition['indicator'],
          operator: selectedType.operator as AlertCondition['operator'],
          value: parseFloat(value),
          compareTo: selectedType.indicator === 'sma_cross' ? 'sma200' : undefined,
        },
        notificationChannels: channels,
        isRecurring,
        expiresAt,
      }

      await onSubmit(input)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create alert')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get value label based on type
  const getValueLabel = () => {
    if (!selectedType) return 'Value'
    switch (selectedType.indicator) {
      case 'price': return 'Target Price (₹)'
      case 'rsi': return 'RSI Level (0-100)'
      case 'score': return 'AI Score (0-100)'
      case 'volume': return 'Volume Multiplier (e.g., 2 = 2x average)'
      default: return 'Value'
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-x-4 top-[5%] z-50 mx-auto max-w-lg max-h-[90vh] overflow-y-auto bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/5 bg-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Bell size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {editingAlert ? 'Edit Alert' : 'Create Alert'}
              </h2>
              <p className="text-xs text-gray-500">
                {step === 'type' ? 'Choose alert type' : 'Configure alert'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <p className="text-sm text-rose-400">{error}</p>
          </div>
        )}

        {/* Step 1: Select Type */}
        {step === 'type' && (
          <div className="p-4 space-y-3">
            {ALERT_TYPES.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.id}
                  onClick={() => handleTypeSelect(type)}
                  className="flex items-center gap-4 w-full p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl transition-all text-left"
                >
                  <div className={`p-2.5 rounded-xl bg-${type.color}-500/20`}>
                    <Icon size={20} className={`text-${type.color}-400`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{type.label}</p>
                    <p className="text-xs text-gray-500">{type.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 2: Configure Details */}
        {step === 'details' && selectedType && (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Back button */}
            {!editingAlert && (
              <button
                type="button"
                onClick={() => setStep('type')}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                ← Back to alert types
              </button>
            )}

            {/* Selected type badge */}
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl">
              <selectedType.icon size={18} className={`text-${selectedType.color}-400`} />
              <span className="text-sm font-medium text-white">{selectedType.label}</span>
            </div>

            {/* Symbol Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Stock Symbol *
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={symbolSearch || STOCK_LIST.find(s => s.symbol === symbol)?.name || symbol}
                  onChange={(e) => {
                    setSymbolSearch(e.target.value)
                    setShowSymbolDropdown(true)
                  }}
                  onFocus={() => setShowSymbolDropdown(true)}
                  placeholder="Search for a stock..."
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* Dropdown */}
                {showSymbolDropdown && symbolSearch && (
                  <div className="absolute z-20 w-full mt-1 max-h-60 overflow-y-auto bg-[#0A0A0A] border border-white/10 rounded-xl shadow-xl">
                    {filteredStocks.length > 0 ? (
                      filteredStocks.map((stock) => (
                        <button
                          key={stock.symbol}
                          type="button"
                          onClick={() => handleSymbolSelect(stock.symbol, stock.name)}
                          className="flex items-center justify-between w-full px-4 py-3 hover:bg-white/5 transition-colors"
                        >
                          <div>
                            <p className="font-medium text-white">{stock.symbol.replace('.NS', '')}</p>
                            <p className="text-xs text-gray-500">{stock.name}</p>
                          </div>
                          {stock.sector && (
                            <span className="text-[10px] px-2 py-0.5 bg-white/5 text-gray-400 rounded">
                              {stock.sector}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-3 text-sm text-gray-500">No stocks found</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Value Input */}
            {selectedType.indicator !== 'sma_cross' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {getValueLabel()} *
                </label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  step={selectedType.indicator === 'price' ? '0.01' : '1'}
                  min={0}
                  max={selectedType.indicator === 'rsi' || selectedType.indicator === 'score' ? 100 : undefined}
                  placeholder={`Enter ${selectedType.indicator} value`}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {selectedType.indicator === 'rsi' && (
                  <p className="mt-1 text-xs text-gray-500">
                    Typical: Overbought &gt; 70, Oversold &lt; 30
                  </p>
                )}
              </div>
            )}

            {/* Notification Channels */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notification Channels
              </label>
              <div className="grid grid-cols-2 gap-2">
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => {
                      if (!channel.available) return
                      setChannels(prev => 
                        prev.includes(channel.id)
                          ? prev.filter(c => c !== channel.id)
                          : [...prev, channel.id]
                      )
                    }}
                    disabled={!channel.available}
                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                      channels.includes(channel.id)
                        ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                        : channel.available
                        ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                        : 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <channel.icon size={16} />
                    <span className="text-sm">{channel.label}</span>
                    {channel.comingSoon && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded">Soon</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-4">
              {/* Recurring */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Alert Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRecurring(false)}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all ${
                      !isRecurring
                        ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                        : 'bg-white/5 border-white/10 text-gray-400'
                    }`}
                  >
                    One-time
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRecurring(true)}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all ${
                      isRecurring
                        ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                        : 'bg-white/5 border-white/10 text-gray-400'
                    }`}
                  >
                    Recurring
                  </button>
                </div>
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Expires In
                </label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-900"
                >
                  <option value="never">Never</option>
                  <option value="1d">1 Day</option>
                  <option value="1w">1 Week</option>
                  <option value="1m">1 Month</option>
                  <option value="3m">3 Months</option>
                </select>
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300">
                {isRecurring 
                  ? 'Recurring alerts will re-arm automatically after being triggered.'
                  : 'One-time alerts will be disabled after being triggered once.'}
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !symbol || (!value && selectedType.indicator !== 'sma_cross')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {editingAlert ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Bell size={18} />
                  {editingAlert ? 'Update Alert' : 'Create Alert'}
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </>
  )
}