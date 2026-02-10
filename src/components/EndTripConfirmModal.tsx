import { useState } from 'react'
import { X, AlertTriangle, Mail } from 'lucide-react'

interface EndTripConfirmModalProps {
    tripName: string
    onClose: () => void
    onConfirm: (sendEmail: boolean, useOriginalDate?: boolean) => void
    previousEndedAt?: string | null
    unsettledBalances?: { participantId: string, amount: number, name: string }[]
}

export default function EndTripConfirmModal({ tripName, onClose, onConfirm, previousEndedAt, unsettledBalances = [] }: EndTripConfirmModalProps) {
    const [sendEmail, setSendEmail] = useState(false)
    const [useOriginalDate, setUseOriginalDate] = useState(true)

    const handleConfirm = () => {
        onConfirm(sendEmail, previousEndedAt ? useOriginalDate : undefined)
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    // Filter for actual debts (negative balances or positive balances that imply others have debts)
    // Actually, any non-zero balance means the trip isn't fully settled.
    // Let's check for any non-zero balances (with a small epsilon for float errors)
    const hasUnsettledDebts = unsettledBalances.some(b => Math.abs(b.amount) > 0.01)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="glass-panel w-full max-w-2xl bg-white dark:bg-gray-900 relative flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <div className="p-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30">
                            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        End Trip
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">
                        Are you sure you want to end <strong>{tripName}</strong>?
                    </p>

                    {/* Unsettled Balances Warning */}
                    {hasUnsettledDebts && (
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                            <h4 className="font-bold text-red-800 dark:text-red-300 flex items-center gap-2 text-sm mb-1">
                                <AlertTriangle className="w-4 h-4" />
                                Unsettled Balances
                            </h4>
                            <p className="text-xs text-red-700 dark:text-red-400 mb-2">
                                There are still unsettled debts in this trip. Ending the trip will lock all editing capabilities.
                            </p>
                            <ul className="text-xs space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                                {unsettledBalances.filter(b => b.amount < -0.01).map(b => (
                                    <li key={b.participantId} className="flex justify-between text-red-600 dark:text-red-400">
                                        <span>{b.name}</span>
                                        <span className="font-mono">owes {(Math.abs(b.amount)).toFixed(2)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            Members will no longer be able to add or edit expenses after the trip is ended.
                        </p>
                    </div>

                    {previousEndedAt && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 space-y-3">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                This trip was previously ended on <strong>{formatDate(previousEndedAt)}</strong>
                            </p>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={useOriginalDate}
                                        onChange={() => setUseOriginalDate(true)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        Keep original date ({formatDate(previousEndedAt)})
                                    </span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={!useOriginalDate}
                                        onChange={() => setUseOriginalDate(false)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        Use today's date ({formatDate(new Date().toISOString())})
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <input
                            type="checkbox"
                            checked={sendEmail}
                            onChange={(e) => setSendEmail(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            Send email notification to members
                        </span>
                    </label>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
                        >
                            End Trip
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
