import React, { useMemo } from 'react'
import { Plus, Trash2, Edit2, CheckSquare, Square, X, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'


interface ExpensesTabProps {
    expenses: any[]
    participants: any[]
    currency: string
    currentUserId: string | null
    isOwner: boolean
    balances: { participantId: string, amount: number }[]
    selectedExpenseIds: string[]
    onAddExpense: () => void
    onEditExpense: (expense: any) => void
    onDeleteExpense: (id: string) => void
    onRemoveMember: (id: string, name: string) => void
    onEditMember: (member: any) => void
    onAddMember: () => void
    onToggleSelectExpense: (id: string) => void
    onSelectAllDate: (date: string, expenseIds: string[]) => void
    onBulkDelete: () => void
    onBulkCategoryChange: () => void
    onDeleteAllExpenses: () => void
    getParticipantName: (id: string) => string
    categories?: string[]
    canEdit?: boolean
    isEnded?: boolean
}



const ExpensesTab = React.memo(({
    expenses,
    participants,
    currency,
    currentUserId,
    isOwner,
    balances,
    selectedExpenseIds,
    onAddExpense,
    onEditExpense,
    onDeleteExpense,
    onRemoveMember,
    onEditMember,
    onAddMember,
    onToggleSelectExpense,
    onSelectAllDate,
    onBulkDelete,
    onBulkCategoryChange,
    onDeleteAllExpenses,
    getParticipantName,
    categories: _categories,
    canEdit = true,
    isEnded = false
}: ExpensesTabProps) => {

    // 1. Calculate Stats
    // 1. Calculate Stats (Exclude Settlements)
    const validExpenses = expenses.filter(e => e.category !== 'Settlement' && e.title !== 'Settlement')
    const totalCost = validExpenses.reduce((sum, e) => sum + e.amount, 0)

    // Your Share
    const myParticipantId = participants.find(p => p.user_id === currentUserId)?.id
    const mySpending = validExpenses.filter(e => e.paid_by === myParticipantId).reduce((sum, e) => sum + e.amount, 0)

    // Category Data for Pie Chart
    const categoryData = useMemo(() => {
        const stats: Record<string, number> = {}
        validExpenses.forEach(e => {
            stats[e.category] = (stats[e.category] || 0) + e.amount
        })
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }, [validExpenses])

    // Group Expenses by Date
    const groupedExpenses = useMemo(() => {
        const groups: Record<string, any[]> = {}
        expenses.filter(e => e.category !== 'Settlement' && e.title !== 'Settlement').forEach(e => {
            const dateStr = e.date
            if (!groups[dateStr]) groups[dateStr] = []
            groups[dateStr].push(e)
        })
        // Sort groups by date descending
        return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    }, [expenses])


    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in relative pb-20">

            {/* Ended Trip Warning Banner */}
            {isEnded && (
                <div className="glass-panel p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/50">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
                        <div>
                            <p className="font-bold text-orange-800 dark:text-orange-300">This trip has ended</p>
                            <p className="text-sm text-orange-700 dark:text-orange-400 mt-0.5">
                                All editing is disabled for everyone. {
                                    isOwner
                                        ? 'As the owner, you can reopen the trip from Settings if needed.'
                                        : 'Please contact owner to enable editing.'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}


            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-panel p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none">
                    <p className="text-blue-100 text-sm font-medium mb-1">Total Trip Cost</p>
                    <h2 className="text-3xl font-bold">{currency} {totalCost.toFixed(2)}</h2>
                </div>
                <div className="glass-panel p-6 dark:bg-gray-800">
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">You Paid</p>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{currency} {mySpending.toFixed(2)}</h2>
                </div>
                <div className="glass-panel p-6 dark:bg-gray-800">
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">Top Category</p>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
                        {categoryData.length > 0 ? categoryData[0].name : '-'}
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* LEFT: Transaction List */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Recent Transactions</h3>
                        <div className="flex gap-2">
                            {/* Delete All Button - Owner Only */}
                            {isOwner && expenses.length > 0 && (
                                <button
                                    onClick={onDeleteAllExpenses}
                                    disabled={!canEdit}
                                    className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition border border-red-200 dark:border-red-900/50 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={!canEdit ? 'Trip is ended' : 'Delete all expenses'}
                                >
                                    <AlertTriangle className="w-3 h-3" />
                                    Reset
                                </button>
                            )}
                            <button
                                onClick={onAddExpense}
                                disabled={!canEdit}
                                className="btn-primary py-2 px-4 text-sm flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!canEdit ? 'Trip is ended' : 'Add new expense'}
                            >
                                <Plus className="w-4 h-4" /> Add Expense
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {groupedExpenses.length === 0 ? (
                            <div className="glass-panel p-12 text-center text-gray-400 italic">
                                No expenses yet. Start by adding one!
                            </div>
                        ) : (
                            groupedExpenses.map(([date, groupExpenses]) => {
                                const isAllSelected = groupExpenses.every(e => selectedExpenseIds.includes(e.id))

                                return (
                                    <div key={date} className="space-y-2">
                                        {/* Date Header */}
                                        <div className="flex items-center gap-3 px-2">
                                            {isOwner && (
                                                <button
                                                    onClick={() => onSelectAllDate(date, groupExpenses.map((e: any) => e.id))}
                                                    disabled={!canEdit}
                                                    className={`p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isAllSelected ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
                                                    title={!canEdit ? 'Trip is ended' : 'Select all for this date'}
                                                >
                                                    {isAllSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                </button>
                                            )}
                                            <div className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                <CalendarIcon className="w-4 h-4" />
                                                {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                                            </div>
                                        </div>

                                        {/* Transactions for Date */}
                                        <div className="space-y-2">
                                            {groupExpenses.map((expense: any) => {
                                                const isSelected = selectedExpenseIds.includes(expense.id)

                                                return (
                                                    <div
                                                        key={expense.id}
                                                        className={`glass-panel p-4 flex items-center justify-between hover:scale-[1.01] transition-all duration-200 cursor-pointer group border
                                                            ${isSelected ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent'}`}
                                                        onClick={() => {
                                                            if (isOwner) {
                                                                onToggleSelectExpense(expense.id)
                                                            } else if (participants.find(p => p.id === expense.paid_by)?.user_id === currentUserId) {
                                                                onEditExpense(expense)
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            {/* Checkbox for Owner */}
                                                            {isOwner && (
                                                                <div className={`shrink-0 transition-colors ${isSelected ? 'text-blue-600' : 'text-gray-300 group-hover:text-gray-400'}`}>
                                                                    {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                                </div>
                                                            )}

                                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl
                                                                ${expense.category === 'Food' ? 'bg-orange-100 text-orange-600' :
                                                                    expense.category === 'Transport' ? 'bg-blue-100 text-blue-600' :
                                                                        expense.category === 'Accommodation' ? 'bg-purple-100 text-purple-600' :
                                                                            'bg-gray-100 text-gray-600'
                                                                } dark:bg-opacity-20`}>
                                                                {expense.category === 'Food' ? '🍔' :
                                                                    expense.category === 'Transport' ? '✈️' :
                                                                        expense.category === 'Accommodation' ? '🏨' : '💸'}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-gray-800 dark:text-white text-base">{expense.title}</p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                                    <span className="font-medium text-gray-700 dark:text-gray-300">{getParticipantName(expense.paid_by)}</span>
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-4">
                                                            <div className="text-right">
                                                                <p className="font-bold text-gray-800 dark:text-white text-lg">
                                                                    {currency} {expense.amount.toFixed(2)}
                                                                </p>
                                                            </div>

                                                            {/* Individual Action (Edit Only, Delete via bulk) */}
                                                            {
                                                                !isSelected && canEdit && (isOwner || participants.find(p => p.id === expense.paid_by)?.user_id === currentUserId) && (
                                                                    <div className="flex gap-1">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); onEditExpense(expense) }}
                                                                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition"
                                                                            title="Edit"
                                                                        >
                                                                            <Edit2 className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); onDeleteExpense(expense.id) }}
                                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition"
                                                                            title="Delete"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                )
                                                            }
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT: Analytics */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Member Spending List */}
                    <div className="glass-panel p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                Members
                            </h3>
                            {isOwner && (
                                <button
                                    onClick={onAddMember}
                                    disabled={!canEdit}
                                    className="p-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={!canEdit ? 'Trip is ended' : 'Add Member'}
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {/* Group parents with their children */}
                            {participants.filter(p => !p.parent_id).map(parent => {
                                const parentTotalSpent = expenses.filter(e => e.paid_by === parent.id && e.category !== 'Settlement' && e.title !== 'Settlement').reduce((sum, e) => sum + e.amount, 0)
                                const parentBalance = balances.find(b => b.participantId === parent.id)?.amount || 0
                                const parentName = parent.profiles?.full_name || parent.name || parent.profiles?.email
                                const children = participants.filter(c => c.parent_id === parent.id)

                                return (
                                    <div key={parent.id} className="space-y-1">
                                        {/* Parent Member */}
                                        <div className="flex items-center justify-between group gap-2">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${parent.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                                    {(parentName || 'G')[0]}
                                                </div>
                                                <span className="text-sm font-medium text-gray-800 dark:text-white whitespace-nowrap">
                                                    {parentName}
                                                </span>
                                                {isOwner && (
                                                    <button
                                                        onClick={() => onEditMember(parent)}
                                                        disabled={!canEdit}
                                                        className="p-1 rounded-full text-gray-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title={!canEdit ? 'Trip is ended' : 'Edit Member Name'}
                                                    >
                                                        <Edit2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded shrink-0 ${parent.role === 'owner' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    {parent.role === 'owner' ? 'Owner' : 'Member'}
                                                </span>
                                                {children.length > 0 && (
                                                    <span className="text-[10px] text-purple-500 shrink-0">+{children.length}</span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <div className="font-mono text-sm font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {currency} {parentTotalSpent.toFixed(0)}
                                                </div>

                                                {isOwner && (
                                                    <button
                                                        onClick={() => onRemoveMember(parent.id, parentName)}
                                                        disabled={!canEdit || Math.abs(parentBalance) > 0.01}
                                                        className={`p-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${Math.abs(parentBalance) < 0.01 ? 'text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer' : 'text-gray-200 cursor-not-allowed'}`}
                                                        title={!canEdit ? 'Trip is ended' : Math.abs(parentBalance) > 0.01 ? `Cannot remove (Balance: ${parentBalance.toFixed(2)})` : "Remove Member"}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Child Members (indented under parent) */}
                                        {children.map(child => {
                                            const childName = child.profiles?.full_name || child.name || child.profiles?.email
                                            return (
                                                <div key={child.id} className="ml-8 flex items-center justify-between py-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-700">
                                                            {(childName || 'D')[0]}
                                                        </div>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                                            {childName}
                                                            {isOwner && (
                                                                <button
                                                                    onClick={() => onEditMember(child)}
                                                                    disabled={!canEdit}
                                                                    className="p-0.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    title={!canEdit ? 'Trip is ended' : 'Edit Dependent Name'}
                                                                >
                                                                    <Edit2 className="w-2.5 h-2.5" />
                                                                </button>
                                                            )}
                                                            <span className="px-1.5 py-0.5 text-[9px] font-medium bg-purple-100 text-purple-600 rounded">
                                                                Dependent
                                                            </span>
                                                        </p>
                                                    </div>

                                                    {isOwner && (
                                                        <button
                                                            onClick={() => onRemoveMember(child.id, childName)}
                                                            disabled={!canEdit}
                                                            className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title={!canEdit ? 'Trip is ended' : 'Remove Dependent'}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Category Breakdown */}
                    <div className="glass-panel p-5">
                        <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-2">Category Split</h3>
                        <div className="space-y-4">
                            {categoryData.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">No expenses yet</p>
                            ) : (
                                categoryData.map((cat) => {
                                    const percentage = totalCost > 0 ? (cat.value / totalCost) * 100 : 0

                                    // Helper for colors/icons (inline for now to match transaction list style)
                                    let colorClass = 'bg-gray-100 text-gray-600'
                                    let barColor = 'bg-gray-400'
                                    let icon = '💸'

                                    if (cat.name === 'Food') {
                                        colorClass = 'bg-orange-100 text-orange-600'
                                        barColor = 'bg-orange-500'
                                        icon = '🍔'
                                    } else if (cat.name === 'Transport') {
                                        colorClass = 'bg-blue-100 text-blue-600'
                                        barColor = 'bg-blue-500'
                                        icon = '✈️'
                                    } else if (cat.name === 'Accommodation') {
                                        colorClass = 'bg-purple-100 text-purple-600'
                                        barColor = 'bg-purple-500'
                                        icon = '🏨'
                                    } else if (cat.name === 'Entertainment') {
                                        colorClass = 'bg-pink-100 text-pink-600'
                                        barColor = 'bg-pink-500'
                                        icon = '🎉'
                                    }

                                    return (
                                        <div key={cat.name} className="group">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${colorClass} dark:bg-opacity-20`}>
                                                        {icon}
                                                    </div>
                                                    <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">{cat.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block font-bold text-gray-800 dark:text-white text-sm">{currency} {cat.value.toFixed(0)}</span>
                                                    <span className="text-xs text-gray-400">{percentage.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                            {/* Progress Bar */}
                                            <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${barColor} rounded-full transition-all duration-500 ease-out`}
                                                    style={{ width: `${percentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                </div>
            </div >

            {/* Bulk Action Bar - Sticky Bottom */}
            {
                isOwner && selectedExpenseIds.length > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 animate-slide-up z-50">
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            {selectedExpenseIds.length} selected
                        </span>
                        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                        <button
                            onClick={onBulkCategoryChange}
                            className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                            <Edit2 className="w-4 h-4" /> Change Category
                        </button>
                        <button
                            onClick={onBulkDelete}
                            className="flex items-center gap-1.5 text-sm font-bold text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                            <Trash2 className="w-4 h-4" /> Delete ({selectedExpenseIds.length})
                        </button>
                        <button
                            onClick={() => onSelectAllDate('', [])} // Clear selection 
                            className="ml-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                )
            }
        </div >
    )
})

export default ExpensesTab
