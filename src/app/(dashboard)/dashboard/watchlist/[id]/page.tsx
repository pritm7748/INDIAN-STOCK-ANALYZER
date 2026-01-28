'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { useWatchlist } from '@/lib/hooks/useWatchlists'
import { STOCK_LIST } from '@/lib/stockList'
import { 
  ArrowLeft, 
  ArrowUp, 
  ArrowDown,
  Trash2, 
  Edit3, 
  Plus, 
  Search,
  TrendingUp,
  BarChart2,
  Loader2,
  MoreHorizontal,
  X,
  Check,
  AlertTriangle,
  Bookmark,
  Clock,
  IndianRupee,
  ExternalLink,
  RefreshCw,
  StickyNote,
  Palette
} from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

interface StockPrice {
  symbol: string
  price: number
  change: number
  changePercent: number
  loading: boolean
  error: boolean
}

// ============================================================
// COLOR PICKER COMPONENT
// ============================================================

const COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#6366F1', // Indigo
]

function ColorPicker({ 
  selected, 
  onChange 
}: { 
  selected: string
  onChange: (color: string) => void 
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onChange(color)}
          className={`w-8 h-8 rounded-full transition-all ${
            selected === color 
              ? 'ring-2 ring-offset-2 ring-offset-[#0A0A0A] ring-white scale-110' 
              : 'hover:scale-110'
          }`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}

// ============================================================
// ADD STOCK MODAL
// ============================================================

function AddStockModal({
  isOpen,
  onClose,
  onAdd,
  existingSymbols,
}: {
  isOpen: boolean
  onClose: () => void
  onAdd: (symbol: string) => Promise<void>
  existingSymbols: string[]
}) {
  const [search, setSearch] = useState('')
  const [isAdding, setIsAdding] = useState<string | null>(null)

  const filteredStocks = STOCK_LIST.filter(stock => {
    const query = search.toLowerCase()
    const matchesSearch = 
      stock.symbol.toLowerCase().includes(query) ||
      stock.name.toLowerCase().includes(query) ||
      stock.sector?.toLowerCase().includes(query)
    const notAlreadyAdded = !existingSymbols.includes(stock.symbol)
    return matchesSearch && notAlreadyAdded
  }).slice(0, 20) // Limit for performance

  const handleAdd = async (symbol: string) => {
    setIsAdding(symbol)
    try {
      await onAdd(symbol)
    } finally {
      setIsAdding(null)
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
      <div className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Add Stock</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, symbol, or sector..."
              autoFocus
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-100 overflow-y-auto">
          {filteredStocks.length === 0 ? (
            <div className="p-8 text-center">
              <Search size={40} className="mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">
                {search ? 'No stocks found matching your search' : 'Start typing to search stocks'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredStocks.map((stock) => (
                <div
                  key={stock.symbol}
                  className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        {stock.symbol.replace('.NS', '')}
                      </span>
                      {stock.sector && (
                        <span className="px-2 py-0.5 text-[10px] bg-white/5 text-gray-400 rounded">
                          {stock.sector}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{stock.name}</p>
                  </div>
                  <button
                    onClick={() => handleAdd(stock.symbol)}
                    disabled={isAdding === stock.symbol}
                    className="ml-4 p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
                  >
                    {isAdding === stock.symbol ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Plus size={18} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ============================================================
// NOTES MODAL
// ============================================================

function NotesModal({
  isOpen,
  onClose,
  onSave,
  initialNotes,
  stockSymbol,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (notes: string) => Promise<void>
  initialNotes: string
  stockSymbol: string
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setNotes(initialNotes)
  }, [initialNotes])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(notes)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">
            Notes for {stockSymbol.replace('.NS', '')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add your notes about this stock..."
            rows={5}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            Save
          </button>
        </div>
      </div>
    </>
  )
}

// ============================================================
// MAIN WATCHLIST PAGE
// ============================================================

export default function WatchlistPage() {
  const params = useParams()
  const router = useRouter()
  const watchlistId = params.id as string
  
  const { userId } = useUser()
  const { 
    watchlist, 
    isLoading, 
    error, 
    addStock, 
    removeStock, 
    updateStockNotes,
    fetchWatchlist 
  } = useWatchlist(watchlistId)
  
  const supabase = createClient()

  // UI State
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [notesModal, setNotesModal] = useState<{ itemId: string; symbol: string; notes: string } | null>(null)
  
  // Price State
  const [prices, setPrices] = useState<Record<string, StockPrice>>({})
  const [loadingPrices, setLoadingPrices] = useState(false)

  // Initialize edit form
  useEffect(() => {
    if (watchlist) {
      setEditName(watchlist.name)
      setEditColor(watchlist.color)
    }
  }, [watchlist])

// ============================================================
// PRICE FETCHING
// ============================================================

const fetchPrices = useCallback(async () => {
  if (!watchlist?.items.length) return

  setLoadingPrices(true)
  
  // Initialize loading state for all symbols
  const initialPrices: Record<string, StockPrice> = {}
  watchlist.items.forEach(item => {
    initialPrices[item.symbol] = {
      symbol: item.symbol,
      price: 0,
      change: 0,
      changePercent: 0,
      loading: true,
      error: false,
    }
  })
  setPrices(initialPrices)

  // Fetch prices one by one (to avoid rate limiting)
  for (const item of watchlist.items) {
    try {
      const res = await fetch(`/api/quote?symbol=${item.symbol}`)
      if (res.ok) {
        const data = await res.json()
        setPrices(prev => ({
          ...prev,
          [item.symbol]: {
            symbol: item.symbol,
            price: data.price || 0,
            change: data.change || 0,
            changePercent: data.changePercent || 0,
            loading: false,
            error: false,
          }
        }))
      } else {
        throw new Error('Failed to fetch')
      }
    } catch {
      setPrices(prev => ({
        ...prev,
        [item.symbol]: {
          ...prev[item.symbol],
          loading: false,
          error: true,
        }
      }))
    }
  }

  setLoadingPrices(false)
}, [watchlist?.items])

// ✅ Auto-fetch prices when watchlist loads
useEffect(() => {
  if (watchlist?.items.length) {
    fetchPrices()
  }
}, [watchlist?.items.length])

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleSaveEdit = async () => {
    if (!editName.trim()) return
    
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('watchlists')
        .update({ 
          name: editName.trim(),
          color: editColor,
        })
        .eq('id', watchlistId)

      if (error) throw error
      
      await fetchWatchlist()
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to update watchlist:', err)
      alert('Failed to update watchlist')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      // Delete all items first
      await supabase
        .from('watchlist_items')
        .delete()
        .eq('watchlist_id', watchlistId)

      // Then delete the watchlist
      const { error } = await supabase
        .from('watchlists')
        .delete()
        .eq('id', watchlistId)

      if (error) throw error
      
      router.push('/dashboard')
    } catch (err) {
      console.error('Failed to delete watchlist:', err)
      alert('Failed to delete watchlist')
      setIsDeleting(false)
    }
  }

  const handleAddStock = async (symbol: string) => {
    try {
      await addStock(symbol)
    } catch (err: any) {
      if (err.message === 'Stock already in watchlist') {
        alert('This stock is already in your watchlist')
      } else {
        console.error('Failed to add stock:', err)
        alert('Failed to add stock')
      }
    }
  }

  const handleRemoveStock = async (itemId: string) => {
    if (!confirm('Remove this stock from your watchlist?')) return
    
    try {
      await removeStock(itemId)
    } catch (err) {
      console.error('Failed to remove stock:', err)
      alert('Failed to remove stock')
    }
  }

  const handleSaveNotes = async (notes: string) => {
    if (!notesModal) return
    
    try {
      await updateStockNotes(notesModal.itemId, notes)
    } catch (err) {
      console.error('Failed to save notes:', err)
      throw err
    }
  }

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 size={40} className="animate-spin text-blue-500" />
        <p className="text-gray-400">Loading watchlist...</p>
      </div>
    )
  }

  // ============================================================
  // ERROR STATE
  // ============================================================

  if (error || !watchlist) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6">
          <AlertTriangle size={40} className="text-rose-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Watchlist Not Found</h2>
        <p className="text-gray-500 max-w-md mb-6">
          This watchlist doesn't exist or you don't have access to it.
        </p>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>
      </div>
    )
  }

  // ============================================================
  // HELPERS
  // ============================================================

  const getStockData = (symbol: string) => {
    return STOCK_LIST.find(s => s.symbol === symbol)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Back Link + Title */}
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          
          {isEditing ? (
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: editColor }}
              />
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-2xl font-bold bg-transparent text-white border-b-2 border-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: watchlist.color }}
              />
              <h1 className="text-2xl font-bold text-white">{watchlist.name}</h1>
              {watchlist.is_default && (
                <span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded">
                  Default
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving || !editName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={fetchPrices}
                disabled={loadingPrices || !watchlist.items.length}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-300 font-medium rounded-xl transition-colors"
                title="Refresh prices"
              >
                <RefreshCw size={16} className={loadingPrices ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Refresh Prices</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Add Stock</span>
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                title="Edit watchlist"
              >
                <Edit3 size={18} />
              </button>
              {!watchlist.is_default && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-lg hover:bg-rose-500/10 text-gray-400 hover:text-rose-400 transition-colors"
                  title="Delete watchlist"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Color Picker (when editing) */}
      {isEditing && (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
          <p className="text-sm text-gray-400 mb-3">Watchlist Color</p>
          <ColorPicker selected={editColor} onChange={setEditColor} />
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Stocks</p>
          <p className="text-2xl font-bold text-white">{watchlist.items.length}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Created</p>
          <p className="text-sm font-medium text-white">{formatDate(watchlist.created_at)}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Last Updated</p>
          <p className="text-sm font-medium text-white">{formatDate(watchlist.updated_at)}</p>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">With Notes</p>
          <p className="text-2xl font-bold text-white">
            {watchlist.items.filter(i => i.notes).length}
          </p>
        </div>
      </div>

      {/* Stock List */}
      {watchlist.items.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
            <Bookmark size={40} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No Stocks Yet</h2>
          <p className="text-gray-500 max-w-md mb-6">
            Add stocks to this watchlist to track them easily and get quick access to analysis.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
          >
            <Plus size={18} />
            Add Your First Stock
          </button>
        </div>
      ) : (
        /* Stock Table */
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                    Stock
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                    Current Price
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4 hidden sm:table-cell">
                    Added Price
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4 hidden md:table-cell">
                    Change
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4 hidden lg:table-cell">
                    Added On
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {watchlist.items.map((item) => {
                  const stockData = getStockData(item.symbol)
                  const priceData = prices[item.symbol]
                  const gainFromAdded = item.added_price && priceData?.price
                    ? ((priceData.price - item.added_price) / item.added_price) * 100
                    : null

                  return (
                    <tr 
                      key={item.id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      {/* Stock Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/dashboard?symbol=${item.symbol}`}
                                className="font-medium text-white hover:text-blue-400 transition-colors"
                              >
                                {item.symbol.replace('.NS', '')}
                              </Link>
                              {item.notes && (
                                <StickyNote size={14} className="text-yellow-500" />
                              )}
                            </div>
                            <p className="text-sm text-gray-500 truncate max-w-50">
                              {stockData?.name || item.symbol}
                            </p>
                            {stockData?.sector && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-[10px] bg-white/5 text-gray-400 rounded">
                                {stockData.sector}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Current Price */}
                      <td className="px-6 py-4 text-right">
                        {priceData ? (
                          priceData.loading ? (
                            <Loader2 size={16} className="animate-spin text-gray-500 ml-auto" />
                          ) : priceData.error ? (
                            <span className="text-gray-500">--</span>
                          ) : (
                            <div>
                              <p className="font-medium text-white">
                                {formatCurrency(priceData.price)}
                              </p>
                              <p className={`text-sm flex items-center justify-end gap-1 ${
                                priceData.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {priceData.change >= 0 ? (
                                  <ArrowUp size={12} />
                                ) : (
                                  <ArrowDown size={12} />
                                )}
                                {priceData.changePercent.toFixed(2)}%
                              </p>
                            </div>
                          )
                        ) : (
                          <span className="text-gray-500">--</span>
                        )}
                      </td>

                      {/* Added Price */}
                      <td className="px-6 py-4 text-right hidden sm:table-cell">
                        {item.added_price ? (
                          <div>
                            <p className="text-gray-300">
                              {formatCurrency(item.added_price)}
                            </p>
                            {gainFromAdded !== null && (
                              <p className={`text-sm ${
                                gainFromAdded >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {gainFromAdded >= 0 ? '+' : ''}{gainFromAdded.toFixed(2)}%
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">--</span>
                        )}
                      </td>

                      {/* Today's Change */}
                      <td className="px-6 py-4 text-right hidden md:table-cell">
                        {priceData && !priceData.loading && !priceData.error ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
                            priceData.change >= 0 
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {priceData.change >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                            {Math.abs(priceData.change).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-500">--</span>
                        )}
                      </td>

                      {/* Added On */}
                      <td className="px-6 py-4 text-right hidden lg:table-cell">
                        <span className="text-gray-400 text-sm">
                          {formatDate(item.created_at)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard?symbol=${item.symbol}`}
                            className="p-2 rounded-lg hover:bg-blue-500/10 text-gray-400 hover:text-blue-400 transition-colors"
                            title="Analyze"
                          >
                            <BarChart2 size={16} />
                          </Link>
                          <button
                            onClick={() => setNotesModal({
                              itemId: item.id,
                              symbol: item.symbol,
                              notes: item.notes || '',
                            })}
                            className={`p-2 rounded-lg transition-colors ${
                              item.notes 
                                ? 'hover:bg-yellow-500/10 text-yellow-500 hover:text-yellow-400'
                                : 'hover:bg-white/5 text-gray-400 hover:text-white'
                            }`}
                            title="Notes"
                          >
                            <StickyNote size={16} />
                          </button>
                          <button
                            onClick={() => handleRemoveStock(item.id)}
                            className="p-2 rounded-lg hover:bg-rose-500/10 text-gray-400 hover:text-rose-400 transition-colors"
                            title="Remove"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed inset-x-4 top-[30%] z-50 mx-auto max-w-sm bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} className="text-rose-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Delete Watchlist?</h3>
            <p className="text-gray-400 mb-6">
              This will permanently delete "{watchlist.name}" and all {watchlist.items.length} stocks in it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
              >
                {isDeleting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add Stock Modal */}
      <AddStockModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddStock}
        existingSymbols={watchlist.items.map(i => i.symbol)}
      />

      {/* Notes Modal */}
      {notesModal && (
        <NotesModal
          isOpen={true}
          onClose={() => setNotesModal(null)}
          onSave={handleSaveNotes}
          initialNotes={notesModal.notes}
          stockSymbol={notesModal.symbol}
        />
      )}
    </div>
  )
}