// src/app/api/screener/scanner/route.ts

import { NextResponse } from 'next/server'
import {
    startFullScan,
    getScanProgress,
    getCacheStats,
    initializeCache
} from '@/lib/screener/screener-cache'

// POST - Start a new scan
export async function POST() {
    try {
        // Ensure cache is initialized
        await initializeCache()

        const progress = await startFullScan()

        return NextResponse.json({
            message: 'Scan started',
            ...progress
        })
    } catch (error: any) {
        console.error('Scanner error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to start scan' },
            { status: 500 }
        )
    }
}

// GET - Check scan progress
export async function GET() {
    try {
        await initializeCache()

        const progress = getScanProgress()
        const stats = getCacheStats()

        return NextResponse.json({
            scan: progress,
            cache: stats,
            timestamp: new Date().toISOString()
        })
    } catch (error: any) {
        console.error('Scanner status error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to get status' },
            { status: 500 }
        )
    }
}
