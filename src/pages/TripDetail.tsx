import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { Calendar, ImageIcon, UserPlus, Home, User, Loader2, Edit2, CheckCircle2, Trash2, Settings } from 'lucide-react'
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
import { useTrip, useTripParticipants, useExpenses, useUpdateTrip, useDeleteTrip, useCurrentUser } from '../hooks/useTripData'

// ... (existing imports and interfaces)



// Lazy Load Heavy Components
const TripSnapshotTab = lazy(() => import('../components/TripSnapshotTab'))
const AddExpenseModal = lazy(() => import('../components/AddExpenseModal'))

// Interfaces extracted from hooks or defined locally if needed
// Expense interface is still used for state like expenseToEdit
interface Expense {
    id: string
    title: string
    amount: number
    date: string
    category: string
    paid_by: string
    expense_splits: {
        participant_id: string
        amount: number
    }[]
}

export default function TripDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    // AUTH
    // AUTH
    const { data: currentUser = null } = useCurrentUser()

    // DATA HOOKS
    const { data: trip, isLoading: loadingTrip, error: tripError } = useTrip(id)
    const { data: participants = [], isLoading: loadingParticipants } = useTripParticipants(id)
    const { data: expenses = [], isLoading: loadingExpenses } = useExpenses(id)
    const updateTripMutation = useUpdateTrip()
    const deleteTripMutation = useDeleteTrip()

    // DERIVED STATE
    const loading = loadingTrip || loadingParticipants || loadingExpenses

    // LOCAL UI STATE
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const [showDeleteTripModal, setShowDeleteTripModal] = useState(false)
    const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'snapshot'>('expenses')
    const [showAddExpense, setShowAddExpense] = useState(false)
    const [showAddMember, setShowAddMember] = useState(false)
    const [showImagePicker, setShowImagePicker] = useState(false)
    const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null)
    const [settleData, setSettleData] = useState<any>(null)
    const [isEditingTitle, setIsEditingTitle] = useState(false)
    const [editedTitle, setEditedTitle] = useState('')
    const [showProfileModal, setShowProfileModal] = useState(false)

    // Modal State for Confirmations
    const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false)
    const [memberToRemove, setMemberToRemove] = useState<{ id: string, name: string } | null>(null)
    const [showDeleteExpenseModal, setShowDeleteExpenseModal] = useState(false)
    const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null)
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
    const [showEditMemberModal, setShowEditMemberModal] = useState(false)
    const [memberToEdit, setMemberToEdit] = useState<any>(null)
    const [editedMemberName, setEditedMemberName] = useState('')

    // Bulk Actions State
    const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([])
    const [showPasswordModal, setShowPasswordModal] = useState(false)

    // THEME & TITLE SYNC
    useEffect(() => {
        // Theme check
        const savedTheme = localStorage.getItem('theme')
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [])

    useEffect(() => {
        if (trip) setEditedTitle(trip.title)
    }, [trip])

    // ERROR HANDLING
    useEffect(() => {
        if (tripError) {
            console.error('Error fetching trip:', tripError)
            toast.error('Failed to load trip details')
            navigate('/dashboard')
        }
    }, [tripError, navigate])

    const handleDeleteTrip = async () => {
        if (!trip) return
        try {
            await deleteTripMutation.mutateAsync(trip.id)
            toast.success('Trip deleted successfully')
            navigate('/dashboard')
        } catch (error) {
            console.error('Error deleting trip:', error)
            toast.error('Failed to delete trip')
        }
    }

    const handleUpdateImage = async (url: string) => {
        if (!trip) return
        try {
            await updateTripMutation.mutateAsync({ id: trip.id, updates: { header_image_url: url } })
            setShowImagePicker(false)
            toast.success('Cover image updated!')
        } catch (error) {
            toast.error('Failed to update cover image')
        }
    }

    const handleUpdateTitle = async () => {
        if (!trip || !editedTitle.trim()) return

        try {
            await updateTripMutation.mutateAsync({ id: trip.id, updates: { title: editedTitle.trim() } })
            setIsEditingTitle(false)
            toast.success('Trip title updated')
        } catch (error) {
            toast.error('Failed to update title')
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
                category: 'Other',
                paid_by: payer.id,
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

                {/* Edit Cover Button - Only for owners */}
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
                                    />
                                    <button onClick={handleUpdateTitle} className="p-1 hover:bg-white/20 rounded">
                                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                                    </button>
                                    <button onClick={() => { setIsEditingTitle(false); setEditedTitle(trip.title) }} className="p-1 hover:bg-white/20 rounded">
                                        <Trash2 className="w-6 h-6 text-red-400" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 group/title">
                                    <h1 className="text-3xl font-bold mb-1 shadow-black/50 drop-shadow-md">{trip.title}</h1>
                                    {isOwner && (
                                        <button
                                            onClick={() => setIsEditingTitle(true)}
                                            className="p-1.5 bg-black/20 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm"
                                            title="Edit Trip Name"
                                        >
                                            <Edit2 className="w-4 h-4 text-white/90" />
                                        </button>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center gap-4 text-sm opacity-90">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {trip.start_date ? format(new Date(trip.start_date), 'MMM d') : ''}
                                    {trip.end_date ? ` - ${format(new Date(trip.end_date), 'MMM d, yyyy')}` : ''}
                                </div>
                                {participants.length} Members
                            </div>
                        </div>

                        <div className="flex gap-2 shrink-0 pb-1">
                            {isOwner && (
                                <button
                                    onClick={() => setShowSettingsModal(true)}
                                    className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition flex items-center gap-2 px-3"
                                    title="Trip Settings"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={() => setShowAddMember(true)}
                                className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition flex items-center gap-2 px-4"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span className="hidden sm:inline text-sm font-bold">Invite</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>


            {/* Navigation Tabs - Sticky */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-4 shrink-0 shadow-sm transition-all duration-300">
                <div className="flex justify-between items-center max-w-6xl mx-auto h-14">

                    {/* Left: Home Button & Title */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition"
                            title="Go to Dashboard"
                        >
                            <Home className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white hidden sm:block truncate max-w-[200px]">{trip.title}</h2>
                    </div>

                    {/* Center: Tabs */}
                    <div className="flex gap-6 absolute left-1/2 -translate-x-1/2">
                        <button
                            onClick={() => setActiveTab('expenses')}
                            className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'expenses' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            Expenses
                        </button>
                        <button
                            onClick={() => setActiveTab('balances')}
                            className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'balances' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            Balances
                        </button>
                        <button
                            onClick={() => setActiveTab('snapshot')}
                            className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'snapshot' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            Snapshot
                        </button>
                    </div>

                    {/* Right: Profile Button */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowProfileModal(true)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition"
                            title="Profile Settings"
                        >
                            <User className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 pt-6">

                {activeTab === 'expenses' && (
                    <ExpensesTab
                        expenses={expenses}
                        participants={participants}
                        currency={trip.currency}
                        currentUserId={currentUser}
                        isOwner={isOwner || false}
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
                    />
                )}

                {activeTab === 'balances' && (
                    <BalancesTab
                        balances={balances}
                        settlements={settlements}
                        currency={trip.currency}
                        onSettle={handleSettle}
                        currentUser={currentUser}
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
                            currency={trip.currency}
                            getParticipantName={getParticipantName}
                            balances={balances}
                            settlements={settlements}
                        />
                    </Suspense>
                )}

            </div>

            {/* Modals */}
            {
                showAddExpense && (
                    <Suspense fallback={null}>
                        <AddExpenseModal
                            tripId={id!}
                            participants={participants}
                            currency={trip.currency}
                            onClose={() => setShowAddExpense(false)}
                            onSuccess={handleSaveExpenseSuccess}
                            expenseToEdit={expenseToEdit}
                            defaultValues={settleData}
                            categories={trip.categories}
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
            />

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
        </div >
    )
}
