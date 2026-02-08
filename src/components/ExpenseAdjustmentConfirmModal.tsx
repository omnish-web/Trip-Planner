import { AlertTriangle, Loader2 } from 'lucide-react'

interface ExpenseAdjustmentConfirmModalProps {
    isOpen: boolean
    memberName: string
    onConfirm: (updateExisting: boolean) => void
    onCancel: () => void
    loading?: boolean
}

export default function ExpenseAdjustmentConfirmModal({
    isOpen,
    memberName,
    onConfirm,
    onCancel,
    loading = false
}: ExpenseAdjustmentConfirmModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Update Existing Expenses?
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            You're changing the dependency status for <strong>{memberName}</strong>.
                        </p>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 mb-6 space-y-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        Would you like to adjust <strong>existing expenses</strong> to reflect this change?
                    </p>
                    <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 ml-4 list-disc">
                        <li><strong>Yes:</strong> Recalculate all past equal-split expenses based on the new structure</li>
                        <li><strong>No:</strong> Keep existing expenses as-is, only apply changes to new expenses</li>
                    </ul>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(false)}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gray-600 text-white hover:bg-gray-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        No, Keep Current
                    </button>
                    <button
                        onClick={() => onConfirm(true)}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Yes, Update
                    </button>
                </div>
            </div>
        </div>
    )
}
