import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
    X, FolderOpen, FileText, FileImage, File, Search,
    ArrowUpDown, ArrowUp, ArrowDown, Trash2, Pencil,
    Check, ChevronDown, Loader2, Download, TriangleAlert,
    Tag
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow, format, parseISO } from 'date-fns'
import {
    useAllTripAttachments,
    useRenameAttachment,
    useDeleteAttachment,
    type EnrichedAttachment
} from '../hooks/useTripData'

import StorageMeter from './StorageMeter'

// ── Types ───────────────────────────────────────────────────
type SortKey = 'name' | 'date' | 'trip'
type SortDir = 'asc' | 'desc'

interface FileManagerModalProps {
    onClose: () => void
    userId: string | null
    /** Pre-filter to a single trip (from Notes tab) */
    singleTripId?: string
    singleTripTitle?: string
    embedded?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────
function readableSize(bytes: number): string {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileColor(fileType: string): string {
    if (fileType.startsWith('image/')) return 'from-blue-600/30 to-cyan-600/20 border-blue-500/30'
    if (fileType === 'application/pdf') return 'from-rose-600/30 to-red-600/20 border-rose-500/30'
    if (fileType.includes('word') || fileType.includes('document')) return 'from-indigo-600/30 to-blue-600/20 border-indigo-500/30'
    if (fileType === 'text/plain') return 'from-slate-600/30 to-slate-700/20 border-slate-500/30'
    return 'from-amber-600/30 to-orange-600/20 border-amber-500/30'
}

function fileIconColor(fileType: string): string {
    if (fileType.startsWith('image/')) return 'text-blue-400'
    if (fileType === 'application/pdf') return 'text-rose-400'
    if (fileType.includes('word') || fileType.includes('document')) return 'text-indigo-400'
    return 'text-amber-400'
}

function FileTypeIcon({ fileType, className }: { fileType: string; className?: string }) {
    if (fileType.startsWith('image/')) return <FileImage className={className} />
    if (fileType === 'application/pdf') return <FileText className={className} />
    return <File className={className} />
}

// ─── Thumbnail or icon for file row ──────────────────────────
function FileThumbnail({ att }: { att: EnrichedAttachment }) {
    const isImage = att.file_type.startsWith('image/')
    const colorClass = fileColor(att.file_type)
    const iconColor = fileIconColor(att.file_type)

    if (isImage) {
        return (
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 bg-white/5">
                <img
                    src={att.file_url}
                    alt={att.file_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        const el = e.target as HTMLImageElement
                        el.style.display = 'none'
                        el.parentElement!.classList.add('flex', 'items-center', 'justify-center')
                    }}
                />
            </div>
        )
    }

    return (
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${colorClass} border`}>
            <FileTypeIcon fileType={att.file_type} className={`w-6 h-6 ${iconColor}`} />
        </div>
    )
}

// ─── Sort button ─────────────────────────────────────────────
function SortButton({
    label, sortKey, active, direction, onClick
}: {
    label: string
    sortKey: SortKey
    active: boolean
    direction: SortDir
    onClick: (key: SortKey) => void
}) {
    const Icon = active
        ? (direction === 'asc' ? ArrowUp : ArrowDown)
        : ArrowUpDown

    return (
        <button
            onClick={() => onClick(sortKey)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200
                ${active
                    ? 'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-500/30'
                    : 'text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-slate-300 hover:bg-gray-200/50 dark:hover:bg-white/5 border border-transparent'
                }`}
        >
            {label}
            <Icon className="w-3 h-3" />
        </button>
    )
}

