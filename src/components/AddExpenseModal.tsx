import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2, Users, Paperclip, Upload, FolderOpen } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { useAllTripAttachments } from '../hooks/useTripData'


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
        payers?: Record<string, number>
        comments?: string
    }
    categories?: string[]
}

export default function AddExpenseModal({ tripId, participants, currency, onClose, onSuccess, expenseToEdit, defaultValues, categories = ['Food', 'Transport', 'Accommodation', 'Entertainment', 'Other'] }: AddExpenseModalProps) {
    const queryClient = useQueryClient()
    const [title, setTitle] = useState(defaultValues?.title || '')
    const [amount, setAmount] = useState(defaultValues?.amount || '')
    const [category, setCategory] = useState(defaultValues?.category || categories[0] || 'Other')
    const [paidBy, setPaidBy] = useState(defaultValues?.paidBy || '')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]) // Default to today
    const [comments, setComments] = useState(defaultValues?.comments || '')
    const [expenseTime, setExpenseTime] = useState(() => {
        const now = new Date()
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    })
    const [splitType, setSplitType] = useState<'equal' | 'exact'>(defaultValues?.splits ? 'exact' : 'equal')
    const [splits, setSplits] = useState<Record<string, number>>(defaultValues?.splits || {})
    const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([])
    const [payerType, setPayerType] = useState<'single' | 'multiple'>(defaultValues?.payers ? 'multiple' : 'single')
    const [payers, setPayers] = useState<Record<string, number>>(defaultValues?.payers || {})
    const [loading, setLoading] = useState(false)

    // File attachments states
    const [file, setFile] = useState<File | null>(null)
    const [existingAttachment, setExistingAttachment] = useState<{ url: string; name: string; size?: number; type?: string } | null>(null)
    const [removeExisting, setRemoveExisting] = useState(false)

    // Library attachments states
    const [selectedLibraryAttachment, setSelectedLibraryAttachment] = useState<{ url: string; name: string; size?: number; type?: string } | null>(null)
    const [showLibraryPicker, setShowLibraryPicker] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setCurrentUserId(data.user.id)
            }
        })
    }, [])

    const { data: allAttachments = [] } = useAllTripAttachments(currentUserId)
    const tripAttachments = useMemo(() => {
        const seen = new Set<string>()
        return allAttachments
            .filter(att => att.trip_id === tripId)
            .filter(att => {
                if (!att.file_url) return false
                if (seen.has(att.file_url)) return false
                seen.add(att.file_url)
                return true
            })
    }, [allAttachments, tripId])


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

    // Initialize selected participants to all parent members by default
    useEffect(() => {
        const parentIds = participants.filter(p => !p.parent_id).map(p => p.id)
        setSelectedParticipantIds(parentIds)
    }, [participants])

    const fetchExpenseDetails = async (id: string) => {
        setLoading(true)
        try {
            const { data: exp, error } = await supabase
                .from('expenses')
                .select(`
                    *,
                    *,
                    expense_splits(participant_id, amount),
                    expense_payers(participant_id, amount)
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
            setExpenseTime(exp.expense_time || '')
            setComments(exp.comments || '')
            if (exp.attachment_url) {
                setExistingAttachment({
                    url: exp.attachment_url,
                    name: exp.attachment_name || 'Receipt',
                    size: exp.attachment_size,
                    type: exp.attachment_type
                })
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

            // Reconstruct Payers
            if (exp.expense_payers && exp.expense_payers.length > 0) {
                if (exp.expense_payers.length > 1) {
                    setPayerType('multiple')
                    const loadedPayers: Record<string, number> = {}
                    exp.expense_payers.forEach((p: any) => {
                        loadedPayers[p.participant_id] = p.amount
                    })
                    setPayers(loadedPayers)
                } else {
                    setPayerType('single')
                    setPaidBy(exp.expense_payers[0].participant_id)
                }
            } else if (exp.paid_by) {
                // Fallback for old data
                setPayerType('single')
                setPaidBy(exp.paid_by)
            }

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

            // Prepare Payers List
            const finalPayers: { participant_id: string, amount: number }[] = []
            let primaryPayerId: string | null = null

            if (payerType === 'single') {
                if (!paidBy) throw new Error('Please select who paid')
                finalPayers.push({ participant_id: paidBy, amount: numAmount })
                primaryPayerId = paidBy
            } else {
                const totalPaid = Object.values(payers).reduce((a, b) => a + b, 0)
                if (Math.abs(totalPaid - numAmount) > 0.05) {
                    throw new Error(`Paid amounts (${totalPaid}) do not match total amount (${numAmount})`)
                }

                Object.entries(payers).forEach(([pid, amt]) => {
                    if (amt > 0) finalPayers.push({ participant_id: pid, amount: amt })
                })

                if (finalPayers.length === 0) throw new Error('Please enter at least one payer')

                // Pick the one who paid the most as "primary" for sorting/display simplification if needed
                finalPayers.sort((a, b) => b.amount - a.amount)
                primaryPayerId = finalPayers[0].participant_id
            }

            // Calculate Splits
            const finalSplits: { participant_id: string, amount: number }[] = []

            if (splitType === 'equal') {
                // Validate at least one member is selected
                if (selectedParticipantIds.length === 0) {
                    throw new Error('Please select at least one member to split with')
                }

                // Get selected participants and their children
                const selectedWithChildren = participants.filter(p => {
                    // Include if directly selected OR if parent is selected
                    return selectedParticipantIds.includes(p.id) ||
                        (p.parent_id && selectedParticipantIds.includes(p.parent_id))
                })

                const perPersonShare = numAmount / selectedWithChildren.length

                // Consolidate: child shares go to their parent
                const consolidatedSplits: Record<string, number> = {}
                selectedWithChildren.forEach(p => {
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

            // Handle uploading new file if selected
            let uploadedUrl = selectedLibraryAttachment?.url || null
            let uploadedName = selectedLibraryAttachment?.name || null
            let uploadedType = selectedLibraryAttachment?.type || null
            let uploadedSize = selectedLibraryAttachment?.size || null

            if (file) {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) throw new Error('Not authenticated')
                const ext = file.name.split('.').pop()
                const storagePath = `${user.id}/${tripId}/${crypto.randomUUID()}.${ext}`

                const { error: uploadError } = await supabase.storage
                    .from('trip-files')
                    .upload(storagePath, file, { contentType: file.type, upsert: false })

                if (uploadError) throw uploadError

                const { data: urlData } = supabase.storage
                    .from('trip-files')
                    .getPublicUrl(storagePath)

                uploadedUrl = urlData.publicUrl
                uploadedName = file.name
                uploadedType = file.type
                uploadedSize = file.size
            }

            // Format date to ISO
            const isoDate = new Date(date).toISOString()

            if (expenseToEdit) {
                // UPDATE EXISTING
                const updatePayload: any = {
                    title,
                    amount: numAmount,
                    category,
                    paid_by: primaryPayerId,
                    date: isoDate,
                    expense_time: expenseTime || null,
                    comments: comments || null
                }

                if (uploadedUrl) {
                    updatePayload.attachment_url = uploadedUrl
                    updatePayload.attachment_name = uploadedName
                    updatePayload.attachment_type = uploadedType
                    updatePayload.attachment_size = uploadedSize
                } else if (removeExisting) {
                    updatePayload.attachment_url = null
                    updatePayload.attachment_name = null
                    updatePayload.attachment_type = null
                    updatePayload.attachment_size = null
                }

                const { error: updateError } = await supabase
                    .from('expenses')
                    .update(updatePayload)
                    .eq('id', expenseId)

                if (updateError) throw updateError

                // Delete old splits and payers
                await supabase.from('expense_splits').delete().eq('expense_id', expenseId)
                await supabase.from('expense_payers').delete().eq('expense_id', expenseId)

            } else {
                // INSERT NEW
                const insertPayload: any = {
                    trip_id: tripId,
                    title,
                    amount: numAmount,
                    category,
                    paid_by: primaryPayerId,
                    date: isoDate,
                    expense_time: expenseTime || null,
                    comments: comments || null
                }

                if (uploadedUrl) {
                    insertPayload.attachment_url = uploadedUrl
                    insertPayload.attachment_name = uploadedName
                    insertPayload.attachment_type = uploadedType
                    insertPayload.attachment_size = uploadedSize
                }

                const { data: expenseData, error: expenseError } = await supabase
                    .from('expenses')
                    .insert(insertPayload)
                    .select()
                    .single()

                if (expenseError) throw expenseError
                expenseId = expenseData.id
            }

            // Insert Payers
            if (finalPayers.length > 0 && expenseId) {
                const { error: payerError } = await supabase
                    .from('expense_payers')
                    .insert(finalPayers.map(p => ({
                        expense_id: expenseId,
                        participant_id: p.participant_id,
                        amount: p.amount
                    })))

                if (payerError) throw payerError
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
                    expense_splits(participant_id, amount),
                    expense_payers(participant_id, amount)
                `)
                .eq('id', expenseId)
                .single()

            toast.success(expenseToEdit ? 'Expense updated' : 'Expense added successfully')
            queryClient.invalidateQueries({ queryKey: ['allAttachments'] })
            queryClient.invalidateQueries({ queryKey: ['expenses', tripId] })
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
            <div className="glass-panel w-full max-w-4xl p-6 bg-white dark:bg-gray-800 relative animate-fade-in max-h-[95vh] overflow-y-auto custom-scroll">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold mb-6">{expenseToEdit ? 'Edit Expense' : 'Add Expense'}</h2>

                <form onSubmit={handleSubmit} className="space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* LEFT COLUMN: Basic Details */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                    <label className="compact-label">Description</label>
                                    <input
                                        type="text"
                                        required
                                        className="compact-input w-full"
                                        placeholder="e.g. Dinner at Mario's"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="compact-label">Category</label>
                                    <select
                                        className="compact-input w-full font-medium"
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                    >
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="compact-label">Amount</label>
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        className="compact-input font-bold w-full"
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
                                        className="compact-input w-full"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="compact-label">Time <span className="text-gray-400 font-normal">(opt)</span></label>
                                    <input
                                        type="time"
                                        className="compact-input w-full"
                                        value={expenseTime}
                                        onChange={e => setExpenseTime(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Comments Section */}
                            <div>
                                <label className="compact-label">Comments <span className="text-gray-400 font-normal">(optional)</span></label>
                                <input
                                    type="text"
                                    className="compact-input w-full"
                                    placeholder="Add any notes about this expense..."
                                    value={comments}
                                    onChange={e => setComments(e.target.value)}
                                />
                            </div>

                            {/* File Attachment Section */}
                            <div>
                                <label className="compact-label flex justify-between items-center">
                                    <span>Attachment <span className="text-gray-400 font-normal">(optional)</span></span>
                                    {!file && !existingAttachment && !selectedLibraryAttachment && (
                                        <button
                                            type="button"
                                            onClick={() => setShowLibraryPicker(true)}
                                            className="text-[10px] font-bold text-fuchsia-400 hover:text-fuchsia-300 transition flex items-center gap-1"
                                        >
                                            <FolderOpen className="w-3 h-3" />
                                            Choose from Library
                                        </button>
                                    )}
                                </label>
                                
                                {existingAttachment && !removeExisting ? (
                                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center gap-2 truncate">
                                            <Paperclip className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            <a 
                                                href={existingAttachment.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate"
                                            >
                                                {existingAttachment.name}
                                            </a>
                                            {existingAttachment.size && (
                                                <span className="text-[10px] text-gray-400">
                                                    ({(existingAttachment.size / 1024).toFixed(1)} KB)
                                                </span>
                                            )}
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => setRemoveExisting(true)}
                                            className="text-[10px] font-bold text-red-500 hover:text-red-600 transition"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : selectedLibraryAttachment ? (
                                    <div className="flex items-center justify-between p-2 bg-fuchsia-500/10 rounded-xl border border-fuchsia-500/20">
                                        <div className="flex items-center gap-2 truncate">
                                            <FolderOpen className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                                            <span className="text-xs font-semibold text-fuchsia-300 truncate">
                                                [Library] {selectedLibraryAttachment.name}
                                            </span>
                                            {selectedLibraryAttachment.size && (
                                                <span className="text-[10px] text-fuchsia-400/50">
                                                    ({(selectedLibraryAttachment.size / 1024).toFixed(1)} KB)
                                                </span>
                                            )}
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => setSelectedLibraryAttachment(null)}
                                            className="text-[10px] font-bold text-red-500 hover:text-red-600 transition"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                ) : file ? (
                                    <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                        <div className="flex items-center gap-2 truncate">
                                            <Paperclip className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            <span className="text-xs font-semibold text-blue-950 dark:text-blue-300 truncate">
                                                {file.name}
                                            </span>
                                            <span className="text-[10px] text-blue-500">
                                                ({(file.size / 1024).toFixed(1)} KB)
                                            </span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => setFile(null)}
                                            className="text-[10px] font-bold text-red-500 hover:text-red-600 transition"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative group border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl transition-all duration-200 cursor-pointer bg-gray-50/50 dark:bg-gray-800/10 hover:bg-white dark:hover:bg-gray-700/10">
                                        <input
                                            type="file"
                                            onChange={e => {
                                                if (e.target.files && e.target.files.length > 0) {
                                                    setFile(e.target.files[0])
                                                }
                                            }}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="flex items-center justify-center py-2 px-3 gap-2">
                                            <Upload className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                            <span className="text-xs font-semibold text-gray-500 group-hover:text-blue-500 transition-colors">
                                                Attach receipt / invoice file
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Paid By Section */}
                            <div>
                                <label className="compact-label">Paid By</label>
                                <div className="flex bg-gray-100 dark:bg-gray-700/50 rounded-lg p-1 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setPayerType('single')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${payerType === 'single' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                                    >
                                        Single
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPayerType('multiple')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${payerType === 'multiple' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                                    >
                                        Multiple
                                    </button>
                                </div>

                                {payerType === 'single' ? (
                                    <select
                                        className="compact-input w-full"
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
                                ) : (
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800/50">
                                        <div className="max-h-60 overflow-y-auto custom-scroll p-2 space-y-1">
                                            {participants.filter(p => !p.parent_id).map(p => (
                                                <div key={p.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-700/50 rounded-lg transition-colors">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${p.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {(p.profiles?.full_name || p.name || 'G')[0]}
                                                    </div>
                                                    <span className="text-sm font-medium flex-1 truncate text-gray-700 dark:text-gray-200">
                                                        {p.profiles?.full_name || p.name || p.profiles?.email || 'Guest'}
                                                    </span>
                                                    <div className="relative w-24">
                                                        <span className="absolute left-2 top-1.5 text-xs text-gray-500">{currency}</span>
                                                        <input
                                                            type="number"
                                                            className="compact-input !pl-6 !py-1 text-right text-sm font-medium"
                                                            placeholder="0"
                                                            value={payers[p.id] || ''}
                                                            onChange={e => setPayers(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-gray-100 dark:bg-gray-700/50 px-4 py-2 flex justify-between items-center text-xs font-bold border-t border-gray-200 dark:border-gray-700">
                                            <span className="text-gray-500 dark:text-gray-400">TOTAL</span>
                                            <span className={`text-sm ${Math.abs(Object.values(payers).reduce((a, b) => a + b, 0) - parseFloat(amount || '0')) < 0.05 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                                {Object.values(payers).reduce((a, b) => a + b, 0).toFixed(2)} / {parseFloat(amount || '0').toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Split Details */}
                        <div className="space-y-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 h-full">
                                <div className="flex items-center gap-2 mb-4">
                                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">Split Method</span>
                                </div>

                                <div className="flex gap-2 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setSplitType('equal')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded shadow-sm border transition-all ${splitType === 'equal' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}
                                    >
                                        Equally
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSplitType('exact')}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded shadow-sm border transition-all ${splitType === 'exact' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'}`}
                                    >
                                        Exact Amounts
                                    </button>
                                </div>

                                {amount && splitType === 'equal' && (
                                    <div className="space-y-3">
                                        <div className="max-h-[300px] overflow-y-auto pr-1 custom-scroll space-y-1">
                                            {participants.filter(p => !p.parent_id).map(parent => {
                                                const children = participants.filter(c => c.parent_id === parent.id)
                                                const isSelected = selectedParticipantIds.includes(parent.id)

                                                return (
                                                    <div key={parent.id}>
                                                        <label className="flex items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-gray-700/50 p-2 rounded transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedParticipantIds(prev => [...prev, parent.id])
                                                                    } else {
                                                                        setSelectedParticipantIds(prev => prev.filter(id => id !== parent.id))
                                                                    }
                                                                }}
                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm flex-1 font-medium text-gray-700 dark:text-gray-200">
                                                                {parent.profiles?.full_name || parent.name || parent.profiles?.email || 'Guest'}
                                                                {children.length > 0 && (
                                                                    <span className="text-xs text-gray-500 ml-1">
                                                                        (+ {children.map(c => c.name).join(', ')})
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </label>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        {selectedParticipantIds.length > 0 && (
                                            <p className="text-xs text-center text-gray-500 pt-3 border-t border-blue-200 dark:border-blue-800">
                                                <strong>
                                                    {(() => {
                                                        const selectedWithChildren = participants.filter(p =>
                                                            selectedParticipantIds.includes(p.id) ||
                                                            (p.parent_id && selectedParticipantIds.includes(p.parent_id))
                                                        )
                                                        return (parseFloat(amount) / selectedWithChildren.length).toFixed(2)
                                                    })()}
                                                </strong> / person
                                            </p>
                                        )}
                                    </div>
                                )}

                                {splitType === 'exact' && (
                                    <div className="max-h-[300px] overflow-y-auto pr-1 custom-scroll space-y-2">
                                        {participants.map(p => (
                                            <div key={p.id} className="flex items-center gap-2 hover:bg-white dark:hover:bg-gray-700/50 p-1.5 rounded">
                                                <span className="text-sm flex-1 truncate font-medium text-gray-700 dark:text-gray-200">
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
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex justify-center items-center gap-2 py-3 text-base shadow-lg hover:shadow-xl transition-all"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (expenseToEdit ? 'Update Expense' : 'Save Expense')}
                        </button>
                    </div>
                </form>
            </div >

            {/* Library File Picker Modal */}
            {showLibraryPicker && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#0a0f2c] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-scale-up">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-white text-base flex items-center gap-2">
                                <FolderOpen className="w-4 h-4 text-fuchsia-400" />
                                Trip File Library
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowLibraryPicker(false)}
                                className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 max-h-[350px] overflow-y-auto custom-scroll space-y-2">
                            {tripAttachments.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-sm italic">
                                    No attachments uploaded to this trip yet.
                                </div>
                            ) : (
                                tripAttachments.map((att) => (
                                    <div
                                        key={att.id}
                                        onClick={() => {
                                            setSelectedLibraryAttachment({
                                                url: att.file_url,
                                                name: att.file_name,
                                                size: att.file_size,
                                                type: att.file_type
                                            })
                                            setShowLibraryPicker(false)
                                        }}
                                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-fuchsia-500/10 border border-white/5 hover:border-fuchsia-500/20 cursor-pointer transition"
                                    >
                                        <div className="min-w-0 flex-1 flex items-center gap-3">
                                            <Paperclip className="w-4 h-4 text-fuchsia-400 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold text-slate-200 truncate">
                                                    {att.file_name}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">
                                                    {(att.file_size / 1024).toFixed(1)} KB · {att.uploader_name || 'Guest'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="text-[10px] font-bold text-fuchsia-400 hover:text-fuchsia-300 px-2.5 py-1 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 rounded-lg transition shrink-0"
                                        >
                                            Select
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    )
}
