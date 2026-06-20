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
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <HardDrive className="w-3.5 h-3.5 animate-pulse text-slate-500" />
                <span>Calculating storage…</span>
            </div>
        )
    }

    if (compact) {
        return (
            <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl px-4 py-2.5 shadow-inner">
                <HardDrive className={`w-4 h-4 ${percentage > 90 ? 'text-rose-400 animate-pulse' : 'text-fuchsia-400'}`} />
                <div className="flex flex-col min-w-[120px]">
                    <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                        <span>Storage Used</span>
                        <span className={percentage > 90 ? 'text-rose-400' : 'text-fuchsia-300'}>
                            {percentage.toFixed(1)}%
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${
                                percentage > 90
                                    ? 'bg-gradient-to-r from-rose-500 to-red-600'
                                    : percentage > 70
                                    ? 'bg-gradient-to-r from-amber-500 to-fuchsia-500'
                                    : 'bg-gradient-to-r from-fuchsia-500 to-indigo-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                        {readableSize(totalUsedBytes)} of {readableSize(STORAGE_LIMIT_BYTES)}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full bg-[#0a0f2c]/40 border border-white/5 rounded-2xl p-4 shadow-inner">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <HardDrive className={`w-4.5 h-4.5 ${percentage > 90 ? 'text-rose-400' : 'text-fuchsia-400'}`} />
                    <span className="text-xs font-bold text-slate-300">Cloud Storage Usage</span>
                </div>
                <span className={`text-xs font-black ${percentage > 90 ? 'text-rose-400' : 'text-fuchsia-300'}`}>
                    {percentage.toFixed(1)}% ({readableSize(totalUsedBytes)} / {readableSize(STORAGE_LIMIT_BYTES)})
                </span>
            </div>
            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${
                        percentage > 90
                             ? 'bg-gradient-to-r from-rose-500 to-red-600'
                             : percentage > 70
                             ? 'bg-gradient-to-r from-amber-500 to-fuchsia-500'
                             : 'bg-gradient-to-r from-fuchsia-500 to-indigo-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {percentage > 90 && (
                <p className="text-[10px] text-rose-400 font-medium mt-1.5 flex items-center gap-1">
                    ⚠️ Storage space is almost full. Consider deleting older attachments to free up space.
                </p>
            )}
        </div>
    )
}
