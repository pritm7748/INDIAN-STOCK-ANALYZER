// src/app/(auth)/login/page.tsx
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = {
  title: 'Sign In - TradeSense AI',
  description: 'Sign in to your TradeSense AI account',
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md mx-auto animate-pulse">
        <div className="h-8 bg-white/5 rounded mb-4" />
        <div className="h-4 bg-white/5 rounded w-2/3 mx-auto mb-8" />
        <div className="h-12 bg-white/5 rounded mb-4" />
        <div className="h-12 bg-white/5 rounded mb-4" />
        <div className="h-12 bg-white/5 rounded" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}