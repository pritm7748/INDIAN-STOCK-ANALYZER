// src/lib/cache.ts

// ============================================================
// TYPES
// ============================================================

interface CacheEntry<T> {
  data: T
  timestamp: number
  symbol: string
  timeframe: string
}

interface CacheOptions {
  ttl?: number // Time-to-live in milliseconds
}

// ============================================================
// CONSTANTS
// ============================================================

const CACHE_PREFIX = 'tradesense_analysis_'
const DEFAULT_TTL = 15 * 60 * 1000 // 15 minutes

// ============================================================
// CACHE FUNCTIONS
// ============================================================

/**
 * Generate cache key for a stock analysis
 */
export function getCacheKey(symbol: string, timeframe: string): string {
  return `${CACHE_PREFIX}${symbol}_${timeframe}`
}

/**
 * Save analysis to cache
 */
export function saveToCache<T>(
  symbol: string, 
  timeframe: string, 
  data: T
): void {
  if (typeof window === 'undefined') return
  
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      symbol,
      timeframe,
    }
    
    const key = getCacheKey(symbol, timeframe)
    localStorage.setItem(key, JSON.stringify(entry))
    
    // Also update the cache index
    updateCacheIndex(key)
    
    console.log(`💾 Cached analysis for ${symbol} (${timeframe})`)
  } catch (error) {
    console.error('Failed to save to cache:', error)
  }
}

/**
 * Get analysis from cache
 */
export function getFromCache<T>(
  symbol: string, 
  timeframe: string, 
  options: CacheOptions = {}
): { data: T; age: number; isStale: boolean } | null {
  if (typeof window === 'undefined') return null
  
  try {
    const key = getCacheKey(symbol, timeframe)
    const stored = localStorage.getItem(key)
    
    if (!stored) return null
    
    const entry: CacheEntry<T> = JSON.parse(stored)
    const age = Date.now() - entry.timestamp
    const ttl = options.ttl || DEFAULT_TTL
    const isStale = age > ttl
    
    // Return data with metadata (even if stale - let caller decide)
    return {
      data: entry.data,
      age,
      isStale,
    }
  } catch (error) {
    console.error('Failed to read from cache:', error)
    return null
  }
}

/**
 * Check if valid cache exists
 */
export function hasValidCache(
  symbol: string, 
  timeframe: string, 
  options: CacheOptions = {}
): boolean {
  const cached = getFromCache(symbol, timeframe, options)
  return cached !== null && !cached.isStale
}

/**
 * Clear specific cache entry
 */
export function clearCacheEntry(symbol: string, timeframe: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const key = getCacheKey(symbol, timeframe)
    localStorage.removeItem(key)
    removeFromCacheIndex(key)
  } catch (error) {
    console.error('Failed to clear cache entry:', error)
  }
}

/**
 * Clear all analysis cache
 */
export function clearAllCache(): number {
  if (typeof window === 'undefined') return 0
  
  try {
    const index = getCacheIndex()
    let cleared = 0
    
    index.forEach(key => {
      localStorage.removeItem(key)
      cleared++
    })
    
    // Clear the index
    localStorage.removeItem(`${CACHE_PREFIX}index`)
    
    console.log(`🗑️ Cleared ${cleared} cached analyses`)
    return cleared
  } catch (error) {
    console.error('Failed to clear cache:', error)
    return 0
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  count: number
  entries: Array<{ symbol: string; timeframe: string; age: number; isStale: boolean }>
  totalSize: number
} {
  if (typeof window === 'undefined') {
    return { count: 0, entries: [], totalSize: 0 }
  }
  
  try {
    const index = getCacheIndex()
    const entries: Array<{ symbol: string; timeframe: string; age: number; isStale: boolean }> = []
    let totalSize = 0
    
    index.forEach(key => {
      const stored = localStorage.getItem(key)
      if (stored) {
        totalSize += stored.length * 2 // Approximate bytes (UTF-16)
        
        try {
          const entry = JSON.parse(stored)
          const age = Date.now() - entry.timestamp
          entries.push({
            symbol: entry.symbol,
            timeframe: entry.timeframe,
            age,
            isStale: age > DEFAULT_TTL,
          })
        } catch {
          // Invalid entry, skip
        }
      }
    })
    
    return {
      count: entries.length,
      entries,
      totalSize,
    }
  } catch (error) {
    console.error('Failed to get cache stats:', error)
    return { count: 0, entries: [], totalSize: 0 }
  }
}

/**
 * Format age for display
 */
export function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) return `${hours}h ${minutes % 60}m ago`
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================
// INTERNAL: Cache Index Management
// ============================================================

function getCacheIndex(): string[] {
  try {
    const stored = localStorage.getItem(`${CACHE_PREFIX}index`)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function updateCacheIndex(key: string): void {
  try {
    const index = getCacheIndex()
    if (!index.includes(key)) {
      index.push(key)
      localStorage.setItem(`${CACHE_PREFIX}index`, JSON.stringify(index))
    }
  } catch {
    // Ignore
  }
}

function removeFromCacheIndex(key: string): void {
  try {
    const index = getCacheIndex().filter(k => k !== key)
    localStorage.setItem(`${CACHE_PREFIX}index`, JSON.stringify(index))
  } catch {
    // Ignore
  }
}