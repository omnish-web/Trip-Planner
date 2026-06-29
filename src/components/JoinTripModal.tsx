import { useState, useEffect } from 'react'
import { X, Loader2, Key, Sparkles } from 'lucide-react'
import { useJoinTripInstantly, useRequestTripJoin } from '../hooks/useTripData'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

interface JoinTripModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function JoinTripModal({ isOpen, onClose }: JoinTripModalProps) {
    const navigate = useNavigate()
    const [shareCode, setShareCode] = useState('')
    const [tripKey, setTripKey] = useState('')
    const [loading, setLoading] = useState(false)

    const joinInstantly = useJoinTripInstantly()
    const requestJoin = useRequestTripJoin()

    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!shareCode.trim()) {
            toast.error('Please enter a Trip ID.')
            return
        }

        setLoading(true)
        const trimmedCode = shareCode.trim().toUpperCase()
        const trimmedKey = tripKey.trim()

        try {
            if (trimmedKey) {
                // Dual path: Join instantly with ID + Key
                const res = await joinInstantly.mutateAsync({
                    shareCode: trimmedCode,
                    tripKey: trimmedKey
                })
                if (res.success) {
                    if (res.already_member) {
                        toast.success('You are already a member of this trip!')
                    } else {
                        toast.success('Successfully joined the trip!')
                    }
                    navigate(`/trip/${res.trip_id}`)
                    onClose()
                }
            } else {
                // Request to join with ID only
                const res = await requestJoin.mutateAsync({
                    shareCode: trimmedCode
                })
                if (res.success) {
                    if (res.already_member) {
                        toast.success('You are already a member of this trip!')
                        navigate(`/trip/${res.trip_id}`)
                    } else {
                        toast.success('Join request sent to the trip owner!')
                    }
                    onClose()
                }
            }
        } catch (err: any) {
            console.error(err)
            toast.error(err.message || 'Failed to join trip. Check your Trip ID / Key.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-md p-8 rounded-[2rem] relative bg-[#0a0f2c]/90 border border-white/10 shadow-[0_0_50px_rgba(192,38,211,0.15)] overflow-hidden">
                {/* Background decorative glow */}
                <div className="absolute -top-[30%] -right-[30%] w-[60%] h-[60%] rounded-full bg-gradient-to-bl from-fuchsia-500/20 to-transparent blur-[50px] pointer-events-none" />
                <div className="absolute -bottom-[30%] -left-[30%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-indigo-500/20 to-transparent blur-[50px] pointer-events-none" />

                <button
                    onClick={onClose}
                    className="absolute right-6 top-6 text-slate-400 hover:text-white transition-colors w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/5"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col items-center text-center mb-8 relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-600/20 border border-fuchsia-500/30 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(192,38,211,0.1)]">
                        <Key className="w-6 h-6 text-fuchsia-400" />
                    </div>
                    <h3 className="text-2xl font-black text-white tracking-tight mb-2">Join a Trip</h3>
                    <p className="text-sm text-slate-400 max-w-xs">
                        Enter a Trip ID to request access, or add a Trip Key to join instantly.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Trip ID <span className="text-rose-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={shareCode}
                            onChange={(e) => setShareCode(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0c1236]/80 border border-white/10 focus:border-fuchsia-500/50 rounded-xl text-white placeholder-slate-600 text-sm font-medium outline-none focus:ring-2 focus:ring-fuchsia-500/20 transition-all uppercase"
                            placeholder="e.g., 7X9A2B"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                            <span>Trip Key</span>
                            <span className="text-[10px] font-normal lowercase text-slate-500">optional for instant join</span>
                        </label>
                        <input
                            type="text"
                            value={tripKey}
                            onChange={(e) => setTripKey(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0c1236]/80 border border-white/10 focus:border-indigo-500/50 rounded-xl text-white placeholder-slate-600 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            placeholder="e.g., 827190"
                        />
                    </div>

                    <div className="bg-white/5 border border-white/5 p-4 rounded-xl flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-slate-400 leading-relaxed">
                            {tripKey.trim() ? (
                                <span>You have entered a Trip Key. You will be added to the trip <strong className="text-indigo-300">instantly</strong> as a member.</span>
                            ) : (
                                <span>No Trip Key entered. This will send a <strong className="text-fuchsia-300">join request</strong> to the trip owner for approval.</span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white font-bold text-sm transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-5 py-3 bg-gradient-to-r from-fuchsia-500 to-indigo-600 hover:brightness-110 text-white rounded-xl font-black text-sm shadow-lg hover:shadow-[0_0_20px_rgba(192,38,211,0.2)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : tripKey.trim() ? (
                                'Join Instantly'
                            ) : (
                                'Request to Join'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
