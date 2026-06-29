import { useState, useEffect } from 'react'
import { X, Mail, Check, Trash2, Send, Inbox } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useReceivedInvites, useSentInvites, useAllIncomingJoinRequests, useMyPendingRequests, useRespondToJoinRequest } from '../hooks/useTripData'

interface InvitationsHubModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function InvitationsHubModal({ isOpen, onClose }: InvitationsHubModalProps) {
    const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received')
    const queryClient = useQueryClient()

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
    
    const { data: receivedInvites = [], refetch: refetchReceived } = useReceivedInvites()
    const { data: sentInvites = [], refetch: refetchSent } = useSentInvites()
    const { data: incomingJoinRequests = [], refetch: refetchIncomingJoin } = useAllIncomingJoinRequests()
    const { data: myPendingRequests = [], refetch: refetchMyPending } = useMyPendingRequests()
    const respondToJoinRequest = useRespondToJoinRequest()

    if (!isOpen) return null

    const handleRespondToInvite = async (inviteId: string, status: 'accepted' | 'rejected') => {
        try {
            if (status === 'accepted') {
                const { error: rpcError } = await supabase.rpc('accept_trip_invitation', {
                    p_invite_id: inviteId
                })
                if (rpcError) throw rpcError
                
                toast.success('Invitation accepted! Welcome to the trip.')
                queryClient.invalidateQueries({ queryKey: ['trips'] })
            } else {
                const { error } = await supabase
                    .from('trip_invitations')
                    .update({ status })
                    .eq('id', inviteId)
                if (error) throw error
                
                toast.success('Invitation rejected.')
            }
            refetchReceived()
        } catch (err: any) {
            toast.error(err.message || 'Failed to respond to invite')
        }
    }

    const handleDeleteReceived = async (inviteId: string) => {
        try {
            const { error } = await supabase.from('trip_invitations').update({ invitee_deleted: true }).eq('id', inviteId)
            if (error) throw error
            toast.success('Invitation hidden from history')
            refetchReceived()
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete invitation')
        }
    }

    const handleRevokeSent = async (inviteId: string) => {
        try {
            const { error } = await supabase.from('trip_invitations').update({ inviter_deleted: true }).eq('id', inviteId)
            if (error) throw error
            toast.success('Sent invitation revoked/hidden')
            refetchSent()
        } catch (err: any) {
            toast.error(err.message || 'Failed to revoke invitation')
        }
    }

