import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { Calendar, ImageIcon, UserPlus, Home, Loader2, Edit2, CheckCircle2, Trash2, Settings, MapPin, Sun, Moon, CreditCard, PieChart as PieChartIcon, LogOut, Wallet } from 'lucide-react'
import AddMemberModal from '../components/AddMemberModal'
import ImagePickerModal from '../components/ImagePickerModal'
import ConfirmModal from '../components/ConfirmModal'
import PasswordConfirmModal from '../components/PasswordConfirmModal'
import ProfileSettingsModal from '../components/ProfileSettingsModal'
import TripSettingsModal from '../components/TripSettingsModal'
import { toast } from 'react-hot-toast'
import ExpensesTab from '../components/ExpensesTab'
import BalancesTab from '../components/BalancesTab'
import { useQueryClient } from '@tanstack/react-query'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import EndTripConfirmModal from '../components/EndTripConfirmModal'
import { useTrip, useTripParticipants, useExpenses, useCurrentUser } from '../hooks/useTripData'


// ... (existing imports and interfaces)



// Lazy Load Heavy Components
const TripSnapshotTab = lazy(() => import('../components/TripSnapshotTab'))
const AddExpenseModal = lazy(() => import('../components/AddExpenseModal'))

// Helper function to send email notifications when trip status changes
async function sendTripStatusEmail(
    tripId: string,
    participants: any[],
    action: 'ended' | 'reopened'
) {
    try {
        // Get trip details
        const { data: trip } = await supabase
            .from('trips')
            .select('title')
            .eq('id', tripId)
            .single()

        if (!trip) return

        // Get owner info
        const owner = participants.find(p => p.role === 'owner')
        const ownerName = owner?.profiles?.full_name || owner?.name || 'Trip Owner'

        // Get all member emails (excluding owner)
        const memberEmails = participants
            .filter(p => p.role !== 'owner' && p.profiles?.email)
            .map(p => p.profiles.email)

        if (memberEmails.length === 0) return

        // Note: This is a placeholder for actual email sending
        // You would typically use Supabase Edge Functions or an email service here
        console.log(`Would send email to:`, memberEmails)
        console.log(`Subject: Trip "${trip.title}" has been ${action}`)
        console.log(`Message: ${ownerName} has ${action} the trip "${trip.title}"`)

        toast.success(`Email notifications would be sent to ${memberEmails.length} members`)
    } catch (error) {
        console.error('Error sending email notifications:', error)
        // Don't throw - email failure shouldn't block the main action
    }
}


