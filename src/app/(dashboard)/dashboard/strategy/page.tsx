'use client'

import { useState, useRef, useCallback } from 'react'
import {
    Brain, Loader2, TrendingUp, TrendingDown, Shield,
    Zap, Target, BarChart3, AlertTriangle, ChevronDown,
    ChevronRight, Activity, Clock, Filter, Info, StopCircle,
    CalendarDays, ArrowRightLeft, ShieldCheck, Play,
    Crosshair, Eye, GitPullRequestArrow, PieChart, Repeat,
    Newspaper, Sparkles, ArrowUpRight, Layers, Timer,
    BookOpen, Waves, Moon, Sun, ArrowDown, TrendingUp as TUp2
} from 'lucide-react'

interface Holding {
    rank: number
    symbol: string
    name: string
    sector: string
    composite: number
    ret1m: number
    ret3m: number
    ret6m: number
    volatility: number
    currentPrice: number
    weightInvVol: number
    weightEqual: number
    stopLoss: number
    avgDailyTurnoverCr: number
    trailingStopLevel: number | null
    trailingStopActive: boolean
    entrySignal: string
    daysSinceRecentHigh: number
    priceVs52wHigh: number | null
    beta: number | null
}

interface StrategyResult {
    date: string
    regime: 'BULL' | 'BEAR'
    signal: 'INVEST' | 'CASH'
    message?: string
    niftyPrice: number
    niftySMA: number
    totalCandidates: number
    passedFilters: number
    filteredOut: { symbol: string; name: string; reason: string }[]
    holdings: Holding[]
    allScored: any[]
    holdingPeriod: string
    config: any
    performance: {
        expectedCAGR: string
        expectedWinRate: string
        avgWinnerLoserRatio: string
        maxDrawdownRange: string
        sharpeEstimate: string
        methodology: string
    }
    fetchStats: {
        totalSymbols: number
        successfulFetches: number
        failedFetches: number
    }
    rebalance?: {
        scanDate: string
        entryDate: string
        exitDate: string
        holdingDays: number
        nextScanDate: string
    }
    entryGuidance?: {
        action: string
        timing: string
        sizing: string
        stopLossRule: string
        trailingStopRule: string
        exitRule: string
    }
}

interface ScanProgress {
    scanned: number
    total: number
    fetched: number
    errors: number
    pct: number
}

interface RegimeInfo {
    isBull: boolean
    currentPrice: number
    sma: number
    smaPeriod: number
}