    const renderBadge = (status: string) => {
        if (status === 'accepted') return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">ACCEPTED</span>
        if (status === 'pending') return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">PENDING</span>
        return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">REJECTED</span>
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#0a0f2c] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-fade-in-up">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <Mail className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Invitations Hub</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors outline-none focus:ring-2 focus:ring-fuchsia-500/50">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 px-6 pt-4 border-b border-white/10">
                    <button
                        onClick={() => setActiveTab('received')}
                        className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
                            activeTab === 'received' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Inbox className="w-4 h-4" /> Received Invites
                        {(receivedInvites.filter(i => i.status === 'pending').length + incomingJoinRequests.length) > 0 && (
                            <span className="bg-fuchsia-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {receivedInvites.filter(i => i.status === 'pending').length + incomingJoinRequests.length}
                            </span>
                        )}
                        {activeTab === 'received' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-fuchsia-500 to-indigo-500 rounded-t-full shadow-[0_-2px_10px_rgba(217,70,239,0.5)]" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('sent')}
                        className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
                            activeTab === 'sent' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Send className="w-4 h-4" /> Sent Invites
                        {myPendingRequests.filter(req => req.status === 'pending').length > 0 && (
                            <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {myPendingRequests.filter(req => req.status === 'pending').length}
                            </span>
                        )}
                        {activeTab === 'sent' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-fuchsia-500 to-indigo-500 rounded-t-full shadow-[0_-2px_10px_rgba(217,70,239,0.5)]" />
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {activeTab === 'received' && (
                        <div className="space-y-3">
                            {receivedInvites.length === 0 && incomingJoinRequests.length === 0 ? (
                                <div className="text-center py-12">
                                    <Inbox className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                    <p className="text-slate-400 font-medium">Your inbox is empty.</p>
                                </div>
                            ) : (
                                <>
                                    {receivedInvites.map(invite => (
                                        <div key={invite.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                                            <div className="flex flex-col">
                                                <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                                                    <span className="text-sm text-slate-300">
                                                        <strong className="text-white">{invite.inviter?.full_name || 'Someone'}</strong> invited you to
                                                    </span>
                                                    <span className="text-lg font-black text-white">{invite.trip?.title || 'a trip'}</span>
                                                    {renderBadge(invite.status)}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">{new Date(invite.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {invite.status === 'pending' ? (
                                                    <>
                                                        <button onClick={() => handleRespondToInvite(invite.id, 'accepted')} className="w-10 h-10 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 flex items-center justify-center transition-colors" title="Accept Invite">
                                                            <Check className="w-5 h-5" />
                                                        </button>
                                                        <button onClick={() => handleRespondToInvite(invite.id, 'rejected')} className="w-10 h-10 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 flex items-center justify-center transition-colors" title="Reject Invite">
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => handleDeleteReceived(invite.id)} className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors" title="Delete record">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Incoming Join Requests */}
                                    {incomingJoinRequests.length > 0 && (
                                        <div className="mt-6 pt-6 border-t border-white/10">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" />
                                                Join Requests for Your Trips
                                            </h3>
                                            <div className="space-y-3">
                                                {incomingJoinRequests.map(req => (
                                                    <div key={req.id} className="flex items-center justify-between p-4 rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/10 hover:border-fuchsia-500/20 transition-colors">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                                                                <span className="text-sm text-slate-300">
                                                                    <strong className="text-white">{req.requester?.full_name || 'Someone'}</strong> (ID: {req.requester?.username_id || '?'}) requested to join
                                                                </span>
                                                                <span className="text-lg font-black text-white">{req.trip?.title || 'your trip'}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-1">{new Date(req.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        await respondToJoinRequest.mutateAsync({ requestId: req.id, approve: true })
                                                                        toast.success('Request approved!')
                                                                        refetchIncomingJoin()
                                                                    } catch (err: any) {
                                                                        toast.error(err.message || 'Failed to approve request')
                                                                    }
                                                                }}
                                                                className="w-10 h-10 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 flex items-center justify-center transition-colors"
                                                                title="Approve"
                                                            >
                                                                <Check className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        await respondToJoinRequest.mutateAsync({ requestId: req.id, approve: false })
                                                                        toast.success('Request rejected.')
                                                                        refetchIncomingJoin()
                                                                    } catch (err: any) {
                                                                        toast.error(err.message || 'Failed to reject request')
                                                                    }
                                                                }}
                                                                className="w-10 h-10 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 flex items-center justify-center transition-colors"
                                                                title="Reject"
                                                            >
                                                                <X className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'sent' && (
                        <div className="space-y-3">
                            {sentInvites.length === 0 && myPendingRequests.length === 0 ? (
                                <div className="text-center py-12">
                                    <Send className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                    <p className="text-slate-400 font-medium">You haven't sent any invitations recently.</p>
                                </div>
                            ) : (
                                <>
                                    {sentInvites.map(invite => (
                                        <div key={invite.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                                            <div className="flex flex-col">
                                                <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                                                    <span className="text-sm text-slate-300">
                                                        You invited <strong className="text-white">{invite.invitee?.full_name || 'User'}</strong> ({invite.invitee?.username_id}) to
                                                    </span>
                                                    <span className="text-lg font-black text-white">{invite.trip?.title || 'a trip'}</span>
                                                    {renderBadge(invite.status)}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">{new Date(invite.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <button onClick={() => handleRevokeSent(invite.id)} className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors" title="Revoke / Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Sent Join Requests */}
                                    {myPendingRequests.length > 0 && (
                                        <div className="mt-6 pt-6 border-t border-white/10">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                                Your Sent Join Requests
                                            </h3>
                                            <div className="space-y-3">
                                                {myPendingRequests.map(req => (
                                                    <div key={req.id} className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                                                        req.status === 'approved' ? 'bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/25' :
                                                        req.status === 'rejected' ? 'bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/25' :
                                                        'bg-indigo-500/5 border border-indigo-500/10 hover:border-indigo-500/20'
                                                    }`}>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                                                                <span className="text-sm text-slate-300">
                                                                    You requested to join trip
                                                                </span>
                                                                <span className="text-lg font-black text-white">{req.trip?.title || 'a trip'}</span>
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                                    req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                    req.status === 'rejected' ? 'bg-rose-500/20 text-rose-400' :
                                                                    'bg-amber-500/20 text-amber-400 animate-pulse'
                                                                }`}>
                                                                    {req.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-1">{new Date(req.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    const { error } = await supabase.from('trip_join_requests').delete().eq('id', req.id)
                                                                    if (error) throw error
                                                                    toast.success(req.status === 'pending' ? 'Join request cancelled.' : 'Notification cleared.')
                                                                    refetchMyPending()
                                                                } catch (err: any) {
                                                                    toast.error(err.message || 'Failed to update request')
                                                                }
                                                            }}
                                                            className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors"
                                                            title={req.status === 'pending' ? 'Cancel Request' : 'Clear Notification'}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
