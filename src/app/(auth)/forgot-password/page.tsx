// src/app/(auth)/forgot-password/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, ArrowLeft, AlertCircle, CheckCircle, Loader2, KeyRound } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      console.error('Password reset error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="glass-card p-8 text-center card-glow-green">
          <div className="w-20 h-20 bg-gradient-to-br from-[#69f6b8]/15 to-[#22d3ee]/15 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-subtle">
            <CheckCircle className="w-10 h-10 text-[#69f6b8]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 animate-fade-in-up font-display">Check your email</h1>
          <p className="text-[#adaaaa] mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            We've sent a password reset link to <strong className="text-white">{email}</strong>
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[#ba9eff] hover:text-[#a27cff] transition-colors duration-400 group animate-fade-in-up"
            style={{ animationDelay: '0.2s' }}
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Glass Card Container */}
      <div className="glass-card p-8 card-glow-primary">
        {/* Back Link */}
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-[#adaaaa] hover:text-white transition-colors duration-400 mb-8 group animate-fade-in-down"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to sign in
        </Link>

        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#8455ef]/15 to-[#ba9eff]/15 rounded-xl flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-[#ba9eff]" />
            </div>
            <h1 className="text-3xl font-bold text-white font-display">Forgot password?</h1>
          </div>
          <p className="text-[#adaaaa]">
            No worries, we'll send you reset instructions.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl flex items-center gap-3 animate-scale-in backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 text-[#ff6e84] shrink-0 animate-pulse" />
            <p className="text-sm text-[#ff6e84]">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <label htmlFor="email" className="block text-sm font-medium text-[#adaaaa] mb-2">
              Email address
            </label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#777575] group-focus-within:text-[#ba9eff] transition-colors duration-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full pl-12 pr-4 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white placeholder-[#777575] focus:outline-none focus:ring-2 focus:ring-[#8455ef]/40 focus:border-transparent transition-all duration-400 hover:bg-white/[0.05]"
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#8455ef]/15 to-[#ba9eff]/15 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 -z-10 blur-xl" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-[#8455ef] to-[#ba9eff] text-white font-medium rounded-full transition-all duration-400 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#8455ef]/25 hover:shadow-[#8455ef]/40 hover:-translate-y-0.5 active:translate-y-0 animate-fade-in-up"
            style={{ animationDelay: '0.15s' }}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Send reset link'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}