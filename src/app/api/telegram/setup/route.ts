// src/app/api/telegram/setup/route.ts

import { NextResponse } from 'next/server'
import { setTelegramWebhook, getWebhookInfo } from '@/lib/alerts/telegram'

// GET - Get current webhook info
export async function GET() {
  try {
    const info = await getWebhookInfo()
    return NextResponse.json(info)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Set the webhook
export async function POST(request: Request) {
  try {
    // Optional: Add authentication here to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await setTelegramWebhook()
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Get the updated info
    const info = await getWebhookInfo()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook configured successfully',
      webhookInfo: info
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}