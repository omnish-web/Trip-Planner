import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, Key, User, UserPlus, Users, Search, Trash2, Check, Send, Inbox, CheckCircle, AlertCircle, Copy } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useTripInvites, useTripReceivedInvite, usePastInvitees, useJoinRequests, useRespondToJoinRequest } from '../hooks/useTripData'
import { useQueryClient } from '@tanstack/react-query'

interface Participant {
    id: string
    user_id?: string
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
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState<Mode>('invite')
    const [usernameId, setUsernameId] = useState('')
    const [passcode, setPasscode] = useState('')
    const [guestName, setGuestName] = useState('')
    const [parentId, setParentId] = useState<string>('') // Empty = independent member
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)

    // Live user lookup state for Send Invite form
    const [foundUser, setFoundUser] = useState<{ id: string, full_name: string, username_id: string } | null>(null)
    const [lookupLoading, setLookupLoading] = useState(false)

    const queryClient = useQueryClient()

    // Debounced live lookup: fires 400ms after the inviter stops typing
    useEffect(() => {
        const trimmed = usernameId.trim().toUpperCase()
        // Only lookup when we have a complete 6-char User-ID (both invite and direct modes)
        if ((mode !== 'invite' && mode !== 'direct') || trimmed.length < 6) {
            setFoundUser(null)
            setLookupLoading(false)
            return
        }
        setLookupLoading(true)
        const timer = setTimeout(async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, username_id')
                .eq('username_id', trimmed)
                .single()
            setFoundUser(data || null)
            setLookupLoading(false)
        }, 400)
        return () => clearTimeout(timer)
    }, [usernameId, mode])

    // Fetch pending invites for the "Manage Invites" tab (sent by current user for this trip)
    const { data: tripInvites = [], refetch: refetchInvites } = useTripInvites(tripId)
    // Fetch invitations received by current user for this specific trip
    const { data: receivedInvite = [], refetch: refetchReceived } = useTripReceivedInvite(tripId)
    // Fetch pending join requests for this trip
    const { data: joinRequests = [], refetch: refetchJoinRequests } = useJoinRequests(tripId)
    const respondToJoinRequest = useRespondToJoinRequest()
    // Fetch past invitees for quick suggestions
    const { data: pastInvitees = [] } = usePastInvitees()

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
                    throw new Error('User not found. Please check the Traveller ID!')
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
                // Invalidate caches so InvitationsHub and Manage Invites reflect the new invite immediately
                queryClient.invalidateQueries({ queryKey: ['sentInvites'] })
                queryClient.invalidateQueries({ queryKey: ['tripInvites', tripId] })
                queryClient.invalidateQueries({ queryKey: ['myInvites'] })
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

    const handleQuickAction = async (targetUser: { id: string, username_id: string, full_name: string }) => {
        setLoading(true)
        setMessage(null)
        try {
            if (mode === 'invite') {
                const { error: inviteError } = await supabase.rpc('send_trip_invitation', {
                    p_trip_id: tripId,
                    p_invitee_id: targetUser.id
                })
                if (inviteError) throw inviteError
                toast.success(`Invitation sent to ${targetUser.full_name}!`)
                queryClient.invalidateQueries({ queryKey: ['sentInvites'] })
                queryClient.invalidateQueries({ queryKey: ['tripInvites', tripId] })
                queryClient.invalidateQueries({ queryKey: ['myInvites'] })
            } else if (mode === 'direct') {
                // If direct adding, populate the username_id so they only need to enter the passcode
                setUsernameId(targetUser.username_id)
                toast.success(`Selected ${targetUser.full_name}. Please enter their passcode to add them.`)
                setLoading(false)
                return
            }
            onSuccess()
            onClose()
        } catch (error: any) {
            console.error('Error in quick action:', error)
            toast.error(error.message || 'Action failed')
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

    const handleRespondToInvite = async (inviteId: string, status: 'accepted' | 'rejected') => {
        try {
            if (status === 'accepted') {
                const { error } = await supabase.rpc('accept_trip_invitation', { p_invite_id: inviteId })
                if (error) throw error
                toast.success('Invitation accepted! Welcome to the trip.')
                queryClient.invalidateQueries({ queryKey: ['trips'] })
                onSuccess()
            } else {
                const { error } = await supabase
                    .from('trip_invitations')
                    .update({ status: 'rejected' })
                    .eq('id', inviteId)
                if (error) throw error
                toast.success('Invitation rejected.')
            }
            refetchReceived()
            refetchInvites()
        } catch (err: any) {
            toast.error(err.message || 'Failed to respond to invite')
        }
    }

    const handleRespondToJoinRequest = async (requestId: string, approve: boolean) => {
        try {
            setLoading(true)
            await respondToJoinRequest.mutateAsync({ requestId, approve })
            toast.success(approve ? 'Request approved!' : 'Request rejected.')
            refetchJoinRequests()
            onSuccess()
        } catch (err: any) {
            toast.error(err.message || 'Failed to respond to request')
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
                            refetchReceived()
                            refetchJoinRequests()
                        }}
                    >
                        Manage Invites
                        {(tripInvites.length + receivedInvite.length + joinRequests.length) > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
                                {tripInvites.length + receivedInvite.length + joinRequests.length}
                            </span>
                        )}
                    </button>
                </div>

                {mode === 'manage' ? (
                    <div className="space-y-5">

                        {/* ── Sent Invitations ── */}
                        <div>
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                                <Send className="w-3 h-3" /> Sent Invitations
                            </h3>
                            {tripInvites.length === 0 ? (
                                <div className="text-center py-4 text-gray-400 dark:text-gray-500">
                                    <p className="text-sm">No invitations sent for this trip.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
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
                                                    {invite.invitee?.username_id && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                navigator.clipboard.writeText(invite.invitee.username_id)
                                                                toast.success(`Copied Traveller ID: ${invite.invitee.username_id}`)
                                                            }}
                                                            className="group/id mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-blue-900/30 border border-gray-200/60 dark:border-gray-700/50 text-[10px] font-mono text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all shrink-0"
                                                            title="Click to copy Traveller ID"
                                                        >
                                                            <span>ID: {invite.invitee.username_id}</span>
                                                            <Copy className="w-2.5 h-2.5 opacity-0 group-hover/id:opacity-100 transition-opacity" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleCancelInvite(invite.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                                                title="Revoke / Cancel Invitation"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Received Invitations ── */}
                        <div>
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                                <Inbox className="w-3 h-3" /> Received Invitations
                            </h3>
                            {receivedInvite.length === 0 ? (
                                <div className="text-center py-4 text-gray-400 dark:text-gray-500">
                                    <p className="text-sm">No received invitations for this trip.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                                    {receivedInvite.map((invite: any) => (
                                        <div key={invite.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-purple-100 text-purple-700">
                                                    {(invite.inviter?.full_name?.[0] || 'U').toUpperCase()}
                                                </div>
                                                <div className="truncate">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                                            From: <strong>{invite.inviter?.full_name || 'Someone'}</strong>
                                                        </p>
                                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                                                            invite.status === 'accepted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                            invite.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                            'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                                        }`}>
                                                            {invite.status}
                                                        </span>
                                                    </div>
                                                    {invite.inviter?.username_id && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                navigator.clipboard.writeText(invite.inviter.username_id)
                                                                toast.success(`Copied Traveller ID: ${invite.inviter.username_id}`)
                                                            }}
                                                            className="group/id mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-blue-900/30 border border-gray-200/60 dark:border-gray-700/50 text-[10px] font-mono text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all shrink-0"
                                                            title="Click to copy Traveller ID"
                                                        >
                                                            <span>ID: {invite.inviter.username_id}</span>
                                                            <Copy className="w-2.5 h-2.5 opacity-0 group-hover/id:opacity-100 transition-opacity" />
                                                        </button>
                                                    )}
                                                    <p className="text-[10px] text-gray-400 mt-1">{new Date(invite.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            {invite.status === 'pending' ? (
                                                <div className="flex gap-1 shrink-0">
                                                    <button
                                                        onClick={() => handleRespondToInvite(invite.id, 'accepted')}
                                                        className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                        title="Accept"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRespondToInvite(invite.id, 'rejected')}
                                                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                                        title="Reject"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={async () => {
                                                        const { error } = await supabase
                                                            .from('trip_invitations')
                                                            .update({ invitee_deleted: true })
                                                            .eq('id', invite.id)
                                                        if (!error) { toast.success('Hidden from history'); refetchReceived() }
                                                        else toast.error('Failed to hide')
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                                                    title="Hide from history"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Join Requests ── */}
                        {joinRequests.length > 0 && (
                            <div>
                                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                                    <Users className="w-3 h-3" /> Join Requests
                                </h3>
                                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                                    {joinRequests.map((req: any) => (
                                        <div key={req.id} className="flex items-center justify-between p-3 bg-fuchsia-500/5 dark:bg-fuchsia-500/5 rounded-lg border border-fuchsia-100 dark:border-fuchsia-900/20">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400">
                                                    {(req.requester?.full_name?.[0] || 'U').toUpperCase()}
                                                </div>
                                                <div className="truncate">
                                                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                                        {req.requester?.full_name || 'Unknown User'}
                                                    </p>
                                                    {req.requester?.username_id && (
                                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">ID: {req.requester.username_id}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button
                                                    onClick={() => handleRespondToJoinRequest(req.id, true)}
                                                    disabled={loading}
                                                    className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Approve Request"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleRespondToJoinRequest(req.id, false)}
                                                    disabled={loading}
                                                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Reject Request"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'invite' && (
                        <div>
                            <label className="compact-label">Traveller ID</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    className="compact-input !pl-10 font-mono uppercase"
                                    placeholder="e.g. 8F2A9B"
                                    maxLength={6}
                                    value={usernameId}
                                    onChange={e => setUsernameId(e.target.value.toUpperCase())}
                                />
                                {lookupLoading && (
                                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 animate-spin" />
                                )}
                            </div>

                            {/* ── Live user preview ── */}
                            {!lookupLoading && foundUser && (
                                <>
                                    <div className="mt-2 flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 animate-fade-in">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
                                            {(foundUser.full_name?.[0] || 'U').toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                                                {foundUser.full_name || 'Unknown User'}
                                            </p>
                                            <p className="text-[11px] text-emerald-600/70 dark:text-emerald-500 font-mono">
                                                ID: {foundUser.username_id}
                                            </p>
                                        </div>
                                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                                    </div>
                                    {participants.some(p => p.user_id === foundUser.id) && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1.5">
                                            <AlertCircle className="w-3 h-3 shrink-0" />
                                            This user is already a member of this trip.
                                        </p>
                                    )}
                                </>
                            )}

                            {!lookupLoading && !foundUser && usernameId.trim().length >= 6 && (
                                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1 mt-2">
                                    <AlertCircle className="w-3 h-3 shrink-0" /> No user found with this ID.
                                </p>
                            )}

                            {usernameId.trim().length < 6 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    Send a notification to this user to join your trip. They must approve the invite.
                                </p>
                            )}

                            {/* ── Quick Suggestions ── */}
                            {usernameId.trim() === '' && pastInvitees.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                    <label className="compact-label mb-2 flex items-center gap-1">
                                        <Users className="w-3 h-3 text-blue-500" /> Quick Re-invite
                                    </label>
                                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                        {pastInvitees
                                            .filter((p: any) => !participants.some((curr: any) => curr.user_id === p.id))
                                            .map((user: any) => (
                                                <div key={user.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{user.full_name}</p>
                                                        <p className="text-[10px] text-gray-500 font-mono">ID: {user.username_id}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={loading}
                                                        onClick={() => handleQuickAction(user)}
                                                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                                                    >
                                                        Invite
                                                    </button>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {mode === 'direct' && (
                        <>
                            <div>
                                <label className="compact-label">Traveller ID</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        className="compact-input !pl-10 font-mono uppercase"
                                        placeholder="e.g. 8F2A9B"
                                        maxLength={6}
                                        value={usernameId}
                                        onChange={e => setUsernameId(e.target.value.toUpperCase())}
                                    />
                                    {lookupLoading && (
                                        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 animate-spin" />
                                    )}
                                </div>

                                {/* ── Live user preview ── */}
                                {!lookupLoading && foundUser && (
                                    <>
                                        <div className="mt-2 flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 animate-fade-in">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
                                                {(foundUser.full_name?.[0] || 'U').toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                                                    {foundUser.full_name || 'Unknown User'}
                                                </p>
                                                <p className="text-[11px] text-emerald-600/70 dark:text-emerald-500 font-mono">
                                                    ID: {foundUser.username_id}
                                                </p>
                                            </div>
                                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                                        </div>
                                        {participants.some(p => p.user_id === foundUser.id) && (
                                            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1.5">
                                                <AlertCircle className="w-3 h-3 shrink-0" />
                                                This user is already a member of this trip.
                                            </p>
                                        )}
                                    </>
                                )}

                                {!lookupLoading && !foundUser && usernameId.trim().length >= 6 && (
                                    <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1 mt-2">
                                        <AlertCircle className="w-3 h-3 shrink-0" /> No user found with this ID.
                                    </p>
                                )}

                                {/* ── Quick Suggestions ── */}
                                {usernameId.trim() === '' && pastInvitees.length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                        <label className="compact-label mb-2 flex items-center gap-1">
                                            <Users className="w-3 h-3 text-blue-500" /> Quick Add
                                        </label>
                                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                            {pastInvitees
                                                .filter((p: any) => !participants.some((curr: any) => curr.user_id === p.id))
                                                .map((user: any) => (
                                                    <div key={user.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs">
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{user.full_name}</p>
                                                            <p className="text-[10px] text-gray-500 font-mono">ID: {user.username_id}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={loading}
                                                            onClick={() => handleQuickAction(user)}
                                                            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                                                        >
                                                            Select
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
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
