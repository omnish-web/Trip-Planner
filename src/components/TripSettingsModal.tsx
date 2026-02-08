import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, Save, Trash2, Plus, AlertTriangle, Settings, List, Check, Edit2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { Trip } from '../hooks/useTripData'
import { useUpdateTrip, useUpdateMemberRole } from '../hooks/useTripData'
import ExpenseAdjustmentConfirmModal from './ExpenseAdjustmentConfirmModal'

interface TripSettingsModalProps {
    trip: Trip
    participants: any[]
    isOpen: boolean
    onClose: () => void
    currentUser: string | null
}

export default function TripSettingsModal({ trip, participants, isOpen, onClose, currentUser }: TripSettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'roles' | 'categories'>('general')
    const updateTripMutation = useUpdateTrip()
    const updateMemberRoleMutation = useUpdateMemberRole()

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="glass-panel w-full max-w-2xl bg-white dark:bg-gray-900 relative flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-500" />
                        Trip Settings
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab('roles')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'roles' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        Members & Roles
                    </button>
                    <button
                        onClick={() => setActiveTab('categories')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'categories' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        Categories
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scroll">
                    {activeTab === 'general' && (
                        <GeneralSettings trip={trip} updateTrip={updateTripMutation} />
                    )}
                    {activeTab === 'roles' && (
                        <RolesSettings tripId={trip.id} participants={participants} currentUser={currentUser} updateRole={updateMemberRoleMutation} />
                    )}
                    {activeTab === 'categories' && (
                        <CategoriesSettings trip={trip} updateTrip={updateTripMutation} />
                    )}
                </div>
            </div>
        </div>
    )
}

function GeneralSettings({ trip, updateTrip }: { trip: Trip, updateTrip: any }) {
    const [title, setTitle] = useState(trip.title)
    const [currency, setCurrency] = useState(trip.currency)
    const [startDate, setStartDate] = useState(trip.start_date || '')
    const [endDate, setEndDate] = useState(trip.end_date || '')
    const [loading, setLoading] = useState(false)

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await updateTrip.mutateAsync({
                id: trip.id,
                updates: {
                    title,
                    currency,
                    start_date: startDate || null,
                    end_date: endDate || null
                }
            })
            toast.success('Settings saved')
        } catch (error) {
            toast.error('Failed to save settings')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSave} className="space-y-4">
            <div>
                <label className="compact-label">Trip Name</label>
                <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="compact-input"
                    required
                />
            </div>
            <div>
                <label className="compact-label">Currency</label>
                <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="compact-input"
                >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="compact-label">Start Date</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="compact-input"
                    />
                </div>
                <div>
                    <label className="compact-label">End Date</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="compact-input"
                    />
                </div>
            </div>
            <div className="pt-4">
                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full flex justify-center items-center gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>
        </form>
    )
}

