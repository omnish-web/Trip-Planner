import { useAllTripAttachments } from '../hooks/useTripData'
import { HardDrive } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Define a default storage limit: 1 GB (1024 MB)
export const STORAGE_LIMIT_MB = 1024
export const STORAGE_LIMIT_BYTES = STORAGE_LIMIT_MB * 1024 * 1024

export function readableSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

interface StorageMeterProps {
    userId: string | null
    compact?: boolean
}

export default function StorageMeter({ userId, compact = false }: StorageMeterProps) {
    const { data: attachments = [], isLoading: isLoadingAttachments } = useAllTripAttachments(userId)

    const { data: imagesSize = 0, isLoading: isLoadingImages } = useQuery({
        queryKey: ['tripImagesSize', userId],
        queryFn: async () => {
            if (!userId) return 0
            const { data, error } = await supabase.storage.from('trip-images').list(userId, { limit: 100 })
            if (error) return 0
            return (data || []).reduce((acc, f) => acc + (f.metadata?.size || 0), 0)
        },
        enabled: !!userId,
    })

    const totalUsedBytes = attachments.reduce((acc, att) => acc + (att.file_size || 0), 0) + imagesSize
    const percentage = Math.min((totalUsedBytes / STORAGE_LIMIT_BYTES) * 100, 100)

    const isLoading = isLoadingAttachments || isLoadingImages

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-2">
                <LoaderRing size={compact ? 32 : 44} />
            </div>
        )
    }

    // Breakdown calculations
    const receiptsSize = attachments.filter(att => att.expense_id).reduce((acc, att) => acc + (att.file_size || 0), 0)
    const notesSize = attachments.filter(att => att.note_id).reduce((acc, att) => acc + (att.file_size || 0), 0)
    const otherSize = attachments.filter(att => !att.expense_id && !att.note_id).reduce((acc, att) => acc + (att.file_size || 0), 0)
    const freeSize = Math.max(STORAGE_LIMIT_BYTES - totalUsedBytes, 0)

    // SVG parameters
    const size = compact ? 42 : 56
    const strokeWidth = compact ? 3.5 : 4.5
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (percentage / 100) * circumference

    // Theme colors based on percentage
    const progressColorClass =
        percentage > 90
            ? 'stroke-rose-500'
            : percentage > 70
            ? 'stroke-amber-500'
            : 'stroke-fuchsia-500'

    const percentageColorClass =
        percentage > 90
            ? 'text-rose-400'
            : percentage > 70
            ? 'text-amber-400'
            : 'text-fuchsia-400'

    const circleContent = (
        <div className="relative group cursor-pointer inline-flex items-center justify-center select-none">
            {/* SVG Progress Circle */}
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background Ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    className="stroke-gray-200 dark:stroke-white/5 fill-transparent"
                    strokeWidth={strokeWidth}
                />
                {/* Active Ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    className={`${progressColorClass} fill-transparent transition-all duration-500 ease-out`}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
            </svg>

            {/* Percentage Text inside Circle */}
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className={`font-black tracking-tighter ${compact ? 'text-[10px]' : 'text-xs'} ${percentageColorClass}`}>
                    {percentage.toFixed(0)}%
                </span>
            </div>

            {/* Hover Breakdown Tooltip */}
            <div className={`absolute ${compact ? 'top-full mt-2.5 origin-top' : 'bottom-full mb-3 origin-bottom'} left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 ease-out z-50 w-64 bg-slate-950/95 border border-white/10 backdrop-blur-md rounded-xl p-4 shadow-2xl transform scale-95 group-hover:scale-100`}>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-fuchsia-400" />
                        Storage Breakdown
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                        {readableSize(totalUsedBytes)} / {readableSize(STORAGE_LIMIT_BYTES)}
                    </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300">
                    <TooltipRow color="bg-fuchsia-500" label="Receipts / Invoices" size={receiptsSize} />
                    <TooltipRow color="bg-blue-500" label="Notes Attachments" size={notesSize} />
                    <TooltipRow color="bg-violet-500" label="Trip Cover Images" size={imagesSize} />
                    {otherSize > 0 && <TooltipRow color="bg-orange-500" label="Other Files" size={otherSize} />}
                    <TooltipRow color="bg-slate-600" label="Free Space" size={freeSize} />
                </div>
                {percentage > 90 && (
                    <div className="mt-2.5 pt-2 border-t border-white/5 text-[9px] text-rose-400 leading-normal flex items-start gap-1">
                        <span>⚠️</span>
                        <span>Storage is almost full. Consider removing files.</span>
                    </div>
                )}
            </div>
        </div>
    )

    if (compact) {
        return circleContent
    }

    return (
        <div className="w-full bg-[#0a0f2c]/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-inner">
            <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-300">Cloud Storage Sense</span>
                <span className="text-[10px] text-slate-500 font-medium">
                    {readableSize(totalUsedBytes)} of {readableSize(STORAGE_LIMIT_BYTES)} used
                </span>
            </div>
            {circleContent}
        </div>
    )
}

function LoaderRing({ size }: { size: number }) {
    return (
        <div
            className="animate-spin rounded-full border-2 border-white/5 border-t-fuchsia-500"
            style={{ width: size, height: size }}
        />
    )
}

function TooltipRow({ color, label, size }: { color: string; label: string; size: number }) {
    return (
        <div className="flex items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                <span className="truncate text-slate-400">{label}</span>
            </div>
            <span className="font-mono text-slate-200 font-medium shrink-0">
                {readableSize(size)}
            </span>
        </div>
    )
}
