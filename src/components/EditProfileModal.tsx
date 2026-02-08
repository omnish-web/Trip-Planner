import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, User, Save } from 'lucide-react'

interface EditProfileModalProps {
    onClose: () => void
    onSuccess: () => void
}

export default function EditProfileModal({ onClose, onSuccess }: EditProfileModalProps) {
    const [loading, setLoading] = useState(false)
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [userId, setUserId] = useState<string | null>(null)
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No user found')

            setUserId(user.id)
            setEmail(user.email || '')

            const { data, error } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single()

            if (error) throw error
            if (data) setFullName(data.full_name || '')

        } catch (error) {
            console.error('Error fetching profile:', error)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            if (!userId) throw new Error('User not authenticated')

            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName })
                .eq('id', userId)

            if (error) throw error

            setMessage({ type: 'success', text: 'Profile updated successfully!' })
            setTimeout(() => {
                onSuccess()
                onClose()
            }, 1000)

        } catch (error: any) {
            console.error('Error updating profile:', error)
            setMessage({ type: 'error', text: error.message || 'Failed to update profile' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="glass-panel w-full max-w-md p-6 bg-white dark:bg-gray-800 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    Edit Profile
                </h2>

                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'error'
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                        }`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="compact-label">Email</label>
                        <input
                            type="email"
                            disabled
                            className="compact-input bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-70"
                            value={email}
                        />
                        <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
                    </div>

                    <div>
                        <label className="compact-label">Full Name</label>
                        <input
                            type="text"
                            required
                            className="compact-input"
                            placeholder="John Doe"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full flex justify-center items-center gap-2 mt-4"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Changes
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
