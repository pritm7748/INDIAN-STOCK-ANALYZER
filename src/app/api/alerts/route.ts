// src/app/api/alerts/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  const activeOnly = searchParams.get('active') === 'true'

  let query = supabase
    .from('alerts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (symbol) {
    query = query.eq('symbol', symbol)
  }

  if (activeOnly) {
    query = query.eq('is_active', true).eq('is_triggered', false)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    
    const { data, error } = await supabase
      .from('alerts')
      .insert({
        user_id: user.id,
        symbol: body.symbol,
        stock_name: body.stockName,
        alert_type: body.alertType,
        condition: body.condition,
        notification_channels: body.notificationChannels || ['in_app'],
        is_recurring: body.isRecurring || false,
        expires_at: body.expiresAt || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Error creating alert:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Alert ID required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('alerts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating alert:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const ids = searchParams.get('ids')

  try {
    if (ids) {
      // Delete multiple
      const idArray = ids.split(',')
      const { error } = await supabase
        .from('alerts')
        .delete()
        .in('id', idArray)
        .eq('user_id', user.id)

      if (error) throw error
    } else if (id) {
      // Delete single
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
    } else {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting alert:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}