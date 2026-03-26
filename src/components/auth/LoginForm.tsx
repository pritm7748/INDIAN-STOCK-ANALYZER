// src/components/auth/LoginForm.tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SocialButtons } from './SocialButtons'
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from 'lucide-react'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.')
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please verify your email before signing in.')
        } else {
          setError(signInError.message)
        }
        return
      }

      if (data.user) {
        router.push(redirectTo)
        router.refresh()
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      console.error('Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Glass Card Container */}
      <div className="glass-card p-8 card-glow-primary">
        {/* Header */}
        <div className="text-center mb-8 stagger-children">
          <h1 className="text-3xl font-bold text-white mb-2 animate-fade-in-up font-display">Welcome back</h1>
          <p className="text-[#adaaaa] animate-fade-in-up">Sign in to continue to TradeSense AI</p>
        </div>

        {/* Social Login */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <SocialButtons redirectTo={redirectTo} />
        </div>

        {/* Divider */}
        <div className="relative my-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-transparent text-gray-500 backdrop-blur-sm">or continue with email</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl flex items-center gap-3 animate-scale-in backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 text-[#ff6e84] shrink-0 animate-pulse" />
            <p className="text-sm text-[#ff6e84]">{error}</p>
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
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

          {/* Password Field */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-sm font-medium text-[#adaaaa]">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-sm text-[#ba9eff] hover:text-[#a27cff] transition-colors duration-400 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#777575] group-focus-within:text-[#ba9eff] transition-colors duration-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-12 pr-12 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white placeholder-[#777575] focus:outline-none focus:ring-2 focus:ring-[#8455ef]/40 focus:border-transparent transition-all duration-400 hover:bg-white/[0.05]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#777575] hover:text-[#adaaaa] transition-colors duration-400 p-1 rounded-lg hover:bg-white/5"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#8455ef]/15 to-[#ba9eff]/15 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 -z-10 blur-xl" />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-[#8455ef] to-[#ba9eff] text-white font-medium rounded-full transition-all duration-400 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#8455ef]/25 hover:shadow-[#8455ef]/40 hover:-translate-y-0.5 active:translate-y-0 animate-fade-in-up group"
            style={{ animationDelay: '0.3s' }}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Sign Up Link */}
        <p className="mt-6 text-center text-[#adaaaa] animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
          Don't have an account?{' '}
          <Link
            href={`/signup${redirectTo !== '/dashboard' ? `?redirect=${redirectTo}` : ''}`}
            className="text-[#ba9eff] hover:text-[#a27cff] font-medium transition-colors duration-400 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}