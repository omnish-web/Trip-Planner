import { CheckCircle2, Pencil } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface BalancesTabProps {
    balances: {
        participantId: string
        amount: number
        name: string
    }[]
    settlements: {
        from: string
        fromId: string
        to: string
        toId: string
        amount: number
    }[]
    settledHistory?: {
        id: string
        from: string
        to: string
        amount: number
        date: string
        settled_at?: string
    }[]
    currency: string
    onSettle: (from: string, to: string, amount: number) => void
    onEditSettlement?: (id: string) => void
    currentUser: string | null
    onUndoSettlement?: (id: string) => void
    canEdit?: boolean
    isEnded?: boolean
    isOwner?: boolean
}

function SettledRow({
    s,
    currency,
    canEdit,
    onUndoSettlement,
    onEditSettlement,
}: {
    s: NonNullable<BalancesTabProps['settledHistory']>[number]
    currency: string
    canEdit: boolean
    onUndoSettlement?: (id: string) => void
    onEditSettlement?: (id: string) => void
}) {
    const displayDate = (() => {
        try { return format(parseISO(s.date), 'd MMM yyyy') }
        catch { return s.date }
    })()

    return (
        <div className="grid gap-4 items-center p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 opacity-80 hover:opacity-100 transition-opacity group" style={{ gridTemplateColumns: '2fr auto auto' }}>

            {/* Description + Date */}
            <div className="text-sm min-w-0">
                <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">{s.from}</span>
                    <span className="text-gray-400 dark:text-gray-600 mx-1.5 text-xs">paid</span>
                    <span className="font-medium text-gray-600 dark:text-gray-400">{s.to}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{displayDate}</span>
                    {canEdit && onEditSettlement && (
                        <button
                            onClick={() => onEditSettlement(s.id)}
                            className="text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition"
                            title="Edit settlement"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Amount */}
            <div className="col-span-1 text-right font-mono font-medium text-gray-500 dark:text-gray-500 line-through decoration-gray-400 text-sm whitespace-nowrap">
                {currency} {s.amount.toFixed(2)}
            </div>

            {/* Settled Badge / Undo */}
            <div className="col-span-1 flex justify-center relative">
                <span className={`px-4 py-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-xs font-bold text-center cursor-default transition-opacity duration-200 ${canEdit ? 'group-hover:opacity-0' : ''}`}>
                    Settled
                </span>
                {canEdit && (
                    <button
                        onClick={() => onUndoSettlement?.(s.id)}
                        className="absolute inset-0 flex items-center justify-center bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-4"
                        title="Undo Settlement"
                    >
                        Undo
                    </button>
                )}
            </div>
        </div>
    )
}

export default function BalancesTab({ balances, settlements, settledHistory = [], currency, onSettle, currentUser: _currentUser, onUndoSettlement, onEditSettlement, canEdit = true, isOwner = false }: BalancesTabProps) {

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

                {/* LEFT: Settlement Plan */}
                <div className="lg:col-span-3 glass-panel p-6 h-[600px] flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 shrink-0">Settlement Plan</h3>

                    <div className="flex-1 overflow-y-auto -mx-4 px-4 overflow-x-hidden custom-scrollbar">
                        {settlements.length === 0 && settledHistory.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                                </div>
                                <h4 className="text-lg font-bold text-gray-800 dark:text-white">All Settled!</h4>
                                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">No pending debts between members.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Header */}
                                <div className="grid gap-4 px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800" style={{ gridTemplateColumns: '2fr auto auto' }}>
                                    <div>Description</div>
                                    <div className="text-right">Amount</div>
                                    <div className="text-center">Action</div>
                                </div>

                                {/* Pending Settlements */}
                                {settlements.map((s, idx) => (
                                    <div key={`pending-${idx}`} className="grid gap-4 items-center p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors bg-white dark:bg-transparent" style={{ gridTemplateColumns: '2fr auto auto' }}>
                                        <div className="text-sm">
                                            <span className="font-semibold text-gray-800 dark:text-gray-200">{s.from}</span>
                                            <span className="text-gray-400 dark:text-gray-500 mx-1.5 text-xs">pays</span>
                                            <span className="font-semibold text-gray-800 dark:text-gray-200">{s.to}</span>
                                        </div>
                                        <div className="col-span-1 text-right font-mono font-bold text-blue-600 dark:text-blue-400 text-sm whitespace-nowrap">
                                            {currency} {s.amount.toFixed(2)}
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            <button
                                                onClick={() => onSettle(s.fromId, s.toId, s.amount)}
                                                disabled={!canEdit || (!isOwner && _currentUser !== s.fromId && _currentUser !== s.toId)}
                                                className="px-4 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition text-xs font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={
                                                    !canEdit ? 'Trip is ended'
                                                        : (!isOwner && _currentUser !== s.fromId && _currentUser !== s.toId)
                                                            ? 'Only owner or involved members can settle'
                                                            : 'Settle Debt'
                                                }
                                            >
                                                Settle
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Separator */}
                                {settlements.length > 0 && settledHistory.length > 0 && (
                                    <div className="py-4 flex items-center gap-4">
                                        <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Settled History</span>
                                        <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                                    </div>
                                )}

                                {/* Settled History */}
                                {settledHistory.map((s) => (
                                    <SettledRow
                                        key={`settled-${s.id}`}
                                        s={s}
                                        currency={currency}
                                        canEdit={canEdit}
                                        onUndoSettlement={onUndoSettlement}
                                        onEditSettlement={onEditSettlement}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Net Balances */}
                <div className="lg:col-span-2 glass-panel p-6 h-[600px] flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 shrink-0">Net Balances</h3>
                    <div className="flex-1 overflow-y-auto -mx-4 px-4 space-y-3 custom-scrollbar">
                        {balances.map(b => (
                            <div key={b.participantId} className="flex justify-between items-center p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${b.amount >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                        {b.name?.[0] || 'U'}
                                    </div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">{b.name}</span>
                                </div>
                                <div className={`text-lg font-bold font-mono ${b.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {b.amount >= 0 ? '+' : ''}{currency} {b.amount.toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
