// src/components/alerts/AlertList.tsx
'use client'

import { useState, useEffect } from 'react'
import { Alert } from '@/lib/supabase/types'
import { AlertCard } from './AlertCard'
import { AlertCondition } from '@/lib/hooks/useAlerts'
import {
  Bell,
  BellOff,
  Filter,
  Trash2,
  Loader2,
  Search,
  X
} from 'lucide-react'

interface AlertListProps {
  alerts: Alert[]
  isLoading: boolean
  onToggle: (id: string, isActive: boolean) => Promise<void>
  onEdit: (alert: Alert) => void
  onDelete: (id: string) => Promise<void>
  onDeleteMultiple: (ids: string[]) => Promise<void>
}

type FilterType = 'all' | 'active' | 'triggered' | 'inactive'
type SortType = 'newest' | 'oldest' | 'symbol'

export function AlertList({
  alerts,
  isLoading,
  onToggle,
  onEdit,
  onDelete,
  onDeleteMultiple
}: AlertListProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('newest')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [priceCache, setPriceCache] = useState<Record<string, number>>({})

  // Fetch current prices for alerts
  useEffect(() => {
    const fetchPrices = async () => {
      const uniqueSymbols = [...new Set(alerts.map(a => a.symbol))]
      
      for (const symbol of uniqueSymbols) {
        if (priceCache[symbol]) continue
        
        try {
          const res = await fetch(`/api/quote?symbol=${symbol}`)
          if (res.ok) {
            const data = await res.json()
            setPriceCache(prev => ({ ...prev, [symbol]: data.price }))
          }
        } catch (err) {
          console.error(`Failed to fetch price for ${symbol}`)
        }
      }
    }

    if (alerts.length > 0) {
      fetchPrices()
    }
  }, [alerts])

  // Filter and sort alerts
  const filteredAlerts = alerts
    .filter(alert => {
      // Search filter
      if (search) {
        const query = search.toLowerCase()
        const matchesSymbol = alert.symbol.toLowerCase().includes(query)
        const matchesName = alert.stock_name?.toLowerCase().includes(query)
        if (!matchesSymbol && !matchesName) return false
      }

      // Status filter
      switch (filter) {
        case 'active': return alert.is_active && !alert.is_triggered
        case 'triggered': return alert.is_triggered
        case 'inactive': return !alert.is_active
        default: return true
      }
    })
    .sort((a, b) => {
      switch (sort) {
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'symbol': return a.symbol.localeCompare(b.symbol)
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  // Select all
  const selectAll = () => {
    if (selectedIds.length === filteredAlerts.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredAlerts.map(a => a.id))
    }
  }

  // Delete selected
  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedIds.length} selected alerts?`)) return
    setIsDeleting(true)
    try {
      await onDeleteMultiple(selectedIds)
      setSelectedIds([])
    } finally {
      setIsDeleting(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-blue-500 mb-4" />
        <p className="text-gray-400">Loading alerts...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alerts..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {/* Status Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-900"
          >
            <option value="all">All Alerts</option>
            <option value="active">Active</option>
            <option value="triggered">Triggered</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortType)}
            className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-900"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="symbol">By Symbol</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.length === filteredAlerts.length}
              onChange={selectAll}
              className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-blue-600"
            />
            <span className="text-sm text-blue-300">
              {selectedIds.length} selected
            </span>
          </div>
          <button
            onClick={handleDeleteSelected}
            disabled={isDeleting}
            className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-sm rounded-lg transition-colors"
          >
            {isDeleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Delete Selected
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing {filteredAlerts.length} of {alerts.length} alerts
        </span>
        {filter !== 'all' && (
          <button
            onClick={() => setFilter('all')}
            className="text-blue-400 hover:text-blue-300"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Alert Cards */}
      {filteredAlerts.length > 0 ? (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div key={alert.id} className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedIds.includes(alert.id)}
                onChange={() => toggleSelection(alert.id)}
                className="mt-5 w-4 h-4 rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <AlertCard
                  alert={alert}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  currentPrice={priceCache[alert.symbol]}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gray-500/10 rounded-2xl flex items-center justify-center mb-4">
            {filter === 'active' ? (
              <Bell size={32} className="text-gray-500" />
            ) : filter === 'triggered' ? (
              <BellOff size={32} className="text-gray-500" />
            ) : (
              <Filter size={32} className="text-gray-500" />
            )}
          </div>
          <h3 className="text-lg font-medium text-white mb-1">
            {search ? 'No alerts found' : filter !== 'all' ? `No ${filter} alerts` : 'No alerts yet'}
          </h3>
          <p className="text-gray-500 text-sm max-w-md">
            {search 
              ? 'Try a different search term'
              : filter !== 'all'
              ? 'Try changing the filter'
              : 'Create your first alert to get notified when conditions are met'}
          </p>
        </div>
      )}
    </div>
  )
}