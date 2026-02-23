// src/components/auth/SignupForm.tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SocialButtons } from './SocialButtons'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle, Loader2, Shield } from 'lucide-react'

export function SignupForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  const supabase = createClient()

  // Password strength checker
  const getPasswordStrength = (pass: string) => {
    let strength = 0
    if (pass.length >= 8) strength++
    if (/[A-Z]/.test(pass)) strength++
    if (/[a-z]/.test(pass)) strength++
    if (/[0-9]/.test(pass)) strength++
    if (/[^A-Za-z0-9]/.test(pass)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(password)
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColors = ['bg-rose-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-emerald-500']
  const strengthGlows = ['shadow-rose-500/30', 'shadow-orange-500/30', 'shadow-yellow-500/30', 'shadow-lime-500/30', 'shadow-emerald-500/30']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setIsLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${redirectTo}`,
        },
      })

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('This email is already registered. Please sign in instead.')
        } else {
          setError(signUpError.message)
        }
        return
      }

      if (data.user) {
        // Check if email confirmation is required
        if (data.user.identities?.length === 0) {
          setError('This email is already registered. Please sign in instead.')
          return
        }

        // If email confirmation is disabled in Supabase, user is signed in immediately
        if (data.session) {
          router.push(redirectTo)
          router.refresh()
        } else {
          // Email confirmation required
          setSuccess(true)
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      console.error('Signup error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Success state
  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="glass-card p-8 text-center card-glow-green">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-subtle">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 animate-fade-in-up">Check your email</h1>
          <p className="text-gray-400 mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            We've sent a confirmation link to <strong className="text-white">{email}</strong>.
            Click the link to verify your account.
          </p>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <p className="text-sm text-gray-400">
              Didn't receive the email? Check your spam folder or{' '}
              <button
                onClick={() => setSuccess(false)}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                try again
              </button>
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 mt-6 text-blue-400 hover:text-blue-300 transition-colors animate-fade-in-up"
            style={{ animationDelay: '0.3s' }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Glass Card Container */}
      <div className="glass-card p-8 card-glow-purple">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 animate-fade-in-up">Create an account</h1>
          <p className="text-gray-400 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>Get started with TradeSense AI for free</p>
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
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 animate-scale-in backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
            <p className="text-sm text-rose-400">{error}</p>
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name Field */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-2">
              Full name
            </label>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 hover:bg-white/[0.07] hover:border-white/20"
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email address
            </label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 hover:bg-white/[0.07] hover:border-white/20"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 hover:bg-white/[0.07] hover:border-white/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {password && (
              <div className="mt-3 space-y-2 animate-scale-in">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < passwordStrength ? `${strengthColors[passwordStrength - 1]} shadow-sm ${strengthGlows[passwordStrength - 1]}` : 'bg-gray-700'
                        }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Shield size={12} className={passwordStrength >= 4 ? 'text-emerald-400' : 'text-gray-500'} />
                  <p className="text-xs text-gray-500">
                    Password strength: <span className={`font-medium ${passwordStrength >= 3 ? 'text-emerald-400' : passwordStrength >= 2 ? 'text-yellow-400' : 'text-rose-400'}`}>
                      {strengthLabels[passwordStrength - 1] || 'Too short'}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
              Confirm password
            </label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className={`w-full pl-12 pr-4 py-3.5 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 hover:bg-white/[0.07] ${confirmPassword && confirmPassword !== password
                    ? 'border-rose-500/50'
                    : confirmPassword && confirmPassword === password
                      ? 'border-emerald-500/50'
                      : 'border-white/10 hover:border-white/20'
                  }`}
              />
              {confirmPassword && confirmPassword === password && (
                <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
              )}
            </div>
            {confirmPassword && confirmPassword !== password && (
              <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle size={12} /> Passwords do not match
              </p>
            )}
          </div>

          {/* Terms */}
          <p className="text-xs text-gray-500 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="text-blue-400 hover:text-blue-300 hover:underline">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300 hover:underline">Privacy Policy</Link>
          </p>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || (password !== confirmPassword)}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5 active:translate-y-0 animate-fade-in-up group"
            style={{ animationDelay: '0.45s' }}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Create account</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Sign In Link */}
        <p className="mt-6 text-center text-gray-400 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          Already have an account?{' '}
          <Link
            href={`/login${redirectTo !== '/dashboard' ? `?redirect=${redirectTo}` : ''}`}
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}