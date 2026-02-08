import { AlertTriangle, X, Loader2 } from 'lucide-react'

interface ConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'info'
    loading?: boolean
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    loading = false
}: ConfirmModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel w-full max-w-sm p-6 relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center mb-6">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 
                        ${variant === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-500' :
                            variant === 'warning' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-500' :
                                'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-500'}`}>
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {message}
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 px-4 py-2 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2
                            ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                                variant === 'warning' ? 'bg-orange-500 hover:bg-orange-600' :
                                    'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}