// Helper function to recalculate expense splits when parent_id changes
async function recalculateExpenseSplits(
    tripId: string,
    participants: any[],
    changedMemberId: string,
    newParentId: string | null
) {
    try {
        // Fetch all expenses for this trip with their splits
        const { data: expenses, error: expError } = await supabase
            .from('expenses')
            .select(`
                id,
                amount,
                expense_splits (
                    participant_id,
                    amount
                )
            `)
            .eq('trip_id', tripId)

        if (expError) {
            console.error('Error fetching expenses:', expError)
            throw expError
        }
        if (!expenses || expenses.length === 0) {
            console.log('No expenses found for this trip')
            return
        }

        console.log(`Processing ${expenses.length} expenses for recalculation`)

        // Create updated participant map with new parent_id
        const updatedParticipants = participants.map(p =>
            p.id === changedMemberId
                ? { ...p, parent_id: newParentId }
                : p
        )

        let updatedCount = 0

        // Process each expense
        for (const expense of expenses) {
            const splits = expense.expense_splits || []
            if (splits.length === 0) continue

            // 1. ANALYSIS: ATTEMPT TO DETECT "STANDARD/EQUAL" SPLIT PATTERN
            // We support two detection strategies:
            // A. Strict Construction: Reconstruct exactly based on "Payer + All Dependents"
            // B. Heuristic/Fuzzy: Check if amounts are simple integer multiples of a base unit matching dependent counts

            const getDependents = (pid: string) => participants.filter(p => p.parent_id === pid)

            let isStandardSplit = false
            let peopleInvolved = new Set<string>()

            // Strategy A: Strict Reconstruction
            let strictTotalUnits = 0
            const strictPayerCounts: Record<string, number> = {}
            const strictPeople: Set<string> = new Set()

            for (const split of splits) {
                const pid = split.participant_id
                const dependents = getDependents(pid)
                const count = 1 + dependents.length
                strictPayerCounts[pid] = count
                strictTotalUnits += count
                strictPeople.add(pid)
                dependents.forEach(d => strictPeople.add(d.id))
            }

            // Verify Strict
            const strictUnitShare = expense.amount / strictTotalUnits
            const isStrictMatch = splits.every((split: any) => {
                const theoretical = strictUnitShare * (strictPayerCounts[split.participant_id] || 0)
                return Math.abs(split.amount - theoretical) < 0.1
            })

            if (isStrictMatch) {
                isStandardSplit = true
                peopleInvolved = strictPeople
                // console.log(`Expense ${expense.id}: Strict match found`)
            } else {
                // Strategy B: Heuristic Unit Matching (GCD-ish)
                // Try total unit counts from splits.length up to participants.length * 2
                // We are looking for a K such that `Share = Total / K` explains all splits as integer multiples

                // Optimization: Start from strictTotalUnits (most likely)
                const candidateUnits = [strictTotalUnits]
                for (let k = splits.length; k <= participants.length + 5; k++) {
                    if (k !== strictTotalUnits) candidateUnits.push(k)
                }

                for (const k of candidateUnits) {
                    if (k === 0) continue
                    const share = expense.amount / k

                    // Check if every split is a rough integer multiple of `share`
                    let fitsIntegers = true
                    const splitUnits: Record<string, number> = {}

                    for (const split of splits) {
                        const unitsRaw = split.amount / share
                        const units = Math.round(unitsRaw)
                        if (Math.abs(unitsRaw - units) > 0.05) {
                            fitsIntegers = false
                            break
                        }
                        splitUnits[split.participant_id] = units
                    }

                    if (!fitsIntegers) continue

                    // SUCCESS CASE 1: GLOBAL EQUAL SPLIT (K = N)
                    // If the math works out to exactly N units, assume it's an equal split among everyone.
                    // This handles cases where dependency links were broken (legacy data) but the amounts imply a full split.
                    if (k === participants.length) {
                        isStandardSplit = true
                        peopleInvolved = new Set(participants.map(p => p.id))
                        // console.log(`Expense ${expense.id}: Global match with K=${k}`)
                        break
                    }

                    // SUCCESS CASE 2: STANDARD HIERARCHY CHECK
                    // Check if the units assigned to each payer fit within their (Self + Dependents) capacity
                    let possibleParams = new Set<string>()
                    let isCapacityValid = true

                    for (const split of splits) {
                        const units = splitUnits[split.participant_id]
                        const maxCapacity = 1 + getDependents(split.participant_id).length

                        if (units > maxCapacity) {
                            isCapacityValid = false
                            break
                        }

                        // Add Payer + (Units-1) Dependents to peopleInvolved
                        possibleParams.add(split.participant_id)
                        const deps = getDependents(split.participant_id)
                        for (let i = 0; i < units - 1; i++) {
                            if (deps[i]) possibleParams.add(deps[i].id)
                        }
                    }

                    if (isCapacityValid) {
                        isStandardSplit = true
                        peopleInvolved = possibleParams
                        // console.log(`Expense ${expense.id}: Hierarchy match with K=${k}`)
                        break
                    }
                }
            }

            if (!isStandardSplit) {
                console.log(`Skipping expense ${expense.id} - custom split detected`)
                continue
            }

            // 2. RECALCULATE FOR NEW STRUCTURE
            // Distribute expense.amount among `peopleInvolved` using NEW relationships
            if (peopleInvolved.size === 0) continue

            const newPerPersonShare = expense.amount / peopleInvolved.size
            const newConsolidatedSplits: Record<string, number> = {}

            peopleInvolved.forEach(personId => {
                // Find this person in NEW structure
                const p = updatedParticipants.find(p => p.id === personId)
                if (p) {
                    // Consolidate to NEW parent or Self
                    const targetId = p.parent_id || p.id
                    newConsolidatedSplits[targetId] = (newConsolidatedSplits[targetId] || 0) + newPerPersonShare
                }
            })

            // Delete old splits
            const { error: deleteError } = await supabase
                .from('expense_splits')
                .delete()
                .eq('expense_id', expense.id)

            if (deleteError) {
                console.error(`Error deleting splits for expense ${expense.id}:`, deleteError)
                continue
            }

            // Insert new splits
            const newSplits = Object.entries(newConsolidatedSplits).map(([pid, amt]) => ({
                expense_id: expense.id,
                participant_id: pid,
                amount: amt
            }))

            if (newSplits.length > 0) {
                const { error: insertError } = await supabase
                    .from('expense_splits')
                    .insert(newSplits)

                if (insertError) {
                    console.error(`Error inserting splits for expense ${expense.id}:`, insertError)
                    continue
                }
                updatedCount++
            }
        }

        if (updatedCount > 0) {
            toast.success(`Updated ${updatedCount} expenses successfully`)
        } else {
            toast.success('Member updated (no expenses needed recalculation)')
        }
    } catch (error) {
        console.error('Error recalculating expenses:', error)
        toast.error('Failed to update expenses: ' + ((error as any).message || 'Unknown error'))
        throw error // Re-throw to let caller know
    }
}