export default function TripDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { data: trip, isLoading: loadingTrip } = useTrip(id)
    const { data: participants = [], isLoading: loadingParticipants } = useTripParticipants(id)
    const { data: expenses = [], isLoading: loadingExpenses } = useExpenses(id)
    const { data: user = null } = useCurrentUser()
    const currentUser = user?.id || null

    const loading = loadingTrip || loadingParticipants || loadingExpenses

    const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'snapshot'>('expenses')
    const [showAddExpense, setShowAddExpense] = useState(false)
    const [showAddMember, setShowAddMember] = useState(false)
    const [expenseToEdit, setExpenseToEdit] = useState<any>(null)
    const [showDeleteTripModal, setShowDeleteTripModal] = useState(false)
    const [showEndTripModal, setShowEndTripModal] = useState(false)
    const [isEditingTitle, setIsEditingTitle] = useState(false)
    const [editedTitle, setEditedTitle] = useState('')
    const [showImagePicker, setShowImagePicker] = useState(false)


    // New state for settings
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const [showProfileModal, setShowProfileModal] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const handleSignOut = async () => {
        setIsLoggingOut(true)
        try {
            await supabase.auth.signOut()
            navigate('/')
            toast.success('Signed out successfully')
        } catch (error) {
            console.error('Error signing out:', error)
            toast.error('Failed to sign out')
        } finally {
            setIsLoggingOut(false)
        }
    }


    // Member Management
    const [memberToRemove, setMemberToRemove] = useState<{ id: string, name: string } | null>(null)
    const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false)
    const [memberToEdit, setMemberToEdit] = useState<any>(null)
    const [showEditMemberModal, setShowEditMemberModal] = useState(false)
    const [editedMemberName, setEditedMemberName] = useState('')


    // Expense Management
    const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null)
    const [showDeleteExpenseModal, setShowDeleteExpenseModal] = useState(false)
    const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([])
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)

    // Settle flow
    const [settleData, setSettleData] = useState<any>(null)

    // Theme state (local for now, could be global)
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('dark')
        }
        return false
    })

    const toggleTheme = useCallback(() => {
        const newIsDark = !isDark
        setIsDark(newIsDark)
        if (newIsDark) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
        }
    }, [isDark])

    const handleEndTrip = async (sendEmail: boolean, useOriginalDate?: boolean) => {
        if (!trip) return
        try {
            const endedAt = useOriginalDate !== undefined && useOriginalDate && trip.ended_at
                ? trip.ended_at
                : new Date().toISOString()

            const { error } = await supabase
                .from('trips')
                .update({
                    status: 'ended',
                    ended_at: endedAt
                })
                .eq('id', trip.id)

            if (error) throw error

            if (sendEmail) {
                // Send email notifications to all members except owner
                await sendTripStatusEmail(trip.id, participants, 'ended')
            }

            toast.success('Trip ended successfully')
            setShowEndTripModal(false)
            queryClient.invalidateQueries({ queryKey: ['trip', id] })
        } catch (error: any) {
            console.error('Error ending trip:', error)
            toast.error('Failed to end trip: ' + (error.message || 'Unknown error'))
        }
    }



    // Effect to init editedTitle
    useEffect(() => {
        if (trip) setEditedTitle(trip.title)
    }, [trip])

    // ERROR HANDLING
    useEffect(() => {
        // Assuming useTripData handles its own errors or provides an error state
        // If useTripData had an explicit error, we'd handle it here.
        // For now, we'll rely on the `loading` state from useTripData.
        if (!loading && !trip && id) { // If not loading and no trip found for an ID
            // This might indicate an error or non-existent trip
            // console.error('Trip not found or error fetching trip details.')
            // toast.error('Failed to load trip details or trip not found.')
            // navigate('/dashboard')
        }
    }, [loading, trip, id, navigate])

    const handleDeleteTrip = async () => {
        if (!trip) return
        toast.loading('Deleting trip...')
        const { error } = await supabase.from('trips').delete().eq('id', trip.id)
        toast.dismiss()

        if (error) {
            toast.error('Failed to delete trip')
        } else {
            toast.success('Trip deleted')
            navigate('/dashboard')
        }
    }

    const handleUpdateImage = async (url: string) => {
        if (!trip) return

        const { error } = await supabase
            .from('trips')
            .update({ header_image_url: url })
            .eq('id', trip.id)

        if (error) {
            toast.error('Failed to update cover image')
        } else {
            toast.success('Cover image updated')
            setShowImagePicker(false)
            queryClient.invalidateQueries({ queryKey: ['trip', id] })
        }
    }

    const handleUpdateTitle = async () => {
        if (!editedTitle.trim() || !trip) return

        const { error } = await supabase
            .from('trips')
            .update({ title: editedTitle.trim() })
            .eq('id', trip.id)

        if (error) {
            toast.error('Failed to update title')
        } else {
            toast.success('Title updated')
            setIsEditingTitle(false)
            queryClient.invalidateQueries({ queryKey: ['trip', id] })
        }
    }

    // BALANCES CALCULATION
    const { balances, settlements } = useMemo(() => {
        if (!expenses.length || !participants.length) return { balances: [], settlements: [] }

        // 1. Calculate Net Balances
        const balancesMap: Record<string, number> = {}
        participants.forEach(p => balancesMap[p.id] = 0)

        expenses.forEach(expense => {
            const payerId = expense.paid_by
            const amount = expense.amount
            const splits = expense.expense_splits

            // Payer gets +amount
            balancesMap[payerId] = (balancesMap[payerId] || 0) + amount

            // Debtors get -splitAmount
            splits.forEach(split => {
                balancesMap[split.participant_id] = (balancesMap[split.participant_id] || 0) - split.amount
            })
        })

        const balancesList = Object.entries(balancesMap).map(([id, amount]) => {
            const p = participants.find(p => p.id === id)
            return {
                participantId: id,
                name: p?.profiles?.full_name || p?.name || p?.profiles?.email || 'Unknown',
                amount
            }
        }).sort((a, b) => b.amount - a.amount)

        // 2. Calculate Settlements (Minimize Transactions)
        const settlementBalances = balancesList.map(b => ({ ...b }))

        let debtors = settlementBalances.filter(b => b.amount < -0.01).sort((a, b) => a.amount - b.amount)
        let creditors = settlementBalances.filter(b => b.amount > 0.01).sort((a, b) => b.amount - a.amount)

        const settlementsList = []

        let d = 0
        let c = 0

        while (d < debtors.length && c < creditors.length) {
            const debtor = debtors[d]
            const creditor = creditors[c]

            const amount = Math.min(Math.abs(debtor.amount), creditor.amount)

            settlementsList.push({
                from: debtor.name,
                to: creditor.name,
                amount
            })

            debtor.amount += amount
            creditor.amount -= amount

            if (Math.abs(debtor.amount) < 0.01) d++
            if (creditor.amount < 0.01) c++
        }

        return { balances: balancesList, settlements: settlementsList }

    }, [expenses, participants])

    const handleSettle = useCallback((fromName: string, toName: string, amount: number) => {
        const payer = participants.find(p => (p.profiles?.full_name === fromName || p.name === fromName))
        const receiver = participants.find(p => (p.profiles?.full_name === toName || p.name === toName))

        if (payer && receiver) {
            setSettleData({
                title: 'Settlement',
                amount: amount,
                category: 'Settlement',
                paidBy: payer.id,
                split_type: 'exact',
                splits: { [receiver.id]: amount }
            })
            setShowAddExpense(true)
        } else {
            toast.error('Could not identify participants strictly by name.')
        }
    }, [participants])

    const handleRemoveMember = useCallback((id: string, name: string) => {
        const balance = balances.find(b => b.participantId === id)?.amount || 0
        if (Math.abs(balance) > 0.01) {
            toast.error(`Cannot remove ${name || 'member'}. Balance is not zero (${balance > 0 ? '+' : ''}${balance.toFixed(2)}). Please settle first.`)
            return
        }
        setMemberToRemove({ id, name })
        setShowRemoveMemberModal(true)
    }, [balances])

    const handleDelete = useCallback((expenseId: string) => {
        setExpenseToDelete(expenseId)
        setShowDeleteExpenseModal(true)
    }, [])

    const handleToggleSelectExpense = useCallback((id: string) => {
        setSelectedExpenseIds(prev =>
            prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]
        )
    }, [])

    const handleSelectAllDate = useCallback((_date: string, expenseIds: string[]) => {
        setSelectedExpenseIds(prev => {
            const allSelected = expenseIds.every(id => prev.includes(id))
            if (allSelected) {
                return prev.filter(id => !expenseIds.includes(id))
            } else {
                return [...Array.from(new Set([...prev, ...expenseIds]))]
            }
        })
    }, [])

    const handleBulkDelete = useCallback(() => {
        setShowBulkDeleteModal(true)
    }, [])

    const handleBulkCategoryChange = useCallback(async () => {
        // Keeping this async logic here, but wrapped. prompt blocks, so it's fine.
        const category = prompt(`Enter new category:\n(${trip?.categories?.join(', ') || 'Food, Transport, Accommodation, Entertainment, Other'})`)
        if (!category) return

        const { error } = await supabase
            .from('expenses')
            .update({ category })
            .in('id', selectedExpenseIds)

        if (error) {
            toast.error('Failed to update category')
        } else {
            toast.success('Category updated')
            setSelectedExpenseIds([])
            queryClient.invalidateQueries({ queryKey: ['expenses', id] })
        }
    }, [selectedExpenseIds, queryClient, id])

    const handleDeleteAllExpenses = useCallback(() => {
        setShowPasswordModal(true)
    }, [])

    const getParticipantName = useCallback((id: string) => {
        const p = participants.find(p => p.id === id)
        return p?.profiles?.full_name || p?.name || p?.profiles?.email || 'Unknown'
    }, [participants])

    const confirmRemoveMember = async () => {
        if (!memberToRemove) return

        try {
            const { error } = await supabase
                .from('trip_participants')
                .delete()
                .eq('id', memberToRemove.id)

            if (error) throw error

            toast.success(`${memberToRemove.name || 'Member'} removed`)
            setShowRemoveMemberModal(false)
            setMemberToRemove(null)
            queryClient.invalidateQueries({ queryKey: ['participants', id] })
            queryClient.invalidateQueries({ queryKey: ['expenses', id] }) // Balances might change
        } catch (error: any) {
            console.error('Error removing member:', error)
            toast.error('Failed to remove member')
        }
    }

    const handleEditMember = (member: any) => {
        const currentName = member.profiles?.full_name || member.name || member.profiles?.email || ''
        setMemberToEdit(member)
        setEditedMemberName(currentName)
        setShowEditMemberModal(true)
    }

    const confirmEditMember = async () => {
        if (!memberToEdit || !editedMemberName.trim()) return

        try {
            const { error } = await supabase
                .from('trip_participants')
                .update({ name: editedMemberName.trim() })
                .eq('id', memberToEdit.id)

            if (error) throw error

            toast.success('Member name updated')
            setShowEditMemberModal(false)
            setMemberToEdit(null)
            setEditedMemberName('')
            queryClient.invalidateQueries({ queryKey: ['participants', id] })
        } catch (error: any) {
            console.error('Error updating member:', error)
            toast.error('Failed to update member name')
        }
    }

    const confirmDeleteExpense = async () => {
        if (!expenseToDelete) return

        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', expenseToDelete)

        if (error) {
            toast.error('Failed to delete expense')
        } else {
            toast.success('Expense deleted')
            setExpenseToDelete(null)
            setShowDeleteExpenseModal(false)
            queryClient.invalidateQueries({ queryKey: ['expenses', id] })
        }
    }

    const handleSaveExpenseSuccess = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['expenses', id] })
    }, [queryClient, id])

    const confirmBulkDelete = async () => {
        const { error } = await supabase.from('expenses').delete().in('id', selectedExpenseIds)
        if (error) {
            toast.error('Failed to delete expenses')
        } else {
            toast.success('Expenses deleted')
            setSelectedExpenseIds([])
            queryClient.invalidateQueries({ queryKey: ['expenses', id] })
            setShowBulkDeleteModal(false)
        }
    }

    const performDeleteAll = async () => {
        if (!id) return
        const { error } = await supabase.from('expenses').delete().eq('trip_id', id)
        if (error) {
            toast.error('Failed to reset expenses')
        } else {
            toast.success('All expenses deleted')
            setSelectedExpenseIds([])
            queryClient.invalidateQueries({ queryKey: ['expenses', id] })
        }
    }

    const isOwner = useMemo(() => participants.find(p => p.user_id === currentUser && p.user_id !== null)?.role === 'owner', [participants, currentUser])

    // Check if user can edit - disabled when trip is ended for ALL users (including owner)
    const isEnded = trip?.status === 'ended'
    const canEdit = !isEnded

    // 3. Get Settled History
    const settledHistory = useMemo(() => {
        return expenses
            .filter(e => e.title === 'Settlement' || e.category === 'Settlement')
            .map(e => {
                const payer = participants.find(p => p.id === e.paid_by)
                // In a settlement, there's usually one split: the receiver
                const receiverId = e.expense_splits?.[0]?.participant_id
                const receiver = participants.find(p => p.id === receiverId)

                return {
                    id: e.id,
                    from: payer?.profiles?.full_name || payer?.name || payer?.profiles?.email || 'Unknown',
                    to: receiver?.profiles?.full_name || receiver?.name || receiver?.profiles?.email || 'Unknown',
                    amount: e.amount,
                    date: e.date
                }
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }, [expenses, participants])


    const tabs = [
        { id: 'expenses', label: 'Expenses', icon: CreditCard },
        { id: 'balances', label: 'Balances', icon: Wallet },
        { id: 'snapshot', label: 'Snapshot', icon: PieChartIcon },
    ]


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (!trip) return null

    return (
        <div className="min-h-screen w-full bg-gray-50 dark:bg-gray-900 pb-10">

            {/* Header Image Area */}
            <div className="relative h-48 sm:h-64 shrink-0 group">
                <img
                    src={trip.header_image_url || `https://source.unsplash.com/random/800x600/?travel,${trip.title}`}
                    className="w-full h-full object-cover"
                    alt={trip.title}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>

                {/* Edit Cover and Delete Trip Buttons - Only for owners */}
                {isOwner && (
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => setShowDeleteTripModal(true)}
                            className="p-2 bg-red-500/80 backdrop-blur-md rounded-full text-white hover:bg-red-600 transition flex items-center gap-2 px-3"
                            title="Delete Trip"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-xs font-medium">Delete</span>
                        </button>
                        <button
                            onClick={() => setShowImagePicker(true)}
                            className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition flex items-center gap-2 px-3"
                        >
                            <ImageIcon className="w-4 h-4" />
                            <span className="text-xs font-medium">Change Cover</span>
                        </button>
                    </div>
                )}


                <div className="absolute bottom-4 left-4 right-4 text-white">
                    <div className="flex justify-between items-end">
                        <div className="flex-1 mr-4">
                            {isEditingTitle ? (
                                <div className="flex items-center gap-2 mb-1">
                                    <input
                                        type="text"
                                        value={editedTitle}
                                        onChange={(e) => setEditedTitle(e.target.value)}
                                        className="text-3xl font-bold bg-black/20 backdrop-blur-sm text-white border-b border-white/50 focus:outline-none focus:border-white w-full max-w-md px-2 rounded"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleUpdateTitle()
                                            if (e.key === 'Escape') {
                                                setIsEditingTitle(false)
                                                setEditedTitle(trip.title)
                                            }
                                        }}
                                        onBlur={() => {
                                            setIsEditingTitle(false)
                                            setEditedTitle(trip.title)
                                        }}
                                    />
                                    <button onClick={handleUpdateTitle} className="p-1 hover:bg-white/20 rounded">
                                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                                    </button>
                                    <button onClick={() => { setIsEditingTitle(false); setEditedTitle(trip.title) }} className="p-1 hover:bg-white/20 rounded">
                                        <Trash2 className="w-6 h-6 text-red-400" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mb-1 group/title cursor-pointer" onClick={() => isOwner && setIsEditingTitle(true)}>
                                    <h1 className="text-3xl font-bold">{trip.title}</h1>
                                    {isOwner && <Edit2 className="w-4 h-4 opacity-50 group-hover/title:opacity-100 transition-opacity" />}
                                </div>
                            )}
                            <div className="flex items-center gap-4 text-sm opacity-90">
                                <span className="flex items-center gap-1 bg-black/20 backdrop-blur-sm px-2 py-1 rounded">
                                    <Calendar className="w-4 h-4" />
                                    {trip.start_date && trip.end_date ? (
                                        new Date(trip.start_date).getFullYear() === new Date(trip.end_date).getFullYear()
                                            ? `${format(parseISO(trip.start_date), 'MMM d')} - ${format(parseISO(trip.end_date), 'MMM d, yyyy')}`
                                            : `${format(parseISO(trip.start_date), 'MMM d, yyyy')} - ${format(parseISO(trip.end_date), 'MMM d, yyyy')}`
                                    ) : trip.start_date ? (
                                        format(parseISO(trip.start_date), 'MMM d, yyyy')
                                    ) : 'Date TBD'}
                                </span>
                                <span className="flex items-center gap-1 bg-black/20 backdrop-blur-sm px-2 py-1 rounded">
                                    <MapPin className="w-4 h-4" />
                                    {trip.destination || 'No Destination'}
                                </span>
                            </div>
                        </div>

                        {/* Theme Toggle in Header */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 text-white transition-colors"
                            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Sticky Navigation Bar */}
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 gap-4">

                        {/* Left: Home & Title */}
                        <div className="flex items-center gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
                                title="Back to Dashboard"
                            >
                                <Home className="w-5 h-5" />
                            </button>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate hidden sm:block opacity-90">
                                {trip.title}
                            </h2>
                        </div>

                        {/* Center: Tabs */}
                        <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-3 sm:px-4 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium transition-all duration-200 whitespace-nowrap
                                    ${activeTab === tab.id
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    {/* Show simplified label on mobile if needed, or just icon */}
                                    <span className="sm:hidden">{tab.label === 'Expenses' ? 'Exp' : tab.label === 'Balances' ? 'Bal' : 'Snap'}</span>
                                </button>
                            ))}
                        </div>

                        {/* Right: Actions */}
                        <div className="flex gap-2 shrink-0">
                            {/* Only Owner can manage settings */}
                            {isOwner && (
                                <button
                                    onClick={() => setShowSettingsModal(true)}
                                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
                                    title="Trip Settings"
                                >
                                    <Settings className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={() => setShowAddMember(true)}
                                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition"
                                title="Invite Members"
                            >
                                <UserPlus className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleSignOut}
                                disabled={isLoggingOut}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition disabled:opacity-50"
                                title="Sign Out"
                            >
                                {isLoggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* (Tabs were here, now moved up) */}

                {/* Tab Content */}
                <div className="min-h-[500px]">
                    {activeTab === 'expenses' && (
                        <ExpensesTab
                            expenses={expenses}
                            participants={participants}
                            currency={trip?.currency || 'INR'}
                            currentUserId={currentUser}
                            isOwner={isOwner}
                            balances={balances}
                            selectedExpenseIds={selectedExpenseIds}
                            onAddExpense={() => {
                                setExpenseToEdit(null)
                                setSettleData(null)
                                setShowAddExpense(true)
                            }}
                            onEditExpense={(expense) => {
                                setExpenseToEdit(expense)
                                setShowAddExpense(true)
                            }}
                            onDeleteExpense={handleDelete}
                            onRemoveMember={handleRemoveMember}
                            onEditMember={handleEditMember}
                            onAddMember={() => setShowAddMember(true)}
                            onToggleSelectExpense={handleToggleSelectExpense}
                            onSelectAllDate={handleSelectAllDate}
                            onBulkDelete={handleBulkDelete}
                            onBulkCategoryChange={handleBulkCategoryChange}
                            onDeleteAllExpenses={handleDeleteAllExpenses}
                            getParticipantName={getParticipantName}
                            categories={trip.categories}
                            canEdit={canEdit}
                            isEnded={isEnded}
                        />
                    )}

                    {activeTab === 'balances' && (
                        <BalancesTab
                            balances={balances}
                            settlements={settlements}
                            settledHistory={settledHistory}
                            currency={trip?.currency || 'INR'}
                            onSettle={handleSettle}
                            onUndoSettlement={handleDelete}
                            currentUser={currentUser}
                            canEdit={canEdit}
                            isEnded={isEnded}
                        />
                    )}

                    {activeTab === 'snapshot' && (
                        <Suspense fallback={
                            <div className="flex justify-center p-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            </div>
                        }>
                            <TripSnapshotTab
                                trip={trip}
                                expenses={expenses}
                                participants={participants}
                                currency={trip?.currency || 'INR'}
                                getParticipantName={getParticipantName}
                                balances={balances}
                                settlements={settlements}
                            />
                        </Suspense>
                    )}

                </div>
            </div>

            {/* Modals outside max-w container */}
            {
                showAddExpense && (
                    <Suspense fallback={null}>
                        <AddExpenseModal
                            tripId={id!}
                            participants={participants}
                            currency={trip?.currency || 'INR'}
                            onClose={() => {
                                setShowAddExpense(false)
                                setExpenseToEdit(null)
                            }}
                            onSuccess={handleSaveExpenseSuccess}
                            expenseToEdit={expenseToEdit}
                            defaultValues={settleData}
                            categories={Array.from(new Set([...(trip.categories || ['Food', 'Transport', 'Accommodation', 'Entertainment', 'Other']), 'Settlement']))}
                        />
                    </Suspense>
                )
            }

            {
                showAddMember && (
                    <AddMemberModal
                        tripId={id!}
                        onClose={() => setShowAddMember(false)}
                        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['participants', id] })}
                        participants={participants}
                    />
                )
            }

            {
                showImagePicker && (
                    <ImagePickerModal
                        onClose={() => setShowImagePicker(false)}
                        onSelect={handleUpdateImage}
                        currentUrl={trip.header_image_url}
                    />
                )
            }

            <ConfirmModal
                isOpen={showRemoveMemberModal}
                onClose={() => setShowRemoveMemberModal(false)}
                onConfirm={confirmRemoveMember}
                title="Remove Member?"
                message={`Are you sure you want to remove ${memberToRemove?.name || 'this member'} from the trip?`}
                confirmText="Remove"
                variant="danger"
            />

            <ConfirmModal
                isOpen={showDeleteExpenseModal}
                onClose={() => setShowDeleteExpenseModal(false)}
                onConfirm={confirmDeleteExpense}
                title="Delete Expense?"
                message="Are you sure you want to delete this expense? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
            />

            <ConfirmModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={confirmBulkDelete}
                title="Delete Multiple Expenses?"
                message={`Are you sure you want to delete ${selectedExpenseIds.length} expenses? This action cannot be undone.`}
                confirmText={`Delete ${selectedExpenseIds.length} Expenses`}
                variant="danger"
            />

            <PasswordConfirmModal
                isOpen={showPasswordModal}
                onClose={() => setShowPasswordModal(false)}
                onConfirm={performDeleteAll}
                title="Reset All Expenses?"
                message="This will permanently delete ALL expenses for this trip. This action cannot be undone."
                confirmText="Delete All"
                variant="danger"
            />

            <ProfileSettingsModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                currentUser={currentUser}
            />

            <DeleteConfirmModal
                isOpen={showDeleteTripModal}
                onClose={() => setShowDeleteTripModal(false)}
                onConfirm={handleDeleteTrip}
                tripTitle={trip.title}
                additionalWarning={expenses.length > 0 ? (
                    <div className="flex flex-col gap-1">
                        <strong>Warning: This trip has {expenses.length} logged expenses.</strong>
                        <span>Deleting this trip will permanently remove all expenses, settlements, and member data. This action cannot be undone.</span>
                    </div>
                ) : undefined}
            />

            <TripSettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                trip={trip}
                participants={participants}
                currentUser={currentUser}
                balances={balances}
                onRequestEndTrip={() => {
                    setShowEndTripModal(true)
                }}
            />

            {/* End Trip Confirm Modal - Hoisted to TripDetail */}
            {showEndTripModal && trip && (
                <EndTripConfirmModal
                    tripName={trip.title}
                    onClose={() => setShowEndTripModal(false)}
                    onConfirm={handleEndTrip}
                    previousEndedAt={trip.ended_at}
                    unsettledBalances={balances}
                />
            )}

            {/* Edit Member Name Modal */}
            {showEditMemberModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            Edit Member Name
                        </h3>
                        <input
                            type="text"
                            value={editedMemberName}
                            onChange={(e) => setEditedMemberName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            placeholder="Enter member name"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmEditMember()
                                if (e.key === 'Escape') setShowEditMemberModal(false)
                            }}
                        />
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowEditMemberModal(false)
                                    setMemberToEdit(null)
                                    setEditedMemberName('')
                                }}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmEditMember}
                                disabled={!editedMemberName.trim()}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 py-2 text-center text-[10px] text-gray-400 dark:text-gray-600 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm pointer-events-none z-40">
                A proprietary framework designed and developed by Omnish Singhal
            </div>
        </div >
    )
}
