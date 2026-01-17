// src/lib/hooks/useWatchlists.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from './useUser'
import { Watchlist, WatchlistItem, WatchlistWithItems } from '@/lib/supabase/types'

// Color palette for new watchlists
const WATCHLIST_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
]

export function useWatchlists() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { userId, isAuthenticated } = useUser()
  const supabase = createClient()

  // Fetch all watchlists for the user
  const fetchWatchlists = useCallback(async () => {
    if (!userId) {
      setWatchlists([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('watchlists')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })

      if (fetchError) throw fetchError

      setWatchlists(data || [])
    } catch (err) {
      console.error('Error fetching watchlists:', err)
      setError('Failed to load watchlists')
      setWatchlists([])
    } finally {
      setIsLoading(false)
    }
  }, [userId, supabase])

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchWatchlists()
    } else {
      setWatchlists([])
      setIsLoading(false)
    }
  }, [isAuthenticated, fetchWatchlists])

  // Create a new watchlist
  const createWatchlist = useCallback(async (name: string, isDefault: boolean = false) => {
    if (!userId) throw new Error('Not authenticated')

    const color = WATCHLIST_COLORS[watchlists.length % WATCHLIST_COLORS.length]
    const sortOrder = watchlists.length

    const { data, error } = await supabase
      .from('watchlists')
      .insert({
        user_id: userId,
        name,
        color,
        icon: 'bookmark',
        is_default: isDefault,
        sort_order: sortOrder,
      })
      .select()
      .single()

    if (error) throw error

    setWatchlists(prev => [...prev, data])
    return data
  }, [userId, watchlists.length, supabase])

  // Update a watchlist
  const updateWatchlist = useCallback(async (
    watchlistId: string, 
    updates: Partial<Pick<Watchlist, 'name' | 'color' | 'icon' | 'description'>>
  ) => {
    const { data, error } = await supabase
      .from('watchlists')
      .update(updates)
      .eq('id', watchlistId)
      .select()
      .single()

    if (error) throw error

    setWatchlists(prev => 
      prev.map(w => w.id === watchlistId ? { ...w, ...data } : w)
    )
    return data
  }, [supabase])

  // Delete a watchlist
  const deleteWatchlist = useCallback(async (watchlistId: string) => {
    // First delete all items in the watchlist
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

    setWatchlists(prev => prev.filter(w => w.id !== watchlistId))
  }, [supabase])

  // Get default watchlist (create if doesn't exist)
  const getOrCreateDefaultWatchlist = useCallback(async () => {
    if (!userId) throw new Error('Not authenticated')

    // Check if default exists
    const defaultWatchlist = watchlists.find(w => w.is_default)
    if (defaultWatchlist) return defaultWatchlist

    // Create default watchlist
    return await createWatchlist('My Watchlist', true)
  }, [userId, watchlists, createWatchlist])

  return {
    watchlists,
    isLoading,
    error,
    fetchWatchlists,
    createWatchlist,
    updateWatchlist,
    deleteWatchlist,
    getOrCreateDefaultWatchlist,
  }
}

// Hook for a single watchlist with its items
export function useWatchlist(watchlistId: string) {
  const [watchlist, setWatchlist] = useState<WatchlistWithItems | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { userId } = useUser()
  const supabase = createClient()

  // Fetch watchlist with items
  const fetchWatchlist = useCallback(async () => {
    if (!userId || !watchlistId) {
      setWatchlist(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Fetch watchlist
      const { data: watchlistData, error: watchlistError } = await supabase
        .from('watchlists')
        .select('*')
        .eq('id', watchlistId)
        .eq('user_id', userId)
        .single()

      if (watchlistError) throw watchlistError

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('watchlist_id', watchlistId)
        .order('sort_order', { ascending: true })

      if (itemsError) throw itemsError

      setWatchlist({
        ...watchlistData,
        items: itemsData || []
      })
    } catch (err) {
      console.error('Error fetching watchlist:', err)
      setError('Failed to load watchlist')
      setWatchlist(null)
    } finally {
      setIsLoading(false)
    }
  }, [userId, watchlistId, supabase])

  useEffect(() => {
    fetchWatchlist()
  }, [fetchWatchlist])

  // Add stock to watchlist
  const addStock = useCallback(async (symbol: string, addedPrice?: number) => {
    if (!userId || !watchlistId) throw new Error('Not authenticated')

    // Check if already exists
    const exists = watchlist?.items.some(item => item.symbol === symbol)
    if (exists) {
      throw new Error('Stock already in watchlist')
    }

    const sortOrder = watchlist?.items.length || 0

    const { data, error } = await supabase
      .from('watchlist_items')
      .insert({
        watchlist_id: watchlistId,
        user_id: userId,
        symbol,
        added_price: addedPrice,
        sort_order: sortOrder,
      })
      .select()
      .single()

    if (error) throw error

    setWatchlist(prev => prev ? {
      ...prev,
      items: [...prev.items, data]
    } : null)

    return data
  }, [userId, watchlistId, watchlist, supabase])

  // Remove stock from watchlist
  const removeStock = useCallback(async (itemId: string) => {
    const { error } = await supabase
      .from('watchlist_items')
      .delete()
      .eq('id', itemId)

    if (error) throw error

    setWatchlist(prev => prev ? {
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    } : null)
  }, [supabase])

  // Update stock notes
  const updateStockNotes = useCallback(async (itemId: string, notes: string) => {
    const { error } = await supabase
      .from('watchlist_items')
      .update({ notes })
      .eq('id', itemId)

    if (error) throw error

    setWatchlist(prev => prev ? {
      ...prev,
      items: prev.items.map(item => 
        item.id === itemId ? { ...item, notes } : item
      )
    } : null)
  }, [supabase])

  // Check if a symbol is in this watchlist
  const hasStock = useCallback((symbol: string) => {
    return watchlist?.items.some(item => item.symbol === symbol) || false
  }, [watchlist])

  return {
    watchlist,
    isLoading,
    error,
    fetchWatchlist,
    addStock,
    removeStock,
    updateStockNotes,
    hasStock,
  }
}

// Hook to check if a stock is in ANY watchlist (for quick add buttons)
export function useStockInWatchlists(symbol: string) {
  const [watchlistsContaining, setWatchlistsContaining] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const { userId, isAuthenticated } = useUser()
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      if (!userId || !isAuthenticated || !symbol) {
        setWatchlistsContaining([])
        setIsLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('watchlist_items')
          .select('watchlist_id')
          .eq('user_id', userId)
          .eq('symbol', symbol)

        if (error) throw error

        setWatchlistsContaining(data?.map(d => d.watchlist_id) || [])
      } catch (err) {
        console.error('Error checking watchlists:', err)
        setWatchlistsContaining([])
      } finally {
        setIsLoading(false)
      }
    }

    check()
  }, [userId, isAuthenticated, symbol, supabase])

  return {
    isInAnyWatchlist: watchlistsContaining.length > 0,
    watchlistsContaining,
    isLoading,
  }
}