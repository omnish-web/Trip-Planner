import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, User, Save, Lock, ChevronDown, ChevronUp } from 'lucide-react'

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

    const [showPasswordChange, setShowPasswordChange] = useState(false)
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passwordError, setPasswordError] = useState('')

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

            // Handle Password Change
            if (showPasswordChange) {
                if (newPassword !== confirmPassword) {
                    throw new Error("Passwords do not match")
                }

                // Password Policy Validation
                if (newPassword.length < 6) throw new Error("Password must be at least 6 characters long")
                if (!/[A-Z]/.test(newPassword)) throw new Error("Password must contain at least one uppercase letter")
                if (!/[a-z]/.test(newPassword)) throw new Error("Password must contain at least one lowercase letter")
                if (!/[0-9]/.test(newPassword)) throw new Error("Password must contain at least one number")
                if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) throw new Error("Password must contain at least one special character")

                const { error: passwordUpdateError } = await supabase.auth.updateUser({ password: newPassword })
                if (passwordUpdateError) throw passwordUpdateError
            }

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

                    {/* Change Password Section */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <button
                            type="button"
                            onClick={() => setShowPasswordChange(!showPasswordChange)}
                            className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                Change Password
                            </div>
                            {showPasswordChange ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {showPasswordChange && (
                            <div className="mt-4 space-y-4 animate-fade-in pl-1">
                                <div>
                                    <label className="compact-label">New Password</label>
                                    <input
                                        type="password"
                                        className="compact-input"
                                        placeholder="Min 6 chars, A-Z, a-z, 0-9, special char"
                                        value={newPassword}
                                        onChange={e => {
                                            setNewPassword(e.target.value)
                                            setPasswordError('')
                                        }}
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        Must have 1 Uppercase, 1 Lowercase, 1 Number, 1 Special Char, Min 6 chars.
                                    </p>
                                </div>
                                <div>
                                    <label className="compact-label">Confirm Password</label>
                                    <input
                                        type="password"
                                        className="compact-input"
                                        placeholder="Retype new password"
                                        value={confirmPassword}
                                        onChange={e => {
                                            setConfirmPassword(e.target.value)
                                            setPasswordError('')
                                        }}
                                    />
                                </div>
                                {passwordError && (
                                    <p className="text-xs text-red-500">{passwordError}</p>
                                )}
                            </div>
                        )}
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
