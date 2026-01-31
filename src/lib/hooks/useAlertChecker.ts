// src/lib/hooks/useAlertChecker.ts

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from './useUser'
import { checkUserAlerts, isMarketOpen, CheckSummary } from '@/lib/alerts/checker'

interface UseAlertCheckerOptions {
  enabled?: boolean
  intervalMs?: number
  onTriggered?: (results: CheckSummary['results']) => void
}

export function useAlertChecker(options: UseAlertCheckerOptions = {}) {
  const {
    enabled = true,
    intervalMs = 5 * 60 * 1000, // 5 minutes default
    onTriggered
  } = options

  const { userId, isAuthenticated } = useUser()
  const [isChecking, setIsChecking] = useState(false)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [lastResult, setLastResult] = useState<CheckSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [marketOpen, setMarketOpen] = useState(isMarketOpen())

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const onTriggeredRef = useRef(onTriggered)

  useEffect(() => {
    onTriggeredRef.current = onTriggered
  }, [onTriggered])

  const checkAlerts = useCallback(async () => {
    if (!isAuthenticated || !userId || isChecking) return null

    // Update market status
    const marketIsOpen = isMarketOpen()
    setMarketOpen(marketIsOpen)

    // Don't check if market is closed (optional - can remove this check)
    // if (!marketIsOpen) return null

    setIsChecking(true)
    setError(null)

    try {
      const summary = await checkUserAlerts(userId)

      setLastCheck(new Date())
      setLastResult(summary)

      // Notify about triggered alerts
      if (summary.triggered > 0 && onTriggeredRef.current) {
        const triggeredAlerts = summary.results.filter(r => r.triggered)
        onTriggeredRef.current(triggeredAlerts)
      }

      return summary
    } catch (err: any) {
      console.error('Alert check failed:', err)
      setError(err.message)
      return null
    } finally {
      setIsChecking(false)
    }
  }, [isAuthenticated, userId, isChecking])

  // Set up polling
  useEffect(() => {
    if (!enabled || !isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Initial check after short delay
    const initialTimeout = setTimeout(() => {
      checkAlerts()
    }, 2000)

    // Set up interval
    intervalRef.current = setInterval(checkAlerts, intervalMs)

    return () => {
      clearTimeout(initialTimeout)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, isAuthenticated, intervalMs, checkAlerts])

  // Check when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && isAuthenticated) {
        // Check if last check was more than 2 minutes ago
        if (!lastCheck || Date.now() - lastCheck.getTime() > 2 * 60 * 1000) {
          checkAlerts()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled, isAuthenticated, lastCheck, checkAlerts])

  return {
    isChecking,
    lastCheck,
    lastResult,
    error,
    marketOpen,
    checkNow: checkAlerts,
  }
}