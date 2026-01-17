// src/lib/hooks/useUser.ts
'use client'

import { useAuth } from '@/components/auth/AuthProvider'

export function useUser() {
  const { user, profile, session, isLoading, signOut, refreshProfile } = useAuth()
  
  return {
    user,
    profile,
    session,
    isLoading,
    isAuthenticated: !!user,
    signOut,
    refreshProfile,
    
    // Convenience getters
    userId: user?.id,
    email: user?.email,
    fullName: profile?.full_name || user?.user_metadata?.full_name || '',
    avatarUrl: profile?.avatar_url || user?.user_metadata?.avatar_url || '',
    notificationPreferences: profile?.notification_preferences || {
      email: false,
      telegram: false,
      browser_push: true,
      in_app: true
    }
  }
}