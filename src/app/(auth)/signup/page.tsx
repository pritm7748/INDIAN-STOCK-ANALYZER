// src/app/(auth)/signup/page.tsx
import { Suspense } from 'react'
import { SignupForm } from '@/components/auth/SignupForm'

export const metadata = {
  title: 'Sign Up - TradeSense AI',
  description: 'Create your TradeSense AI account',
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md mx-auto animate-pulse">
        <div className="h-8 bg-white/5 rounded mb-4" />
        <div className="h-4 bg-white/5 rounded w-2/3 mx-auto mb-8" />
        <div className="h-12 bg-white/5 rounded mb-4" />
        <div className="h-12 bg-white/5 rounded mb-4" />
        <div className="h-12 bg-white/5 rounded mb-4" />
        <div className="h-12 bg-white/5 rounded" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}