import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

interface BalancesTabProps {
    balances: {
        participantId: string
        amount: number
        name: string
    }[]
    settlements: {
        from: string
        to: string
        amount: number
    }[]
    currency: string
    onSettle: (from: string, to: string, amount: number) => void
    currentUser: string | null
}

export default function BalancesTab({ balances, settlements, currency, onSettle, currentUser }: BalancesTabProps) {

    // Sort balances for chart
    const chartData = [...balances].sort((a, b) => b.amount - a.amount)

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">

            {/* Balances Visualization */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* LEFT: Net Balances Card */}
                <div className="glass-panel p-6 h-[600px] flex flex-col">
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

                {/* RIGHT: Who owes who Card */}
                <div className="glass-panel p-6 h-[600px] flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 shrink-0">Settlement Plan</h3>

                    <div className="flex-1 overflow-y-auto -mx-4 px-4 overflow-x-hidden custom-scrollbar">
                        {settlements.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                                </div>
                                <h4 className="text-lg font-bold text-gray-800 dark:text-white">All Settled!</h4>
                                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">No pending debts between members.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {settlements.map((s, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <div className="flex items-center flex-wrap gap-1.5 leading-snug">
                                                <span className="font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{s.from}</span>
                                                <span className="text-xs text-gray-400">pays</span>
                                                <span className="font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{s.to}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="font-mono font-bold text-lg text-blue-600 dark:text-blue-400">
                                                {currency} {s.amount.toFixed(2)}
                                            </span>
                                            <button
                                                onClick={() => onSettle(s.from, s.to, s.amount)}
                                                className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"
                                                title="Settle"
                                            >
                                                <ArrowRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
