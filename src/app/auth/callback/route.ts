// src/app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirect = searchParams.get('redirect') || '/dashboard'
  const type = searchParams.get('type')

  if (code) {
    const supabase = await createClient()
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Handle password recovery
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/settings/account?reset=true`)
      }
      
      // Normal login/signup - redirect to intended page
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  // If something went wrong, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_error`)
}