// src/lib/hooks/useAlerts.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from './useUser'
import { Alert, AlertHistory } from '@/lib/supabase/types'

export interface AlertCondition {
  indicator: 'price' | 'rsi' | 'score' | 'volume' | 'macd' | 'sma_cross'
  operator: 'above' | 'below' | 'crosses_above' | 'crosses_below'
  value: number
  compareTo?: string // For crosses: 'sma50', 'sma200', etc.
}

export interface CreateAlertInput {
  symbol: string
  stockName?: string
  alertType: string
  condition: AlertCondition
  notificationChannels: string[]
  isRecurring?: boolean
  expiresAt?: string
}

export interface AlertWithMeta extends Alert {
  currentPrice?: number
  currentValue?: number
  distancePercent?: number
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertWithMeta[]>([])
  const [history, setHistory] = useState<AlertHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { userId, isAuthenticated } = useUser()
  const supabase = createClient()

  // Fetch all alerts for the user
  const fetchAlerts = useCallback(async () => {
    if (!userId) {
      setAlerts([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setAlerts(data || [])
    } catch (err: any) {
      console.error('Error fetching alerts:', err)
      setError('Failed to load alerts')
      setAlerts([])
    } finally {
      setIsLoading(false)
    }
  }, [userId, supabase])

  // Fetch alert history
  const fetchHistory = useCallback(async (limit: number = 50) => {
    if (!userId) {
      setHistory([])
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('alert_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (fetchError) throw fetchError

      setHistory(data || [])
    } catch (err: any) {
      console.error('Error fetching alert history:', err)
    }
  }, [userId, supabase])

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchAlerts()
      fetchHistory()
    } else {
      setAlerts([])
      setHistory([])
      setIsLoading(false)
    }
  }, [isAuthenticated, fetchAlerts, fetchHistory])

  // Create a new alert
  const createAlert = useCallback(async (input: CreateAlertInput): Promise<Alert> => {
    if (!userId) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('alerts')
      .insert({
        user_id: userId,
        symbol: input.symbol,
        stock_name: input.stockName,
        alert_type: input.alertType,
        condition: input.condition,
        notification_channels: input.notificationChannels,
        is_recurring: input.isRecurring || false,
        expires_at: input.expiresAt || null,
      })
      .select()
      .single()

    if (error) throw error

    setAlerts(prev => [data, ...prev])
    return data
  }, [userId, supabase])

  // Update an alert
  const updateAlert = useCallback(async (
    alertId: string,
    updates: Partial<CreateAlertInput & { isActive: boolean }>
  ): Promise<Alert> => {
    const updateData: any = {}
    
    if (updates.symbol !== undefined) updateData.symbol = updates.symbol
    if (updates.stockName !== undefined) updateData.stock_name = updates.stockName
    if (updates.alertType !== undefined) updateData.alert_type = updates.alertType
    if (updates.condition !== undefined) updateData.condition = updates.condition
    if (updates.notificationChannels !== undefined) updateData.notification_channels = updates.notificationChannels
    if (updates.isRecurring !== undefined) updateData.is_recurring = updates.isRecurring
    if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive

    const { data, error } = await supabase
      .from('alerts')
      .update(updateData)
      .eq('id', alertId)
      .select()
      .single()

    if (error) throw error

    setAlerts(prev => prev.map(a => a.id === alertId ? data : a))
    return data
  }, [supabase])

  // Toggle alert active status
  const toggleAlert = useCallback(async (alertId: string, isActive: boolean) => {
    return updateAlert(alertId, { isActive })
  }, [updateAlert])

  // Delete an alert
  const deleteAlert = useCallback(async (alertId: string) => {
    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', alertId)

    if (error) throw error

    setAlerts(prev => prev.filter(a => a.id !== alertId))
  }, [supabase])

  // Delete multiple alerts
  const deleteAlerts = useCallback(async (alertIds: string[]) => {
    const { error } = await supabase
      .from('alerts')
      .delete()
      .in('id', alertIds)

    if (error) throw error

    setAlerts(prev => prev.filter(a => !alertIds.includes(a.id)))
  }, [supabase])

  // Clear all triggered (one-time) alerts
  const clearTriggeredAlerts = useCallback(async () => {
    const triggeredIds = alerts
      .filter(a => a.is_triggered && !a.is_recurring)
      .map(a => a.id)

    if (triggeredIds.length > 0) {
      await deleteAlerts(triggeredIds)
    }
  }, [alerts, deleteAlerts])

  // Get alerts for a specific symbol
  const getAlertsForSymbol = useCallback((symbol: string) => {
    return alerts.filter(a => a.symbol === symbol)
  }, [alerts])

  // Stats
  const stats = {
    total: alerts.length,
    active: alerts.filter(a => a.is_active && !a.is_triggered).length,
    triggered: alerts.filter(a => a.is_triggered).length,
    expired: alerts.filter(a => a.expires_at && new Date(a.expires_at) < new Date()).length,
  }

  return {
    alerts,
    history,
    isLoading,
    error,
    stats,
    fetchAlerts,
    fetchHistory,
    createAlert,
    updateAlert,
    toggleAlert,
    deleteAlert,
    deleteAlerts,
    clearTriggeredAlerts,
    getAlertsForSymbol,
  }
}

// Hook for checking if a symbol has any active alerts
export function useSymbolAlerts(symbol: string) {
  const { alerts, isLoading } = useAlerts()
  
  const symbolAlerts = alerts.filter(a => a.symbol === symbol)
  const activeAlerts = symbolAlerts.filter(a => a.is_active && !a.is_triggered)
  
  return {
    alerts: symbolAlerts,
    activeAlerts,
    hasActiveAlerts: activeAlerts.length > 0,
    isLoading,
  }
}