function RolesSettings({ tripId, participants, currentUser, updateRole }: { tripId: string, participants: any[], currentUser: string | null, updateRole: any }) {
    const [editingMember, setEditingMember] = useState<any>(null)
    const [editName, setEditName] = useState('')
    const [editRole, setEditRole] = useState('')
    const [editParentId, setEditParentId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [showExpenseConfirm, setShowExpenseConfirm] = useState(false)
    const [pendingUpdates, setPendingUpdates] = useState<any>(null)

    const getParticipantName = (p: any) => {
        return p.profiles?.full_name || p.name || p.profiles?.email || 'Unknown User'
    }

    // Separate parents (no parent_id) and children (have parent_id)
    const parents = participants.filter(p => !p.parent_id)
    const children = participants.filter(p => p.parent_id)

    // Sort parents: Owner first, then current user, then others
    const sortedParents = [...parents].sort((a, b) => {
        if (a.role === 'owner') return -1
        if (b.role === 'owner') return 1
        if (a.user_id === currentUser) return -1
        if (b.user_id === currentUser) return 1
        return 0
    })

    const openEditModal = (member: any) => {
        setEditingMember(member)
        setEditName(getParticipantName(member))
        setEditRole(member.role || 'editor')
        setEditParentId(member.parent_id || null)
    }

    const closeEditModal = () => {
        setEditingMember(null)
        setEditName('')
        setEditRole('')
        setEditParentId(null)
    }

    const handleSaveEdit = async () => {
        if (!editingMember || !editName.trim()) return

        const willBeDependent = !!editParentId
        const parentIdChanged = editingMember.parent_id !== editParentId

        // Prepare update object
        const updates: any = {
            name: editName.trim(),
            parent_id: editParentId
        }

        // Only set role if NOT a dependent
        if (!willBeDependent) {
            updates.role = editRole
        }

        // If parent_id changed, show confirmation modal
        if (parentIdChanged) {
            setPendingUpdates(updates)
            setShowExpenseConfirm(true)
            return
        }

        // No parent_id change, save directly
        await performSave(updates, false)
    }

    const performSave = async (updates: any, updateExistingExpenses: boolean) => {
        setSaving(true)
        try {
            const willBeDependent = !!updates.parent_id

            const { error } = await supabase
                .from('trip_participants')
                .update(updates)
                .eq('id', editingMember.id)

            if (error) throw error

            // Also update role via mutation if role changed and not dependent
            if (!willBeDependent && editingMember.role !== editRole) {
                await updateRole.mutateAsync({ id: editingMember.id, role: editRole })
            }

            // If user chose to update existing expenses
            if (updateExistingExpenses) {
                await recalculateExpenseSplits(tripId, participants, editingMember.id, updates.parent_id)
            }

            toast.success('Member updated successfully')
            closeEditModal()
            setShowExpenseConfirm(false)
            setPendingUpdates(null)
            window.location.reload()
        } catch (error: any) {
            console.error('Error updating member:', error)
            toast.error('Failed to update member')
        } finally {
            setSaving(false)
        }
    }

    const handleExpenseConfirm = (updateExisting: boolean) => {
        if (pendingUpdates) {
            performSave(pendingUpdates, updateExisting)
        }
    }

    const handleExpenseCancel = () => {
        setShowExpenseConfirm(false)
        setPendingUpdates(null)
    }

    const handleDeleteMember = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to remove ${name}?`)) return
        try {
            const { error } = await supabase
                .from('trip_participants')
                .delete()
                .eq('id', id)
            if (error) throw error
            toast.success(`${name} removed`)
            window.location.reload()
        } catch (error: any) {
            console.error('Error removing member:', error)
            toast.error('Failed to remove member')
        }
    }

    return (
        <div className="space-y-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50">
                <p><strong>Owner:</strong> Full access + Delete Trip</p>
                <p><strong>Editor:</strong> Add/Edit Expenses & Invite Members</p>
                <p><strong>Viewer:</strong> Read-only access</p>
                <p className="mt-2 text-xs"><strong>Dependent:</strong> Member whose expense share is paid by their linked parent</p>
            </div>

            {sortedParents.map(p => {
                const isMe = p.user_id === currentUser
                const isOwner = p.role === 'owner'
                const myChildren = children.filter(c => c.parent_id === p.id)

                return (
                    <div key={p.id} className="space-y-2">
                        {/* Parent Member */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-3 flex-1">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isOwner ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-700'}`}>
                                    {(p.profiles?.full_name?.[0] || p.name?.[0] || p.profiles?.email?.[0] || 'U').toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                        {getParticipantName(p)}
                                        {isMe && <span className="text-xs text-blue-500">(You)</span>}
                                        {myChildren.length > 0 && (
                                            <span className="text-xs text-purple-500">+{myChildren.length} dependent{myChildren.length > 1 ? 's' : ''}</span>
                                        )}
                                    </p>
                                    <p className="text-xs text-gray-500">{p.profiles?.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {isOwner ? (
                                    <span className="px-2 py-1 text-xs font-bold bg-amber-100 text-amber-700 rounded border border-amber-200">
                                        OWNER
                                    </span>
                                ) : (
                                    <span className={`px-2 py-1 text-xs font-medium rounded ${p.role === 'editor' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                                        {p.role === 'editor' ? 'Editor' : 'Viewer'}
                                    </span>
                                )}
                                {!isOwner && (
                                    <>
                                        <button
                                            onClick={() => openEditModal(p)}
                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                            title="Edit Member"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMember(p.id, getParticipantName(p))}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                            title="Remove Member"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Child Members (indented) */}
                        {myChildren.map(child => (
                            <div key={child.id} className="ml-8 flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800/50">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-purple-100 text-purple-700 shrink-0">
                                        {(child.profiles?.full_name?.[0] || child.name?.[0] || 'D').toUpperCase()}
                                    </div>
                                    <p className="font-medium text-xs text-gray-700 dark:text-gray-300">
                                        {getParticipantName(child)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-600 rounded">
                                        Dependent
                                    </span>
                                    <button
                                        onClick={() => openEditModal(child)}
                                        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                        title="Edit Dependent"
                                    >
                                        <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteMember(child.id, getParticipantName(child))}
                                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        title="Remove Dependent"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            })}

            {/* Edit Member Modal */}
            {editingMember && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Edit2 className="w-5 h-5 text-blue-500" />
                            Edit Member
                        </h3>

                        <div className="space-y-4">
                            {/* Name Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    placeholder="Enter member name"
                                    autoFocus
                                />
                            </div>

                            {/* Dependency Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Status
                                </label>
                                <select
                                    value={editParentId || 'independent'}
                                    onChange={(e) => setEditParentId(e.target.value === 'independent' ? null : e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                >
                                    <option value="independent">Independent (Parent Member)</option>
                                    {parents.filter(p => p.id !== editingMember.id).map(parent => (
                                        <option key={parent.id} value={parent.id}>
                                            Dependent of {getParticipantName(parent)}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    {editParentId ? 'Dependent members have their expenses paid by their parent' : 'Independent members manage their own expenses'}
                                </p>
                            </div>

                            {/* Role Field (only for independent members) */}
                            {!editParentId && editingMember.role !== 'owner' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Role
                                    </label>
                                    <select
                                        value={editRole}
                                        onChange={(e) => setEditRole(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    >
                                        <option value="editor">Editor - Can add/edit expenses</option>
                                        <option value="viewer">Viewer - Read-only access</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={closeEditModal}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={!editName.trim() || saving}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Expense Adjustment Confirmation Modal */}
            <ExpenseAdjustmentConfirmModal
                isOpen={showExpenseConfirm}
                memberName={editName}
                onConfirm={handleExpenseConfirm}
                onCancel={handleExpenseCancel}
                loading={saving}
            />
        </div>
    )
}

function CategoriesSettings({ trip, updateTrip }: { trip: Trip, updateTrip: any }) {
    const [categories, setCategories] = useState<string[]>(trip.categories || ['Food', 'Transport', 'Accommodation', 'Entertainment', 'Other'])
    const [newCategory, setNewCategory] = useState('')
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [editValue, setEditValue] = useState('')

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newCategory.trim()) return

        const updated = [...categories, newCategory.trim()]
        setCategories(updated)
        setNewCategory('')

        // Persist
        try {
            await updateTrip.mutateAsync({ id: trip.id, updates: { categories: updated } })
            toast.success('Category added')
        } catch {
            toast.error('Failed to add category')
        }
    }

    const handleRename = async (index: number) => {
        if (!editValue.trim() || editValue === categories[index]) {
            setEditingIndex(null)
            return
        }

        const oldName = categories[index]
        const newName = editValue.trim()
        const updated = [...categories]
        updated[index] = newName

        setCategories(updated)
        setEditingIndex(null)

        try {
            toast.loading('Updating all expenses...', { id: 'rename-cat' })

            // 1. Update Trip Categories
            await updateTrip.mutateAsync({ id: trip.id, updates: { categories: updated } })

            // 2. Bulk update expenses
            const { error } = await supabase
                .from('expenses')
                .update({ category: newName })
                .eq('trip_id', trip.id)
                .eq('category', oldName)

            if (error) throw error

            toast.success('Category renamed & expenses updated', { id: 'rename-cat' })
        } catch (error) {
            console.error(error)
            toast.error('Failed to rename category', { id: 'rename-cat' })
            setCategories(categories) // Revert on error
        }
    }

    const handleDelete = async (index: number) => {
        const catToDelete = categories[index]

        // Check usage first
        try {
            const { count, error } = await supabase
                .from('expenses')
                .select('*', { count: 'exact', head: true })
                .eq('trip_id', trip.id)
                .eq('category', catToDelete)

            if (error) throw error

            if (count && count > 0) {
                toast.error(`Cannot delete "${catToDelete}". It is used by ${count} expenses.`)
                return
            }

            const updated = categories.filter((_, i) => i !== index)
            setCategories(updated)

            await updateTrip.mutateAsync({ id: trip.id, updates: { categories: updated } })
            toast.success('Category deleted')

        } catch (error) {
            console.error(error)
            toast.error('Failed to delete category')
        }
    }

    return (
        <div className="space-y-6">
            <form onSubmit={handleAdd} className="flex gap-2">
                <input
                    type="text"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="New Category Name..."
                    className="compact-input flex-1"
                />
                <button type="submit" className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    <Plus className="w-5 h-5" />
                </button>
            </form>

            <div className="space-y-2">
                {categories.map((cat, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 group">
                        {editingIndex === index ? (
                            <div className="flex-1 flex gap-2 mr-2">
                                <input
                                    type="text"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    className="compact-input py-1 h-8 text-sm"
                                    autoFocus
                                />
                                <button onClick={() => handleRename(index)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                    <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => setEditingIndex(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                <span className="text-gray-700 dark:text-gray-200 font-medium">{cat}</span>
                            </div>
                        )}

                        {editingIndex !== index && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => { setEditingIndex(index); setEditValue(cat) }}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(index)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="text-xs text-gray-400 flex items-start gap-1 p-2 bg-yellow-50 dark:bg-yellow-900/10 rounded border border-yellow-100 dark:border-yellow-900/30">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-yellow-500" />
                <span>Renaming a category will automatically update all past expenses tagged with it. Deleting is only allowed for unused categories.</span>
            </div>
        </div>
    )
}
