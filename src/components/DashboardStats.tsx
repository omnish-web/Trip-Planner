import { Plane, Zap, Compass, Archive } from 'lucide-react'

interface DashboardStatsProps {
    total: number
    active: number
    upcoming: number
    past: number
    filter: string
    onFilterChange: (f: 'all' | 'active' | 'upcoming' | 'past') => void
}

const buildStats = (total: number, active: number, upcoming: number, past: number) => [
    {
        label: 'Total Trips',
        filterKey: 'all' as const,
        value: total,
        icon: Plane,
        color: 'from-violet-500/20 to-violet-600/5',
        border: 'border-violet-500/20 hover:border-violet-500/50',
        glow: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]',
        iconColor: 'text-violet-400',
        iconBg: 'bg-violet-500/10',
        valueColor: 'text-violet-200',
        delay: '0ms',
        pulse: false,
    },
    {
        label: 'Active Now',
        filterKey: 'active' as const,
        value: active,
        icon: Zap,
        color: 'from-fuchsia-500/20 to-fuchsia-600/5',
        border: 'border-fuchsia-500/20 hover:border-fuchsia-500/50',
        glow: 'hover:shadow-[0_0_30px_rgba(192,38,211,0.2)]',
        iconColor: 'text-fuchsia-400',
        iconBg: 'bg-fuchsia-500/10',
        valueColor: active > 0 ? 'shimmer-text' : 'text-fuchsia-200',
        delay: '80ms',
        pulse: active > 0,
    },
    {
        label: 'Upcoming',
        filterKey: 'upcoming' as const,
        value: upcoming,
        icon: Compass,
        color: 'from-indigo-500/20 to-indigo-600/5',
        border: 'border-indigo-500/20 hover:border-indigo-500/50',
        glow: 'hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]',
        iconColor: 'text-indigo-400',
        iconBg: 'bg-indigo-500/10',
        valueColor: 'text-indigo-200',
        delay: '160ms',
        pulse: false,
    },
    {
        label: 'Memories',
        filterKey: 'past' as const,
        value: past,
        icon: Archive,
        color: 'from-slate-500/20 to-slate-600/5',
        border: 'border-slate-500/20 hover:border-slate-500/40',
        glow: 'hover:shadow-[0_0_30px_rgba(100,116,139,0.15)]',
        iconColor: 'text-slate-400',
        iconBg: 'bg-slate-500/10',
        valueColor: 'text-slate-300',
        delay: '240ms',
        pulse: false,
    },
]

export default function DashboardStats({ total, active, upcoming, past, filter, onFilterChange }: DashboardStatsProps) {
    const items = buildStats(total, active, upcoming, past)

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map((stat) => {
                const Icon = stat.icon
                const isActive = filter === stat.filterKey
                return (
                    <button
                        key={stat.label}
                        onClick={() => onFilterChange(stat.filterKey)}
                        className={`
                            relative group rounded-2xl p-5 text-left outline-none
                            bg-gradient-to-br ${stat.color}
                            bg-[#0a0f2c]/60 backdrop-blur-xl
                            border ${isActive ? 'border-white/40 ring-2 ring-white/10' : stat.border}
                            ${stat.glow}
                            transition-all duration-300
                            animate-fade-in-up
                            overflow-hidden
                            ${isActive ? 'shadow-[0_0_40px_rgba(255,255,255,0.1)] scale-[1.02]' : ''}
                        `}
                        style={{ animationDelay: stat.delay, animationFillMode: 'both' }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

                        {stat.pulse && (
                            <span className="absolute top-3 right-3 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-fuchsia-500" />
                            </span>
                        )}

                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center border border-white/5`}>
                                <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                            </div>
                        </div>

                        <div className={`text-4xl font-black mb-1 tabular-nums leading-none ${stat.valueColor}`}>
                            {stat.value}
                        </div>
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-400 transition-colors">
                            {stat.label}
                        </div>
                    </button>
                )
            })}
        </div>
    )
}

