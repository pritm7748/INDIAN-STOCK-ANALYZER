// src/app/api/telegram/notify/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendAlertNotification } from '@/lib/alerts/telegram'

export async function POST(request: Request) {
  try {
    const { userId, symbol, message, currentValue, alertType } = await request.json()

    if (!userId || !symbol || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get user's telegram chat ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('telegram_chat_id, notification_preferences')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!profile?.telegram_chat_id) {
      console.log('No Telegram connected for user:', userId)
      return NextResponse.json({ error: 'No Telegram connected' }, { status: 404 })
    }

    // Check if telegram notifications are enabled
    const prefs = profile.notification_preferences as any
    if (!prefs?.telegram) {
      console.log('Telegram notifications disabled for user:', userId)
      return NextResponse.json({ message: 'Telegram notifications disabled' }, { status: 200 })
    }

    // Send notification
    const result = await sendAlertNotification(
      profile.telegram_chat_id,
      symbol,
      message,
      currentValue || 0,
      alertType || 'price'
    )

    if (!result.success) {
      console.error('Failed to send Telegram notification:', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    console.log(`✅ Telegram notification sent to user ${userId} for ${symbol}`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Telegram notify error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}