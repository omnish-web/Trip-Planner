
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react'

export default function Auth() {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [isResetPassword, setIsResetPassword] = useState(false)
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
    const navigate = useNavigate()

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            if (isResetPassword) {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/dashboard`,
                })
                if (error) throw error
                setMessage({ type: 'success', text: 'Password reset link sent! Check your email.' })
            } else if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                        },
                    },
                })
                if (error) throw error
                setMessage({ type: 'success', text: 'Signup successful! Please check your email for verification link.' })
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
                navigate('/dashboard')
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md p-8 animate-fade-in">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">
                        Trip<span className="text-blue-600 dark:text-blue-400">Planner</span>
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {isResetPassword
                            ? 'Reset your password'
                            : isSignUp
                                ? 'Create an account to start planning'
                                : 'Welcome back to your trips'}
                    </p>
                </div>

                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'error'
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                        }`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && !isResetPassword && (
                        <div>
                            <label className="compact-label">Full Name</label>
                            <input
                                type="text"
                                required
                                className="compact-input"
                                placeholder="John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        </div>
                    )}

                    <div>
                        <label className="compact-label">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="email"
                                required
                                className="compact-input !pl-10"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    {!isResetPassword && (
                        <div>
                            <label className="compact-label">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="password"
                                    required={!isResetPassword}
                                    className="compact-input !pl-10"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            {!isSignUp && (
                                <div className="flex justify-end mt-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsResetPassword(true)}
                                        className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary flex justify-center items-center gap-2 mt-6"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            <>
                                {isResetPassword ? 'Send Reset Link' : (isSignUp ? 'Sign Up' : 'Sign In')}
                                <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm">
                    {isResetPassword ? (
                        <button
                            onClick={() => setIsResetPassword(false)}
                            className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline"
                        >
                            Back to Sign In
                        </button>
                    ) : (
                        <>
                            <span className="text-gray-500 dark:text-gray-400">
                                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                            </span>
                            <button
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="ml-2 font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline"
                            >
                                {isSignUp ? 'Sign in' : 'Sign up'}
                            </button>
                        </>
                    )}
                </div>
            </div >
        </div >
    )
}