export default function StrategyAnalysisPage() {
    const [scanning, setScanning] = useState(false)
    const [result, setResult] = useState<StrategyResult | null>(null)
    const [error, setError] = useState('')
    const [showFiltered, setShowFiltered] = useState(false)
    const [showAllScored, setShowAllScored] = useState(false)
    const [activeTimeframe, setActiveTimeframe] = useState('1M')
    const [progress, setProgress] = useState<ScanProgress | null>(null)
    const [regime, setRegime] = useState<RegimeInfo | null>(null)
    const [statusMsg, setStatusMsg] = useState('')
    const abortRef = useRef<AbortController | null>(null)

    // Swing state
    const [swingScanning, setSwingScanning] = useState(false)
    const [swingResult, setSwingResult] = useState<any>(null)
    const [swingError, setSwingError] = useState('')
    const [swingProgress, setSwingProgress] = useState<ScanProgress | null>(null)
    const [swingStatusMsg, setSwingStatusMsg] = useState('')
    const [showSwingSetupA, setShowSwingSetupA] = useState(true)
    const [showSwingSetupB, setShowSwingSetupB] = useState(true)
    const [showSwingNearMiss, setShowSwingNearMiss] = useState(false)
    const [showSwingFiltered, setShowSwingFiltered] = useState(false)
    const swingAbortRef = useRef<AbortController | null>(null)

    // Mean Reversion state
    const [mrScanning, setMrScanning] = useState(false)
    const [mrResult, setMrResult] = useState<any>(null)
    const [mrError, setMrError] = useState('')
    const [mrProgress, setMrProgress] = useState<ScanProgress | null>(null)
    const [mrStatusMsg, setMrStatusMsg] = useState('')
    const [showMrWatchlist, setShowMrWatchlist] = useState(false)
    const [showMrFiltered, setShowMrFiltered] = useState(false)
    const mrAbortRef = useRef<AbortController | null>(null)

    // Sector Rotation state
    const [srScanning, setSrScanning] = useState(false)
    const [srResult, setSrResult] = useState<any>(null)
    const [srError, setSrError] = useState('')
    const [srProgress, setSrProgress] = useState<ScanProgress | null>(null)
    const [srStatusMsg, setSrStatusMsg] = useState('')
    const srAbortRef = useRef<AbortController | null>(null)

    // Event-Driven state
    const [edScanning, setEdScanning] = useState(false)
    const [edResult, setEdResult] = useState<any>(null)
    const [edError, setEdError] = useState('')
    const [edProgress, setEdProgress] = useState<ScanProgress | null>(null)
    const [edStatusMsg, setEdStatusMsg] = useState('')
    const edAbortRef = useRef<AbortController | null>(null)

    // Breakout (VCP) state
    const [boScanning, setBoScanning] = useState(false)
    const [boResult, setBoResult] = useState<any>(null)
    const [boError, setBoError] = useState('')
    const [boProgress, setBoProgress] = useState<ScanProgress | null>(null)
    const [boStatusMsg, setBoStatusMsg] = useState('')
    const boAbortRef = useRef<AbortController | null>(null)

    // Factor Strategy state
    const [fcScanning, setFcScanning] = useState(false)
    const [fcResult, setFcResult] = useState<any>(null)
    const [fcError, setFcError] = useState('')
    const [fcProgress, setFcProgress] = useState<ScanProgress | null>(null)
    const [fcStatusMsg, setFcStatusMsg] = useState('')
    const fcAbortRef = useRef<AbortController | null>(null)

    // ORB (Intraday) state
    const [orbScanning, setOrbScanning] = useState(false)
    const [orbResult, setOrbResult] = useState<any>(null)
    const [orbError, setOrbError] = useState('')
    const [orbProgress, setOrbProgress] = useState<ScanProgress | null>(null)
    const [orbStatusMsg, setOrbStatusMsg] = useState('')
    const orbAbortRef = useRef<AbortController | null>(null)

    // VWAP (Intraday) state
    const [vwapScanning, setVwapScanning] = useState(false)
    const [vwapResult, setVwapResult] = useState<any>(null)
    const [vwapError, setVwapError] = useState('')
    const [vwapProgress, setVwapProgress] = useState<ScanProgress | null>(null)
    const [vwapStatusMsg, setVwapStatusMsg] = useState('')
    const vwapAbortRef = useRef<AbortController | null>(null)

    // Gap Trading (Intraday) state
    const [gapScanning, setGapScanning] = useState(false)
    const [gapResult, setGapResult] = useState<any>(null)
    const [gapError, setGapError] = useState('')
    const [gapProgress, setGapProgress] = useState<ScanProgress | null>(null)
    const [gapStatusMsg, setGapStatusMsg] = useState('')
    const gapAbortRef = useRef<AbortController | null>(null)

    // EMA Crossover + MACD (Intraday) state
    const [emaScanning, setEmaScanning] = useState(false)
    const [emaResult, setEmaResult] = useState<any>(null)
    const [emaError, setEmaError] = useState('')
    const [emaProgress, setEmaProgress] = useState<ScanProgress | null>(null)
    const [emaStatusMsg, setEmaStatusMsg] = useState('')
    const emaAbortRef = useRef<AbortController | null>(null)

    // Order Flow & Market Depth state
    const [ofScanning, setOfScanning] = useState(false)
    const [ofResult, setOfResult] = useState<any>(null)
    const [ofError, setOfError] = useState('')
    const [ofProgress, setOfProgress] = useState<ScanProgress | null>(null)
    const [ofStatusMsg, setOfStatusMsg] = useState('')
    const ofAbortRef = useRef<AbortController | null>(null)

    // BTST / STBT state
    const [btstScanning, setBtstScanning] = useState(false)
    const [btstResult, setBtstResult] = useState<any>(null)
    const [btstError, setBtstError] = useState('')
    const [btstProgress, setBtstProgress] = useState<ScanProgress | null>(null)
    const [btstStatusMsg, setBtstStatusMsg] = useState('')
    const [btstRiskGate, setBtstRiskGate] = useState<any>(null)
    const btstAbortRef = useRef<AbortController | null>(null)

    // Weekly Breakout state
    const [wbScanning, setWbScanning] = useState(false)
    const [wbResult, setWbResult] = useState<any>(null)
    const [wbError, setWbError] = useState('')
    const [wbProgress, setWbProgress] = useState<ScanProgress | null>(null)
    const [wbStatusMsg, setWbStatusMsg] = useState('')
    const [wbRiskGate, setWbRiskGate] = useState<any>(null)
    const wbAbortRef = useRef<AbortController | null>(null)

    const timeframes = [
        { id: '1D', label: 'Intraday', available: true },
        { id: '1W', label: '1 Week', available: true },
        { id: '1M', label: '1 Month', available: true },
        { id: '3M', label: '3 Months', available: false },
        { id: '6M', label: '6 Months', available: false },
        { id: '1Y', label: '1 Year', available: false },
    ]

    const stopScan = useCallback(() => {
        abortRef.current?.abort()
        setScanning(false)
        setStatusMsg('Scan stopped')
    }, [])

    const stopSwingScan = useCallback(() => {
        swingAbortRef.current?.abort()
        setSwingScanning(false)
        setSwingStatusMsg('Scan stopped')
    }, [])

    const stopMrScan = useCallback(() => {
        mrAbortRef.current?.abort()
        setMrScanning(false)
        setMrStatusMsg('Scan stopped')
    }, [])

    const stopSrScan = useCallback(() => {
        srAbortRef.current?.abort()
        setSrScanning(false)
        setSrStatusMsg('Scan stopped')
    }, [])

    const stopEdScan = useCallback(() => {
        edAbortRef.current?.abort()
        setEdScanning(false)
        setEdStatusMsg('Scan stopped')
    }, [])

    const stopBoScan = useCallback(() => {
        boAbortRef.current?.abort()
        setBoScanning(false)
        setBoStatusMsg('Scan stopped')
    }, [])

    const stopFcScan = useCallback(() => {
        fcAbortRef.current?.abort()
        setFcScanning(false)
        setFcStatusMsg('Scan stopped')
    }, [])

    const stopOrbScan = useCallback(() => {
        orbAbortRef.current?.abort()
        setOrbScanning(false)
        setOrbStatusMsg('Scan stopped')
    }, [])

    const runVwap = useCallback(async () => {
        setVwapScanning(true)
        setVwapError('')
        setVwapResult(null)
        setVwapProgress(null)
        setVwapStatusMsg('Connecting...')

        const abort = new AbortController()
        vwapAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/vwap', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (currentEvent) {
                                case 'status':
                                    setVwapStatusMsg(data.message || '')
                                    break
                                case 'progress':
                                    setVwapProgress(data)
                                    setVwapStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                    break
                                case 'result':
                                    setVwapResult(data)
                                    setVwapStatusMsg('Analysis complete!')
                                    break
                                case 'error':
                                    setVwapError(data.message)
                                    break
                                case 'done':
                                    break
                            }
                        } catch { /* skip */ }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setVwapError(err.message || 'Something went wrong')
            }
        } finally {
            setVwapScanning(false)
        }
    }, [])

    const stopVwapScan = useCallback(() => {
        vwapAbortRef.current?.abort()
        setVwapScanning(false)
        setVwapStatusMsg('Scan stopped')
    }, [])

    const runGap = useCallback(async () => {
        setGapScanning(true)
        setGapError('')
        setGapResult(null)
        setGapProgress(null)
        setGapStatusMsg('Connecting...')

        const abort = new AbortController()
        gapAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/gap', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (currentEvent) {
                                case 'status':
                                    setGapStatusMsg(data.message || '')
                                    break
                                case 'progress':
                                    setGapProgress(data)
                                    setGapStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                    break
                                case 'result':
                                    setGapResult(data)
                                    setGapStatusMsg('Analysis complete!')
                                    break
                                case 'error':
                                    setGapError(data.message)
                                    break
                                case 'done':
                                    break
                            }
                        } catch { /* skip */ }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setGapError(err.message || 'Something went wrong')
            }
        } finally {
            setGapScanning(false)
        }
    }, [])

    const stopGapScan = useCallback(() => {
        gapAbortRef.current?.abort()
        setGapScanning(false)
        setGapStatusMsg('Scan stopped')
    }, [])

    const runEmaMacd = useCallback(async () => {
        setEmaScanning(true)
        setEmaError('')
        setEmaResult(null)
        setEmaProgress(null)
        setEmaStatusMsg('Connecting...')

        const abort = new AbortController()
        emaAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/ema-macd', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (currentEvent) {
                                case 'status':
                                    setEmaStatusMsg(data.message || '')
                                    break
                                case 'progress':
                                    setEmaProgress(data)
                                    setEmaStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks`)
                                    break
                                case 'result':
                                    setEmaResult(data)
                                    setEmaStatusMsg('Analysis complete!')
                                    break
                                case 'error':
                                    setEmaError(data.message)
                                    break
                                case 'done':
                                    break
                            }
                        } catch { /* skip */ }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setEmaError(err.message || 'Something went wrong')
            }
        } finally {
            setEmaScanning(false)
        }
    }, [])

    const stopEmaScan = useCallback(() => {
        emaAbortRef.current?.abort()
        setEmaScanning(false)
        setEmaStatusMsg('Scan stopped')
    }, [])

    const runOrderFlow = useCallback(async () => {
        setOfScanning(true)
        setOfError('')
        setOfResult(null)
        setOfProgress(null)
        setOfStatusMsg('Connecting...')

        const abort = new AbortController()
        ofAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/orderflow', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) currentEvent = line.slice(7).trim()
                    if (!line.startsWith('data: ')) continue
                    try {
                        const data = JSON.parse(line.slice(6))
                        switch (currentEvent) {
                            case 'status':
                                setOfStatusMsg(data.message)
                                break
                            case 'progress':
                                setOfProgress(data)
                                setOfStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks`)
                                break
                            case 'result':
                                setOfResult(data)
                                setOfStatusMsg('Analysis complete!')
                                break
                            case 'error':
                                setOfError(data.message)
                                break
                            case 'done':
                                break
                        }
                    } catch { /* skip */ }
                    currentEvent = ''
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setOfError(err.message || 'Something went wrong')
            }
        } finally {
            setOfScanning(false)
        }
    }, [])

    const stopOfScan = useCallback(() => {
        ofAbortRef.current?.abort()
        setOfScanning(false)
        setOfStatusMsg('Scan stopped')
    }, [])

    const runBTST = useCallback(async () => {
        setBtstScanning(true)
        setBtstError('')
        setBtstResult(null)
        setBtstProgress(null)
        setBtstRiskGate(null)
        setBtstStatusMsg('Connecting...')

        const abort = new AbortController()
        btstAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/btst', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) currentEvent = line.slice(7).trim()
                    if (!line.startsWith('data: ')) continue
                    try {
                        const data = JSON.parse(line.slice(6))
                        switch (currentEvent) {
                            case 'status':
                                setBtstStatusMsg(data.message)
                                break
                            case 'riskGate':
                                setBtstRiskGate(data)
                                break
                            case 'progress':
                                setBtstProgress(data)
                                setBtstStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks`)
                                break
                            case 'result':
                                setBtstResult(data)
                                setBtstStatusMsg('Analysis complete!')
                                break
                            case 'error':
                                setBtstError(data.message)
                                break
                            case 'done':
                                break
                        }
                    } catch { /* skip */ }
                    currentEvent = ''
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setBtstError(err.message || 'Something went wrong')
            }
        } finally {
            setBtstScanning(false)
        }
    }, [])

    const stopBtstScan = useCallback(() => {
        btstAbortRef.current?.abort()
        setBtstScanning(false)
        setBtstStatusMsg('Scan stopped')
    }, [])

    const runWeeklyBreakout = useCallback(async () => {
        setWbScanning(true)
        setWbError('')
        setWbResult(null)
        setWbProgress(null)
        setWbRiskGate(null)
        setWbStatusMsg('Connecting...')
        const abort = new AbortController()
        wbAbortRef.current = abort
        try {
            const res = await fetch('/api/strategy/weekly-breakout', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let currentEvent = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''
                for (const line of lines) {
                    if (line.startsWith('event: ')) currentEvent = line.slice(7).trim()
                    if (!line.startsWith('data: ')) continue
                    try {
                        const data = JSON.parse(line.slice(6))
                        switch (currentEvent) {
                            case 'status': setWbStatusMsg(data.message); break
                            case 'riskGate': setWbRiskGate(data); break
                            case 'progress': setWbProgress(data); setWbStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks`); break
                            case 'result': setWbResult(data); setWbStatusMsg('Analysis complete!'); break
                            case 'error': setWbError(data.message); break
                            case 'done': break
                        }
                    } catch { /* skip */ }
                    currentEvent = ''
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') setWbError(err.message || 'Something went wrong')
        } finally { setWbScanning(false) }
    }, [])

    const stopWbScan = useCallback(() => {
        wbAbortRef.current?.abort()
        setWbScanning(false)
        setWbStatusMsg('Scan stopped')
    }, [])

    const runSectorRotation = useCallback(async () => {
        setSrScanning(true)
        setSrError('')
        setSrResult(null)
        setSrProgress(null)
        setSrStatusMsg('Connecting...')

        const abort = new AbortController()
        srAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/sector-rotation', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''


                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (currentEvent) {
                                case 'status':
                                    setSrStatusMsg(data.message || '')
                                    break
                                case 'progress':
                                    setSrProgress(data)
                                    setSrStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                    break
                                case 'result':
                                    setSrResult(data)
                                    setSrStatusMsg('Analysis complete!')
                                    break
                                case 'error':
                                    setSrError(data.message)
                                    break
                                case 'done':
                                    break
                            }
                        } catch { /* skip */ }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setSrError(err.message || 'Something went wrong')
            }
        } finally {
            setSrScanning(false)
        }
    }, [])

    const runEventDriven = useCallback(async () => {
        setEdScanning(true)
        setEdError('')
        setEdResult(null)
        setEdProgress(null)
        setEdStatusMsg('Connecting...')

        const abort = new AbortController()
        edAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/event-driven', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (currentEvent) {
                                case 'status':
                                    setEdStatusMsg(data.message || '')
                                    break
                                case 'progress':
                                    setEdProgress(data)
                                    setEdStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                    break
                                case 'result':
                                    setEdResult(data)
                                    setEdStatusMsg('Analysis complete!')
                                    break
                                case 'error':
                                    setEdError(data.message)
                                    break
                                case 'done':
                                    break
                            }
                        } catch { /* skip */ }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setEdError(err.message || 'Something went wrong')
            }
        } finally {
            setEdScanning(false)
        }
    }, [])

    const runBreakout = useCallback(async () => {
        setBoScanning(true)
        setBoError('')
        setBoResult(null)
        setBoProgress(null)
        setBoStatusMsg('Connecting...')

        const abort = new AbortController()
        boAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/breakout', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (currentEvent) {
                                case 'status':
                                    setBoStatusMsg(data.message || '')
                                    break
                                case 'progress':
                                    setBoProgress(data)
                                    setBoStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                    break
                                case 'result':
                                    setBoResult(data)
                                    setBoStatusMsg('Analysis complete!')
                                    break
                                case 'error':
                                    setBoError(data.message)
                                    break
                                case 'done':
                                    break
                            }
                        } catch { /* skip */ }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setBoError(err.message || 'Something went wrong')
            }
        } finally {
            setBoScanning(false)
        }
    }, [])

    const runFactor = useCallback(async () => {
        setFcScanning(true)
        setFcError('')
        setFcResult(null)
        setFcProgress(null)
        setFcStatusMsg('Connecting...')

        const abort = new AbortController()
        fcAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/factor', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (currentEvent) {
                                case 'status':
                                    setFcStatusMsg(data.message || '')
                                    break
                                case 'progress':
                                    setFcProgress(data)
                                    setFcStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                    break
                                case 'result':
                                    setFcResult(data)
                                    setFcStatusMsg('Analysis complete!')
                                    break
                                case 'error':
                                    setFcError(data.message)
                                    break
                                case 'done':
                                    break
                            }
                        } catch { /* skip */ }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setFcError(err.message || 'Something went wrong')
            }
        } finally {
            setFcScanning(false)
        }
    }, [])

    const runOrb = useCallback(async () => {
        setOrbScanning(true)
        setOrbError('')
        setOrbResult(null)
        setOrbProgress(null)
        setOrbStatusMsg('Connecting...')

        const abort = new AbortController()
        orbAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/orb', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''


                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (currentEvent) {
                                case 'status':
                                    setOrbStatusMsg(data.message || '')
                                    break
                                case 'progress':
                                    setOrbProgress(data)
                                    setOrbStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                    break
                                case 'result':
                                    setOrbResult(data)
                                    setOrbStatusMsg('Analysis complete!')
                                    break
                                case 'error':
                                    setOrbError(data.message)
                                    break
                                case 'done':
                                    break
                            }
                        } catch { /* skip */ }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setOrbError(err.message || 'Something went wrong')
            }
        } finally {
            setOrbScanning(false)
        }
    }, [])

    const runMomentumStrategy = useCallback(async () => {
        setScanning(true)
        setError('')
        setResult(null)
        setProgress(null)
        setRegime(null)
        setStatusMsg('Connecting...')

        const abort = new AbortController()
        abortRef.current = abort

        try {
            const res = await fetch('/api/strategy/momentum', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (currentEvent) {
                                case 'status':
                                    setStatusMsg(data.message || '')
                                    break
                                case 'regime':
                                    setRegime(data)
                                    break
                                case 'progress':
                                    setProgress(data)
                                    setStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                    break
                                case 'result':
                                    setResult(data)
                                    setStatusMsg('Analysis complete!')
                                    break
                                case 'error':
                                    setError(data.message)
                                    break
                                case 'done':
                                    break
                            }
                        } catch { /* skip malformed JSON */ }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setError(err.message || 'Something went wrong')
            }
        } finally {
            setScanning(false)
        }
    }, [])

    const runSwingStrategy = useCallback(async () => {
        setSwingScanning(true)
        setSwingError('')
        setSwingResult(null)
        setSwingProgress(null)
        setSwingStatusMsg('Connecting...')

        const abort = new AbortController()
        swingAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/swing', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let currentEvent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (currentEvent) {
                                case 'status':
                                    setSwingStatusMsg(data.message || '')
                                    break
                                case 'progress':
                                    setSwingProgress(data)
                                    setSwingStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                    break
                                case 'result':
                                    setSwingResult(data)
                                    setSwingStatusMsg('Analysis complete!')
                                    break
                                case 'error':
                                    setSwingError(data.message)
                                    break
                                case 'done':
                                    break
                            }
                        } catch { /* skip */ }
                        currentEvent = ''
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setSwingError(err.message || 'Something went wrong')
            }
        } finally {
            setSwingScanning(false)
        }
    }, [])

    const runMeanReversion = useCallback(async () => {
        setMrScanning(true)
        setMrError('')
        setMrResult(null)
        setMrProgress(null)
        setMrStatusMsg('Connecting...')

        const abort = new AbortController()
        mrAbortRef.current = abort

        try {
            const res = await fetch('/api/strategy/mean-reversion', { signal: abort.signal })
            if (!res.ok || !res.body) throw new Error('Failed to connect')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const data = JSON.parse(line.slice(6))
                        switch (data.type) {
                            case 'status':
                                setMrStatusMsg(data.message || '')
                                break
                            case 'progress':
                                setMrProgress(data)
                                setMrStatusMsg(`Scanning... ${data.scanned}/${data.total} stocks (${data.pct}%)`)
                                break
                            case 'result':
                                setMrResult(data.data)
                                setMrStatusMsg('Analysis complete!')
                                break
                            case 'error':
                                setMrError(data.message)
                                break
                            case 'done':
                                break
                        }
                    } catch { /* skip */ }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setMrError(err.message || 'Something went wrong')
            }
        } finally {
            setMrScanning(false)
        }
    }, [])

    return (
        <div className="max-w-[1400px] mx-auto space-y-5 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl flex items-center justify-center">
                        <Brain size={22} className="text-cyan-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[var(--foreground)]">Strategy Analysis</h1>
                        <p className="text-xs text-[var(--foreground-muted)]">Research-backed trading strategies across multiple timeframes</p>
                    </div>
                </div>
            </div>

            {/* Timeframe Selector */}
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4">
                <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-3">Holding Period</p>
                <div className="flex flex-wrap gap-2">
                    {timeframes.map(tf => (
                        <button key={tf.id} onClick={() => tf.available && setActiveTimeframe(tf.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTimeframe === tf.id
                                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                                : tf.available
                                    ? 'bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)] hover:border-cyan-500/30'
                                    : 'bg-[var(--background)] text-[var(--foreground-muted)] border border-[var(--border)] opacity-40 cursor-not-allowed'
                                }`}>
                            {tf.label}
                            {!tf.available && <span className="ml-1 text-[9px]">SOON</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* Strategy Cards per Timeframe */}
            {activeTimeframe === '1M' && (
                <div className="space-y-4">
                    {/* Momentum Strategy Card */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-[var(--border)]">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center">
                                        <TrendingUp size={20} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[var(--foreground)]">MOMENTUM TRADING</h3>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Jegadeesh & Titman · Multi-period composite scoring · Inv-vol weighting</p>
                                    </div>
                                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold rounded-full border border-emerald-500/20">PROVEN</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {scanning && (
                                        <button onClick={stopScan}
                                            className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-xl flex items-center gap-2 transition-all text-sm border border-red-500/20">
                                            <StopCircle size={16} /> Stop
                                        </button>
                                    )}
                                    <button onClick={runMomentumStrategy} disabled={scanning}
                                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap text-sm">
                                        {scanning ? <><Loader2 size={16} className="animate-spin" /> Scanning...</> : <><Zap size={16} /> Scan All Stocks</>}
                                    </button>
                                </div>
                            </div>
                            {/* Academic backing */}
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[var(--foreground-muted)]">
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">📚 J&T 1993</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">📊 Sehgal & Balakrishnan 2002</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">🇮🇳 NSE Nifty200 MOM30</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">⏱️ {result?.holdingPeriod || '22 trading days'}</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">🔍 ~500 stocks universe</span>
                            </div>
                        </div>

                        {/* LIVE SCANNING PROGRESS */}
                        {scanning && (
                            <div className="p-4 sm:p-5 space-y-3 border-b border-[var(--border)] bg-gradient-to-b from-cyan-500/5 to-transparent">
                                {/* Regime info if received */}
                                {regime && (
                                    <div className={`rounded-xl p-3 border ${regime.isBull
                                        ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${regime.isBull
                                                ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {regime.isBull ? '🟢 BULL' : '🔴 BEAR'}
                                            </span>
                                            <span className="text-xs text-[var(--foreground-muted)]">
                                                Nifty ₹{regime.currentPrice?.toFixed(0)} {regime.isBull ? '>' : '<'} {regime.smaPeriod}d SMA ₹{regime.sma?.toFixed(0)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Progress bar */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-[var(--foreground-muted)] flex items-center gap-1.5">
                                            <Loader2 size={12} className="animate-spin text-cyan-400" />
                                            {statusMsg}
                                        </span>
                                        {progress && (
                                            <span className="text-cyan-400 font-bold">{progress.pct}%</span>
                                        )}
                                    </div>
                                    <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${progress?.pct || 2}%` }}
                                        />
                                    </div>
                                    {progress && (
                                        <div className="flex flex-wrap gap-3 text-[10px] text-[var(--foreground-muted)]">
                                            <span>📊 Scanned: <strong className="text-[var(--foreground)]">{progress.scanned}/{progress.total}</strong></span>
                                            <span>✅ Fetched: <strong className="text-emerald-400">{progress.fetched}</strong></span>
                                            {progress.errors > 0 && (
                                                <span>❌ Errors: <strong className="text-red-400">{progress.errors}</strong></span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="p-4 mx-4 mb-4 mt-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-sm text-red-400">
                                <AlertTriangle size={16} /> {error}
                            </div>
                        )}

                        {/* RESULTS */}
                        {result && !scanning && (
                            <div className="p-4 sm:p-5 space-y-4">
                                {/* Market Regime Banner */}
                                <div className={`rounded-xl p-4 border-2 ${result.regime === 'BULL'
                                    ? 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-transparent'
                                    : 'border-red-500/30 bg-gradient-to-r from-red-500/5 to-transparent'
                                    }`}>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${result.regime === 'BULL'
                                            ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {result.regime === 'BULL' ? '🟢 BULL MARKET' : '🔴 BEAR MARKET'}
                                        </span>
                                        <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                                            <span>Nifty 50: <strong className="text-[var(--foreground)]">₹{result.niftyPrice?.toFixed(0)}</strong></span>
                                            <span>|</span>
                                            <span>{result.config?.NIFTY_SMA_PERIOD}d SMA: <strong className="text-[var(--foreground)]">₹{result.niftySMA?.toFixed(0)}</strong></span>
                                        </div>
                                        <span className={`ml-auto px-3 py-1 rounded-lg text-xs font-bold ${result.signal === 'INVEST'
                                            ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            Signal: {result.signal}
                                        </span>
                                    </div>
                                    {result.message && (
                                        <p className="mt-2 text-sm text-[var(--foreground-muted)]">{result.message}</p>
                                    )}
                                </div>

                                {/* Stats Row */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { label: 'Universe Scanned', value: result.fetchStats?.totalSymbols || result.totalCandidates, icon: Activity, color: 'text-blue-400' },
                                        { label: 'Passed Filters', value: result.passedFilters, icon: Filter, color: 'text-emerald-400' },
                                        { label: 'Selected', value: result.holdings?.length || 0, icon: Target, color: 'text-cyan-400' },
                                        { label: 'Filtered Out', value: result.filteredOut?.length || 0, icon: AlertTriangle, color: 'text-amber-400' },
                                    ].map(s => (
                                        <div key={s.label} className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)]">
                                            <div className={`flex items-center gap-1.5 text-[10px] ${s.color} mb-1`}>
                                                <s.icon size={12} /> {s.label}
                                            </div>
                                            <p className="text-lg font-bold text-[var(--foreground)]">{s.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Expected Performance */}
                                {result.performance && (
                                    <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border)]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <BarChart3 size={14} className="text-violet-400" />
                                            <span className="text-xs font-semibold text-[var(--foreground)]">Expected Performance (Historical Backtests on NSE)</span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                            {[
                                                { l: 'CAGR', v: result.performance.expectedCAGR, c: 'text-emerald-400' },
                                                { l: 'Win Rate', v: result.performance.expectedWinRate, c: 'text-blue-400' },
                                                { l: 'W:L Ratio', v: result.performance.avgWinnerLoserRatio, c: 'text-cyan-400' },
                                                { l: 'Max DD', v: result.performance.maxDrawdownRange, c: 'text-red-400' },
                                                { l: 'Sharpe', v: result.performance.sharpeEstimate, c: 'text-violet-400' },
                                            ].map(m => (
                                                <div key={m.l} className="text-center py-2">
                                                    <p className={`text-sm font-bold ${m.c}`}>{m.v}</p>
                                                    <p className="text-[9px] text-[var(--foreground-muted)]">{m.l}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-[var(--foreground-muted)] mt-2 flex items-center gap-1">
                                            <Info size={10} /> {result.performance.methodology}
                                        </p>
                                    </div>
                                )}

                                {/* ENTRY GUIDANCE & REBALANCE SCHEDULE */}
                                {result.signal === 'INVEST' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Entry Guidance */}
                                        {result.entryGuidance && (
                                            <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border)]">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Play size={14} className="text-emerald-400" />
                                                    <span className="text-xs font-semibold text-[var(--foreground)]">Entry & Exit Rules</span>
                                                </div>
                                                <div className="space-y-2 text-[11px]">
                                                    {[
                                                        { icon: '🟢', label: 'Entry', value: result.entryGuidance.action },
                                                        { icon: '⏰', label: 'Timing', value: result.entryGuidance.timing },
                                                        { icon: '⚖️', label: 'Sizing', value: result.entryGuidance.sizing },
                                                        { icon: '🛑', label: 'Stop Loss', value: result.entryGuidance.stopLossRule },
                                                        { icon: '📉', label: 'Trailing Stop', value: result.entryGuidance.trailingStopRule },
                                                        { icon: '🔄', label: 'Exit', value: result.entryGuidance.exitRule },
                                                    ].map(r => (
                                                        <div key={r.label} className="flex gap-2">
                                                            <span className="shrink-0">{r.icon}</span>
                                                            <div>
                                                                <span className="font-semibold text-[var(--foreground)]">{r.label}: </span>
                                                                <span className="text-[var(--foreground-muted)]">{r.value}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Rebalance Schedule */}
                                        {result.rebalance && (
                                            <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border)]">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <CalendarDays size={14} className="text-blue-400" />
                                                    <span className="text-xs font-semibold text-[var(--foreground)]">Rebalance Schedule</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {[
                                                        { label: 'Scan Date', value: result.rebalance.scanDate, icon: '📅', color: 'text-[var(--foreground)]' },
                                                        { label: 'Entry Date', value: result.rebalance.entryDate, icon: '🟢', color: 'text-emerald-400' },
                                                        { label: 'Exit Date', value: result.rebalance.exitDate, icon: '🔴', color: 'text-red-400' },
                                                        { label: 'Next Scan', value: result.rebalance.nextScanDate, icon: '🔄', color: 'text-blue-400' },
                                                    ].map(d => (
                                                        <div key={d.label} className="flex items-center justify-between text-[11px]">
                                                            <span className="text-[var(--foreground-muted)] flex items-center gap-1.5">
                                                                {d.icon} {d.label}
                                                            </span>
                                                            <span className={`font-bold ${d.color}`}>{d.value}</span>
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[var(--border)]">
                                                        <span className="text-[var(--foreground-muted)]">⏱️ Holding Period</span>
                                                        <span className="font-bold text-[var(--foreground)]">{result.rebalance.holdingDays} trading days</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* PORTFOLIO HOLDINGS TABLE */}
                                {result.holdings && result.holdings.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Shield size={14} className="text-cyan-400" />
                                            <h4 className="text-sm font-semibold text-[var(--foreground)]">
                                                Top {result.holdings.length} Momentum Picks
                                            </h4>
                                            <span className="text-[10px] text-[var(--foreground-muted)]">· from {result.fetchStats?.successfulFetches || result.totalCandidates} stocks · inv-vol weighted</span>
                                        </div>

                                        <div className="space-y-1.5">
                                            {result.holdings.map(h => (
                                                <div key={h.symbol} className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)] hover:border-cyan-500/20 transition-all">
                                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                                        {/* Rank */}
                                                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${h.rank <= 3 ? 'bg-gradient-to-br from-cyan-500/30 to-blue-500/30 text-cyan-300' : 'bg-[var(--card)] text-[var(--foreground-muted)]'}`}>
                                                            #{h.rank}
                                                        </span>

                                                        {/* Name */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-[var(--foreground)] truncate">{h.name}</p>
                                                            <div className="flex items-center gap-2 text-[10px] text-[var(--foreground-muted)]">
                                                                <span>{h.symbol.replace('.NS', '')}</span>
                                                                <span>·</span>
                                                                <span>{h.sector}</span>
                                                            </div>
                                                        </div>

                                                        {/* Score + Returns (desktop) */}
                                                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                                                            {[
                                                                { l: 'Score', v: `${(h.composite * 100).toFixed(1)}%`, c: 'text-cyan-400' },
                                                                { l: '1M', v: `${h.ret1m >= 0 ? '+' : ''}${(h.ret1m * 100).toFixed(1)}%`, c: h.ret1m >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                                { l: '3M', v: `${h.ret3m >= 0 ? '+' : ''}${(h.ret3m * 100).toFixed(1)}%`, c: h.ret3m >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                                { l: '6M', v: `${h.ret6m >= 0 ? '+' : ''}${(h.ret6m * 100).toFixed(1)}%`, c: h.ret6m >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                                { l: 'Vol', v: `${(h.volatility * 100).toFixed(1)}%`, c: 'text-[var(--foreground)]' },
                                                                { l: 'Wt', v: `${(h.weightInvVol * 100).toFixed(1)}%`, c: 'text-violet-400' },
                                                            ].map(m => (
                                                                <div key={m.l} className="text-center px-2">
                                                                    <p className={`text-xs font-bold ${m.c}`}>{m.v}</p>
                                                                    <p className="text-[8px] text-[var(--foreground-muted)]">{m.l}</p>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Price + Stop Levels */}
                                                        <div className="text-right shrink-0">
                                                            <p className="text-sm font-bold text-[var(--foreground)]">₹{h.currentPrice.toFixed(0)}</p>
                                                            <p className="text-[10px] text-red-400">Hard SL: ₹{h.stopLoss.toFixed(0)}</p>
                                                            {h.trailingStopLevel && (
                                                                <p className={`text-[10px] ${h.trailingStopActive ? 'text-amber-400' : 'text-[var(--foreground-muted)]'}`}>
                                                                    Trail: ₹{h.trailingStopLevel.toFixed(0)} {h.trailingStopActive ? '⚡' : ''}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Mobile metrics */}
                                                    <div className="grid grid-cols-6 gap-1 mt-2 sm:hidden">
                                                        {[
                                                            { l: 'Score', v: `${(h.composite * 100).toFixed(1)}%`, c: 'text-cyan-400' },
                                                            { l: '1M', v: `${h.ret1m >= 0 ? '+' : ''}${(h.ret1m * 100).toFixed(1)}%`, c: h.ret1m >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                            { l: '3M', v: `${h.ret3m >= 0 ? '+' : ''}${(h.ret3m * 100).toFixed(1)}%`, c: h.ret3m >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                            { l: '6M', v: `${h.ret6m >= 0 ? '+' : ''}${(h.ret6m * 100).toFixed(1)}%`, c: h.ret6m >= 0 ? 'text-emerald-400' : 'text-red-400' },
                                                            { l: 'Vol', v: `${(h.volatility * 100).toFixed(1)}%`, c: 'text-[var(--foreground)]' },
                                                            { l: 'Wt', v: `${(h.weightInvVol * 100).toFixed(1)}%`, c: 'text-violet-400' },
                                                        ].map(m => (
                                                            <div key={m.l} className="text-center bg-[var(--card)] rounded-lg p-1">
                                                                <p className={`text-[10px] font-bold ${m.c}`}>{m.v}</p>
                                                                <p className="text-[7px] text-[var(--foreground-muted)]">{m.l}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* BEAR MARKET — No holdings */}
                                {result.signal === 'CASH' && (
                                    <div className="text-center py-8 space-y-3">
                                        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto">
                                            <Shield size={32} className="text-amber-400" />
                                        </div>
                                        <h3 className="text-lg font-bold text-amber-400">Cash Position Recommended</h3>
                                        <p className="text-sm text-[var(--foreground-muted)] max-w-md mx-auto">
                                            The market regime filter indicates a bearish phase. The momentum strategy avoids entering positions during downtrends to reduce drawdowns.
                                        </p>
                                    </div>
                                )}

                                {/* All Scored Toggle */}
                                {result.allScored && result.allScored.length > 0 && (
                                    <button onClick={() => setShowAllScored(!showAllScored)}
                                        className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                                        {showAllScored ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        View all {result.allScored.length} scored stocks
                                    </button>
                                )}

                                {showAllScored && result.allScored && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-[var(--foreground-muted)] text-[10px]">
                                                    <th className="text-left py-2 px-2">#</th>
                                                    <th className="text-left py-2 px-2">Stock</th>
                                                    <th className="text-left py-2 px-2 hidden sm:table-cell">Sector</th>
                                                    <th className="text-right py-2 px-2">Score</th>
                                                    <th className="text-right py-2 px-2">1M</th>
                                                    <th className="text-right py-2 px-2">3M</th>
                                                    <th className="text-right py-2 px-2">6M</th>
                                                    <th className="text-right py-2 px-2">Vol</th>
                                                    <th className="text-right py-2 px-2">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.allScored.map((s: any, i: number) => (
                                                    <tr key={s.symbol} className={`border-t border-[var(--border)] ${i < (result.config?.TOP_N_STOCKS || 15) ? 'bg-cyan-500/5' : ''}`}>
                                                        <td className="py-1.5 px-2 text-[var(--foreground-muted)]">{i + 1}</td>
                                                        <td className="py-1.5 px-2 text-[var(--foreground)] font-medium">{s.symbol.replace('.NS', '')}</td>
                                                        <td className="py-1.5 px-2 text-[var(--foreground-muted)] hidden sm:table-cell text-[10px]">{s.sector}</td>
                                                        <td className="py-1.5 px-2 text-right text-cyan-400 font-bold">{(s.composite * 100).toFixed(2)}%</td>
                                                        <td className={`py-1.5 px-2 text-right ${s.ret1m >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(s.ret1m * 100).toFixed(1)}%</td>
                                                        <td className={`py-1.5 px-2 text-right ${s.ret3m >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(s.ret3m * 100).toFixed(1)}%</td>
                                                        <td className={`py-1.5 px-2 text-right ${s.ret6m >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(s.ret6m * 100).toFixed(1)}%</td>
                                                        <td className="py-1.5 px-2 text-right text-[var(--foreground-muted)]">{(s.volatility * 100).toFixed(1)}%</td>
                                                        <td className="py-1.5 px-2 text-right text-[var(--foreground)]">₹{s.currentPrice.toFixed(0)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Filtered Out Toggle */}
                                {result.filteredOut && result.filteredOut.length > 0 && (
                                    <>
                                        <button onClick={() => setShowFiltered(!showFiltered)}
                                            className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                                            {showFiltered ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            {result.filteredOut.length} stocks filtered out
                                        </button>

                                        {showFiltered && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                {result.filteredOut.map((f: any) => (
                                                    <div key={f.symbol} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[11px]">
                                                        <span className="text-red-400">✕</span>
                                                        <span className="font-medium text-[var(--foreground)]">{f.symbol.replace('.NS', '')}</span>
                                                        <span className="text-[var(--foreground-muted)] truncate">{f.reason}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Fetch Stats */}
                                {result.fetchStats && (
                                    <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)] flex flex-wrap gap-4 text-[10px] text-[var(--foreground-muted)]">
                                        <span>🔍 Universe: <strong className="text-[var(--foreground)]">{result.fetchStats.totalSymbols}</strong> stocks</span>
                                        <span>✅ Fetched: <strong className="text-emerald-400">{result.fetchStats.successfulFetches}</strong></span>
                                        {result.fetchStats.failedFetches > 0 && (
                                            <span>❌ Failed: <strong className="text-red-400">{result.fetchStats.failedFetches}</strong></span>
                                        )}
                                    </div>
                                )}

                                {/* Strategy Config */}
                                {result.config && (
                                    <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)]">
                                        <p className="text-[10px] font-semibold text-[var(--foreground-muted)] mb-2 uppercase tracking-wide">Strategy Configuration</p>
                                        <div className="flex flex-wrap gap-2 text-[10px]">
                                            {[
                                                { l: 'Weights', v: `${(result.config.WEIGHT_1M * 100).toFixed(0)}% / ${(result.config.WEIGHT_3M * 100).toFixed(0)}% / ${(result.config.WEIGHT_6M * 100).toFixed(0)}% (1M/3M/6M)` },
                                                { l: 'Top N', v: result.config.TOP_N_STOCKS },
                                                { l: 'Stop Loss', v: `${(result.config.STOP_LOSS_PCT * 100).toFixed(0)}% hard` },
                                                { l: 'Trailing Stop', v: `After +${(result.config.TRAILING_STOP_ACTIVATION * 100).toFixed(0)}%, trail at ${result.config.TRAILING_STOP_LOOKBACK}d low` },
                                                { l: 'Min Turnover', v: `₹${result.config.MIN_AVG_TURNOVER_CR}cr` },
                                                { l: 'Vol Cap', v: `${(result.config.MAX_ANNUALIZED_VOLATILITY * 100).toFixed(0)}%` },
                                                { l: 'Regime Filter', v: `Nifty > ${result.config.NIFTY_SMA_PERIOD}d SMA` },
                                                { l: 'Earnings Blackout', v: `±${result.config.EARNINGS_BLACKOUT_DAYS}d from earnings` },
                                            ].map(c => (
                                                <span key={c.l} className="px-2 py-1 bg-[var(--card)] rounded-lg border border-[var(--border)] text-[var(--foreground-muted)]">
                                                    <span className="text-[var(--foreground)] font-medium">{c.l}:</span> {c.v}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ========================================== */}
                    {/* STRATEGY 2: SWING TRADING */}
                    {/* ========================================== */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-[var(--border)]">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
                                        <Crosshair size={20} className="text-violet-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[var(--foreground)]">SWING TRADING</h3>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">20-EMA Pullback + MACD Crossover · Multi-confluence · Technical Analysis</p>
                                    </div>
                                    <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 text-[9px] font-bold rounded-full border border-violet-500/20">2 SETUPS</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {swingScanning && (
                                        <button onClick={stopSwingScan}
                                            className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-xl flex items-center gap-2 transition-all text-sm border border-red-500/20">
                                            <StopCircle size={16} /> Stop
                                        </button>
                                    )}
                                    <button onClick={runSwingStrategy} disabled={swingScanning}
                                        className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-40 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap text-sm">
                                        {swingScanning ? <><Loader2 size={16} className="animate-spin" /> Scanning...</> : <><Crosshair size={16} /> Scan Swing Setups</>}
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[var(--foreground-muted)]">
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">📈 Setup A: 20-EMA Pullback (7 conditions)</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">📊 Setup B: MACD Crossover (5 conditions)</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">🇮🇳 Indian market filters</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">⏱️ 2-4 week hold</span>
                                <span className="px-2 py-1 bg-[var(--background)] rounded-lg border border-[var(--border)]">🔍 ~500 stocks</span>
                            </div>
                        </div>

                        {/* SWING SCANNING PROGRESS */}
                        {swingScanning && (
                            <div className="p-4 sm:p-5 space-y-3 border-b border-[var(--border)] bg-gradient-to-b from-violet-500/5 to-transparent">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-[var(--foreground-muted)] flex items-center gap-1.5">
                                            <Loader2 size={12} className="animate-spin text-violet-400" />
                                            {swingStatusMsg}
                                        </span>
                                        {swingProgress && <span className="text-violet-400 font-bold">{swingProgress.pct}%</span>}
                                    </div>
                                    <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${swingProgress?.pct || 2}%` }} />
                                    </div>
                                    {swingProgress && (
                                        <div className="flex flex-wrap gap-3 text-[10px] text-[var(--foreground-muted)]">
                                            <span>📊 Scanned: <strong className="text-[var(--foreground)]">{swingProgress.scanned}/{swingProgress.total}</strong></span>
                                            <span>✅ Fetched: <strong className="text-emerald-400">{swingProgress.fetched}</strong></span>
                                            {swingProgress.errors > 0 && <span>❌ Errors: <strong className="text-red-400">{swingProgress.errors}</strong></span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {swingError && (
                            <div className="p-4 mx-4 mb-4 mt-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-sm text-red-400">
                                <AlertTriangle size={16} /> {swingError}
                            </div>
                        )}

                        {/* SWING RESULTS */}
                        {swingResult && !swingScanning && (
                            <div className="p-4 sm:p-5 space-y-4">
                                {/* Stats Row */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {[
                                        { label: 'Scanned', value: swingResult.fetchStats?.totalSymbols || swingResult.totalScanned, icon: Activity, color: 'text-blue-400' },
                                        { label: 'Setup A Hits', value: swingResult.setupA_signals?.length || 0, icon: TrendingUp, color: 'text-emerald-400' },
                                        { label: 'Setup B Hits', value: swingResult.setupB_signals?.length || 0, icon: BarChart3, color: 'text-violet-400' },
                                        { label: 'Near Misses', value: swingResult.nearMiss?.length || 0, icon: Eye, color: 'text-amber-400' },
                                        { label: 'Filtered Out', value: swingResult.totalFiltered || 0, icon: Filter, color: 'text-red-400' },
                                    ].map(s => (
                                        <div key={s.label} className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)]">
                                            <div className={`flex items-center gap-1.5 text-[10px] ${s.color} mb-1`}><s.icon size={12} /> {s.label}</div>
                                            <p className="text-lg font-bold text-[var(--foreground)]">{s.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Expected Performance */}
                                {swingResult.performance && (
                                    <div className="bg-[var(--background)] rounded-xl p-4 border border-[var(--border)]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <BarChart3 size={14} className="text-violet-400" />
                                            <span className="text-xs font-semibold text-[var(--foreground)]">Expected Performance</span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[
                                                { l: 'Win Rate', v: swingResult.performance.expectedWinRate, c: 'text-emerald-400' },
                                                { l: 'Reward:Risk', v: swingResult.performance.rewardRisk, c: 'text-cyan-400' },
                                                { l: 'Holding', v: swingResult.performance.avgHoldingDays, c: 'text-blue-400' },
                                            ].map(m => (
                                                <div key={m.l} className="text-center py-2">
                                                    <p className={`text-sm font-bold ${m.c}`}>{m.v}</p>
                                                    <p className="text-[9px] text-[var(--foreground-muted)]">{m.l}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-[var(--foreground-muted)] mt-2 flex items-center gap-1">
                                            <Info size={10} /> {swingResult.performance.methodology}
                                        </p>
                                    </div>
                                )}

                                {/* SETUP A SIGNALS */}
                                {swingResult.setupA_signals && swingResult.setupA_signals.length > 0 && (
                                    <div className="space-y-2">
                                        <button onClick={() => setShowSwingSetupA(!showSwingSetupA)}
                                            className="flex items-center gap-2">
                                            {showSwingSetupA ? <ChevronDown size={14} className="text-emerald-400" /> : <ChevronRight size={14} className="text-emerald-400" />}
                                            <TrendingUp size={14} className="text-emerald-400" />
                                            <span className="text-sm font-semibold text-[var(--foreground)]">Setup A: 20-EMA Pullback</span>
                                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold rounded-full">{swingResult.setupA_signals.length} signals</span>
                                        </button>

                                        {showSwingSetupA && swingResult.setupA_signals.map((sig: any) => (
                                            <div key={sig.symbol} className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)] hover:border-emerald-500/20 transition-all space-y-2">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-medium text-[var(--foreground)]">{sig.name}</p>
                                                        <p className="text-[10px] text-[var(--foreground-muted)]">{sig.symbol.replace('.NS', '')} · {sig.sector}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-lg">
                                                            Confluence: {sig.confluenceRatio}
                                                        </span>
                                                        <span className="text-sm font-bold text-[var(--foreground)]">₹{sig.indicators?.close?.toFixed(0)}</span>
                                                    </div>
                                                </div>

                                                {/* Condition checklist */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 text-[10px]">
                                                    {sig.reasons?.map((r: string, i: number) => (
                                                        <span key={i} className={`px-2 py-0.5 rounded ${r.startsWith('✓') ? 'text-emerald-400' : r.startsWith('~') ? 'text-amber-400' : 'text-red-400'}`}>{r}</span>
                                                    ))}
                                                </div>

                                                {/* Trade plan */}
                                                {sig.trade && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--border)]">
                                                        {[
                                                            { l: 'Entry', v: `₹${sig.trade.entry}`, c: 'text-emerald-400' },
                                                            { l: 'Stop Loss', v: `₹${sig.trade.stopLoss} (${sig.trade.riskPct})`, c: 'text-red-400' },
                                                            { l: 'Target 1', v: `₹${sig.trade.target1} (${sig.trade.target1Pct})`, c: 'text-cyan-400' },
                                                            { l: 'R:R', v: sig.trade.riskRewardRatio, c: 'text-violet-400' },
                                                        ].map(m => (
                                                            <div key={m.l} className="text-center bg-[var(--card)] rounded-lg p-1.5">
                                                                <p className={`text-[10px] font-bold ${m.c}`}>{m.v}</p>
                                                                <p className="text-[7px] text-[var(--foreground-muted)]">{m.l}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Indicators */}
                                                <div className="flex flex-wrap gap-2 text-[9px] text-[var(--foreground-muted)]">
                                                    {sig.indicators?.ema20 && <span>EMA20: ₹{sig.indicators.ema20}</span>}
                                                    {sig.indicators?.sma50 && <span>SMA50: ₹{sig.indicators.sma50}</span>}
                                                    {sig.indicators?.rsi && <span>RSI: {sig.indicators.rsi}</span>}
                                                    {sig.indicators?.macdLine !== null && <span>MACD: {sig.indicators.macdLine}</span>}
                                                    {sig.indicators?.volumeRatio && <span>Vol: {sig.indicators.volumeRatio}x</span>}
                                                    {sig.indicators?.volatility && <span>σ: {sig.indicators.volatility}</span>}
                                                </div>

                                                {sig.warnings && sig.warnings.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {sig.warnings.map((w: string, i: number) => (
                                                            <span key={i} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] rounded-lg">⚠️ {w}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* SETUP B SIGNALS */}
                                {swingResult.setupB_signals && swingResult.setupB_signals.length > 0 && (
                                    <div className="space-y-2">
                                        <button onClick={() => setShowSwingSetupB(!showSwingSetupB)}
                                            className="flex items-center gap-2">
                                            {showSwingSetupB ? <ChevronDown size={14} className="text-violet-400" /> : <ChevronRight size={14} className="text-violet-400" />}
                                            <BarChart3 size={14} className="text-violet-400" />
                                            <span className="text-sm font-semibold text-[var(--foreground)]">Setup B: MACD Crossover</span>
                                            <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 text-[9px] font-bold rounded-full">{swingResult.setupB_signals.length} signals</span>
                                        </button>

                                        {showSwingSetupB && swingResult.setupB_signals.map((sig: any) => (
                                            <div key={sig.symbol} className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)] hover:border-violet-500/20 transition-all space-y-2">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-medium text-[var(--foreground)]">{sig.name}</p>
                                                        <p className="text-[10px] text-[var(--foreground-muted)]">{sig.symbol.replace('.NS', '')} · {sig.sector}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-1 bg-violet-500/10 text-violet-400 text-[10px] font-bold rounded-lg">
                                                            Confluence: {sig.confluenceRatio}
                                                        </span>
                                                        <span className="text-sm font-bold text-[var(--foreground)]">₹{sig.indicators?.close?.toFixed(0)}</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 text-[10px]">
                                                    {sig.reasons?.map((r: string, i: number) => (
                                                        <span key={i} className={`px-2 py-0.5 rounded ${r.startsWith('✓') ? 'text-emerald-400' : r.startsWith('~') ? 'text-amber-400' : 'text-red-400'}`}>{r}</span>
                                                    ))}
                                                </div>

                                                {sig.trade && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]">
                                                        {[
                                                            { l: 'Entry', v: `₹${sig.trade.entry}`, c: 'text-emerald-400' },
                                                            { l: 'Stop Loss', v: `₹${sig.trade.stopLoss} (${sig.trade.riskPct})`, c: 'text-red-400' },
                                                            { l: 'Target', v: sig.trade.targetMethod, c: 'text-cyan-400' },
                                                        ].map(m => (
                                                            <div key={m.l} className="text-center bg-[var(--card)] rounded-lg p-1.5">
                                                                <p className={`text-[10px] font-bold ${m.c}`}>{m.v}</p>
                                                                <p className="text-[7px] text-[var(--foreground-muted)]">{m.l}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex flex-wrap gap-2 text-[9px] text-[var(--foreground-muted)]">
                                                    {sig.indicators?.ema20 && <span>EMA20: ₹{sig.indicators.ema20}</span>}
                                                    {sig.indicators?.macdLine !== null && <span>MACD: {sig.indicators.macdLine}</span>}
                                                    {sig.indicators?.signalLine !== null && <span>Signal: {sig.indicators.signalLine}</span>}
                                                    {sig.indicators?.histogram !== null && <span>Hist: {sig.indicators.histogram}</span>}
                                                    {sig.indicators?.volumeRatio && <span>Vol: {sig.indicators.volumeRatio}x</span>}
                                                </div>

                                                {sig.warnings && sig.warnings.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {sig.warnings.map((w: string, i: number) => (
                                                            <span key={i} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] rounded-lg">⚠️ {w}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* NO SIGNALS */}
                                {(!swingResult.setupA_signals || swingResult.setupA_signals.length === 0) &&
                                 (!swingResult.setupB_signals || swingResult.setupB_signals.length === 0) && (
                                    <div className="text-center py-8 space-y-3">
                                        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto">
                                            <Crosshair size={32} className="text-amber-400" />
                                        </div>
                                        <h3 className="text-lg font-bold text-amber-400">No Active Swing Setups</h3>
                                        <p className="text-sm text-[var(--foreground-muted)] max-w-md mx-auto">
                                            No stocks currently meet the multi-confluence criteria for either the 20-EMA Pullback or MACD Crossover setups. Check the near-misses for stocks approaching setup conditions.
                                        </p>
                                    </div>
                                )}

                                {/* NEAR MISSES */}
                                {swingResult.nearMiss && swingResult.nearMiss.length > 0 && (
                                    <>
                                        <button onClick={() => setShowSwingNearMiss(!showSwingNearMiss)}
                                            className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                                            {showSwingNearMiss ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            <Eye size={14} /> {swingResult.nearMiss.length} near-misses (watchlist)
                                        </button>

                                        {showSwingNearMiss && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                {swingResult.nearMiss.map((nm: any) => (
                                                    <div key={nm.symbol} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[11px]">
                                                        <div>
                                                            <span className="font-medium text-[var(--foreground)]">{nm.symbol.replace('.NS', '')}</span>
                                                            <span className="text-[var(--foreground-muted)] ml-1">{nm.name}</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <span className="text-emerald-400">A:{nm.setupA_score}</span>
                                                            <span className="text-violet-400">B:{nm.setupB_score}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* FILTERED OUT */}
                                {swingResult.filtered && swingResult.filtered.length > 0 && (
                                    <>
                                        <button onClick={() => setShowSwingFiltered(!showSwingFiltered)}
                                            className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                                            {showSwingFiltered ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            {swingResult.filtered.length} stocks filtered out
                                        </button>

                                        {showSwingFiltered && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                                {swingResult.filtered.map((f: any) => (
                                                    <div key={f.symbol} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[11px]">
                                                        <span className="text-red-400">✕</span>
                                                        <span className="font-medium text-[var(--foreground)]">{f.symbol.replace('.NS', '')}</span>
                                                        <span className="text-[var(--foreground-muted)] truncate">{f.reason}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Fetch Stats */}
                                {swingResult.fetchStats && (
                                    <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)] flex flex-wrap gap-4 text-[10px] text-[var(--foreground-muted)]">
                                        <span>🔍 Universe: <strong className="text-[var(--foreground)]">{swingResult.fetchStats.totalSymbols}</strong></span>
                                        <span>✅ Fetched: <strong className="text-emerald-400">{swingResult.fetchStats.successfulFetches}</strong></span>
                                        {swingResult.fetchStats.failedFetches > 0 && (
                                            <span>❌ Failed: <strong className="text-red-400">{swingResult.fetchStats.failedFetches}</strong></span>
                                        )}
                                    </div>
                                )}

                                {/* Config */}
                                {swingResult.config && (
                                    <div className="bg-[var(--background)] rounded-xl p-3 border border-[var(--border)]">
                                        <p className="text-[10px] font-semibold text-[var(--foreground-muted)] mb-2 uppercase tracking-wide">Strategy Configuration</p>
                                        <div className="flex flex-wrap gap-2 text-[10px]">
                                            {[
                                                { l: 'EMA Fast/Mid', v: `${swingResult.config.EMA_FAST}/${swingResult.config.EMA_MID}` },
                                                { l: 'SMA Slow', v: swingResult.config.SMA_SLOW },
                                                { l: 'RSI Zone', v: `${swingResult.config.RSI_RESET_LOW}-${swingResult.config.RSI_RESET_HIGH}` },
                                                { l: 'MACD', v: `${swingResult.config.MACD_FAST}/${swingResult.config.MACD_SLOW}/${swingResult.config.MACD_SIGNAL}` },
                                                { l: 'Pullback', v: `±${(swingResult.config.PULLBACK_PROXIMITY_PCT * 100).toFixed(0)}% of EMA20` },
                                                { l: 'Vol Trigger (A)', v: `${swingResult.config.TRIGGER_VOLUME_MULTIPLIER}x` },
                                                { l: 'Vol Trigger (B)', v: `${swingResult.config.MACD_VOLUME_MULTIPLIER}x` },
                                                { l: 'Min Stop', v: `${(swingResult.config.MIN_STOP_DISTANCE_PCT * 100).toFixed(0)}%` },
                                                { l: 'Dead Money', v: `${swingResult.config.DEAD_MONEY_DAYS}d / ${(swingResult.config.DEAD_MONEY_THRESHOLD * 100).toFixed(0)}%` },
                                                { l: 'Risk/Trade', v: `${(swingResult.config.MAX_RISK_PER_TRADE_PCT * 100).toFixed(0)}%` },
                                                { l: 'Max Positions', v: swingResult.config.MAX_CONCURRENT_POSITIONS },
                                                { l: 'Min Turnover', v: `₹${swingResult.config.MIN_AVG_TURNOVER_CR}cr` },
                                            ].map(c => (
                                                <span key={c.l} className="px-2 py-1 bg-[var(--card)] rounded-lg border border-[var(--border)] text-[var(--foreground-muted)]">
                                                    <span className="text-[var(--foreground)] font-medium">{c.l}:</span> {c.v}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ═══ STRATEGY 3: MEAN REVERSION ═══ */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-b border-[var(--border)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center">
                                        <GitPullRequestArrow size={20} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                                            Strategy 3: Mean Reversion (RSI2)
                                            <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">CONTRARIAN</span>
                                        </h3>
                                        <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">Buy oversold Nifty 100 stocks above 200-SMA · RSI(2) &lt; 10 entry · Connors &amp; Alvarez</p>
                                    </div>
                                </div>
                                <button
                                    onClick={mrScanning ? stopMrScan : runMeanReversion}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                                        mrScanning
                                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/25'
                                    }`}
                                >
                                    {mrScanning ? <><StopCircle size={14} /> Stop</> : <><Play size={14} /> Run Scan</>}
                                </button>
                            </div>

                            {/* Progress */}
                            {(mrScanning || mrProgress) && (
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-[10px] text-[var(--foreground-muted)] mb-1">
                                        <span>{mrStatusMsg}</span>
                                        <span>{mrProgress?.pct || 0}%</span>
                                    </div>
                                    <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${mrProgress?.pct || 0}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Error */}
                        {mrError && (
                            <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                                <AlertTriangle size={14} className="inline mr-1" /> {mrError}
                            </div>
                        )}

                        {/* Expected Performance (before scan) */}
                        {!mrResult && !mrScanning && (
                            <div className="p-5">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                    {[
                                        { label: 'Win Rate', value: '70-80%', icon: Target, color: 'text-emerald-400' },
                                        { label: 'Avg Gain', value: '3-5%', icon: TrendingUp, color: 'text-teal-400' },
                                        { label: 'Holding', value: '4-7 days', icon: Clock, color: 'text-cyan-400' },
                                        { label: 'Max DD', value: '10-15%', icon: Shield, color: 'text-amber-400' },
                                    ].map(m => (
                                        <div key={m.label} className="bg-[var(--background)] rounded-xl p-3 text-center">
                                            <m.icon size={16} className={`${m.color} mx-auto mb-1`} />
                                            <div className="text-sm font-bold text-[var(--foreground)]">{m.value}</div>
                                            <div className="text-[9px] text-[var(--foreground-muted)]">{m.label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[10px] text-[var(--foreground-muted)] bg-[var(--background)] rounded-lg p-3">
                                    <p className="font-medium text-[var(--foreground)] mb-1">How it works:</p>
                                    <ul className="space-y-0.5 list-disc list-inside">
                                        <li>Scans for stocks in <span className="text-emerald-400">long-term uptrends</span> (price &gt; 200-SMA)</li>
                                        <li>Identifies <span className="text-emerald-400">extreme short-term oversold</span> conditions (RSI(2) &lt; 10)</li>
                                        <li>Requires 2+ consecutive down closes + earnings blackout check</li>
                                        <li>Exit: RSI(2) &gt; 70, above 5-SMA, or 10-day time stop</li>
                                        <li>Stop-loss: tighter of 2×ATR(14) or 7% below entry</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Results */}
                        {mrResult && (
                            <div className="p-5 space-y-4">
                                {/* Market Regime */}
                                {mrResult.regime && (
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                                        mrResult.regime.regime === 'BULL' ? 'bg-emerald-500/10 text-emerald-400' :
                                        mrResult.regime.regime === 'BULL_PANIC' ? 'bg-amber-500/10 text-amber-400' :
                                        'bg-red-500/10 text-red-400'
                                    }`}>
                                        {mrResult.regime.regime === 'BULL' ? <TrendingUp size={14} /> : mrResult.regime.regime === 'BULL_PANIC' ? <AlertTriangle size={14} /> : <TrendingDown size={14} />}
                                        <span className="font-semibold">Market: {mrResult.regime.regime}</span>
                                        {mrResult.regime.nifty && <span className="text-[var(--foreground-muted)]">• Nifty {mrResult.regime.nifty} ({mrResult.regime.distancePct} from 200-SMA)</span>}
                                        {mrResult.regime.warning && <span className="text-amber-400 ml-1">⚠ {mrResult.regime.warning}</span>}
                                    </div>
                                )}

                                {/* Stats Row */}
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { label: 'Scanned', value: mrResult.totalScanned, color: 'text-[var(--foreground)]' },
                                        { label: 'Signals', value: mrResult.signalCount, color: 'text-emerald-400' },
                                        { label: 'Watchlist', value: mrResult.watchlist?.length || 0, color: 'text-amber-400' },
                                        { label: 'Filtered', value: mrResult.totalFiltered, color: 'text-[var(--foreground-muted)]' },
                                    ].map(s => (
                                        <div key={s.label} className="bg-[var(--background)] rounded-xl p-3 text-center">
                                            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                                            <div className="text-[9px] text-[var(--foreground-muted)]">{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Triggered Signals */}
                                {mrResult.signals?.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                                            <Zap size={14} /> TRIGGERED SIGNALS ({mrResult.signals.length})
                                        </h4>
                                        {mrResult.signals.map((sig: any, idx: number) => (
                                            <div key={idx} className="bg-[var(--background)] rounded-xl p-4 border border-emerald-500/20">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div>
                                                        <span className="text-sm font-bold text-[var(--foreground)]">{sig.symbol}</span>
                                                        {sig.name && <span className="text-[10px] text-[var(--foreground-muted)] ml-2">{sig.name}</span>}
                                                        {sig.overallGrade && (
                                                            <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                                                sig.overallGrade === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                sig.overallGrade === 'B' ? 'bg-teal-500/20 text-teal-400' :
                                                                'bg-amber-500/20 text-amber-400'
                                                            }`}>Grade {sig.overallGrade}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-emerald-400 font-semibold">Quality: {sig.qualityScore}/{sig.maxQualityScore}</span>
                                                </div>

                                                {/* Conditions */}
                                                <div className="grid grid-cols-2 gap-1.5 mb-3">
                                                    {sig.conditions?.map((c: any, ci: number) => (
                                                        <div key={ci} className={`text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 ${
                                                            c.met ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                            {c.met ? '✓' : '✗'} {c.name.replace(/_/g, ' ')}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Quality Factors */}
                                                {sig.qualityFactors?.length > 0 && (
                                                    <div className="text-[10px] text-[var(--foreground-muted)] mb-3 space-y-0.5">
                                                        {sig.qualityFactors.map((f: string, fi: number) => (
                                                            <div key={fi}>• {f}</div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Trade Plan */}
                                                {sig.trade && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                                                        <div className="bg-[var(--card)] rounded-lg p-2">
                                                            <div className="text-[var(--foreground-muted)]">Entry</div>
                                                            <div className="font-bold text-[var(--foreground)]">₹{sig.trade.entryPrice}</div>
                                                        </div>
                                                        <div className="bg-[var(--card)] rounded-lg p-2">
                                                            <div className="text-[var(--foreground-muted)]">Stop Loss</div>
                                                            <div className="font-bold text-red-400">₹{sig.trade.stopLoss} ({sig.trade.stopDistancePct})</div>
                                                        </div>
                                                        <div className="bg-[var(--card)] rounded-lg p-2">
                                                            <div className="text-[var(--foreground-muted)]">Target (BB Mid)</div>
                                                            <div className="font-bold text-emerald-400">₹{sig.trade.bbMiddleTarget}</div>
                                                        </div>
                                                        <div className="bg-[var(--card)] rounded-lg p-2">
                                                            <div className="text-[var(--foreground-muted)]">Risk:Reward</div>
                                                            <div className="font-bold text-teal-400">{sig.trade.estimatedRiskReward}</div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Key Indicators */}
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {[
                                                        { l: 'RSI(2)', v: sig.indicators?.rsi2 },
                                                        { l: 'RSI(14)', v: sig.indicators?.rsi14 },
                                                        { l: 'BB %B', v: sig.indicators?.bbPercentB },
                                                        { l: 'Down Days', v: sig.indicators?.consecutiveDown },
                                                        { l: 'Decline', v: sig.indicators?.cumulativeDecline },
                                                    ].map(ind => (
                                                        <span key={ind.l} className="text-[9px] px-2 py-0.5 bg-[var(--card)] rounded border border-[var(--border)] text-[var(--foreground-muted)]">
                                                            <span className="text-[var(--foreground)] font-medium">{ind.l}:</span> {ind.v ?? 'N/A'}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {mrResult.signals?.length === 0 && mrResult.regime?.tradeable && (
                                    <div className="text-center py-8 text-[var(--foreground-muted)] text-sm">
                                        <Info size={24} className="mx-auto mb-2 opacity-50" />
                                        No stocks currently meet all 4 mean reversion conditions.
                                        <br />
                                        <span className="text-[10px]">Check the watchlist for stocks close to triggering.</span>
                                    </div>
                                )}

                                {/* Watchlist */}
                                {mrResult.watchlist?.length > 0 && (
                                    <div>
                                        <button onClick={() => setShowMrWatchlist(!showMrWatchlist)} className="flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">
                                            {showMrWatchlist ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            <Eye size={14} /> WATCHLIST — Almost Triggered ({mrResult.watchlist.length})
                                        </button>
                                        {showMrWatchlist && (
                                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {mrResult.watchlist.map((w: any, i: number) => (
                                                    <div key={i} className="bg-[var(--background)] rounded-lg p-3 text-[10px] border border-amber-500/10">
                                                        <div className="font-bold text-[var(--foreground)] text-xs">{w.symbol} <span className="text-[var(--foreground-muted)] font-normal">{w.name}</span></div>
                                                        <div className="text-[var(--foreground-muted)] mt-1">Score: {w.score}/4 • RSI(2): {w.rsi2} • Down: {w.consecutiveDown} days</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Filtered */}
                                {mrResult.filtered?.length > 0 && (
                                    <div>
                                        <button onClick={() => setShowMrFiltered(!showMrFiltered)} className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                                            {showMrFiltered ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            <Filter size={14} /> Filtered Stocks ({mrResult.totalFiltered})
                                        </button>
                                        {showMrFiltered && (
                                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                {mrResult.filtered.slice(0, 20).map((f: any, i: number) => (
                                                    <div key={i} className="text-[10px] px-2.5 py-1.5 bg-[var(--background)] rounded-lg text-[var(--foreground-muted)]">
                                                        <span className="text-[var(--foreground)] font-medium">{f.symbol}</span> — {f.reason}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Config */}
                                {mrResult.config && (
                                    <div>
                                        <h4 className="text-[10px] font-semibold text-[var(--foreground-muted)] mb-2 flex items-center gap-1"><Info size={12} /> Configuration</h4>
                                        <div className="flex flex-wrap gap-1.5 text-[9px]">
                                            {[
                                                { l: 'RSI Entry', v: `< ${mrResult.config.RSI2_OVERSOLD}` },
                                                { l: 'RSI Exit', v: `> ${mrResult.config.RSI2_OVERBOUGHT}` },
                                                { l: 'Min Down', v: `${mrResult.config.MIN_CONSECUTIVE_DOWN} days` },
                                                { l: 'Time Stop', v: `${mrResult.config.TIME_STOP_DAYS}d` },
                                                { l: 'ATR Stop', v: `${mrResult.config.ATR_STOP_MULTIPLIER}×ATR` },
                                                { l: 'Max Stop', v: `${Math.round(mrResult.config.MAX_STOP_PCT * 100)}%` },
                                                { l: 'Trend Filter', v: `${mrResult.config.SMA_TREND}-SMA` },
                                                { l: 'Max Positions', v: mrResult.config.MAX_CONCURRENT_POSITIONS },
                                            ].map(c => (
                                                <span key={c.l} className="px-2 py-1 bg-[var(--card)] rounded-lg border border-[var(--border)] text-[var(--foreground-muted)]">
                                                    <span className="text-[var(--foreground)] font-medium">{c.l}:</span> {c.v}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ═══════════════ STRATEGY 4: SECTOR ROTATION ═══════════════ */}
                    <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-6 pb-4">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                                        <PieChart size={20} className="text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                                            Strategy 4: Sector Rotation
                                            <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full font-medium">RS + Cycle</span>
                                        </h3>
                                        <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5">Relative strength ranking · Economic cycle overlay · Monthly rebalance</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {srScanning && (
                                        <button onClick={stopSrScan} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-[10px] font-bold hover:bg-red-500/20 transition-all flex items-center gap-1">
                                            <StopCircle size={12} /> Stop
                                        </button>
                                    )}
                                    <button onClick={runSectorRotation} disabled={srScanning}
                                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50 flex items-center gap-2">
                                        {srScanning ? <><Loader2 size={14} className="animate-spin" /> Scanning...</> : <><Repeat size={14} /> Run Sector Rotation</>}
                                    </button>
                                </div>
                            </div>

                            {/* Progress bar */}
                            {srScanning && srProgress && (
                                <div className="mt-4">
                                    <div className="flex justify-between text-[10px] text-[var(--foreground-muted)] mb-1">
                                        <span>{srStatusMsg}</span>
                                        <span>{srProgress.fetched} fetched · {srProgress.errors} errors</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-[var(--background)] rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all" style={{ width: `${srProgress.pct || 0}%` }} />
                                    </div>
                                </div>
                            )}

                            {srError && <div className="mt-3 text-xs text-red-400 bg-red-500/10 p-3 rounded-lg">{srError}</div>}
                        </div>

                        {/* Results */}
                        {srResult && (
                            <div className="px-6 pb-6 space-y-4">
                                {/* Market Regime + Economic Phase */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-[var(--card)] rounded-xl p-3 border border-[var(--card-border)]">
                                        <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Market Regime</div>
                                        <div className={`text-sm font-bold ${srResult.portfolio?.regime?.tradeable ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {srResult.portfolio?.regime?.regime || 'UNKNOWN'}
                                        </div>
                                        <div className="text-[10px] text-[var(--foreground-muted)] mt-1">
                                            Nifty: ₹{srResult.portfolio?.regime?.nifty} · 50-SMA: ₹{srResult.portfolio?.regime?.sma50} · 200-SMA: ₹{srResult.portfolio?.regime?.sma200}
                                        </div>
                                    </div>
                                    <div className="bg-[var(--card)] rounded-xl p-3 border border-[var(--card-border)]">
                                        <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Economic Cycle Phase</div>
                                        <div className="text-sm font-bold text-amber-400">
                                            {srResult.economicPhase?.phase?.replace(/_/g, ' ') || 'N/A'}
                                        </div>
                                        <div className="text-[10px] text-[var(--foreground-muted)] mt-1">
                                            Confidence: {srResult.economicPhase?.confidence} · Source: {srResult.economicPhase?.source?.replace(/_/g, ' ')}
                                        </div>
                                    </div>
                                </div>

                                {/* Sector Ranking Table */}
                                {srResult.sectorRanking && srResult.sectorRanking.length > 0 && (
                                    <div className="bg-[var(--card)] rounded-xl border border-[var(--card-border)] overflow-hidden">
                                        <div className="p-3 border-b border-[var(--card-border)]">
                                            <h4 className="text-xs font-bold text-[var(--foreground)] flex items-center gap-2">
                                                <BarChart3 size={14} className="text-amber-400" /> Sector Rankings ({srResult.sectorRanking.length} sectors)
                                            </h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[10px]">
                                                <thead>
                                                    <tr className="text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="p-2 text-left">Rank</th>
                                                        <th className="p-2 text-left">Sector</th>
                                                        <th className="p-2 text-right">Score</th>
                                                        <th className="p-2 text-right">RS 1M</th>
                                                        <th className="p-2 text-right">RS 3M</th>
                                                        <th className="p-2 text-left">Trend</th>
                                                        <th className="p-2 text-left">RRG</th>
                                                        <th className="p-2 text-left">Cycle</th>
                                                        <th className="p-2 text-right">Ret 1M</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {srResult.sectorRanking.map((s: any, i: number) => (
                                                        <tr key={i} className={`border-b border-[var(--card-border)]/50 ${i < (srResult.config?.TOP_SECTORS || 3) ? 'bg-amber-500/5' : ''}`}>
                                                            <td className="p-2 font-bold text-[var(--foreground)]">{s.adjustedRank}</td>
                                                            <td className="p-2 text-[var(--foreground)] font-medium">{s.sectorName}</td>
                                                            <td className="p-2 text-right font-mono text-amber-400">{s.adjustedScore}</td>
                                                            <td className="p-2 text-right font-mono">{s.rs1M}</td>
                                                            <td className="p-2 text-right font-mono">{s.rs3M}</td>
                                                            <td className="p-2">
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                                    s.rsTrend === 'STRONG_IMPROVING' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                    s.rsTrend === 'IMPROVING' ? 'bg-green-500/15 text-green-400' :
                                                                    s.rsTrend === 'WEAKENING' ? 'bg-red-500/15 text-red-400' :
                                                                    s.rsTrend === 'STRONG_WEAKENING' ? 'bg-red-500/20 text-red-500' :
                                                                    'bg-[var(--background)] text-[var(--foreground-muted)]'
                                                                }`}>{s.rsTrend}</span>
                                                            </td>
                                                            <td className="p-2">
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                                    s.rrgQuadrant === 'LEADING' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                    s.rrgQuadrant === 'IMPROVING' ? 'bg-blue-500/15 text-blue-400' :
                                                                    s.rrgQuadrant === 'WEAKENING' ? 'bg-orange-500/15 text-orange-400' :
                                                                    s.rrgQuadrant === 'LAGGING' ? 'bg-red-500/15 text-red-400' :
                                                                    'bg-[var(--background)] text-[var(--foreground-muted)]'
                                                                }`}>{s.rrgQuadrant}</span>
                                                            </td>
                                                            <td className="p-2">
                                                                <span className={`text-[9px] font-bold ${
                                                                    s.cycleAlignment === 'FAVORABLE' ? 'text-emerald-400' :
                                                                    s.cycleAlignment === 'UNFAVORABLE' ? 'text-red-400' : 'text-[var(--foreground-muted)]'
                                                                }`}>{s.cycleAlignment}</span>
                                                            </td>
                                                            <td className="p-2 text-right font-mono">{s.return1M}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Holdings */}
                                {srResult.portfolio?.holdings?.length > 0 && (
                                    <div className="bg-[var(--card)] rounded-xl border border-[var(--card-border)] overflow-hidden">
                                        <div className="p-3 border-b border-[var(--card-border)]">
                                            <h4 className="text-xs font-bold text-[var(--foreground)] flex items-center gap-2">
                                                <Target size={14} className="text-amber-400" /> Portfolio Holdings ({srResult.portfolio.holdings.length} stocks)
                                            </h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[10px]">
                                                <thead>
                                                    <tr className="text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="p-2 text-left">Symbol</th>
                                                        <th className="p-2 text-left">Sector</th>
                                                        <th className="p-2 text-right">Score</th>
                                                        <th className="p-2 text-right">Weight</th>
                                                        <th className="p-2 text-right">Alloc ₹</th>
                                                        <th className="p-2 text-right">Shares</th>
                                                        <th className="p-2 text-right">Stop</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {srResult.portfolio.holdings.map((h: any, i: number) => (
                                                        <tr key={i} className="border-b border-[var(--card-border)]/50">
                                                            <td className="p-2 font-bold text-amber-400">{(h.symbol || '').replace('.NS', '')}</td>
                                                            <td className="p-2 text-[var(--foreground-muted)]">{h.sectorName || h.sector}</td>
                                                            <td className="p-2 text-right font-mono text-[var(--foreground)]">{typeof h.momentumScore === 'number' ? (h.momentumScore * 100).toFixed(1) + '%' : '—'}</td>
                                                            <td className="p-2 text-right font-mono text-[var(--foreground)]">{typeof h.weight === 'number' ? (h.weight * 100).toFixed(1) + '%' : '—'}</td>
                                                            <td className="p-2 text-right font-mono text-[var(--foreground)]">₹{(h.allocatedCapital || 0).toLocaleString('en-IN')}</td>
                                                            <td className="p-2 text-right font-mono">{h.shares || 0}</td>
                                                            <td className="p-2 text-right font-mono text-red-400">₹{h.stopLoss || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Portfolio Stats + Config */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {srResult.portfolio?.portfolioStats && (
                                        <div className="bg-[var(--card)] rounded-xl p-3 border border-[var(--card-border)]">
                                            <h4 className="text-[10px] text-[var(--foreground-muted)] font-bold mb-2">PORTFOLIO STATS</h4>
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { l: 'Holdings', v: srResult.portfolio.portfolioStats.totalHoldings },
                                                    { l: 'Invested', v: srResult.portfolio.portfolioStats.investedPct },
                                                    { l: 'HHI Index', v: srResult.portfolio.portfolioStats.hhiIndex },
                                                    { l: 'Diversification', v: srResult.portfolio.portfolioStats.diversification },
                                                    { l: 'Port. Vol', v: srResult.portfolio.portfolioStats.portfolioVolatility },
                                                    { l: 'Max Weight', v: srResult.portfolio.portfolioStats.maxStockWeight },
                                                ].map((item, i) => (
                                                    <div key={i} className="text-[10px]">
                                                        <span className="text-[var(--foreground-muted)]">{item.l}: </span>
                                                        <span className="text-[var(--foreground)] font-bold">{item.v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {srResult.portfolio.portfolioStats.sectorConcentration && (
                                                <div className="mt-2 pt-2 border-t border-[var(--card-border)]">
                                                    <div className="text-[9px] text-[var(--foreground-muted)] mb-1">Sector Concentration</div>
                                                    {srResult.portfolio.portfolioStats.sectorConcentration.map((sc: any, i: number) => (
                                                        <div key={i} className="text-[10px] flex justify-between">
                                                            <span className="text-[var(--foreground-muted)]">{sc.sector}</span>
                                                            <span className="text-amber-400 font-mono">{sc.weight}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {srResult.config && (
                                        <div className="bg-[var(--card)] rounded-xl p-3 border border-[var(--card-border)]">
                                            <h4 className="text-[10px] text-[var(--foreground-muted)] font-bold mb-2">CONFIGURATION</h4>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {[
                                                    { l: 'Top Sectors', v: srResult.config.TOP_SECTORS },
                                                    { l: 'Stocks/Sector', v: srResult.config.STOCKS_PER_SECTOR },
                                                    { l: 'Hold Period', v: `${srResult.config.HOLDING_PERIOD_DAYS}d` },
                                                    { l: 'RS Weights', v: `${srResult.config.RS_WEIGHT_1M}/${srResult.config.RS_WEIGHT_3M}` },
                                                    { l: 'Weighting', v: srResult.config.WEIGHTING_METHOD },
                                                    { l: 'Max Sector Wt', v: `${Math.round(srResult.config.MAX_SECTOR_WEIGHT * 100)}%` },
                                                    { l: 'Max Stock Wt', v: `${Math.round(srResult.config.MAX_STOCK_WEIGHT * 100)}%` },
                                                    { l: 'Stock Stop', v: `${Math.round(srResult.config.STOCK_STOP_LOSS_PCT * 100)}%` },
                                                    { l: 'Portfolio Stop', v: `${Math.round(srResult.config.STOP_LOSS_PCT * 100)}%` },
                                                    { l: 'Cash Buffer', v: `${Math.round(srResult.config.CASH_RESERVE_PCT * 100)}%` },
                                                ].map(c => (
                                                    <div key={c.l} className="text-[10px]">
                                                        <span className="text-[var(--foreground-muted)]">{c.l}: </span>
                                                        <span className="text-[var(--foreground)] font-bold">{c.v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Fetch Stats */}
                                {srResult.fetchStats && (
                                    <div className="text-[10px] text-[var(--foreground-muted)] flex items-center gap-4">
                                        <span>Sectors: {srResult.fetchStats.sectorsFetched}/12</span>
                                        <span>Stocks: {srResult.fetchStats.successfulFetches}/{srResult.fetchStats.totalSymbols}</span>
                                        <span>Errors: {srResult.fetchStats.failedFetches}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Strategy 5: Event-Driven / Catalyst Trading */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-[var(--border)]">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                                        <Sparkles size={20} className="text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[var(--foreground)]">EVENT-DRIVEN / CATALYST TRADING</h3>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Earnings Surprise (PEAD) · RBI Policy · Index Rebalancing · Bulk/Block Deals</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {edScanning && (
                                        <button onClick={stopEdScan} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors">
                                            <StopCircle size={14} /> Stop
                                        </button>
                                    )}
                                    <button onClick={runEventDriven} disabled={edScanning}
                                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                            edScanning
                                                ? 'bg-amber-500/10 text-amber-400/60 cursor-wait'
                                                : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:shadow-lg hover:shadow-amber-500/20'
                                        }`}>
                                        {edScanning ? <><Loader2 size={14} className="animate-spin" /> Scanning...</> : <><Play size={14} /> Run Event Scanner</>}
                                    </button>
                                </div>
                            </div>
                            {edStatusMsg && <p className="text-[10px] text-[var(--foreground-muted)] mt-2">{edStatusMsg}</p>}
                            {edError && <p className="text-[10px] text-red-400 mt-2">⚠ {edError}</p>}
                            {edProgress && (
                                <div className="mt-2 h-1.5 bg-[var(--background)] rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all" style={{ width: `${edProgress.pct}%` }} />
                                </div>
                            )}
                        </div>

                        {edResult && (
                            <div className="p-4 sm:p-5 space-y-4">
                                {/* Summary */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-[var(--background)] rounded-xl p-3">
                                        <p className="text-[9px] text-[var(--foreground-muted)] uppercase tracking-wide">Stocks Scanned</p>
                                        <p className="text-lg font-bold text-[var(--foreground)]">{edResult.summary?.totalStocksScanned || 0}</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-xl p-3">
                                        <p className="text-[9px] text-[var(--foreground-muted)] uppercase tracking-wide">Earnings Signals</p>
                                        <p className="text-lg font-bold text-emerald-400">{edResult.summary?.earningsTriggered || 0} <span className="text-xs text-[var(--foreground-muted)] font-normal">/ {edResult.summary?.earningsCandidates || 0}</span></p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-xl p-3">
                                        <p className="text-[9px] text-[var(--foreground-muted)] uppercase tracking-wide">Bulk Deal Signals</p>
                                        <p className="text-lg font-bold text-amber-400">{edResult.summary?.bulkDealTriggered || 0} <span className="text-xs text-[var(--foreground-muted)] font-normal">/ {edResult.summary?.bulkDealCandidates || 0}</span></p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-xl p-3">
                                        <p className="text-[9px] text-[var(--foreground-muted)] uppercase tracking-wide">Earnings Season</p>
                                        <p className="text-sm font-bold text-[var(--foreground)]">{edResult.calendar?.currentEarningsSeason?.label || 'Off-season'}</p>
                                    </div>
                                </div>

                                {/* Earnings Surprise Signals */}
                                {edResult.earningsSignals && edResult.earningsSignals.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-[var(--foreground)] mb-2 flex items-center gap-1.5">
                                            <TrendingUp size={14} className="text-emerald-400" /> Earnings Surprise Candidates (PEAD)
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[10px]">
                                                <thead>
                                                    <tr className="text-[var(--foreground-muted)] border-b border-[var(--border)]">
                                                        <th className="text-left py-1.5 px-2">Symbol</th>
                                                        <th className="text-center py-1.5 px-2">Signal</th>
                                                        <th className="text-center py-1.5 px-2">Score</th>
                                                        <th className="text-center py-1.5 px-2">Quality</th>
                                                        <th className="text-center py-1.5 px-2">Surprise</th>
                                                        <th className="text-left py-1.5 px-2">Conditions</th>
                                                        <th className="text-center py-1.5 px-2">Days Ago</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {edResult.earningsSignals.map((sig: any, i: number) => (
                                                        <tr key={i} className={`border-b border-[var(--border)]/30 ${sig.triggered ? 'bg-emerald-500/5' : ''}`}>
                                                            <td className="py-1.5 px-2 font-semibold text-[var(--foreground)]">{sig.symbol?.replace('.NS', '')}</td>
                                                            <td className="py-1.5 px-2 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${sig.triggered ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                                    {sig.triggered ? 'TRIGGERED' : 'CANDIDATE'}
                                                                </span>
                                                            </td>
                                                            <td className="py-1.5 px-2 text-center text-[var(--foreground)]">{sig.score}/{sig.totalConditions}</td>
                                                            <td className="py-1.5 px-2 text-center">
                                                                {sig.qualityGrade ? (
                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${sig.qualityGrade === 'A+' ? 'bg-emerald-500/20 text-emerald-400' : sig.qualityGrade === 'A' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-500/20 text-blue-400'}`}>{sig.qualityGrade}</span>
                                                                ) : <span className="text-[var(--foreground-muted)]">-</span>}
                                                            </td>
                                                            <td className="py-1.5 px-2 text-center text-[var(--foreground)]">{sig.surprisePct || '-'}</td>
                                                            <td className="py-1.5 px-2">
                                                                <div className="flex gap-1">
                                                                    {sig.conditions?.map((c: any, j: number) => (
                                                                        <span key={j} title={c.detail} className={`w-4 h-4 rounded flex items-center justify-center text-[8px] ${c.met ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                            {c.met ? '✓' : '✗'}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="py-1.5 px-2 text-center text-[var(--foreground-muted)]">{sig.daysAgo || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Bulk Deal Signals */}
                                {edResult.bulkDealSignals && edResult.bulkDealSignals.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-[var(--foreground)] mb-2 flex items-center gap-1.5">
                                            <Newspaper size={14} className="text-amber-400" /> Bulk/Block Deal Activity
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[10px]">
                                                <thead>
                                                    <tr className="text-[var(--foreground-muted)] border-b border-[var(--border)]">
                                                        <th className="text-left py-1.5 px-2">Symbol</th>
                                                        <th className="text-center py-1.5 px-2">Signal</th>
                                                        <th className="text-center py-1.5 px-2">Score</th>
                                                        <th className="text-center py-1.5 px-2">Quality</th>
                                                        <th className="text-left py-1.5 px-2">Detection</th>
                                                        <th className="text-left py-1.5 px-2">Conditions</th>
                                                        <th className="text-center py-1.5 px-2">Days Ago</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {edResult.bulkDealSignals.map((sig: any, i: number) => (
                                                        <tr key={i} className={`border-b border-[var(--border)]/30 ${sig.triggered ? 'bg-amber-500/5' : ''}`}>
                                                            <td className="py-1.5 px-2 font-semibold text-[var(--foreground)]">{sig.symbol?.replace('.NS', '')}</td>
                                                            <td className="py-1.5 px-2 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${sig.triggered ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                                    {sig.triggered ? 'TRIGGERED' : 'WATCH'}
                                                                </span>
                                                            </td>
                                                            <td className="py-1.5 px-2 text-center text-[var(--foreground)]">{sig.score}/{sig.totalConditions}</td>
                                                            <td className="py-1.5 px-2 text-center">
                                                                {sig.qualityGrade ? (
                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${sig.qualityGrade === 'A+' ? 'bg-emerald-500/20 text-emerald-400' : sig.qualityGrade === 'A' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-500/20 text-blue-400'}`}>{sig.qualityGrade}</span>
                                                                ) : <span className="text-[var(--foreground-muted)]">-</span>}
                                                            </td>
                                                            <td className="py-1.5 px-2 text-[var(--foreground-muted)]">{sig.detectedFrom || '-'}</td>
                                                            <td className="py-1.5 px-2">
                                                                <div className="flex gap-1">
                                                                    {sig.conditions?.map((c: any, j: number) => (
                                                                        <span key={j} title={c.detail} className={`w-4 h-4 rounded flex items-center justify-center text-[8px] ${c.met ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                            {c.met ? '✓' : '✗'}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="py-1.5 px-2 text-center text-[var(--foreground-muted)]">{sig.daysAgo || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Upcoming Events Calendar */}
                                {edResult.calendar && (
                                    <div>
                                        <h4 className="text-xs font-bold text-[var(--foreground)] mb-2 flex items-center gap-1.5">
                                            <CalendarDays size={14} className="text-cyan-400" /> Upcoming Events
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {edResult.calendar.upcomingRBI?.length > 0 && (
                                                <div className="bg-[var(--background)] rounded-xl p-3">
                                                    <p className="text-[9px] text-[var(--foreground-muted)] uppercase tracking-wide mb-1.5">RBI MPC</p>
                                                    {edResult.calendar.upcomingRBI.map((e: any, i: number) => (
                                                        <div key={i} className="text-[10px] text-[var(--foreground)] mb-1">
                                                            <span className="text-cyan-400 font-mono">{e.date}</span> — {e.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {edResult.calendar.upcomingRebalances?.length > 0 && (
                                                <div className="bg-[var(--background)] rounded-xl p-3">
                                                    <p className="text-[9px] text-[var(--foreground-muted)] uppercase tracking-wide mb-1.5">Index Rebalances</p>
                                                    {edResult.calendar.upcomingRebalances.map((e: any, i: number) => (
                                                        <div key={i} className="text-[10px] text-[var(--foreground)] mb-1">
                                                            <span className="text-amber-400 font-mono">{e.date}</span> — {e.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="bg-[var(--background)] rounded-xl p-3">
                                                <p className="text-[9px] text-[var(--foreground-muted)] uppercase tracking-wide mb-1.5">Current Season</p>
                                                <p className="text-[10px] text-[var(--foreground)]">
                                                    {edResult.calendar.currentEarningsSeason
                                                        ? <><span className="text-emerald-400">●</span> {edResult.calendar.currentEarningsSeason.label}</>
                                                        : <span className="text-[var(--foreground-muted)]">Off-season — no major earnings window</span>}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Fetch Stats */}
                                {edResult.fetchStats && (
                                    <div className="text-[10px] text-[var(--foreground-muted)] flex items-center gap-4">
                                        <span>Stocks: {edResult.fetchStats.successfulFetches}/{edResult.fetchStats.totalSymbols}</span>
                                        <span>Errors: {edResult.fetchStats.failedFetches}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Strategy 6: Breakout Trading (Darvas Box / VCP) */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 hover:border-emerald-500/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center">
                                    <ArrowUpRight size={20} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--foreground)]">Breakout / VCP Trading</h3>
                                    <p className="text-[10px] text-[var(--foreground-muted)]">Darvas Box + Volatility Contraction · Mid-cap focus · Delivery % filters</p>
                                </div>
                            </div>
                            {boScanning ? (
                                <button onClick={stopBoScan} className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all">
                                    <StopCircle size={14} /> Stop
                                </button>
                            ) : (
                                <button onClick={runBreakout} className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-all">
                                    <Play size={14} /> Scan
                                </button>
                            )}
                        </div>

                        {/* Progress */}
                        {boScanning && (
                            <div className="mb-4">
                                <div className="flex items-center gap-2 text-xs text-emerald-400 mb-2">
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>{boStatusMsg}</span>
                                </div>
                                {boProgress && (
                                    <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1.5 rounded-full transition-all" style={{ width: `${boProgress.pct}%` }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Error */}
                        {boError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                <p className="text-xs text-red-400"><AlertTriangle size={12} className="inline mr-1" />{boError}</p>
                            </div>
                        )}

                        {/* Results */}
                        {boResult && (
                            <div className="space-y-4">
                                {/* Summary */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-emerald-400">{boResult.totalScanned}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Stocks Scanned</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-teal-400">{boResult.signals?.length || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Breakout Signals</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-cyan-400">{boResult.watchlist?.length || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Watchlist</p>
                                    </div>
                                </div>

                                {/* Breakout Signals Table */}
                                {boResult.signals && boResult.signals.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1"><Zap size={12} /> Breakout Signals</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="text-left py-2 pr-3">Symbol</th>
                                                        <th className="text-center py-2 px-2">Score</th>
                                                        <th className="text-center py-2 px-2">Grade</th>
                                                        <th className="text-right py-2 px-2">Entry</th>
                                                        <th className="text-right py-2 px-2">Stop</th>
                                                        <th className="text-right py-2 px-2">Target</th>
                                                        <th className="text-center py-2 px-2">R:R</th>
                                                        <th className="text-center py-2 pl-2">VCP</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {boResult.signals.map((s: any, i: number) => (
                                                        <tr key={i} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-2 pr-3 font-medium text-[var(--foreground)]">{s.symbol}</td>
                                                            <td className="py-2 px-2 text-center">{s.score}/{s.totalConditions}</td>
                                                            <td className="py-2 px-2 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s.qualityGrade === 'A+' ? 'bg-emerald-500/20 text-emerald-400' : s.qualityGrade === 'A' ? 'bg-teal-500/20 text-teal-400' : s.qualityGrade === 'B' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                                    {s.qualityGrade}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-2 text-right">₹{s.trade?.entryPrice}</td>
                                                            <td className="py-2 px-2 text-right text-red-400">₹{s.trade?.stopLoss}</td>
                                                            <td className="py-2 px-2 text-right text-emerald-400">₹{s.trade?.measuredMoveTarget}</td>
                                                            <td className="py-2 px-2 text-center">{s.trade?.riskReward}</td>
                                                            <td className="py-2 pl-2 text-center">{s.vcpAnalysis?.detected ? '✅' : '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {boResult.signals && boResult.signals.length === 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4 text-center">
                                        <p className="text-xs text-[var(--foreground-muted)]">No breakout signals detected in current scan. Check the watchlist for near-breakout setups.</p>
                                    </div>
                                )}

                                {/* Watchlist */}
                                {boResult.watchlist && boResult.watchlist.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-cyan-400 mb-2 flex items-center gap-1"><Eye size={12} /> Near-Breakout Watchlist</h4>
                                        <div className="space-y-1">
                                            {boResult.watchlist.slice(0, 8).map((w: any, i: number) => (
                                                <div key={i} className="bg-[var(--background)] rounded-lg p-2 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-[var(--foreground)]">{w.symbol}</span>
                                                        <span className="text-[10px] text-cyan-400">{w.score}</span>
                                                        {w.baseDetected && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1 rounded">Base</span>}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {w.missingConditions?.map((c: string, j: number) => (
                                                            <span key={j} className="text-[9px] bg-[var(--card)] text-[var(--foreground-muted)] px-1 rounded">{c.replace('_', ' ').toLowerCase()}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Fetch Stats */}
                                {boResult.fetchStats && (
                                    <div className="text-[10px] text-[var(--foreground-muted)] flex items-center gap-4">
                                        <span>Stocks: {boResult.fetchStats.successfulFetches}/{boResult.fetchStats.totalSymbols}</span>
                                        <span>Errors: {boResult.fetchStats.failedFetches}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Strategy 7: Factor-Based / Quantitative Stock Selection */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-xl flex items-center justify-center">
                                    <Layers size={20} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--foreground)]">Multi-Factor Quant Selection</h3>
                                    <p className="text-[10px] text-[var(--foreground-muted)]">Momentum 35% · Value 25% · Quality 20% · Revision 20% · 1-month hold</p>
                                </div>
                            </div>
                            {fcScanning ? (
                                <button onClick={stopFcScan} className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all">
                                    <StopCircle size={14} /> Stop
                                </button>
                            ) : (
                                <button onClick={runFactor} className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-500/20 transition-all">
                                    <Play size={14} /> Scan
                                </button>
                            )}
                        </div>

                        {/* Progress */}
                        {fcScanning && (
                            <div className="mb-4">
                                <div className="flex items-center gap-2 text-xs text-indigo-400 mb-2">
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>{fcStatusMsg}</span>
                                </div>
                                {fcProgress && (
                                    <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                                        <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${fcProgress.pct}%` }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Error */}
                        {fcError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                <p className="text-xs text-red-400"><AlertTriangle size={12} className="inline mr-1" />{fcError}</p>
                            </div>
                        )}

                        {/* Results */}
                        {fcResult && (
                            <div className="space-y-4">
                                {/* Summary */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-indigo-400">{fcResult.totalScanned}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Stocks Scanned</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-violet-400">{fcResult.qualifying}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Qualifying</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-fuchsia-400">{fcResult.topStocks?.length || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Top Picks</p>
                                    </div>
                                </div>

                                {/* Top 15 Factor Picks Table */}
                                {fcResult.topStocks && fcResult.topStocks.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-indigo-400 mb-2 flex items-center gap-1"><Layers size={12} /> Top 15 Factor Picks</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="text-left py-2 pr-3">#</th>
                                                        <th className="text-left py-2 pr-3">Symbol</th>
                                                        <th className="text-center py-2 px-2">Composite</th>
                                                        <th className="text-center py-2 px-2">Mom%</th>
                                                        <th className="text-center py-2 px-2">Val%</th>
                                                        <th className="text-center py-2 px-2">Qual%</th>
                                                        <th className="text-center py-2 px-2">Rev%</th>
                                                        <th className="text-right py-2 px-2">Price</th>
                                                        <th className="text-right py-2 pl-2">3M Ret</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {fcResult.topStocks.map((s: any, i: number) => (
                                                        <tr key={i} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-2 pr-3 text-[var(--foreground-muted)]">{s.rank}</td>
                                                            <td className="py-2 pr-3 font-medium text-[var(--foreground)]">{s.symbol?.replace('.NS', '')}</td>
                                                            <td className="py-2 px-2 text-center">
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400">
                                                                    {s.compositeScore?.toFixed(1)}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-2 text-center">
                                                                <div className="flex items-center gap-1 justify-center">
                                                                    <div className="w-8 h-1.5 bg-[var(--card-border)] rounded-full overflow-hidden">
                                                                        <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${s.momentumPctile || 0}%` }} />
                                                                    </div>
                                                                    <span className="text-[10px] text-cyan-400">{s.momentumPctile?.toFixed(0) || '—'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-2 text-center">
                                                                <div className="flex items-center gap-1 justify-center">
                                                                    <div className="w-8 h-1.5 bg-[var(--card-border)] rounded-full overflow-hidden">
                                                                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${s.valuePctile || 0}%` }} />
                                                                    </div>
                                                                    <span className="text-[10px] text-amber-400">{s.valuePctile?.toFixed(0) || '—'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-2 text-center">
                                                                <div className="flex items-center gap-1 justify-center">
                                                                    <div className="w-8 h-1.5 bg-[var(--card-border)] rounded-full overflow-hidden">
                                                                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${s.qualityPctile || 0}%` }} />
                                                                    </div>
                                                                    <span className="text-[10px] text-emerald-400">{s.qualityPctile?.toFixed(0) || '—'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-2 text-center">
                                                                <div className="flex items-center gap-1 justify-center">
                                                                    <div className="w-8 h-1.5 bg-[var(--card-border)] rounded-full overflow-hidden">
                                                                        <div className="h-full bg-violet-400 rounded-full" style={{ width: `${s.revisionPctile || 0}%` }} />
                                                                    </div>
                                                                    <span className="text-[10px] text-violet-400">{s.revisionPctile?.toFixed(0) || '—'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-2 text-right text-[var(--foreground)]">₹{s.currentPrice?.toFixed(0)}</td>
                                                            <td className={`py-2 pl-2 text-right font-medium ${(s.ret3m || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {s.ret3m !== null ? `${s.ret3m?.toFixed(1)}%` : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {fcResult.topStocks && fcResult.topStocks.length === 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4 text-center">
                                        <p className="text-xs text-[var(--foreground-muted)]">No stocks passed all factor filters. Check data availability.</p>
                                    </div>
                                )}

                                {/* Watchlist (rank 16-30) */}
                                {fcResult.watchlist && fcResult.watchlist.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-violet-400 mb-2 flex items-center gap-1"><Eye size={12} /> Next-in-Line Watchlist (Rank 16-30)</h4>
                                        <div className="space-y-1">
                                            {fcResult.watchlist.map((w: any, i: number) => (
                                                <div key={i} className="bg-[var(--background)] rounded-lg p-2 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-[var(--foreground-muted)] w-5">#{w.rank}</span>
                                                        <span className="text-xs font-medium text-[var(--foreground)]">{w.symbol?.replace('.NS', '')}</span>
                                                        <span className="text-[10px] text-[var(--foreground-muted)]">{w.sector}</span>
                                                    </div>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-medium">
                                                        {w.compositeScore?.toFixed(1)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Fetch Stats */}
                                {fcResult.fetchStats && (
                                    <div className="text-[10px] text-[var(--foreground-muted)] flex items-center gap-4">
                                        <span>Stocks: {fcResult.fetchStats.successfulFetches}/{fcResult.fetchStats.totalSymbols}</span>
                                        <span>Errors: {fcResult.fetchStats.failedFetches}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 1D Intraday Strategies */}
            {activeTimeframe === '1D' && (
                <div className="space-y-6">
                    {/* Strategy 1: Opening Range Breakout (ORB) */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 hover:border-orange-500/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-xl flex items-center justify-center">
                                    <Timer size={20} className="text-orange-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--foreground)]">Opening Range Breakout (ORB)</h3>
                                    <p className="text-[10px] text-[var(--foreground-muted)]">15-min ORB · VWAP + Volume filters · Partial exits T1/T2/Trail · All 500+ stocks</p>
                                </div>
                            </div>
                            {orbScanning ? (
                                <button onClick={stopOrbScan} className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all">
                                    <StopCircle size={14} /> Stop
                                </button>
                            ) : (
                                <button onClick={runOrb} className="flex items-center gap-1.5 bg-orange-500/10 text-orange-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-500/20 transition-all">
                                    <Play size={14} /> Scan
                                </button>
                            )}
                        </div>

                        {/* Progress */}
                        {orbScanning && (
                            <div className="mb-4">
                                <div className="flex items-center gap-2 text-xs text-orange-400 mb-2">
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>{orbStatusMsg}</span>
                                </div>
                                {orbProgress && (
                                    <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${orbProgress.pct}%` }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Error */}
                        {orbError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                <p className="text-xs text-red-400"><AlertTriangle size={12} className="inline mr-1" />{orbError}</p>
                            </div>
                        )}

                        {/* Results */}
                        {orbResult && (
                            <div className="space-y-4">
                                {/* Summary */}
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-orange-400">{orbResult.totalSuccessful || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Fetched / {orbResult.totalScanned}</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-amber-400">{orbResult.totalWithSignals}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Signals{orbResult.highBetaSignals > 0 && <span className="text-orange-400"> ({orbResult.highBetaSignals} F&O)</span>}</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-yellow-400">{orbResult.totalWithBacktest}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">With Backtest</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-red-400">{orbResult.fetchStats?.failedFetches || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Fetch Errors</p>
                                    </div>
                                </div>

                                {/* Active Signals Table */}
                                {orbResult.activeSignals && orbResult.activeSignals.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-orange-400 mb-2 flex items-center gap-1"><Zap size={12} /> Today&apos;s ORB Signals</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="text-left py-2 pr-3">Symbol</th>
                                                        <th className="text-center py-2 px-2">Dir</th>
                                                        <th className="text-right py-2 px-2">Entry</th>
                                                        <th className="text-right py-2 px-2">SL</th>
                                                        <th className="text-right py-2 px-2">T1</th>
                                                        <th className="text-right py-2 px-2">T2</th>
                                                        <th className="text-center py-2 px-2">Range%</th>
                                                        <th className="text-right py-2 pl-2">VWAP</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {orbResult.activeSignals.map((s: any, i: number) => (
                                                        <tr key={i} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-2 pr-3 font-medium text-[var(--foreground)]">
                                                                {s.symbol}
                                                                {s.isHighBeta && <span className="ml-1 px-1 py-0.5 rounded text-[8px] bg-orange-500/20 text-orange-400 font-bold">F&O</span>}
                                                            </td>
                                                            <td className="py-2 px-2 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                                    s.todaySignal.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                                                }`}>
                                                                    {s.todaySignal.direction}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-2 text-right">₹{s.todaySignal.entryPrice}</td>
                                                            <td className="py-2 px-2 text-right text-red-400">₹{s.todaySignal.sl}</td>
                                                            <td className="py-2 px-2 text-right text-emerald-400">₹{s.todaySignal.t1 || '—'}</td>
                                                            <td className="py-2 px-2 text-right text-cyan-400">₹{s.todaySignal.t2 || '—'}</td>
                                                            <td className="py-2 px-2 text-center text-orange-400">{s.todaySignal.rangeWidthPct}%</td>
                                                            <td className="py-2 pl-2 text-right text-[var(--foreground-muted)]">{s.todaySignal.vwap ? `₹${s.todaySignal.vwap}` : '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {orbResult.activeSignals && orbResult.activeSignals.length === 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4 text-center">
                                        <p className="text-xs text-[var(--foreground-muted)]">
                                            No ORB breakout signals detected. ORB signals are generated during market hours (9:15 AM – 12:00 PM IST).
                                            {(orbResult.totalSuccessful || 0) === 0 && ' Yahoo Finance may not have returned 5-minute data for this scan.'}
                                        </p>
                                    </div>
                                )}

                                {/* Top Backtested Stocks */}
                                {orbResult.backtestRanking && orbResult.backtestRanking.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1"><BarChart3 size={12} /> Backtest Rankings (55-day, 5-min candles)</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="text-left py-2 pr-3">Symbol</th>
                                                        <th className="text-center py-2 px-2">Trades</th>
                                                        <th className="text-center py-2 px-2">Win%</th>
                                                        <th className="text-center py-2 px-2">W:L</th>
                                                        <th className="text-center py-2 px-2">Expect%</th>
                                                        <th className="text-center py-2 px-2">PF</th>
                                                        <th className="text-center py-2 px-2">Sharpe</th>
                                                        <th className="text-right py-2 pl-2">MaxDD%</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {orbResult.backtestRanking.map((s: any, i: number) => (
                                                        <tr key={i} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-2 pr-3 font-medium text-[var(--foreground)]">
                                                                {s.symbol}
                                                                {s.isHighBeta && <span className="ml-1 px-1 py-0.5 rounded text-[8px] bg-orange-500/20 text-orange-400 font-bold">F&O</span>}
                                                            </td>
                                                            <td className="py-2 px-2 text-center">{s.backtest?.totalTrades || 0}</td>
                                                            <td className={`py-2 px-2 text-center font-medium ${(s.backtest?.winRatePct || 0) >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {s.backtest?.winRatePct || 0}%
                                                            </td>
                                                            <td className="py-2 px-2 text-center">{s.backtest?.avgWinLossRatio || '—'}</td>
                                                            <td className={`py-2 px-2 text-center ${(s.backtest?.expectancyPct || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {s.backtest?.expectancyPct || 0}%
                                                            </td>
                                                            <td className="py-2 px-2 text-center text-amber-400">{s.backtest?.profitFactor || '—'}</td>
                                                            <td className="py-2 px-2 text-center">{s.backtest?.sharpeRatio || '—'}</td>
                                                            <td className="py-2 pl-2 text-right text-red-400">{s.backtest?.maxDrawdownPct || 0}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* All Scanned Stocks Fallback (shows when no backtest or signals) */}
                                {orbResult.allStocks && orbResult.allStocks.length > 0 && (!orbResult.backtestRanking || orbResult.backtestRanking.length === 0) && (
                                    <div>
                                        <h4 className="text-xs font-bold text-[var(--foreground)] mb-2 flex items-center gap-1"><Activity size={12} /> Scanned Stocks (top 50 by data quality)</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="text-left py-2 pr-3">Symbol</th>
                                                        <th className="text-center py-2 px-2">Days</th>
                                                        <th className="text-center py-2 px-2">Candles</th>
                                                        <th className="text-center py-2 px-2">ATR%</th>
                                                        <th className="text-right py-2 px-2">Avg Vol</th>
                                                        <th className="text-center py-2 pl-2">Backtest</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {orbResult.allStocks.map((s: any, i: number) => (
                                                        <tr key={i} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-2 pr-3 font-medium text-[var(--foreground)]">
                                                                {s.symbol}
                                                                {s.isHighBeta && <span className="ml-1 px-1 py-0.5 rounded text-[8px] bg-orange-500/20 text-orange-400 font-bold">F&O</span>}
                                                            </td>
                                                            <td className="py-2 px-2 text-center">{s.daysOfData || 0}</td>
                                                            <td className="py-2 px-2 text-center">{s.totalCandles || 0}</td>
                                                            <td className="py-2 px-2 text-center text-orange-400">{s.atr14Pct || 0}%</td>
                                                            <td className="py-2 px-2 text-right">{s.avgDailyVolume ? (s.avgDailyVolume / 1e6).toFixed(1) + 'M' : '—'}</td>
                                                            <td className="py-2 pl-2 text-center">
                                                                {s.backtest ? (
                                                                    <span className="text-emerald-400">{s.backtest.totalTrades} trades</span>
                                                                ) : (
                                                                    <span className="text-[var(--foreground-muted)]">No trades</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Always show fetch stats */}
                                {orbResult.fetchStats && (
                                    <div className="bg-[var(--background)] rounded-lg p-3">
                                        <div className="text-[10px] text-[var(--foreground-muted)] flex items-center gap-4 flex-wrap">
                                            <span>📡 Fetched: {orbResult.fetchStats.successfulFetches}/{orbResult.fetchStats.totalSymbols} stocks</span>
                                            <span>❌ Errors: {orbResult.fetchStats.failedFetches}</span>
                                            <span>📊 Backtests: {orbResult.totalWithBacktest}</span>
                                            <span>⚡ Signals: {orbResult.totalWithSignals}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Strategy 2: VWAP Trading */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 hover:border-purple-500/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-violet-500/20 rounded-xl flex items-center justify-center">
                                    <Activity size={20} className="text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--foreground)]">VWAP Trading</h3>
                                    <p className="text-[10px] text-[var(--foreground-muted)]">Pullback + Breakout · VWAP ±SD Bands · EMA(9) Trail · All 500+ stocks</p>
                                </div>
                            </div>
                            {vwapScanning ? (
                                <button onClick={stopVwapScan} className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all">
                                    <StopCircle size={14} /> Stop
                                </button>
                            ) : (
                                <button onClick={runVwap} className="flex items-center gap-1.5 bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-500/20 transition-all">
                                    <Play size={14} /> Scan
                                </button>
                            )}
                        </div>

                        {vwapScanning && (
                            <div className="mb-4">
                                <p className="text-xs text-purple-300 mb-2">{vwapStatusMsg}</p>
                                {vwapProgress && (
                                    <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                                        <div className="bg-gradient-to-r from-purple-500 to-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${vwapProgress.pct}%` }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {vwapError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                <p className="text-xs text-red-400">{vwapError}</p>
                            </div>
                        )}

                        {vwapResult && (
                            <div className="space-y-4">
                                {/* Summary Stats */}
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-purple-400">{vwapResult.totalSuccessful || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Fetched</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-green-400">{vwapResult.totalWithSignals || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Signals</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-violet-400">{vwapResult.totalWithBacktest || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Backtests</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-red-400">{vwapResult.fetchStats?.failedFetches || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Errors</p>
                                    </div>
                                </div>

                                {/* Today's VWAP Signals */}
                                {vwapResult.activeSignals && vwapResult.activeSignals.length > 0 ? (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-purple-400 mb-3 flex items-center gap-1.5">
                                            <Sparkles size={14} /> Today&apos;s VWAP Signals
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-3">Setup</th>
                                                        <th className="pb-2 pr-3">Dir</th>
                                                        <th className="pb-2 pr-3">Entry</th>
                                                        <th className="pb-2 pr-3">SL</th>
                                                        <th className="pb-2 pr-3">VWAP</th>
                                                        <th className="pb-2 pr-3">P&L</th>
                                                        <th className="pb-2">Exit</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {vwapResult.activeSignals.map((s: any, idx: number) => (
                                                        s.todaySignals?.map((sig: any, sIdx: number) => (
                                                            <tr key={`${idx}-${sIdx}`} className="border-b border-[var(--card-border)]/30">
                                                                <td className="py-2 pr-3 font-medium text-[var(--foreground)]">
                                                                    {s.symbol}
                                                                    {s.isHighBeta && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300">F&O</span>}
                                                                </td>
                                                                <td className="py-2 pr-3">
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${sig.setup === 'PULLBACK' ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                                                        {sig.setup}
                                                                    </span>
                                                                </td>
                                                                <td className={`py-2 pr-3 font-medium ${sig.direction === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {sig.direction}
                                                                </td>
                                                                <td className="py-2 pr-3 text-[var(--foreground)]">₹{sig.entryPrice}</td>
                                                                <td className="py-2 pr-3 text-red-400">₹{sig.sl}</td>
                                                                <td className="py-2 pr-3 text-purple-400">₹{sig.vwap}</td>
                                                                <td className={`py-2 pr-3 font-medium ${sig.pnlPct != null ? (sig.pnlPct >= 0 ? 'text-green-400' : 'text-red-400') : 'text-[var(--foreground-muted)]'}`}>
                                                                    {sig.pnlPct != null ? `${sig.pnlPct > 0 ? '+' : ''}${sig.pnlPct}%` : '—'}
                                                                </td>
                                                                <td className="py-2 text-[var(--foreground-muted)] text-[10px]">
                                                                    {sig.exitReason?.replace(/_/g, ' ') || '—'}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <p className="text-xs text-[var(--foreground-muted)] text-center">
                                            No VWAP signals today. Pullback signals are best between 10:00 AM – 12:30 PM IST.
                                        </p>
                                    </div>
                                )}

                                {/* Backtest Ranking */}
                                {vwapResult.backtestRanking && vwapResult.backtestRanking.length > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-violet-400 mb-3 flex items-center gap-1.5">
                                            <BarChart3 size={14} /> VWAP Backtest Ranking (Top 30)
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-3">Trades</th>
                                                        <th className="pb-2 pr-3">Win%</th>
                                                        <th className="pb-2 pr-3">Expect%</th>
                                                        <th className="pb-2 pr-3">Return%</th>
                                                        <th className="pb-2 pr-3">PF</th>
                                                        <th className="pb-2">Sharpe</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {vwapResult.backtestRanking.map((s: any, idx: number) => (
                                                        <tr key={idx} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-2 pr-3 font-medium text-[var(--foreground)]">
                                                                {s.symbol}
                                                                {s.isHighBeta && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300">F&O</span>}
                                                            </td>
                                                            <td className="py-2 pr-3 text-[var(--foreground)]">{s.backtest?.totalTrades}</td>
                                                            <td className={`py-2 pr-3 font-medium ${(s.backtest?.winRatePct || 0) >= 55 ? 'text-green-400' : (s.backtest?.winRatePct || 0) >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                                {s.backtest?.winRatePct}%
                                                            </td>
                                                            <td className={`py-2 pr-3 ${(s.backtest?.expectancyPct || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {s.backtest?.expectancyPct}%
                                                            </td>
                                                            <td className={`py-2 pr-3 ${(s.backtest?.totalReturnPct || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {s.backtest?.totalReturnPct}%
                                                            </td>
                                                            <td className="py-2 pr-3 text-[var(--foreground)]">{s.backtest?.profitFactor}</td>
                                                            <td className="py-2 text-[var(--foreground)]">{s.backtest?.sharpeRatio}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Scanned Stocks Fallback */}
                                {(!vwapResult.backtestRanking || vwapResult.backtestRanking.length === 0) && vwapResult.allStocks && vwapResult.allStocks.length > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-[var(--foreground-muted)] mb-3">Scanned Stocks (Top 50)</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-3">Days</th>
                                                        <th className="pb-2 pr-3">Candles</th>
                                                        <th className="pb-2 pr-3">ATR%</th>
                                                        <th className="pb-2">Backtest</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {vwapResult.allStocks.map((s: any, idx: number) => (
                                                        <tr key={idx} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-1.5 pr-3 font-medium text-[var(--foreground)]">
                                                                {s.symbol}
                                                                {s.isHighBeta && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300">F&O</span>}
                                                            </td>
                                                            <td className="py-1.5 pr-3 text-[var(--foreground-muted)]">{s.daysOfData}</td>
                                                            <td className="py-1.5 pr-3 text-[var(--foreground-muted)]">{s.totalCandles}</td>
                                                            <td className="py-1.5 pr-3 text-[var(--foreground-muted)]">{s.atr14Pct}%</td>
                                                            <td className="py-1.5 text-[var(--foreground-muted)]">{s.backtest ? `${s.backtest.totalTrades} trades` : 'No data'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Fetch Stats */}
                                {vwapResult.fetchStats && (
                                    <div className="bg-[var(--background)] rounded-lg p-3">
                                        <div className="text-[10px] text-[var(--foreground-muted)] flex items-center gap-4 flex-wrap">
                                            <span>📡 Fetched: {vwapResult.fetchStats.successfulFetches}/{vwapResult.fetchStats.totalSymbols} stocks</span>
                                            <span>❌ Errors: {vwapResult.fetchStats.failedFetches}</span>
                                            <span>📊 Backtests: {vwapResult.totalWithBacktest}</span>
                                            <span>⚡ Signals: {vwapResult.totalWithSignals}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Strategy 3: Gap Trading */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 hover:border-amber-500/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                                    <TrendingUp size={20} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--foreground)]">Gap Trading</h3>
                                    <p className="text-[10px] text-[var(--foreground-muted)]">Gap &amp; Go + Gap Fill · Catalyst Scoring · ORB Breakout · All 500+ stocks</p>
                                </div>
                            </div>
                            {gapScanning ? (
                                <button onClick={stopGapScan} className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all">
                                    <StopCircle size={14} /> Stop
                                </button>
                            ) : (
                                <button onClick={runGap} className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-500/20 transition-all">
                                    <Play size={14} /> Scan
                                </button>
                            )}
                        </div>

                        {gapScanning && (
                            <div className="mb-4">
                                <p className="text-xs text-amber-300 mb-2">{gapStatusMsg}</p>
                                {gapProgress && (
                                    <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 rounded-full transition-all" style={{ width: `${gapProgress.pct}%` }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {gapError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                <p className="text-xs text-red-400">{gapError}</p>
                            </div>
                        )}

                        {gapResult && (
                            <div className="space-y-4">
                                {/* Summary Stats */}
                                <div className="grid grid-cols-5 gap-3">
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-amber-400">{gapResult.totalSuccessful || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Fetched</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-orange-400">{gapResult.totalGapsToday || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Gaps Today</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-green-400">{gapResult.totalWithSignals || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Signals</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-yellow-400">{gapResult.totalWithBacktest || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Backtests</p>
                                    </div>
                                    <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                        <p className="text-lg font-bold text-red-400">{gapResult.fetchStats?.failedFetches || 0}</p>
                                        <p className="text-[10px] text-[var(--foreground-muted)]">Errors</p>
                                    </div>
                                </div>

                                {/* Today's Gap Signals */}
                                {gapResult.activeSignals && gapResult.activeSignals.length > 0 ? (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
                                            <Sparkles size={14} /> Today&apos;s Gap Signals
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-3">Strategy</th>
                                                        <th className="pb-2 pr-3">Gap</th>
                                                        <th className="pb-2 pr-3">Dir</th>
                                                        <th className="pb-2 pr-3">Entry</th>
                                                        <th className="pb-2 pr-3">SL</th>
                                                        <th className="pb-2 pr-3">Fill Target</th>
                                                        <th className="pb-2 pr-3">P&L</th>
                                                        <th className="pb-2">Exit</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {gapResult.activeSignals.map((s: any, idx: number) => (
                                                        s.todaySignals?.map((sig: any, sIdx: number) => (
                                                            <tr key={`${idx}-${sIdx}`} className="border-b border-[var(--card-border)]/30">
                                                                <td className="py-2 pr-3 font-medium text-[var(--foreground)]">
                                                                    {s.symbol}
                                                                    {s.isHighBeta && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">F&O</span>}
                                                                </td>
                                                                <td className="py-2 pr-3">
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${sig.strategy === 'GAP_AND_GO' ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'}`}>
                                                                        {sig.strategy === 'GAP_AND_GO' ? 'Gap&Go' : 'Gap Fill'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2 pr-3">
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${sig.gapType?.includes('UP') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                        {sig.gapSizeLabel}
                                                                    </span>
                                                                </td>
                                                                <td className={`py-2 pr-3 font-medium ${sig.direction === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {sig.direction}
                                                                </td>
                                                                <td className="py-2 pr-3 text-[var(--foreground)]">₹{sig.entryPrice}</td>
                                                                <td className="py-2 pr-3 text-red-400">₹{sig.sl}</td>
                                                                <td className="py-2 pr-3 text-amber-400">{sig.gapFillTarget ? `₹${sig.gapFillTarget}` : '—'}</td>
                                                                <td className={`py-2 pr-3 font-medium ${sig.pnlPct != null ? (sig.pnlPct >= 0 ? 'text-green-400' : 'text-red-400') : 'text-[var(--foreground-muted)]'}`}>
                                                                    {sig.pnlPct != null ? `${sig.pnlPct > 0 ? '+' : ''}${sig.pnlPct}%` : '—'}
                                                                </td>
                                                                <td className="py-2 text-[var(--foreground-muted)] text-[10px]">
                                                                    {sig.exitReason?.replace(/_/g, ' ') || '—'}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <p className="text-xs text-[var(--foreground-muted)] text-center">
                                            No gap signals today. Gap fills are most common on small/medium gaps (0.3–1.5%) without catalysts.
                                        </p>
                                    </div>
                                )}

                                {/* Today's Gaps (Top 30) */}
                                {gapResult.todayGaps && gapResult.todayGaps.length > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-orange-400 mb-3 flex items-center gap-1.5">
                                            <TrendingUp size={14} /> Today&apos;s Gaps (Top 30)
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-3">Type</th>
                                                        <th className="pb-2 pr-3">Size</th>
                                                        <th className="pb-2 pr-3">Gap%</th>
                                                        <th className="pb-2">Fill Target</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {gapResult.todayGaps.map((s: any, idx: number) => (
                                                        <tr key={idx} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-1.5 pr-3 font-medium text-[var(--foreground)]">
                                                                {s.symbol}
                                                                {s.isHighBeta && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">F&O</span>}
                                                            </td>
                                                            <td className="py-1.5 pr-3">
                                                                <span className={`text-[9px] px-1 py-0.5 rounded ${s.todayGap?.direction === 'UP' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                    {s.todayGap?.type?.replace(/_/g, ' ')}
                                                                </span>
                                                            </td>
                                                            <td className="py-1.5 pr-3 text-amber-400 text-[10px]">{s.todayGap?.size}</td>
                                                            <td className={`py-1.5 pr-3 font-medium ${s.todayGap?.direction === 'UP' ? 'text-green-400' : 'text-red-400'}`}>
                                                                {s.todayGap?.direction === 'UP' ? '+' : '-'}{s.todayGap?.pct}%
                                                            </td>
                                                            <td className="py-1.5 text-[var(--foreground-muted)]">₹{s.todayGap?.fillTarget}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Backtest Ranking */}
                                {gapResult.backtestRanking && gapResult.backtestRanking.length > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-yellow-400 mb-3 flex items-center gap-1.5">
                                            <BarChart3 size={14} /> Gap Backtest Ranking (Top 30)
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-3">Trades</th>
                                                        <th className="pb-2 pr-3">Win%</th>
                                                        <th className="pb-2 pr-3">Fill%</th>
                                                        <th className="pb-2 pr-3">Return%</th>
                                                        <th className="pb-2 pr-3">PF</th>
                                                        <th className="pb-2">Sharpe</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {gapResult.backtestRanking.map((s: any, idx: number) => (
                                                        <tr key={idx} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-2 pr-3 font-medium text-[var(--foreground)]">
                                                                {s.symbol}
                                                                {s.isHighBeta && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">F&O</span>}
                                                            </td>
                                                            <td className="py-2 pr-3 text-[var(--foreground)]">{s.backtest?.totalTrades}</td>
                                                            <td className={`py-2 pr-3 font-medium ${(s.backtest?.winRatePct || 0) >= 55 ? 'text-green-400' : (s.backtest?.winRatePct || 0) >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                                {s.backtest?.winRatePct}%
                                                            </td>
                                                            <td className="py-2 pr-3 text-amber-400">{s.backtest?.gapFillRatePct}%</td>
                                                            <td className={`py-2 pr-3 ${(s.backtest?.totalReturnPct || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {s.backtest?.totalReturnPct}%
                                                            </td>
                                                            <td className="py-2 pr-3 text-[var(--foreground)]">{s.backtest?.profitFactor}</td>
                                                            <td className="py-2 text-[var(--foreground)]">{s.backtest?.sharpeRatio}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Fetch Stats */}
                                {gapResult.fetchStats && (
                                    <div className="bg-[var(--background)] rounded-lg p-3">
                                        <div className="text-[10px] text-[var(--foreground-muted)] flex items-center gap-4 flex-wrap">
                                            <span>📡 Fetched: {gapResult.fetchStats.successfulFetches}/{gapResult.fetchStats.totalSymbols} stocks</span>
                                            <span>❌ Errors: {gapResult.fetchStats.failedFetches}</span>
                                            <span>📊 Backtests: {gapResult.totalWithBacktest}</span>
                                            <span>⚡ Signals: {gapResult.totalWithSignals}</span>
                                            <span>📈 Gaps Today: {gapResult.totalGapsToday}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Strategy 4: EMA Crossover + MACD */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 hover:border-cyan-500/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-teal-500/20 rounded-xl flex items-center justify-center">
                                    <GitPullRequestArrow size={20} className="text-cyan-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--foreground)]">EMA Crossover + MACD</h3>
                                    <p className="text-[10px] text-[var(--foreground-muted)]">9/20 EMA &amp; Triple 5/13/26 · MACD (5,13,4) · VWAP Alignment · 6 Filters · All 500+ stocks</p>
                                </div>
                            </div>
                            {emaScanning ? (
                                <button onClick={stopEmaScan} className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all">
                                    <StopCircle size={14} /> Stop
                                </button>
                            ) : (
                                <button onClick={runEmaMacd} className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-cyan-500/20 transition-all">
                                    <Play size={14} /> Scan
                                </button>
                            )}
                        </div>

                        {/* Key Info */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Systems</div>
                                <div className="text-sm font-bold text-cyan-400">Dual + Triple</div>
                            </div>
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">MACD</div>
                                <div className="text-sm font-bold text-teal-400">(5,13,4)</div>
                            </div>
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Filters</div>
                                <div className="text-sm font-bold text-cyan-300">6 Cascaded</div>
                            </div>
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Window</div>
                                <div className="text-sm font-bold text-teal-300">9:30-1:00</div>
                            </div>
                        </div>

                        {emaScanning && (
                            <div className="mb-4">
                                <p className="text-xs text-cyan-300 mb-2">{emaStatusMsg}</p>
                                {emaProgress && (
                                    <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                                        <div className="bg-gradient-to-r from-cyan-500 to-teal-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.round((emaProgress.scanned / emaProgress.total) * 100)}%` }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {emaError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                <p className="text-xs text-red-400">{emaError}</p>
                            </div>
                        )}

                        {emaResult && (
                            <div className="space-y-4">
                                {/* Today Signals */}
                                {emaResult.todaySignals && emaResult.todaySignals.length > 0 ? (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-cyan-400 mb-3 flex items-center gap-1.5">
                                            <Zap size={14} /> Today&apos;s EMA Signals ({emaResult.todaySignals.reduce((s: number, st: any) => s + st.signals.length, 0)})
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-3">System</th>
                                                        <th className="pb-2 pr-3">Dir</th>
                                                        <th className="pb-2 pr-3">Entry</th>
                                                        <th className="pb-2 pr-3">SL</th>
                                                        <th className="pb-2 pr-3">PnL%</th>
                                                        <th className="pb-2">Exit</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {emaResult.todaySignals.slice(0, 30).map((stock: any, idx: number) =>
                                                        stock.signals.map((sig: any, sIdx: number) => (
                                                            <tr key={`${idx}-${sIdx}`} className="border-b border-[var(--card-border)]/30">
                                                                <td className="py-1.5 pr-3 font-medium text-[var(--foreground)]">
                                                                    {stock.symbol}
                                                                    {stock.isHighBeta && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300">F&amp;O</span>}
                                                                </td>
                                                                <td className="py-1.5 pr-3">
                                                                    <span className={`text-[9px] px-1 py-0.5 rounded ${sig.system === 'DUAL_9_20' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-teal-500/10 text-teal-400'}`}>
                                                                        {sig.system === 'DUAL_9_20' ? '9/20' : '5/13/26'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-1.5 pr-3">
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${sig.direction === 'LONG' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                        {sig.direction}
                                                                    </span>
                                                                </td>
                                                                <td className="py-1.5 pr-3 text-[var(--foreground)]">{sig.entryPrice}</td>
                                                                <td className="py-1.5 pr-3 text-red-400">{sig.sl}</td>
                                                                <td className={`py-1.5 pr-3 font-medium ${sig.netPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {sig.netPnlPct >= 0 ? '+' : ''}{sig.netPnlPct}%
                                                                </td>
                                                                <td className="py-1.5 text-[var(--foreground-muted)] text-[10px]">{sig.exitReason?.replace(/_/g, ' ')}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <p className="text-xs text-[var(--foreground-muted)] text-center">No EMA crossover signals detected today.</p>
                                    </div>
                                )}

                                {/* 9/20 EMA Top Ranking */}
                                {emaResult.topDualByWinRate && emaResult.topDualByWinRate.length > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-cyan-400 mb-3 flex items-center gap-1.5">
                                            <BarChart3 size={14} /> 9/20 EMA Top Stocks by Win Rate
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-3">Trades</th>
                                                        <th className="pb-2 pr-3">Win%</th>
                                                        <th className="pb-2">Expectancy</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {emaResult.topDualByWinRate.map((s: any, idx: number) => (
                                                        <tr key={idx} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-1.5 pr-3 font-medium text-[var(--foreground)]">{s.symbol}</td>
                                                            <td className="py-1.5 pr-3 text-[var(--foreground)]">{s.trades}</td>
                                                            <td className={`py-1.5 pr-3 font-medium ${(s.winRate || 0) >= 55 ? 'text-green-400' : (s.winRate || 0) >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{s.winRate}%</td>
                                                            <td className={`py-1.5 font-medium ${(s.expectancy || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>{s.expectancy}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Triple EMA Top Ranking */}
                                {emaResult.topTripleByWinRate && emaResult.topTripleByWinRate.length > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-teal-400 mb-3 flex items-center gap-1.5">
                                            <Layers size={14} /> Triple EMA (5/13/26) Top Stocks
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-3">Trades</th>
                                                        <th className="pb-2 pr-3">Win%</th>
                                                        <th className="pb-2">Expectancy</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {emaResult.topTripleByWinRate.map((s: any, idx: number) => (
                                                        <tr key={idx} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-1.5 pr-3 font-medium text-[var(--foreground)]">{s.symbol}</td>
                                                            <td className="py-1.5 pr-3 text-[var(--foreground)]">{s.trades}</td>
                                                            <td className={`py-1.5 pr-3 font-medium ${(s.winRate || 0) >= 55 ? 'text-green-400' : (s.winRate || 0) >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{s.winRate}%</td>
                                                            <td className={`py-1.5 font-medium ${(s.expectancy || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>{s.expectancy}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Scan Stats */}
                                <div className="bg-[var(--background)] rounded-lg p-3">
                                    <div className="text-[10px] text-[var(--foreground-muted)] flex items-center gap-4 flex-wrap">
                                        <span>Scanned: {emaResult.totalStocksScanned} stocks</span>
                                        <span>Errors: {emaResult.totalErrors}</span>
                                        <span>Signals: {emaResult.todaySignals?.reduce((s: number, st: any) => s + st.signals.length, 0) || 0}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Strategy 5: Order Flow & Market Depth */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-xl flex items-center justify-center">
                                    <Waves size={20} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--foreground)]">Order Flow &amp; Market Depth</h3>
                                    <p className="text-[10px] text-[var(--foreground-muted)]">Synthetic Depth · Absorption · Stacking · Spoofing · Iceberg · Delta</p>
                                </div>
                            </div>
                            {ofScanning ? (
                                <button onClick={stopOfScan} className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all">
                                    <StopCircle size={14} /> Stop
                                </button>
                            ) : (
                                <button onClick={runOrderFlow} className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-500/20 transition-all">
                                    <Play size={14} /> Scan
                                </button>
                            )}
                        </div>

                        {/* Key Info */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Modes</div>
                                <div className="text-sm font-bold text-indigo-400">Stand + Confirm</div>
                            </div>
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Patterns</div>
                                <div className="text-sm font-bold text-violet-400">4 Detectors</div>
                            </div>
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Filters</div>
                                <div className="text-sm font-bold text-indigo-300">BAR + Δ + Pat</div>
                            </div>
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Window</div>
                                <div className="text-sm font-bold text-violet-300">9:20-2:30</div>
                            </div>
                        </div>

                        {ofScanning && (
                            <div className="mb-4">
                                <p className="text-xs text-indigo-300 mb-2">{ofStatusMsg}</p>
                                {ofProgress && (
                                    <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                                        <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.round((ofProgress.scanned / ofProgress.total) * 100)}%` }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {ofError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                <p className="text-xs text-red-400">{ofError}</p>
                            </div>
                        )}

                        {ofResult && (
                            <div className="space-y-4">
                                {/* Today's Signals */}
                                {ofResult.todaySignals && ofResult.todaySignals.length > 0 ? (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-indigo-400 mb-3 flex items-center gap-1.5">
                                            <Zap size={14} /> Today&apos;s Order Flow Signals ({ofResult.todaySignals.reduce((s: number, st: any) => s + st.signals.length, 0)})
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-3">Pattern</th>
                                                        <th className="pb-2 pr-3">Dir</th>
                                                        <th className="pb-2 pr-3">Score</th>
                                                        <th className="pb-2 pr-3">Entry</th>
                                                        <th className="pb-2 pr-3">SL</th>
                                                        <th className="pb-2 pr-3">PnL%</th>
                                                        <th className="pb-2">Exit</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ofResult.todaySignals.slice(0, 30).map((stock: any, idx: number) =>
                                                        stock.signals.map((sig: any, sIdx: number) => (
                                                            <tr key={`of-${idx}-${sIdx}`} className="border-b border-[var(--card-border)]/30">
                                                                <td className="py-1.5 pr-3 font-medium text-[var(--foreground)]">
                                                                    {stock.symbol}
                                                                    {stock.isFnO && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300">F&amp;O</span>}
                                                                </td>
                                                                <td className="py-1.5 pr-3">
                                                                    <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-400">
                                                                        {sig.primaryPattern?.replace(/_/g, ' ').slice(0, 15) || 'COMPOSITE'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-1.5 pr-3">
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${sig.direction === 'LONG' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                        {sig.direction}
                                                                    </span>
                                                                </td>
                                                                <td className="py-1.5 pr-3 text-indigo-400 font-medium">{sig.patternScore}</td>
                                                                <td className="py-1.5 pr-3 text-[var(--foreground)]">{sig.entryPrice}</td>
                                                                <td className="py-1.5 pr-3 text-red-400">{sig.sl}</td>
                                                                <td className={`py-1.5 pr-3 font-medium ${sig.netPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {sig.netPnlPct >= 0 ? '+' : ''}{sig.netPnlPct}%
                                                                </td>
                                                                <td className="py-1.5 text-[var(--foreground-muted)] text-[10px]">{sig.exitReason?.replace(/_/g, ' ')}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <p className="text-xs text-[var(--foreground-muted)] text-center">No order flow signals detected today.</p>
                                    </div>
                                )}

                                {/* Pattern Effectiveness */}
                                {ofResult.patternRanking && ofResult.patternRanking.length > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-violet-400 mb-3 flex items-center gap-1.5">
                                            <BookOpen size={14} /> Pattern Effectiveness
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Pattern</th>
                                                        <th className="pb-2 pr-3">Count</th>
                                                        <th className="pb-2 pr-3">Win%</th>
                                                        <th className="pb-2">Avg PnL</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ofResult.patternRanking.slice(0, 8).map((p: any, idx: number) => (
                                                        <tr key={idx} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-1.5 pr-3 font-medium text-[var(--foreground)] text-[10px]">{p.pattern}</td>
                                                            <td className="py-1.5 pr-3 text-[var(--foreground)]">{p.count}</td>
                                                            <td className={`py-1.5 pr-3 font-medium ${p.winRatePct >= 55 ? 'text-green-400' : p.winRatePct >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{p.winRatePct}%</td>
                                                            <td className={`py-1.5 font-medium ${p.avgPnlPct > 0 ? 'text-green-400' : 'text-red-400'}`}>{p.avgPnlPct}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Top Stocks by Win Rate */}
                                {ofResult.topByWinRate && ofResult.topByWinRate.length > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-indigo-400 mb-3 flex items-center gap-1.5">
                                            <BarChart3 size={14} /> Top Stocks by Win Rate
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-3">Trades</th>
                                                        <th className="pb-2 pr-3">Win%</th>
                                                        <th className="pb-2">Expectancy</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ofResult.topByWinRate.map((s: any, idx: number) => (
                                                        <tr key={idx} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-1.5 pr-3 font-medium text-[var(--foreground)]">
                                                                {s.symbol}
                                                                {s.isFnO && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300">F&amp;O</span>}
                                                            </td>
                                                            <td className="py-1.5 pr-3 text-[var(--foreground)]">{s.trades}</td>
                                                            <td className={`py-1.5 pr-3 font-medium ${(s.winRate || 0) >= 55 ? 'text-green-400' : (s.winRate || 0) >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{s.winRate}%</td>
                                                            <td className={`py-1.5 font-medium ${(s.expectancy || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>{s.expectancy}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Scan Stats */}
                                <div className="bg-[var(--background)] rounded-lg p-3">
                                    <div className="text-[10px] text-[var(--foreground-muted)] flex items-center gap-4 flex-wrap">
                                        <span>Scanned: {ofResult.totalStocksScanned} stocks</span>
                                        <span>Errors: {ofResult.totalErrors}</span>
                                        <span>Signals: {ofResult.todaySignals?.reduce((s: number, st: any) => s + st.signals.length, 0) || 0}</span>
                                        <span>Patterns: {ofResult.patternRanking?.length || 0} types</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════ 1W TIMEFRAME ═══════════════ */}
            {activeTimeframe === '1W' && (
                <div className="space-y-6">
                    {/* Strategy 7: BTST / STBT */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 hover:border-amber-500/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                                    <Moon size={20} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--foreground)]">BTST / STBT (Buy Today Sell Tomorrow)</h3>
                                    <p className="text-[10px] text-[var(--foreground-muted)]">Overnight Momentum · 7 Criteria · 10-Factor Scoring · Risk Gates · Gap Analysis</p>
                                </div>
                            </div>
                            {btstScanning ? (
                                <button onClick={stopBtstScan} className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all">
                                    <StopCircle size={14} /> Stop
                                </button>
                            ) : (
                                <button onClick={runBTST} className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-500/20 transition-all">
                                    <Play size={14} /> Scan
                                </button>
                            )}
                        </div>

                        {/* Strategy Info Badges */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Entry Window</div>
                                <div className="text-sm font-bold text-amber-400">3:00-3:15 PM</div>
                            </div>
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Hold Period</div>
                                <div className="text-sm font-bold text-orange-400">Overnight</div>
                            </div>
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Target</div>
                                <div className="text-sm font-bold text-amber-300">1.5-3%</div>
                            </div>
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Max Positions</div>
                                <div className="text-sm font-bold text-orange-300">3 stocks</div>
                            </div>
                        </div>

                        {/* Scanning Progress */}
                        {btstScanning && (
                            <div className="mb-4">
                                <p className="text-xs text-amber-300 mb-2">{btstStatusMsg}</p>
                                {btstProgress && (
                                    <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.round((btstProgress.scanned / btstProgress.total) * 100)}%` }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {btstError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                <p className="text-xs text-red-400">{btstError}</p>
                            </div>
                        )}

                        {/* Risk Gate Banner */}
                        {btstRiskGate && (
                            <div className={`rounded-lg p-3 mb-4 border ${btstRiskGate.allowed ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <ShieldCheck size={14} className={btstRiskGate.allowed ? 'text-green-400' : 'text-red-400'} />
                                    <span className={`text-xs font-semibold ${btstRiskGate.allowed ? 'text-green-400' : 'text-red-400'}`}>
                                        Risk Gate: {btstRiskGate.allowed ? '✅ CLEAR' : '🚫 BLOCKED'}
                                        {btstRiskGate.sizeMultiplier < 1 && ` (size: ${btstRiskGate.sizeMultiplier}x)`}
                                    </span>
                                </div>
                                {btstRiskGate.blocks.map((b: any, idx: number) => (
                                    <p key={idx} className="text-[10px] text-red-400 ml-5">❌ {b.rule}: {b.msg}</p>
                                ))}
                                {btstRiskGate.warnings.map((w: any, idx: number) => (
                                    <p key={idx} className="text-[10px] text-yellow-400 ml-5">⚠️ {w.rule}: {w.msg}</p>
                                ))}
                            </div>
                        )}

                        {btstResult && (
                            <div className="space-y-4">
                                {/* Market Context */}
                                <div className="bg-[var(--background)] rounded-lg p-3 flex items-center gap-4 flex-wrap text-[11px]">
                                    <span className="flex items-center gap-1">
                                        {btstResult.market.niftyPositive
                                            ? <TrendingUp size={12} className="text-green-400" />
                                            : <TrendingDown size={12} className="text-red-400" />
                                        }
                                        Nifty: <span className={btstResult.market.niftyPositive ? 'text-green-400' : 'text-red-400'}>{btstResult.market.niftyChange}%</span>
                                    </span>
                                    {btstResult.market.indiaVix && (
                                        <span>VIX: <span className={btstResult.market.indiaVix > 18 ? 'text-yellow-400' : 'text-[var(--foreground)]'}>{btstResult.market.indiaVix}</span></span>
                                    )}
                                    <span>Direction: <span className="text-amber-400 font-medium">{btstResult.market.scanDirection}</span></span>
                                    <span>Candidates: <span className="text-amber-400 font-medium">{btstResult.totalCandidates}</span></span>
                                </div>

                                {/* Today's Candidates */}
                                {btstResult.candidates && btstResult.candidates.length > 0 ? (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
                                            <Zap size={14} /> Today&apos;s {btstResult.market.niftyPositive ? 'BTST' : 'STBT'} Candidates ({btstResult.candidates.length})
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-2">#</th>
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-2">Grade</th>
                                                        <th className="pb-2 pr-2">Score</th>
                                                        <th className="pb-2 pr-2">Day%</th>
                                                        <th className="pb-2 pr-2">CS</th>
                                                        <th className="pb-2 pr-2">Vol×</th>
                                                        <th className="pb-2 pr-2">RSI</th>
                                                        <th className="pb-2 pr-2">Gap↑%</th>
                                                        <th className="pb-2">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {btstResult.candidates.map((c: any) => (
                                                        <tr key={c.rank} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-1.5 pr-2 text-[var(--foreground-muted)]">{c.rank}</td>
                                                            <td className="py-1.5 pr-3 font-medium text-[var(--foreground)]">
                                                                {c.symbol}
                                                                {c.isFnO && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">F&amp;O</span>}
                                                            </td>
                                                            <td className="py-1.5 pr-2">
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                                                    c.grade === 'A+' || c.grade === 'A' ? 'bg-green-500/10 text-green-400' :
                                                                    c.grade === 'B+' || c.grade === 'B' ? 'bg-amber-500/10 text-amber-400' :
                                                                    'bg-red-500/10 text-red-400'
                                                                }`}>{c.grade}</span>
                                                            </td>
                                                            <td className="py-1.5 pr-2 text-amber-400 font-medium">{c.score}</td>
                                                            <td className={`py-1.5 pr-2 font-medium ${c.dayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {c.dayChange >= 0 ? '+' : ''}{c.dayChange}%
                                                            </td>
                                                            <td className="py-1.5 pr-2 text-[var(--foreground)]">{c.closingStrength}</td>
                                                            <td className="py-1.5 pr-2 text-[var(--foreground)]">{c.volumeRatio}×</td>
                                                            <td className="py-1.5 pr-2 text-[var(--foreground)]">{c.rsi14}</td>
                                                            <td className="py-1.5 pr-2">
                                                                {c.gapUpProb !== null ? (
                                                                    <span className={c.gapUpProb >= 0.6 ? 'text-green-400' : 'text-[var(--foreground-muted)]'}>
                                                                        {Math.round(c.gapUpProb * 100)}%
                                                                    </span>
                                                                ) : <span className="text-[var(--foreground-muted)]">-</span>}
                                                            </td>
                                                            <td className="py-1.5">
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                                                    c.action === 'STRONG BUY' ? 'bg-green-500/10 text-green-400' :
                                                                    c.action === 'BUY' ? 'bg-amber-500/10 text-amber-400' :
                                                                    'bg-[var(--background)] text-[var(--foreground-muted)]'
                                                                }`}>{c.action}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <p className="text-xs text-[var(--foreground-muted)] text-center">
                                            {btstRiskGate && !btstRiskGate.allowed
                                                ? 'Risk gate blocked — no BTST trades today.'
                                                : 'No stocks passed all 7 BTST criteria today.'}
                                        </p>
                                    </div>
                                )}

                                {/* Backtest Performance */}
                                {btstResult.backtest && btstResult.backtest.totalTrades > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-orange-400 mb-3 flex items-center gap-1.5">
                                            <BarChart3 size={14} /> Backtest Performance (~1 Year)
                                        </h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                                            <div className="text-center">
                                                <div className="text-[10px] text-[var(--foreground-muted)]">Trades</div>
                                                <div className="text-sm font-bold text-[var(--foreground)]">{btstResult.backtest.totalTrades}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[10px] text-[var(--foreground-muted)]">Win Rate</div>
                                                <div className={`text-sm font-bold ${btstResult.backtest.winRatePct >= 55 ? 'text-green-400' : btstResult.backtest.winRatePct >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{btstResult.backtest.winRatePct}%</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[10px] text-[var(--foreground-muted)]">Profit Factor</div>
                                                <div className={`text-sm font-bold ${btstResult.backtest.profitFactor >= 1.5 ? 'text-green-400' : btstResult.backtest.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>{btstResult.backtest.profitFactor}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[10px] text-[var(--foreground-muted)]">Sharpe</div>
                                                <div className={`text-sm font-bold ${btstResult.backtest.sharpeRatio >= 1 ? 'text-green-400' : btstResult.backtest.sharpeRatio >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>{btstResult.backtest.sharpeRatio}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[10px] text-[var(--foreground-muted)]">Avg PnL</div>
                                                <div className={`text-sm font-bold ${btstResult.backtest.avgPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{btstResult.backtest.avgPnlPct}%</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[10px] text-[var(--foreground-muted)]">Max DD</div>
                                                <div className="text-sm font-bold text-red-400">{btstResult.drawdown?.maxDrawdownPct ?? '-'}%</div>
                                            </div>
                                        </div>

                                        {/* Score Tier Comparison */}
                                        {btstResult.backtest.byScoreTier && (
                                            <div className="mt-3 pt-3 border-t border-[var(--card-border)]/30">
                                                <div className="text-[10px] text-[var(--foreground-muted)] mb-2">Score Tier Analysis</div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-[var(--card)] rounded-lg p-2 text-center">
                                                        <div className="text-[9px] text-amber-400 mb-1">High Score (≥60)</div>
                                                        <div className="text-xs text-[var(--foreground)]">
                                                            {btstResult.backtest.byScoreTier.highScore.trades} trades · WR: {btstResult.backtest.byScoreTier.highScore.winRate}% · Avg: {btstResult.backtest.byScoreTier.highScore.avgPnl}%
                                                        </div>
                                                    </div>
                                                    <div className="bg-[var(--card)] rounded-lg p-2 text-center">
                                                        <div className="text-[9px] text-[var(--foreground-muted)] mb-1">Low Score (&lt;60)</div>
                                                        <div className="text-xs text-[var(--foreground)]">
                                                            {btstResult.backtest.byScoreTier.lowScore.trades} trades · WR: {btstResult.backtest.byScoreTier.lowScore.winRate}% · Avg: {btstResult.backtest.byScoreTier.lowScore.avgPnl}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Gap Analysis */}
                                        <div className="mt-3 pt-3 border-t border-[var(--card-border)]/30">
                                            <div className="flex items-center gap-4 text-[10px] text-[var(--foreground-muted)] flex-wrap">
                                                <span>Avg Gap: <span className={btstResult.backtest.avgGapPct >= 0 ? 'text-green-400' : 'text-red-400'}>{btstResult.backtest.avgGapPct}%</span></span>
                                                <span>Gap↑ Rate: <span className="text-amber-400">{btstResult.backtest.positiveGapRate}%</span></span>
                                                <span>Best: <span className="text-green-400">+{btstResult.backtest.bestTrade}%</span></span>
                                                <span>Worst: <span className="text-red-400">{btstResult.backtest.worstTrade}%</span></span>
                                                <span>Max Loss Streak: <span className="text-red-400">{btstResult.backtest.maxConsecutiveLosses}</span></span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Top Stocks by Win Rate */}
                                {btstResult.topStocksByWinRate && btstResult.topStocksByWinRate.length > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
                                            <BarChart3 size={14} /> Top Stocks — BTST Win Rate (≥3 trades)
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-3">Trades</th>
                                                        <th className="pb-2 pr-3">Win%</th>
                                                        <th className="pb-2">Avg PnL</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {btstResult.topStocksByWinRate.map((s: any, idx: number) => (
                                                        <tr key={idx} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-1.5 pr-3 font-medium text-[var(--foreground)]">
                                                                {s.symbol}
                                                                {s.isFnO && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">F&amp;O</span>}
                                                            </td>
                                                            <td className="py-1.5 pr-3 text-[var(--foreground)]">{s.trades}</td>
                                                            <td className={`py-1.5 pr-3 font-medium ${s.winRate >= 55 ? 'text-green-400' : s.winRate >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{s.winRate}%</td>
                                                            <td className={`py-1.5 font-medium ${s.avgPnl > 0 ? 'text-green-400' : 'text-red-400'}`}>{s.avgPnl > 0 ? '+' : ''}{s.avgPnl}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Exit Reason Breakdown */}
                                {btstResult.backtest?.exitReasons && (
                                    <div className="bg-[var(--background)] rounded-lg p-3">
                                        <div className="text-[10px] text-[var(--foreground-muted)] mb-2">Exit Reasons</div>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            {Object.entries(btstResult.backtest.exitReasons).map(([reason, data]: [string, any]) => (
                                                <span key={reason} className="text-[10px] px-2 py-1 rounded bg-[var(--card)] text-[var(--foreground)]">
                                                    {reason.replace(/_/g, ' ')}: {data.count} (<span className={data.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}>{data.avgPnl}%</span>)
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Scan Stats */}
                                <div className="bg-[var(--background)] rounded-lg p-3">
                                    <div className="text-[10px] text-[var(--foreground-muted)] flex items-center gap-4 flex-wrap">
                                        <span>Scanned: {btstResult.totalStocksScanned} stocks</span>
                                        <span>Errors: {btstResult.totalErrors}</span>
                                        <span>Candidates: {btstResult.totalCandidates}</span>
                                        <span>Backtest Trades: {btstResult.backtest?.totalTrades ?? 0}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Strategy 8: Weekly Breakout / Breakdown */}
                    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 hover:border-teal-500/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center">
                                    <Layers size={20} className="text-teal-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--foreground)]">Weekly Breakout / Breakdown</h3>
                                    <p className="text-[10px] text-[var(--foreground-muted)]">PW Range · Multi-Week Base · RS vs Nifty · Monday Effect · Retest Entries · Hold 3-5 Days</p>
                                </div>
                            </div>
                            {wbScanning ? (
                                <button onClick={stopWbScan} className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all">
                                    <StopCircle size={14} /> Stop
                                </button>
                            ) : (
                                <button onClick={runWeeklyBreakout} className="flex items-center gap-1.5 bg-teal-500/10 text-teal-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-teal-500/20 transition-all">
                                    <Play size={14} /> Scan
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Analysis</div>
                                <div className="text-sm font-bold text-teal-400">Weekend Scan</div>
                            </div>
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Entry</div>
                                <div className="text-sm font-bold text-cyan-400">Mon-Wed</div>
                            </div>
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Target</div>
                                <div className="text-sm font-bold text-teal-300">3-8%</div>
                            </div>
                            <div className="bg-[var(--background)] rounded-lg p-3 text-center">
                                <div className="text-[10px] text-[var(--foreground-muted)] mb-1">Hold</div>
                                <div className="text-sm font-bold text-cyan-300">3-5 Days</div>
                            </div>
                        </div>

                        {wbScanning && (
                            <div className="mb-4">
                                <p className="text-xs text-teal-300 mb-2">{wbStatusMsg}</p>
                                {wbProgress && (
                                    <div className="w-full bg-[var(--background)] rounded-full h-1.5">
                                        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.round((wbProgress.scanned / wbProgress.total) * 100)}%` }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {wbError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                <p className="text-xs text-red-400">{wbError}</p>
                            </div>
                        )}

                        {wbRiskGate && (
                            <div className={`rounded-lg p-3 mb-4 border ${wbRiskGate.allowed ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <ShieldCheck size={14} className={wbRiskGate.allowed ? 'text-green-400' : 'text-red-400'} />
                                    <span className={`text-xs font-semibold ${wbRiskGate.allowed ? 'text-green-400' : 'text-red-400'}`}>
                                        Risk Gate: {wbRiskGate.allowed ? '\u2705 CLEAR' : '\ud83d\udeab BLOCKED'}
                                    </span>
                                </div>
                                {wbRiskGate.blocks.map((b: any, i: number) => <p key={i} className="text-[10px] text-red-400 ml-5">\u274c {b.rule}: {b.msg}</p>)}
                                {wbRiskGate.warnings.map((w: any, i: number) => <p key={i} className="text-[10px] text-yellow-400 ml-5">\u26a0\ufe0f {w.rule}: {w.msg}</p>)}
                            </div>
                        )}

                        {wbResult && (
                            <div className="space-y-4">
                                {/* Market Context */}
                                <div className="bg-[var(--background)] rounded-lg p-3 flex items-center gap-4 flex-wrap text-[11px]">
                                    <span>Regime: <span className={`font-medium ${wbResult.market.regime?.regime === 'STRONG_TREND' || wbResult.market.regime?.regime === 'TRENDING' ? 'text-green-400' : wbResult.market.regime?.regime === 'CHOPPY' ? 'text-red-400' : 'text-yellow-400'}`}>{wbResult.market.regime?.regime || '-'}</span></span>
                                    <span>Nifty Trend: <span className="text-teal-400 font-medium">{wbResult.market.niftyTrend?.trend || '-'}</span></span>
                                    {wbResult.market.indiaVix && <span>VIX: <span className={wbResult.market.indiaVix > 18 ? 'text-yellow-400' : 'text-[var(--foreground)]'}>{wbResult.market.indiaVix}</span></span>}
                                    <span>Success Est: <span className="text-teal-400 font-medium">{wbResult.market.regime?.estimatedSuccessRate ? `${Math.round(wbResult.market.regime.estimatedSuccessRate * 100)}%` : '-'}</span></span>
                                </div>

                                {/* Breakout Watchlist */}
                                {wbResult.breakoutWatch && wbResult.breakoutWatch.length > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-teal-400 mb-3 flex items-center gap-1.5">
                                            <TrendingUp size={14} /> Breakout Watchlist ({wbResult.totalBreakoutCandidates})
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-2">Score</th>
                                                        <th className="pb-2 pr-2">PW High</th>
                                                        <th className="pb-2 pr-2">PW%</th>
                                                        <th className="pb-2 pr-2">Base</th>
                                                        <th className="pb-2 pr-2">RS</th>
                                                        <th className="pb-2 pr-2">52W</th>
                                                        <th className="pb-2 pr-2">RSI</th>
                                                        <th className="pb-2">SL</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {wbResult.breakoutWatch.map((c: any, idx: number) => (
                                                        <tr key={idx} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-1.5 pr-3 font-medium text-[var(--foreground)]">
                                                                {c.symbol}
                                                                {c.isFnO && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-teal-500/20 text-teal-300">F&amp;O</span>}
                                                            </td>
                                                            <td className="py-1.5 pr-2 text-teal-400 font-medium">{c.weekendScore}</td>
                                                            <td className="py-1.5 pr-2 text-[var(--foreground)]">{c.pwHigh}</td>
                                                            <td className="py-1.5 pr-2 text-[var(--foreground)]">{c.pwRangePct}%</td>
                                                            <td className="py-1.5 pr-2">
                                                                <span className={`text-[9px] px-1 py-0.5 rounded ${c.baseClass === 'PERFECT_COIL' || c.baseClass === 'COILED_SPRING' ? 'bg-green-500/10 text-green-400' : c.baseClass === 'STRONG_BASE' || c.baseClass === 'VALID_BASE' ? 'bg-teal-500/10 text-teal-400' : 'bg-[var(--background)] text-[var(--foreground-muted)]'}`}>
                                                                    {c.baseClass === 'PERFECT_COIL' ? 'PERFECT' : c.baseClass === 'COILED_SPRING' ? 'COILED' : c.baseClass === 'STRONG_BASE' ? 'STRONG' : c.baseClass === 'VALID_BASE' ? 'VALID' : 'NONE'}
                                                                    {c.baseWeeks > 0 && ` ${c.baseWeeks}w`}
                                                                </span>
                                                            </td>
                                                            <td className="py-1.5 pr-2">
                                                                <span className={`text-[9px] px-1 py-0.5 rounded ${c.rsRank === 'VERY_STRONG' || c.rsRank === 'STRONG' ? 'bg-green-500/10 text-green-400' : c.rsRank === 'NEUTRAL' ? 'bg-[var(--background)] text-[var(--foreground-muted)]' : 'bg-red-500/10 text-red-400'}`}>{c.rsRank}</span>
                                                            </td>
                                                            <td className="py-1.5 pr-2">{c.nearHighZone ? <span className="text-green-400 text-[9px]">Near ATH</span> : <span className="text-[var(--foreground-muted)]">{Math.round(c.w52Position * 100)}%</span>}</td>
                                                            <td className="py-1.5 pr-2 text-[var(--foreground)]">{c.rsi14}</td>
                                                            <td className="py-1.5 text-red-400">{c.stopLoss}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Breakdown Watchlist */}
                                {wbResult.breakdownWatch && wbResult.breakdownWatch.length > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-red-400 mb-3 flex items-center gap-1.5">
                                            <TrendingDown size={14} /> Breakdown Watchlist ({wbResult.totalBreakdownCandidates})
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                        <th className="pb-2 pr-3">Symbol</th>
                                                        <th className="pb-2 pr-2">Score</th>
                                                        <th className="pb-2 pr-2">PW Low</th>
                                                        <th className="pb-2 pr-2">RSI</th>
                                                        <th className="pb-2">Target</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {wbResult.breakdownWatch.map((c: any, idx: number) => (
                                                        <tr key={idx} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-1.5 pr-3 font-medium text-[var(--foreground)]">{c.symbol}</td>
                                                            <td className="py-1.5 pr-2 text-red-400 font-medium">{c.weekendScore}</td>
                                                            <td className="py-1.5 pr-2 text-[var(--foreground)]">{c.pwLow}</td>
                                                            <td className="py-1.5 pr-2 text-[var(--foreground)]">{c.rsi14}</td>
                                                            <td className="py-1.5 text-red-400">{c.target}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Backtest Stats */}
                                {wbResult.backtest && wbResult.backtest.totalTrades > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-cyan-400 mb-3 flex items-center gap-1.5">
                                            <BarChart3 size={14} /> Backtest Performance (~1 Year)
                                        </h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                                            <div className="text-center"><div className="text-[10px] text-[var(--foreground-muted)]">Trades</div><div className="text-sm font-bold text-[var(--foreground)]">{wbResult.backtest.totalTrades}</div></div>
                                            <div className="text-center"><div className="text-[10px] text-[var(--foreground-muted)]">Win Rate</div><div className={`text-sm font-bold ${wbResult.backtest.winRatePct >= 55 ? 'text-green-400' : wbResult.backtest.winRatePct >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{wbResult.backtest.winRatePct}%</div></div>
                                            <div className="text-center"><div className="text-[10px] text-[var(--foreground-muted)]">Profit Factor</div><div className={`text-sm font-bold ${wbResult.backtest.profitFactor >= 1.5 ? 'text-green-400' : wbResult.backtest.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>{wbResult.backtest.profitFactor}</div></div>
                                            <div className="text-center"><div className="text-[10px] text-[var(--foreground-muted)]">Sharpe</div><div className={`text-sm font-bold ${wbResult.backtest.sharpeRatio >= 1 ? 'text-green-400' : wbResult.backtest.sharpeRatio >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>{wbResult.backtest.sharpeRatio}</div></div>
                                            <div className="text-center"><div className="text-[10px] text-[var(--foreground-muted)]">Avg PnL</div><div className={`text-sm font-bold ${wbResult.backtest.avgPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{wbResult.backtest.avgPnlPct}%</div></div>
                                            <div className="text-center"><div className="text-[10px] text-[var(--foreground-muted)]">Avg Hold</div><div className="text-sm font-bold text-teal-400">{wbResult.backtest.avgHoldDays}d</div></div>
                                        </div>
                                    </div>
                                )}

                                {/* Analytics Breakdown */}
                                {wbResult.analysis && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-teal-400 mb-3">Strategy Analytics</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {/* Monday Effect */}
                                            <div className="bg-[var(--card)] rounded-lg p-2">
                                                <div className="text-[9px] text-teal-400 mb-1">Monday Effect</div>
                                                <div className="text-[10px] text-[var(--foreground)]">
                                                    Mon: {wbResult.analysis.mondayEffect?.monday?.count || 0} trades, WR: {wbResult.analysis.mondayEffect?.monday?.winRate || 0}%
                                                </div>
                                                <div className="text-[10px] text-[var(--foreground-muted)]">
                                                    Other: {wbResult.analysis.mondayEffect?.nonMonday?.count || 0} trades, WR: {wbResult.analysis.mondayEffect?.nonMonday?.winRate || 0}%
                                                </div>
                                                {wbResult.analysis.mondayEffect?.edge != null && <div className={`text-[9px] mt-1 ${wbResult.analysis.mondayEffect.edge > 0 ? 'text-green-400' : 'text-red-400'}`}>Edge: {wbResult.analysis.mondayEffect.edge > 0 ? '+' : ''}{wbResult.analysis.mondayEffect.edge}%</div>}
                                            </div>
                                            {/* Entry Type */}
                                            <div className="bg-[var(--card)] rounded-lg p-2">
                                                <div className="text-[9px] text-cyan-400 mb-1">Entry Type</div>
                                                <div className="text-[10px] text-[var(--foreground)]">
                                                    Breakout: {wbResult.analysis.entryType?.breakout?.count || 0}, WR: {wbResult.analysis.entryType?.breakout?.winRate || 0}%
                                                </div>
                                                <div className="text-[10px] text-[var(--foreground-muted)]">
                                                    Retest: {wbResult.analysis.entryType?.retest?.count || 0}, WR: {wbResult.analysis.entryType?.retest?.winRate || 0}%
                                                </div>
                                            </div>
                                            {/* Base Effect */}
                                            <div className="bg-[var(--card)] rounded-lg p-2">
                                                <div className="text-[9px] text-teal-400 mb-1">Multi-Week Base</div>
                                                <div className="text-[10px] text-[var(--foreground)]">
                                                    With: {wbResult.analysis.baseEffect?.withBase?.count || 0}, WR: {wbResult.analysis.baseEffect?.withBase?.winRate || 0}%
                                                </div>
                                                <div className="text-[10px] text-[var(--foreground-muted)]">
                                                    Without: {wbResult.analysis.baseEffect?.noBase?.count || 0}, WR: {wbResult.analysis.baseEffect?.noBase?.winRate || 0}%
                                                </div>
                                            </div>
                                        </div>

                                        {/* Drawdown & Exit Reasons */}
                                        <div className="flex items-center gap-4 text-[10px] text-[var(--foreground-muted)] flex-wrap mt-3 pt-3 border-t border-[var(--card-border)]/30">
                                            <span>Max DD: <span className="text-red-400">{wbResult.analysis.maxDrawdownPct}%</span></span>
                                            <span>Best: <span className="text-green-400">+{wbResult.backtest.bestTrade}%</span></span>
                                            <span>Worst: <span className="text-red-400">{wbResult.backtest.worstTrade}%</span></span>
                                            <span>Max Loss Streak: <span className="text-red-400">{wbResult.backtest.maxConsecLosses}</span></span>
                                        </div>
                                    </div>
                                )}

                                {/* Exit Reasons */}
                                {wbResult.analysis?.byExitReason && (
                                    <div className="bg-[var(--background)] rounded-lg p-3">
                                        <div className="text-[10px] text-[var(--foreground-muted)] mb-2">Exit Reasons</div>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            {wbResult.analysis.byExitReason.map((r: any, i: number) => (
                                                <span key={i} className="text-[10px] px-2 py-1 rounded bg-[var(--card)] text-[var(--foreground)]">
                                                    {r.reason.replace(/_/g, ' ')}: {r.count} (<span className={r.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}>{r.avgPnl}%</span>)
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Top Stocks */}
                                {wbResult.topStocks && wbResult.topStocks.length > 0 && (
                                    <div className="bg-[var(--background)] rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-teal-400 mb-3 flex items-center gap-1.5">
                                            <BarChart3 size={14} /> Top Stocks by Win Rate
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead><tr className="text-left text-[var(--foreground-muted)] border-b border-[var(--card-border)]">
                                                    <th className="pb-2 pr-3">Symbol</th><th className="pb-2 pr-3">Trades</th><th className="pb-2 pr-3">Win%</th><th className="pb-2">Avg PnL</th>
                                                </tr></thead>
                                                <tbody>
                                                    {wbResult.topStocks.map((s: any, i: number) => (
                                                        <tr key={i} className="border-b border-[var(--card-border)]/30">
                                                            <td className="py-1.5 pr-3 font-medium text-[var(--foreground)]">{s.symbol}{s.isFnO && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-teal-500/20 text-teal-300">F&amp;O</span>}</td>
                                                            <td className="py-1.5 pr-3 text-[var(--foreground)]">{s.trades}</td>
                                                            <td className={`py-1.5 pr-3 font-medium ${s.winRate >= 55 ? 'text-green-400' : s.winRate >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{s.winRate}%</td>
                                                            <td className={`py-1.5 font-medium ${s.avgPnl > 0 ? 'text-green-400' : 'text-red-400'}`}>{s.avgPnl > 0 ? '+' : ''}{s.avgPnl}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Scan Stats */}
                                <div className="bg-[var(--background)] rounded-lg p-3">
                                    <div className="text-[10px] text-[var(--foreground-muted)] flex items-center gap-4 flex-wrap">
                                        <span>Scanned: {wbResult.totalStocksScanned}</span>
                                        <span>Errors: {wbResult.totalErrors}</span>
                                        <span>Breakout: {wbResult.totalBreakoutCandidates}</span>
                                        <span>Breakdown: {wbResult.totalBreakdownCandidates}</span>
                                        <span>Backtest: {wbResult.backtest?.totalTrades ?? 0} trades</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Other Timeframes — Coming Soon */}
            {activeTimeframe !== '1M' && activeTimeframe !== '1D' && activeTimeframe !== '1W' && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
                        <Clock size={40} className="text-cyan-400/60" />
                    </div>
                    <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Coming Soon</h2>
                    <p className="text-[var(--foreground-muted)] text-sm max-w-md">
                        {activeTimeframe} strategies are under development. Stay tuned for more research-backed strategies across all timeframes.
                    </p>
                </div>
            )}
        </div>
    )
}