// ─── Main Component ───────────────────────────────────────────
export default function FileManagerModal({
    onClose,
    userId,
    singleTripId,
    singleTripTitle,
    embedded = false,
}: FileManagerModalProps) {
    const navigate = useNavigate()

    // ── Data ──
    const { data: allAttachments = [], isLoading } = useAllTripAttachments(userId)
    const renameAttachment = useRenameAttachment()
    const deleteAttachment = useDeleteAttachment()

    // ── Sort / filter state ──
    const [sortKey, setSortKey] = useState<SortKey>('date')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const [tripFilter, setTripFilter] = useState<string>(singleTripId ?? 'all')
    const [search, setSearch] = useState('')
    const [tripDropdownOpen, setTripDropdownOpen] = useState(false)

    // ── Rename state ──
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const renameInputRef = useRef<HTMLInputElement>(null)

    // ── Delete state ──
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // Focus rename input when it appears
    useEffect(() => {
        if (renamingId && renameInputRef.current) {
            renameInputRef.current.focus()
            renameInputRef.current.select()
        }
    }, [renamingId])

    // Close trip dropdown on outside click
    useEffect(() => {
        if (!tripDropdownOpen) return
        const handler = () => setTripDropdownOpen(false)
        window.addEventListener('click', handler)
        return () => window.removeEventListener('click', handler)
    }, [tripDropdownOpen])

    // ── Sort handler ──
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDir(key === 'date' ? 'desc' : 'asc')
        }
    }

    // ── Derived data ──
    const uniqueTrips = useMemo(() =>
        Array.from(
            new Map(allAttachments.map(a => [a.trip_id, a.trip_title])).entries()
        )
            .map(([id, title]) => ({ id, title }))
            .sort((a, b) => a.title.localeCompare(b.title)),
        [allAttachments]
    )

    const filteredSorted = useMemo(() => {
        const q = search.toLowerCase()
        const seen = new Set<string>()
        let list = allAttachments
            .filter(a => singleTripId ? a.trip_id === singleTripId : true)
            .filter(a => tripFilter === 'all' || a.trip_id === tripFilter)
            .filter(a => !q || a.file_name.toLowerCase().includes(q))
            .filter(a => {
                if (!a.file_url) return false
                if (seen.has(a.file_url)) return false
                seen.add(a.file_url)
                return true
            })

        return list.sort((a, b) => {
            let cmp = 0
            if (sortKey === 'name') cmp = a.file_name.localeCompare(b.file_name)
            else if (sortKey === 'date') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            else if (sortKey === 'trip') cmp = a.trip_title.localeCompare(b.trip_title)
            return sortDir === 'asc' ? cmp : -cmp
        })
    }, [allAttachments, singleTripId, tripFilter, search, sortKey, sortDir])

    const tripFilterLabel = tripFilter === 'all'
        ? (singleTripId ? (singleTripTitle ?? 'This Trip') : 'All Trips')
        : (uniqueTrips.find(t => t.id === tripFilter)?.title ?? 'All Trips')

    // ── Rename actions ──
    const startRename = (att: EnrichedAttachment) => {
        setRenamingId(att.id)
        setRenameValue(att.file_name)
        setConfirmDeleteId(null)
    }

    const confirmRename = async () => {
        if (!renamingId || !renameValue.trim()) {
            setRenamingId(null)
            return
        }
        try {
            await renameAttachment.mutateAsync({ id: renamingId, newName: renameValue })
            toast.success('File renamed')
        } catch {
            toast.error('Failed to rename file')
        } finally {
            setRenamingId(null)
        }
    }

    const cancelRename = () => setRenamingId(null)

    // ── Delete actions ──
    const confirmDelete = async (att: EnrichedAttachment) => {
        setDeletingId(att.id)
        try {
            await deleteAttachment.mutateAsync({ id: att.id, fileUrl: att.file_url, tripId: att.trip_id })
            toast.success('File deleted')
            setConfirmDeleteId(null)
        } catch {
            toast.error('Failed to delete file')
        } finally {
            setDeletingId(null)
        }
    }

    // ─────────────────────────────────────────────────────────
    const content = (
        <div className={`${embedded ? 'w-full flex flex-col bg-transparent border-none' : 'w-full max-w-3xl flex flex-col max-h-[92vh] rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1235] shadow-[0_32px_80px_rgba(0,0,0,0.6)]'}`}>

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(192,38,211,0.4)]">
                        <FolderOpen className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {singleTripId ? `Files — ${singleTripTitle ?? 'This Trip'}` : 'File Manager'}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                            {isLoading
                                ? 'Loading…'
                                : `${filteredSorted.length} file${filteredSorted.length !== 1 ? 's' : ''}${!singleTripId ? ` across ${uniqueTrips.length} trip${uniqueTrips.length !== 1 ? 's' : ''}` : ''}`
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Sort buttons */}
                    <div className="hidden sm:flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/5">
                        <span className="text-[10px] text-gray-400 dark:text-slate-600 font-bold uppercase tracking-wider px-2">Sort</span>
                        <SortButton label="Name"  sortKey="name"  active={sortKey === 'name'}  direction={sortDir} onClick={handleSort} />
                        <SortButton label="Date"  sortKey="date"  active={sortKey === 'date'}  direction={sortDir} onClick={handleSort} />
                        <SortButton label="Trip"  sortKey="trip"  active={sortKey === 'trip'}  direction={sortDir} onClick={handleSort} />
                    </div>

                    {!embedded && (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

                {/* ── Filter row ── */}
                <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 dark:border-white/5 shrink-0">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by filename…"
                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08]
                                       text-gray-950 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-600 text-sm focus:outline-none
                                       focus:border-fuchsia-500/30 focus:bg-white/[0.06] dark:focus:bg-white/[0.06] transition"
                        />
                    </div>

                    {/* Trip filter dropdown (only show when not pre-filtered) */}
                    {!singleTripId && (
                        <div className="relative" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => setTripDropdownOpen(o => !o)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08]
                                           text-sm font-medium text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/[0.07]
                                           transition whitespace-nowrap"
                            >
                                <Tag className="w-3.5 h-3.5 text-fuchsia-500 dark:text-fuchsia-400" />
                                <span className="max-w-[120px] truncate">{tripFilterLabel}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 dark:text-slate-500 transition-transform ${tripDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {tripDropdownOpen && (
                                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-[#0a0f2c] border border-gray-200 dark:border-white/10
                                                shadow-[0_16px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden py-1.5">
                                    <button
                                        onClick={() => { setTripFilter('all'); setTripDropdownOpen(false) }}
                                        className={`w-full text-left px-4 py-2 text-sm transition ${tripFilter === 'all'
                                            ? 'text-fuchsia-600 dark:text-fuchsia-300 bg-fuchsia-500/10'
                                            : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-950 hover:dark:text-white'}`}
                                    >
                                        All Trips
                                    </button>
                                    {uniqueTrips.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => { setTripFilter(t.id); setTripDropdownOpen(false) }}
                                            className={`w-full text-left px-4 py-2 text-sm truncate transition ${tripFilter === t.id
                                                ? 'text-fuchsia-600 dark:text-fuchsia-300 bg-fuchsia-500/10'
                                                : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-950 hover:dark:text-white'}`}
                                        >
                                            {t.title}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── File list ── */}
                <div className="flex-1 overflow-y-auto custom-scroll px-4 py-3">

                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-7 h-7 animate-spin text-fuchsia-400" />
                        </div>
                    ) : filteredSorted.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center">
                                <FolderOpen className="w-8 h-8 text-gray-400 dark:text-slate-600" />
                            </div>
                            <p className="text-gray-500 dark:text-slate-500 font-medium">
                                {search ? `No files matching "${search}"` : 'No files uploaded yet'}
                            </p>
                            <p className="text-gray-400 dark:text-slate-600 text-sm max-w-xs">
                                Attach files to notes in any trip's Notes tab and they'll appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {filteredSorted.map(att => {
                                const isRenaming = renamingId === att.id
                                const isConfirmingDelete = confirmDeleteId === att.id
                                const isThisDeleting = deletingId === att.id
                                const uploaderDisplay = att.uploader_name || att.uploader_email || 'Unknown'
                                const uploaderInitial = uploaderDisplay.charAt(0).toUpperCase()
                                const uploadedAt = format(parseISO(att.created_at), 'MMM d, yyyy')
                                const uploadedAgo = formatDistanceToNow(parseISO(att.created_at), { addSuffix: true })

                                return (
                                    <div
                                        key={att.id}
                                        className={`rounded-2xl border transition-all duration-200
                                            ${isConfirmingDelete
                                                ? 'border-rose-500/30 bg-rose-500/5'
                                                : 'border-gray-200 dark:border-white/[0.07] bg-gray-50/50 dark:bg-white/[0.02] hover:bg-gray-100/50 dark:hover:bg-white/[0.04] hover:border-gray-300 dark:hover:border-white/[0.12]'
                                            }`}
                                    >
                                        {/* Main row */}
                                        <div className="flex items-start gap-4 p-4">
                                            {/* Thumbnail */}
                                            <FileThumbnail att={att} />

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                {/* Filename (editable) */}
                                                {isRenaming ? (
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <input
                                                            ref={renameInputRef}
                                                            value={renameValue}
                                                            onChange={e => setRenameValue(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') confirmRename()
                                                                 if (e.key === 'Escape') cancelRename()
                                                            }}
                                                            className="flex-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/10 border border-fuchsia-500/40
                                                                        text-gray-900 dark:text-white text-sm font-semibold focus:outline-none focus:border-fuchsia-400"
                                                        />
                                                        <button onClick={confirmRename} disabled={renameAttachment.isPending}
                                                            className="p-1 rounded-lg bg-fuchsia-500/20 hover:bg-fuchsia-500/40 text-fuchsia-300 transition">
                                                            {renameAttachment.isPending
                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                : <Check className="w-3.5 h-3.5" />}
                                                        </button>
                                                        <button onClick={cancelRename}
                                                            className="p-1 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="font-semibold text-gray-800 dark:text-slate-200 text-sm leading-tight mb-1.5 truncate pr-2">
                                                        {att.file_name}
                                                    </p>
                                                )}

                                                {/* Trip badge + size */}
                                                <div className="flex items-center flex-wrap gap-2 mb-1.5">
                                                    <button
                                                        onClick={() => navigate(`/trip/${att.trip_id}`)}
                                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg
                                                                   bg-fuchsia-500/10 hover:bg-fuchsia-500/20
                                                                   border border-fuchsia-500/20 hover:border-fuchsia-500/40
                                                                   text-fuchsia-600 dark:text-fuchsia-300 hover:text-fuchsia-700 hover:dark:text-fuchsia-200
                                                                   text-xs font-semibold transition-all"
                                                        title={`Go to trip: ${att.trip_title}`}
                                                    >
                                                        <Tag className="w-2.5 h-2.5" />
                                                        {att.trip_title}
                                                    </button>
                                                    {att.file_size > 0 && (
                                                        <span className="text-xs text-slate-600">{readableSize(att.file_size)}</span>
                                                    )}
                                                </div>

                                                {/* Uploader + date */}
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500/60 to-fuchsia-500/60
                                                                    border border-white/10 flex items-center justify-center
                                                                    text-[9px] font-bold text-white flex-shrink-0">
                                                        {uploaderInitial}
                                                    </div>
                                                    <span className="text-xs text-gray-500 dark:text-slate-500">
                                                        {uploaderDisplay}
                                                        <span className="mx-1 text-gray-400 dark:text-slate-700">·</span>
                                                        <span title={uploadedAt}>{uploadedAgo}</span>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                                                <a
                                                    href={att.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                                    title="Open / Download"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </a>
                                                <button
                                                    onClick={() => { startRename(att); setConfirmDeleteId(null) }}
                                                    className="p-2 rounded-xl text-gray-500 hover:text-fuchsia-600 dark:text-slate-500 dark:hover:text-fuchsia-300 hover:bg-fuchsia-500/10 transition"
                                                    title="Rename"
                                                    disabled={isThisDeleting}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setConfirmDeleteId(isConfirmingDelete ? null : att.id)
                                                        setRenamingId(null)
                                                    }}
                                                    className={`p-2 rounded-xl transition ${isConfirmingDelete
                                                        ? 'text-rose-300 bg-rose-500/20'
                                                        : 'text-gray-500 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-500/10'}`}
                                                    title="Delete"
                                                    disabled={isThisDeleting}
                                                >
                                                    {isThisDeleting
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : <Trash2 className="w-4 h-4" />
                                                    }
                                                </button>
                                            </div>
                                        </div>

                                        {/* Inline delete confirmation */}
                                        {isConfirmingDelete && (
                                            <div className="flex items-center justify-between px-4 pb-4 pt-0 gap-4 animate-fade-in">
                                                <div className="flex items-center gap-2 text-xs text-rose-500 dark:text-rose-400">
                                                    <TriangleAlert className="w-3.5 h-3.5 flex-shrink-0" />
                                                    <span>
                                                        Permanently delete <strong className="text-rose-600 dark:text-rose-300">{att.file_name}</strong> from storage?
                                                        This cannot be undone.
                                                    </span>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={() => setConfirmDeleteId(null)}
                                                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 dark:border-white/10
                                                                   text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => confirmDelete(att)}
                                                        disabled={isThisDeleting}
                                                        className="px-3 py-1.5 rounded-xl text-xs font-bold
                                                                   bg-rose-500/80 hover:bg-rose-500 text-white transition
                                                                   disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isThisDeleting ? 'Deleting…' : 'Delete'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 shrink-0 bg-gray-50/50 dark:bg-black/20 flex flex-col gap-3">
                    <StorageMeter userId={userId} />
                    <p className="text-[10px] text-gray-400 dark:text-slate-600 text-center">
                        Files stored in Supabase Storage · Rename changes display name only · Deletion is permanent
                    </p>
                </div>

            </div>
        )

    if (embedded) return content

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            {content}
        </div>,
        document.body
    )
}
