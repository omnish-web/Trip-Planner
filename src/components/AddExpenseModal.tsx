
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, Users } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Participant {
    id: string
    user_id: string | null
    name: string | null
    role: string
    parent_id?: string | null
    profiles: {
        full_name: string
        email: string
        id: string
    } | null
}

interface AddExpenseModalProps {
    tripId: string
    participants: Participant[]
    currency: string
    onClose: () => void
    onSuccess: (expense?: any) => void
    expenseToEdit?: { id: string } | null
    defaultValues?: {
        title?: string
        amount?: string
        paidBy?: string
        splits?: Record<string, number>
        category?: string
        date?: string
    }
    categories?: string[]
}

export default function AddExpenseModal({ tripId, participants, currency, onClose, onSuccess, expenseToEdit, defaultValues, categories = ['Food', 'Transport', 'Accommodation', 'Entertainment', 'Other'] }: AddExpenseModalProps) {
    const [title, setTitle] = useState(defaultValues?.title || '')
    const [amount, setAmount] = useState(defaultValues?.amount || '')
    const [category, setCategory] = useState(defaultValues?.category || categories[0] || 'Other')
    const [paidBy, setPaidBy] = useState(defaultValues?.paidBy || '')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]) // Default to today
    const [splitType, setSplitType] = useState<'equal' | 'exact'>(defaultValues?.splits ? 'exact' : 'equal')
    const [splits, setSplits] = useState<Record<string, number>>(defaultValues?.splits || {})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (expenseToEdit) {
            fetchExpenseDetails(expenseToEdit.id)
        } else if (!defaultValues?.paidBy) {
            // Default payer to current user if found, else first participant
            supabase.auth.getUser().then(({ data }) => {
                const currentUserId = data.user?.id
                const me = participants.find(p => p.user_id === currentUserId)
                if (me) setPaidBy(me.id)
                else if (participants.length > 0) setPaidBy(participants[0].id)
            })
        }
    }, [expenseToEdit, participants, defaultValues])

    const fetchExpenseDetails = async (id: string) => {
        setLoading(true)
        try {
            const { data: exp, error } = await supabase
                .from('expenses')
                .select(`
                    *,
                    expense_splits(participant_id, amount)
                `)
                .eq('id', id)
                .single()

            if (error) throw error

            setTitle(exp.title)
            setAmount(exp.amount.toString())
            setCategory(exp.category)
            setPaidBy(exp.paid_by)
            if (exp.date) {
                setDate(new Date(exp.date).toISOString().split('T')[0])
            }

            // Reconstruct splits
            const loadedSplits: Record<string, number> = {}
            if (exp.expense_splits) {
                exp.expense_splits.forEach((s: any) => {
                    loadedSplits[s.participant_id] = s.amount
                })
            }
            setSplits(loadedSplits)
            setSplitType('exact')

        } catch (error) {
            console.error(error)
            toast.error('Failed to load expense details')
            onClose()
        } finally {
            setLoading(false)
        }
    }

    const handleSplitChange = (participantId: string, value: string) => {
        setSplits(prev => ({
            ...prev,
            [participantId]: parseFloat(value) || 0
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const numAmount = parseFloat(amount)
            if (isNaN(numAmount) || numAmount <= 0) throw new Error('Invalid amount')
            if (!paidBy) throw new Error('Please select who paid')

            // Calculate Splits
            const finalSplits: { participant_id: string, amount: number }[] = []

            if (splitType === 'equal') {
                // Split among ALL members (including children)
                const perPersonShare = numAmount / participants.length

                // Consolidate: child shares go to their parent
                const consolidatedSplits: Record<string, number> = {}
                participants.forEach(p => {
                    // If this participant has a parent, add their share to the parent
                    // Otherwise, they pay their own share
                    const targetId = p.parent_id || p.id
                    consolidatedSplits[targetId] = (consolidatedSplits[targetId] || 0) + perPersonShare
                })

                // Convert to final splits array (only parent members will have entries)
                Object.entries(consolidatedSplits).forEach(([pid, amt]) => {
                    finalSplits.push({ participant_id: pid, amount: amt })
                })
            } else {
                // Validate exact splits (manual entry, no consolidation)
                const totalSplit = Object.values(splits).reduce((a, b) => a + b, 0)
                if (Math.abs(totalSplit - numAmount) > 0.05) {
                    throw new Error(`Splits (${totalSplit}) do not match total amount (${numAmount})`)
                }
                Object.entries(splits).forEach(([pid, amt]) => {
                    if (amt > 0) finalSplits.push({ participant_id: pid, amount: amt })
                })
            }

            let expenseId = expenseToEdit?.id

            // Format date to ISO
            const isoDate = new Date(date).toISOString()

            if (expenseToEdit) {
                // UPDATE EXISTING
                const { error: updateError } = await supabase
                    .from('expenses')
                    .update({
                        title,
                        amount: numAmount,
                        category,
                        paid_by: paidBy,
                        date: isoDate
                    })
                    .eq('id', expenseId)

                if (updateError) throw updateError

                // Delete old splits
                await supabase.from('expense_splits').delete().eq('expense_id', expenseId)

            } else {
                // INSERT NEW
                const { data: expenseData, error: expenseError } = await supabase
                    .from('expenses')
                    .insert({
                        trip_id: tripId,
                        title,
                        amount: numAmount,
                        category,
                        paid_by: paidBy,
                        date: isoDate
                    })
                    .select()
                    .single()

                if (expenseError) throw expenseError
                expenseId = expenseData.id
            }

            // Insert Splits (New or Updated)
            if (finalSplits.length > 0 && expenseId) {
                const { error: splitError } = await supabase
                    .from('expense_splits')
                    .insert(finalSplits.map(s => ({
                        expense_id: expenseId,
                        participant_id: s.participant_id,
                        amount: s.amount
                    })))

                if (splitError) throw splitError
            }

            // Fetch full object to return for optimistic update
            const { data: fullExpense } = await supabase
                .from('expenses')
                .select(`
                    *,
                    expense_splits(participant_id, amount)
                `)
                .eq('id', expenseId)
                .single()

            toast.success(expenseToEdit ? 'Expense updated' : 'Expense added successfully')
            onSuccess(fullExpense)
            onClose()
        } catch (error) {
            console.error('Error adding expense:', error)
            const msg = (error as any).message || (error as any).details || 'Unknown error'
            toast.error('Failed to save expense: ' + msg)
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

                <h2 className="text-xl font-bold mb-4">{expenseToEdit ? 'Edit Expense' : 'Add Expense'}</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="compact-label">Description</label>
                        <input
                            type="text"
                            required
                            className="compact-input"
                            placeholder="e.g. Dinner at Mario's"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="compact-label">Amount</label>
                            <input
                                type="number"
                                required
                                step="0.01"
                                className="compact-input font-bold"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="compact-label">Date</label>
                            <input
                                type="date"
                                required
                                className="compact-input"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="compact-label">Category</label>
                            <select
                                className="compact-input"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="compact-label">Paid By</label>
                            <select
                                className="compact-input"
                                value={paidBy}
                                onChange={e => setPaidBy(e.target.value)}
                            >
                                <option value="" disabled>Select Payer</option>
                                {participants.filter(p => !p.parent_id).map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.profiles?.full_name || p.name || p.profiles?.email || 'Guest'} ({p.role === 'owner' ? 'Owner' : 'Member'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">Split</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setSplitType('equal')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded shadow-sm border ${splitType === 'equal' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}
                            >
                                Equally
                            </button>
                            <button
                                type="button"
                                onClick={() => setSplitType('exact')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded shadow-sm border ${splitType === 'exact' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}
                            >
                                Exact Amounts
                            </button>
                        </div>
                        {amount && splitType === 'equal' && (
                            <p className="mt-2 text-xs text-center text-gray-500">
                                <strong>{(parseFloat(amount) / participants.length).toFixed(2)}</strong> / person
                            </p>
                        )}
                        {splitType === 'exact' && (
                            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1 custom-scroll">
                                {participants.map(p => (
                                    <div key={p.id} className="flex items-center gap-2">
                                        <span className="text-sm flex-1 truncate">
                                            {p.profiles?.full_name || p.name || p.profiles?.email || 'Guest'}
                                        </span>
                                        <div className="relative w-24">
                                            <span className="absolute left-2 top-1.5 text-xs text-gray-500">{currency}</span>
                                            <input
                                                type="number"
                                                className="compact-input !pl-5 !py-1 text-right"
                                                placeholder="0.00"
                                                value={splits[p.id] || ''}
                                                onChange={e => handleSplitChange(p.id, e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full flex justify-center items-center gap-2 mt-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (expenseToEdit ? 'Update Expense' : 'Save Expense')}
                    </button>
                </form >
            </div >
        </div >
    )
}
