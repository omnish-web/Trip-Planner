
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Loader2, ArrowRight, User, MapPin, LogOut, CheckCircle2 } from 'lucide-react'

export default function Auth() {
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [isResetPassword, setIsResetPassword] = useState(false)
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
    const navigate = useNavigate()

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true)
        setMessage(null)
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/dashboard`,
                },
            })
            if (error) throw error
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message })
            setGoogleLoading(false)
        }
    }

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
        <div className="flex min-h-screen bg-[#060a1f] text-slate-200 font-work-sans relative overflow-hidden selection:bg-fuchsia-500/30 selection:text-fuchsia-100">
            {/* Immersive Twilight Background Elements */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                {/* Deep purple/pink ambient glow top right */}
                <div className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-bl from-fuchsia-600/20 via-purple-600/10 to-transparent blur-[120px] mix-blend-screen opacity-70 animate-[pulse_10s_ease-in-out_infinite]"></div>
                {/* Midnight blue ambient glow bottom left */}
                <div className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-tr from-blue-600/20 via-cyan-600/10 to-transparent blur-[100px] mix-blend-screen opacity-60"></div>
                {/* Subtle starlight noise opacity */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060a1f]/50 to-[#060a1f] pointer-events-none"></div>
            </div>

            {/* Split-Screen Layout elements (Left Side Branding) */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-[#0a0f2c]/40 backdrop-blur-3xl border-r border-white/5 z-10 flex-col justify-between p-16">
                <div className="relative z-20">
                    <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-sm flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(192,38,211,0.3)] border border-white/10 shrink-0">
                            <MapPin className="text-white w-6 h-6 drop-shadow-md" />
                        </div>
                        <span>Trip<span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400">Planner</span></span>
                    </h1>
                </div>

                <div className="relative z-20 mb-20">
                    <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40 capitalize tracking-tighter mb-6 pb-2 leading-tight">
                        Your journey <br /> begins here.
                    </h2>
                    <p className="text-slate-400 text-xl font-medium leading-relaxed max-w-md">
                        The smartest way to organize group trips, track shared expenses, and manage budgets seamlessly in a beautiful universe.
                    </p>
                </div>
            </div>

            {/* Right Box: Auth Form */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-1/2 lg:px-20 xl:px-24 relative z-10">
                <div className="mx-auto w-full max-w-md p-8 sm:p-10 rounded-[2rem] bg-[#0a0f2c]/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-fade-in-up">
                    <div className="mb-10 text-center lg:text-left">
                        {/* Mobile Logo */}
                        <div className="lg:hidden flex justify-center mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(192,38,211,0.3)] border border-white/10">
                                <MapPin className="text-white w-7 h-7 drop-shadow-md" />
                            </div>
                        </div>

                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
                            {isResetPassword
                                ? 'Reset Password'
                                : isSignUp
                                    ? 'Create Account'
                                    : 'Welcome Back'}
                        </h2>
                        <p className="text-slate-400 text-base font-medium">
                            {isResetPassword
                                ? 'We will send you a secure link.'
                                : isSignUp
                                    ? 'Enter your details to start planning.'
                                    : 'Enter your credentials to access your trips.'}
                        </p>
                    </div>

                    {message && (
                        <div className={`mb-6 p-4 rounded-xl text-sm border flex items-center gap-3 backdrop-blur-md ${message.type === 'error'
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            }`}>
                            {message.type === 'error' ? <LogOut className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
                            <span className="font-bold tracking-wide">{message.text}</span>
                        </div>
                    )}

                    {/* Google OAuth Button */}
                    {!isResetPassword && (
                        <>
                            <button
                                onClick={handleGoogleSignIn}
                                disabled={googleLoading}
                                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 border border-white/10 hover:border-white/20 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 text-sm font-bold text-white disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(0,0,0,0.2)] group outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                            >
                                {googleLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <svg className="h-5 w-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                )}
                                Continue with Google
                            </button>

                            <div className="relative my-8">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-white/10" />
                                </div>
                                <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                    <span className="bg-[#0b102c] px-4 rounded-full">Or continue with email</span>
                                </div>
                            </div>
                        </>
                    )}

                    <form onSubmit={handleAuth} className="space-y-5">
                        {isSignUp && !isResetPassword && (
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-3.5 h-5 w-5 text-slate-500 group-focus-within:text-fuchsia-400 transition-colors" />
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-[#060a1f]/50 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 block p-3.5 pl-12 shadow-inner transition-all hover:bg-[#060a1f]/80 outline-none"
                                        placeholder="John Doe"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-500 group-focus-within:text-fuchsia-400 transition-colors" />
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-[#060a1f]/50 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 block p-3.5 pl-12 shadow-inner transition-all hover:bg-[#060a1f]/80 outline-none"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        {!isResetPassword && (
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-500 group-focus-within:text-fuchsia-400 transition-colors" />
                                    <input
                                        type="password"
                                        required={!isResetPassword}
                                        className="w-full bg-[#060a1f]/50 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 block p-3.5 pl-12 shadow-inner transition-all hover:bg-[#060a1f]/80 outline-none"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                                {!isSignUp && (
                                    <div className="flex justify-between items-center mt-4">
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" id="remember" className="rounded border-white/10 bg-[#060a1f]/50 text-fuchsia-500 shadow-sm focus:border-fuchsia-500 focus:ring focus:ring-fuchsia-500/30 focus:ring-opacity-50" />
                                            <label htmlFor="remember" className="text-sm font-medium text-slate-400 cursor-pointer">Remember me</label>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsResetPassword(true)}
                                            className="text-sm font-bold text-fuchsia-400 hover:text-fuchsia-300 hover:underline transition-colors outline-none focus:ring-2 focus:ring-fuchsia-500/50 rounded"
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
                            className="w-full relative group bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-black rounded-xl text-sm px-5 py-4 text-center flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(192,38,211,0.4)] hover:shadow-[0_0_30px_rgba(192,38,211,0.6)] transform hover:-translate-y-0.5 transition-all duration-300 mt-8 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none outline-none focus:ring-4 focus:ring-fuchsia-500/30 overflow-hidden"
                        >
                            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] animate-[shimmer_2s_infinite]"></span>
                            {loading ? <Loader2 className="h-5 w-5 animate-spin relative z-10" /> : (
                                <>
                                    <span className="relative z-10 tracking-wide">{isResetPassword ? 'Send Reset Link' : (isSignUp ? 'Create Account' : 'Sign In')}</span>
                                    <ArrowRight className="h-5 w-5 relative z-10 transform group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm font-medium border-t border-white/5 pt-6">
                        {isResetPassword ? (
                            <button
                                onClick={() => setIsResetPassword(false)}
                                className="font-bold text-slate-400 hover:text-white hover:underline transition-colors outline-none focus:ring-2 focus:ring-fuchsia-500/50 rounded"
                            >
                                Back to Sign In
                            </button>
                        ) : (
                            <div className="flex items-center justify-center gap-2 text-slate-400">
                                <span>{isSignUp ? 'Already have an account?' : "Don't have an account?"}</span>
                                <button
                                    onClick={() => setIsSignUp(!isSignUp)}
                                    className="font-black text-indigo-400 hover:text-indigo-300 hover:underline transition-colors outline-none focus:ring-2 focus:ring-indigo-500/50 rounded"
                                >
                                    {isSignUp ? 'Sign in' : 'Sign up for free'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
