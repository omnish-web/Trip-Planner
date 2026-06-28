import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, Key, User, UserPlus, Users, Search, Mail, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useTripInvites } from '../hooks/useTripData'

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

type Mode = 'invite' | 'direct' | 'guest' | 'manage'

export default function AddMemberModal({ tripId, onClose, onSuccess, participants = [] }: AddMemberModalProps) {
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState<Mode>('invite')
    const [usernameId, setUsernameId] = useState('')
    const [passcode, setPasscode] = useState('')
    const [guestName, setGuestName] = useState('')
    const [parentId, setParentId] = useState<string>('') // Empty = independent member
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
    
    // Fetch pending invites for the "Manage Invites" tab
    const { data: tripInvites = [], refetch: refetchInvites } = useTripInvites(tripId)

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
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            if (mode === 'guest') {
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
            } else if (mode === 'invite') {
                // Invite Existing User by User-ID
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .eq('username_id', usernameId)
                    .single()

                if (profileError || !profile) {
                    throw new Error('User not found. Please check the User-ID!')
                }

                // Check if user is already a member
                const isAlreadyMember = participants.some(p => p.user_id === profile.id)
                if (isAlreadyMember) {
                    throw new Error('This user is already a member of the trip.')
                }

                const { error: inviteError } = await supabase.rpc('send_trip_invitation', {
                    p_trip_id: tripId,
                    p_invitee_id: profile.id
                })

                if (inviteError) {
                    throw new Error(inviteError.message || 'Failed to send invitation')
                }
                toast.success(`Invitation sent to ${profile.full_name || usernameId}!`)
            } else if (mode === 'direct') {
                // Direct Add via RPC
                const { data: res, error: rpcError } = await supabase.rpc('direct_add_user', {
                    p_username_id: usernameId,
                    p_passcode: passcode,
                    p_trip_id: tripId
                })

                if (rpcError) throw new Error(rpcError.message || 'Direct add failed')
                
                // If they need to be a dependent, update their parent_id
                if (parentId && res?.user_id) {
                    await supabase
                        .from('trip_participants')
                        .update({ parent_id: parentId })
                        .eq('trip_id', tripId)
                        .eq('user_id', res.user_id)
                }

                toast.success('User successfully added to trip!')
            }

            onSuccess()
            if (mode !== 'manage') onClose()
        } catch (error: any) {
            console.error('Error adding member:', error)
            toast.error(error.message || 'Failed to add member')
            setMessage({ type: 'error', text: error.message || 'Failed to add member' })
        } finally {
            setLoading(false)
        }
    }

    const handleCancelInvite = async (inviteId: string) => {
        try {
            const { error } = await supabase
                .from('trip_invitations')
                .update({ inviter_deleted: true })
                .eq('id', inviteId)

            if (error) throw error
            toast.success('Invitation hidden/revoked')
            refetchInvites()
        } catch (err: any) {
            toast.error(err.message || 'Failed to cancel invitation')
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

                <div className="flex gap-4 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2 overflow-x-auto no-scrollbar">
                    <button
                        className={`text-sm font-semibold whitespace-nowrap transition-colors ${mode === 'invite' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setMode('invite')}
                    >
                        Send Invite
                    </button>
                    <button
                        className={`text-sm font-semibold whitespace-nowrap transition-colors ${mode === 'direct' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setMode('direct')}
                    >
                        Direct Add
                    </button>
                    <button
                        className={`text-sm font-semibold whitespace-nowrap transition-colors ${mode === 'guest' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setMode('guest')}
                    >
                        Add Guest
                    </button>
                    <button
                        className={`text-sm font-semibold whitespace-nowrap transition-colors ${mode === 'manage' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => {
                            setMode('manage')
                            refetchInvites()
                        }}
                    >
                        Manage Invites
                        {tripInvites.length > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
                                {tripInvites.length}
                            </span>
                        )}
                    </button>
                </div>

                {mode === 'manage' ? (
                    <div className="space-y-4">
                        {tripInvites.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No invitations for this trip.</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {tripInvites.map((invite: any) => (
                                    <div key={invite.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-blue-100 text-blue-700">
                                                {(invite.invitee?.full_name?.[0] || 'U').toUpperCase()}
                                            </div>
                                            <div className="truncate">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                                        {invite.invitee?.full_name || 'Unknown User'}
                                                    </p>
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                                                        invite.status === 'accepted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                                                        invite.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                        'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                                    }`}>
                                                        {invite.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 font-mono">ID: {invite.invitee?.username_id}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleCancelInvite(invite.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                                            title="Cancel Invitation"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'invite' && (
                        <div>
                            <label className="compact-label">User-ID</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    className="compact-input !pl-10 font-mono"
                                    placeholder="e.g. 8F2A9B"
                                    value={usernameId}
                                    onChange={e => setUsernameId(e.target.value)}
                                />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Send a notification to this user to join your trip. They must approve the invite.
                            </p>
                        </div>
                    )}
                    
                    {mode === 'direct' && (
                        <>
                            <div>
                                <label className="compact-label">User-ID</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        className="compact-input !pl-10 font-mono"
                                        placeholder="e.g. 8F2A9B"
                                        value={usernameId}
                                        onChange={e => setUsernameId(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="compact-label">Secret Passcode</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        className="compact-input !pl-10 font-mono"
                                        placeholder="e.g. X72Y9Z"
                                        value={passcode}
                                        onChange={e => setPasscode(e.target.value)}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    Entering their secret passcode adds them instantly without needing their approval.
                                </p>
                            </div>
                        </>
                    )}

                    {mode === 'guest' && (
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
                        className="btn-primary w-full flex justify-center items-center gap-2 mt-4 bg-blue-600 hover:bg-blue-700"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                            mode === 'guest' ? 'Add Guest' : 
                            mode === 'direct' ? 'Add Instantly' : 'Send Invite'
                        )}
                    </button>
                </form>
                )}
            </div>
        </div>
    )
}
