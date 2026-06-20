
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, Mail, User, UserPlus, Users } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Participant {
    id: string
    name?: string
    parent_id?: string | null
    profiles?: {
        full_name?: string
        email?: string
    }
}

interface AddMemberModalProps {
    tripId: string
    onClose: () => void
    onSuccess: () => void
    participants?: Participant[] // Existing participants to enable parent linking
}

export default function AddMemberModal({ tripId, onClose, onSuccess, participants = [] }: AddMemberModalProps) {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [guestName, setGuestName] = useState('')
    const [isGuestMode, setIsGuestMode] = useState(false)
    const [parentId, setParentId] = useState<string>('') // Empty = independent member
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)

    // Filter to show only parent members (those without a parent_id)
    const parentMembers = participants.filter(p => !p.parent_id)

    const getParticipantName = (p: Participant) => {
        return p.profiles?.full_name || p.name || p.profiles?.email || 'Unknown'
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            if (isGuestMode) {
                // Add Guest
                const { error } = await supabase
                    .from('trip_participants')
                    .insert({
                        trip_id: tripId,
                        name: guestName,
                        role: 'editor',
                        parent_id: parentId || null
                    })
                if (error) throw error
                toast.success(`Guest "${guestName}" added!`)
            } else {
                // Invite Existing User
                const { data: profiles, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .eq('email', email)
                    .single()

                if (profileError || !profiles) {
                    throw new Error('User not found. Ask them to sign up first!')
                }

                const { error: inviteError } = await supabase
                    .from('trip_participants')
                    .insert({
                        trip_id: tripId,
                        user_id: profiles.id,
                        role: 'editor',
                        parent_id: parentId || null
                    })

                if (inviteError) {
                    if (inviteError.code === '23505') throw new Error('User is already in this trip')
                    throw inviteError
                }
                toast.success(`Invited ${profiles.full_name || email}`)
            }

            onSuccess()
            onClose()
        } catch (error: any) {
            console.error('Error adding member:', error)
            toast.error(error.message || 'Failed to add member')
            setMessage({ type: 'error', text: error.message || 'Failed to add member' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="glass-panel w-full max-w-md p-6 bg-white dark:bg-gray-800 relative animate-fade-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-blue-600" />
                    Add Member
                </h2>

                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'error'
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                        }`}>
                        {message.text}
                    </div>
                )}

                <div className="flex gap-4 mb-4 border-b border-gray-100 dark:border-gray-700">
                    <button
                        className={`pb-2 text-sm font-semibold ${!isGuestMode ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                        onClick={() => setIsGuestMode(false)}
                    >
                        Invite User
                    </button>
                    <button
                        className={`pb-2 text-sm font-semibold ${isGuestMode ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                        onClick={() => setIsGuestMode(true)}
                    >
                        Add Guest
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isGuestMode ? (
                        <div>
                            <label className="compact-label">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="email"
                                    required
                                    className="compact-input !pl-10"
                                    placeholder="friend@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                <strong>Note:</strong> Users must create an account on TripPlanner before you can invite them.
                            </p>
                        </div>
                    ) : (
                        <div>
                            <label className="compact-label">Guest Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    className="compact-input !pl-10"
                                    placeholder="e.g. Mom"
                                    value={guestName}
                                    onChange={e => setGuestName(e.target.value)}
                                />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Guests don't need an account. You manage their expenses.
                            </p>
                        </div>
                    )}

                    {/* Parent Link Option */}
                    {parentMembers.length > 0 && (
                        <div>
                            <label className="compact-label flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Link to Parent (Optional)
                            </label>
                            <select
                                value={parentId}
                                onChange={e => setParentId(e.target.value)}
                                className="compact-input"
                            >
                                <option value="">Independent Member (Pays own share)</option>
                                {parentMembers.map(p => (
                                    <option key={p.id} value={p.id}>
                                        Dependent of: {getParticipantName(p)}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Dependent members' shares are added to their parent's total.
                            </p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full flex justify-center items-center gap-2 mt-4"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isGuestMode ? 'Add Guest' : 'Send Invite')}
                    </button>
                </form>
            </div>
        </div>
    )
}
