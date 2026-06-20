import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import {
    Save, Loader2, StickyNote, AlertCircle, Pin,
    Paperclip, Send, Trash2, FileText, FileImage,
    File, X, Clock, ChevronDown, ChevronUp, Download,
    BookOpen, FolderOpen, Pencil
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, format, parseISO } from 'date-fns'
import { useTripNotes, useAddTripNote, useDeleteTripNote, useUpdateTripNote, useAllTripAttachments } from '../hooks/useTripData'
import type { TripNote, TripNoteAttachment } from '../hooks/useTripData'
import FileManagerModal from './FileManagerModal'

// ─── Constants ───────────────────────────────────────────────
const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const ACCEPTED_TYPES = [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
]

// ─── Props ───────────────────────────────────────────────────
interface NotesTabProps {
    tripId: string
    initialNotes?: string
    canEdit: boolean
    currentUserId: string | null
    isOwner: boolean
}

// ─── Helper: File Icon ────────────────────────────────────────
function AttachmentIcon({ fileType, className }: { fileType: string; className?: string }) {
    if (fileType.startsWith('image/')) return <FileImage className={className} />
    if (fileType === 'application/pdf') return <FileText className={className} />
    return <File className={className} />
}

// ─── Helper: Readable file size ───────────────────────────────
function readableSize(bytes: number): string {
    if (bytes === 0) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Sub-component: A single attachment pill ──────────────────
function AttachmentPill({ att }: { att: TripNoteAttachment }) {
    const isImage = att.file_type.startsWith('image/')
    return (
        <a
            href={att.file_url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${att.file_name}`}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-xl
                       bg-white/5 hover:bg-fuchsia-500/20
                       border border-white/10 hover:border-fuchsia-500/40
                       text-slate-300 hover:text-fuchsia-200
                       transition-all duration-200 text-sm max-w-[260px]"
        >
            {isImage ? (
                <img
                    src={att.file_url}
                    alt={att.file_name}
                    className="w-5 h-5 rounded object-cover flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
            ) : (
                <AttachmentIcon fileType={att.file_type} className="w-4 h-4 flex-shrink-0 text-fuchsia-400" />
            )}
            <span className="truncate font-medium">{att.file_name}</span>
            {att.file_size > 0 && (
                <span className="text-slate-500 text-xs flex-shrink-0">{readableSize(att.file_size)}</span>
            )}
            <Download className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
    )
}

// ─── Sub-component: A single note card in the timeline ────────
function NoteCard({
    note,
    canDelete,
    onDelete,
    isDeleting,
    canEdit,
    onEditStart,
    isEditing,
    editContent,
    onEditChange,
    onEditSave,
    onEditCancel,
    isSaving,
}: {
    note: TripNote
    canDelete: boolean
    onDelete: () => void
    isDeleting: boolean
    canEdit: boolean
    onEditStart: () => void
    isEditing: boolean
    editContent: string
    onEditChange: (v: string) => void
    onEditSave: () => void
    onEditCancel: () => void
    isSaving: boolean
}) {
    const authorDisplay = note.author_name || note.author_email || 'Anonymous'
    const timeAgo = formatDistanceToNow(parseISO(note.created_at), { addSuffix: true })
    const fullDate = format(parseISO(note.created_at), 'MMM d, yyyy \u00b7 h:mm a')

    return (
        <div className="relative flex gap-4 group/card">
            {/* Timeline connector */}
            <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-600/80 to-indigo-600/80
                                border border-white/10 flex items-center justify-center text-sm font-bold
                                text-white shadow-[0_0_10px_rgba(192,38,211,0.3)] flex-shrink-0">
                    {authorDisplay.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 w-px bg-white/5 mt-2" />
            </div>

            {/* Card body */}
            <div className="flex-1 mb-6">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                        <span className="font-semibold text-slate-200 text-sm">{authorDisplay}</span>
                        <span className="text-slate-500 text-xs ml-2" title={fullDate}>
                            <Clock className="w-3 h-3 inline mr-1 mb-0.5" />
                            {timeAgo}
                        </span>
                        {isEditing && (
                            <span className="ml-2 text-[10px] text-fuchsia-400 font-semibold uppercase tracking-wider">
                                Editing
                            </span>
                        )}
                    </div>

                    {/* Action buttons — visible on hover */}
                    {!isEditing && (canEdit || canDelete) && (
                        <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-all duration-200">
                            {canEdit && (
                                <button
                                    onClick={onEditStart}
                                    disabled={isDeleting}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-fuchsia-300
                                               hover:bg-fuchsia-500/10 transition-all duration-200
                                               disabled:opacity-50 flex-shrink-0"
                                    title="Edit note"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    onClick={onDelete}
                                    disabled={isDeleting}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400
                                               hover:bg-rose-500/10 transition-all duration-200
                                               disabled:opacity-50 flex-shrink-0"
                                    title="Delete note"
                                >
                                    {isDeleting
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Trash2 className="w-3.5 h-3.5" />
                                    }
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Note content — view or edit */}
                {isEditing ? (
                    <div className="rounded-2xl bg-white/[0.06] border border-fuchsia-500/30 overflow-hidden">
                        <textarea
                            value={editContent}
                            onChange={e => onEditChange(e.target.value)}
                            onKeyDown={e => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onEditSave()
                                if (e.key === 'Escape') onEditCancel()
                            }}
                            autoFocus
                            rows={Math.max(3, editContent.split('\n').length + 1)}
                            className="w-full px-4 py-3 bg-transparent resize-none focus:outline-none
                                       text-slate-200 text-sm leading-relaxed custom-scroll"
                        />
                        <div className="flex items-center justify-between px-3 pb-3 pt-0 gap-2">
                            <span className="text-[11px] text-slate-600">
                                ⌘Enter to save · Esc to cancel
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={onEditCancel}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/10
                                               text-slate-400 hover:text-white hover:bg-white/5 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onEditSave}
                                    disabled={isSaving || !editContent.trim()}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold
                                               bg-fuchsia-600/80 hover:bg-fuchsia-600 text-white
                                               transition disabled:opacity-40 disabled:cursor-not-allowed
                                               flex items-center gap-1.5"
                                >
                                    {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07]
                                    px-4 py-3 text-slate-300 text-sm leading-relaxed
                                    whitespace-pre-wrap break-words">
                        {note.content}
                    </div>
                )}

                {/* Attachments */}
                {note.trip_note_attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {note.trip_note_attachments.map(att => (
                            <AttachmentPill key={att.id} att={att} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────
export default function NotesTab({
    tripId,
    initialNotes = '',
    canEdit,
    currentUserId,
    isOwner,
}: NotesTabProps) {
    const queryClient = useQueryClient()

    // ── Scratchpad state ──
    const [scratchpad, setScratchpad] = useState(initialNotes)
    const [isSaving, setIsSaving] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [scratchpadExpanded, setScratchpadExpanded] = useState(true)

    // ── Composer state ──
    const [composerText, setComposerText] = useState('')
    const [pendingFiles, setPendingFiles] = useState<File[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    // ── Delete tracking ──
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)

    // ── Edit tracking ──
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')
    const [isSavingEdit, setIsSavingEdit] = useState(false)

    // ── File Manager ──
    const [showFileManager, setShowFileManager] = useState(false)

    // ── Library Picker ──
    const [pendingLibraryFiles, setPendingLibraryFiles] = useState<{ url: string; name: string; type: string; size: number }[]>([])
    const [showLibraryPicker, setShowLibraryPicker] = useState(false)

    // ── Data hooks ──
    const { data: notes = [], isLoading: loadingNotes } = useTripNotes(tripId)
    const addNote = useAddTripNote()
    const deleteNote = useDeleteTripNote()
    const updateNote = useUpdateTripNote()
    const { data: allAttachments = [] } = useAllTripAttachments(currentUserId)
    const tripAttachments = useMemo(() => {
        const seen = new Set<string>()
        return allAttachments
            .filter(att => att.trip_id === tripId)
            .filter(att => {
                if (!att.file_url) return false
                if (seen.has(att.file_url)) return false
                seen.add(att.file_url)
                return true
            })
    }, [allAttachments, tripId])

    // Keep scratchpad in sync with server data
    useEffect(() => {
        if (!hasUnsavedChanges) {
            setScratchpad(initialNotes || '')
        }
    }, [initialNotes, hasUnsavedChanges])

    // ── Scratchpad save ──
    const handleSaveScratchpad = async () => {
        if (!canEdit) return
        setIsSaving(true)
        try {
            const { error } = await supabase
                .from('trips')
                .update({ notes: scratchpad })
                .eq('id', tripId)
            if (error) throw error
            toast.success('Notes saved')
            setHasUnsavedChanges(false)
            queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
        } catch {
            toast.error('Failed to save notes')
        } finally {
            setIsSaving(false)
        }
    }

    // ── File picking ──
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || [])
        const valid: File[] = []
        for (const f of selected) {
            if (f.size > MAX_FILE_SIZE_BYTES) {
                toast.error(`"${f.name}" exceeds ${MAX_FILE_SIZE_MB} MB limit`)
                continue
            }
            if (!ACCEPTED_TYPES.includes(f.type)) {
                toast.error(`"${f.name}" file type not supported`)
                continue
            }
            valid.push(f)
        }
        setPendingFiles(prev => [...prev, ...valid])
        // Reset so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const removePendingFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index))
    }

    // ── Post note ──
    const handlePostNote = async () => {
        const content = composerText.trim()
        if (!content && pendingFiles.length === 0 && pendingLibraryFiles.length === 0) return

        try {
            await addNote.mutateAsync({
                tripId,
                content: content || '(attachment)',
                files: pendingFiles,
                libraryFiles: pendingLibraryFiles
            })
            setComposerText('')
            setPendingFiles([])
            setPendingLibraryFiles([])
            toast.success('Note posted')
        } catch (err: any) {
            toast.error(err?.message || 'Failed to post note')
        }
    }

    // ── Delete note ──
    const handleDeleteNote = async (note: TripNote) => {
        setDeletingNoteId(note.id)
        try {
            await deleteNote.mutateAsync({
                noteId: note.id,
                tripId,
                attachments: note.trip_note_attachments,
            })
            toast.success('Note deleted')
        } catch {
            toast.error('Failed to delete note')
        } finally {
            setDeletingNoteId(null)
        }
    }

    const canDeleteNote = (note: TripNote) =>
        isOwner || note.user_id === currentUserId

    // Only the note's own author can edit (not even the owner — preserves intent)
    const canEditNote = (note: TripNote) =>
        note.user_id === currentUserId

    const handleEditStart = (note: TripNote) => {
        setEditingNoteId(note.id)
        setEditContent(note.content)
    }

    const handleEditCancel = () => {
        setEditingNoteId(null)
        setEditContent('')
    }

    const handleEditSave = async (note: TripNote) => {
        if (!editContent.trim() || isSavingEdit) return
        setIsSavingEdit(true)
        try {
            await updateNote.mutateAsync({ noteId: note.id, content: editContent, tripId })
            toast.success('Note updated')
            setEditingNoteId(null)
            setEditContent('')
        } catch {
            toast.error('Failed to update note')
        } finally {
            setIsSavingEdit(false)
        }
    }

    const isPosting = addNote.isPending

    // ─────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* ══════════════════════════════════════════════
                SECTION A — Quick Memo (Scratchpad)
            ══════════════════════════════════════════════ */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                {/* Header */}
                <button
                    onClick={() => setScratchpadExpanded(p => !p)}
                    className="w-full flex items-center justify-between px-5 py-4
                               hover:bg-white/[0.03] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
                            <Pin className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-bold text-slate-200">Quick Memo</p>
                            <p className="text-xs text-slate-500">
                                Private scratchpad — saved manually. Only you see draft changes.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {hasUnsavedChanges && (
                            <span className="flex items-center gap-1 text-amber-400 text-xs font-semibold animate-pulse">
                                <AlertCircle className="w-3 h-3" /> Unsaved
                            </span>
                        )}
                        {scratchpadExpanded
                            ? <ChevronUp className="w-4 h-4 text-slate-500" />
                            : <ChevronDown className="w-4 h-4 text-slate-500" />
                        }
                    </div>
                </button>

                {scratchpadExpanded && (
                    <div className="px-5 pb-5 border-t border-white/[0.05]">
                        <textarea
                            value={scratchpad}
                            onChange={(e) => {
                                setScratchpad(e.target.value)
                                setHasUnsavedChanges(e.target.value !== (initialNotes || ''))
                            }}
                            disabled={!canEdit}
                            placeholder={
                                canEdit
                                    ? 'Jot down quick ideas, links, itinerary drafts…'
                                    : 'No scratchpad notes for this trip.'
                            }
                            className="w-full h-40 mt-4 bg-transparent resize-none focus:outline-none
                                       text-slate-300 text-sm font-medium leading-relaxed
                                       placeholder:text-slate-600 disabled:opacity-60 custom-scroll"
                        />
                        {canEdit && (
                            <div className="flex justify-end mt-2">
                                <button
                                    onClick={handleSaveScratchpad}
                                    disabled={isSaving || !hasUnsavedChanges}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold
                                               bg-gradient-to-r from-amber-500/80 to-orange-500/80
                                               hover:from-amber-400/90 hover:to-orange-400/90
                                               text-white shadow-md transition-all duration-200
                                               disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isSaving
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Save className="w-3.5 h-3.5" />
                                    }
                                    {hasUnsavedChanges ? 'Save Memo' : 'Saved'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════
                SECTION B — Trip Log (Timeline Feed)
            ══════════════════════════════════════════════ */}
            <div className="space-y-4">
                {/* Section header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-fuchsia-500/15 flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-fuchsia-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-200">Trip Log</p>
                            <p className="text-xs text-slate-500">
                                Shared timeline — notes are visible to all trip members.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowFileManager(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold
                                   text-slate-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/10
                                   border border-transparent hover:border-fuchsia-500/20 transition-all"
                        title="Manage all files for this trip"
                    >
                        <FolderOpen className="w-4 h-4" />
                        Manage Files
                    </button>
                </div>

                {/* ── Composer ── */}
                {canEdit && (
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]
                                    focus-within:border-fuchsia-500/30 transition-colors overflow-hidden">
                        <textarea
                            value={composerText}
                            onChange={e => setComposerText(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePostNote()
                            }}
                            placeholder="Write a note for the group… (⌘Enter to post)"
                            rows={3}
                            className="w-full px-5 pt-4 pb-2 bg-transparent resize-none
                                       focus:outline-none text-slate-200 text-sm leading-relaxed
                                       placeholder:text-slate-600 custom-scroll"
                        />

                        {/* Pending file chips */}
                        {pendingFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-5 pb-2">
                                {pendingFiles.map((f, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                                                   bg-fuchsia-500/10 border border-fuchsia-500/20
                                                   text-fuchsia-300 text-xs font-medium"
                                    >
                                        <AttachmentIcon fileType={f.type} className="w-3 h-3" />
                                        <span className="max-w-[140px] truncate">{f.name}</span>
                                        <button
                                            onClick={() => removePendingFile(i)}
                                            className="ml-1 text-fuchsia-400/60 hover:text-rose-400 transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pending library file chips */}
                        {pendingLibraryFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-5 pb-2">
                                {pendingLibraryFiles.map((f, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                                                   bg-fuchsia-500/10 border border-fuchsia-500/30
                                                   text-fuchsia-200 text-xs font-medium"
                                    >
                                        <FolderOpen className="w-3 h-3 text-fuchsia-400" />
                                        <span className="max-w-[140px] truncate">[Library] {f.name}</span>
                                        <button
                                            onClick={() => setPendingLibraryFiles(prev => prev.filter((_, idx) => idx !== i))}
                                            className="ml-1 text-fuchsia-400/60 hover:text-rose-400 transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.05]">
                            <div className="flex items-center gap-1">
                                {/* Hidden file input */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept={ACCEPTED_TYPES.join(',')}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="note-file-input"
                                />
                                <label
                                    htmlFor="note-file-input"
                                    className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-xl
                                               text-slate-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/10
                                               transition-all text-xs font-medium"
                                    title="Attach files (PDFs, images, docs)"
                                >
                                    <Paperclip className="w-4 h-4" />
                                    <span>Attach</span>
                                    {pendingFiles.length > 0 && (
                                        <span className="bg-fuchsia-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                                            {pendingFiles.length}
                                        </span>
                                    )}
                                </label>

                                <button
                                    type="button"
                                    onClick={() => setShowLibraryPicker(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                                               text-slate-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/10
                                               transition-all text-xs font-medium border border-transparent"
                                    title="Attach from trip library"
                                >
                                    <FolderOpen className="w-4 h-4" />
                                    <span>Library</span>
                                    {pendingLibraryFiles.length > 0 && (
                                        <span className="bg-fuchsia-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                                            {pendingLibraryFiles.length}
                                        </span>
                                    )}
                                </button>

                                <span className="text-slate-700 text-xs pl-1">
                                    PDF, images, docs · max {MAX_FILE_SIZE_MB} MB
                                </span>
                            </div>

                            <button
                                onClick={handlePostNote}
                                disabled={isPosting || (!composerText.trim() && pendingFiles.length === 0)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold
                                           bg-gradient-to-r from-fuchsia-600 to-indigo-600
                                           hover:from-fuchsia-500 hover:to-indigo-500
                                           text-white shadow-[0_0_15px_rgba(192,38,211,0.25)]
                                           transition-all duration-200
                                           disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isPosting
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Send className="w-4 h-4" />
                                }
                                {isPosting ? 'Posting…' : 'Post Note'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Timeline Feed ── */}
                <div className="mt-2">
                    {loadingNotes ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-fuchsia-400" />
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06]
                                            flex items-center justify-center">
                                <StickyNote className="w-7 h-7 text-slate-600" />
                            </div>
                            <p className="text-slate-500 text-sm font-medium">No log entries yet</p>
                            <p className="text-slate-600 text-xs text-center max-w-xs">
                                {canEdit
                                    ? 'Use the composer above to post the first note, log an update, or attach a receipt.'
                                    : 'No notes have been posted for this trip yet.'}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4">
                            {notes.map(note => (
                                <NoteCard
                                    key={note.id}
                                    note={note}
                                    canDelete={canDeleteNote(note)}
                                    onDelete={() => handleDeleteNote(note)}
                                    isDeleting={deletingNoteId === note.id}
                                    canEdit={canEditNote(note)}
                                    onEditStart={() => handleEditStart(note)}
                                    isEditing={editingNoteId === note.id}
                                    editContent={editContent}
                                    onEditChange={setEditContent}
                                    onEditSave={() => handleEditSave(note)}
                                    onEditCancel={handleEditCancel}
                                    isSaving={isSavingEdit}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

        {/* File Manager Modal — pre-filtered to this trip */}
        {showFileManager && (
            <FileManagerModal
                onClose={() => setShowFileManager(false)}
                userId={currentUserId}
                singleTripId={tripId}
            />
        )}

        {/* Library Picker Modal */}
        {showLibraryPicker && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
                <div className="bg-[#0a0f2c] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-scale-up">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-white text-base flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-fuchsia-400" />
                            Trip File Library
                        </h3>
                        <button
                            type="button"
                            onClick={() => setShowLibraryPicker(false)}
                            className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-4 max-h-[350px] overflow-y-auto custom-scroll space-y-2">
                        {tripAttachments.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 text-sm italic">
                                No attachments uploaded to this trip yet.
                            </div>
                        ) : (
                            tripAttachments.map((att) => {
                                const isAlreadySelected = pendingLibraryFiles.some(f => f.url === att.file_url)
                                return (
                                    <div
                                        key={att.id}
                                        onClick={() => {
                                            if (isAlreadySelected) {
                                                setPendingLibraryFiles(prev => prev.filter(f => f.url !== att.file_url))
                                            } else {
                                                setPendingLibraryFiles(prev => [...prev, {
                                                    url: att.file_url,
                                                    name: att.file_name,
                                                    type: att.file_type,
                                                    size: att.file_size
                                                }])
                                            }
                                        }}
                                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition border
                                            ${isAlreadySelected 
                                                ? 'bg-fuchsia-500/10 border-fuchsia-500/30' 
                                                : 'bg-white/5 border-white/5 hover:bg-fuchsia-500/5 hover:border-fuchsia-500/10'
                                            }`}
                                    >
                                        <div className="min-w-0 flex-1 flex items-center gap-3">
                                            <Paperclip className="w-4 h-4 text-fuchsia-400 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold text-slate-200 truncate">
                                                    {att.file_name}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">
                                                    {(att.file_size / 1024).toFixed(1)} KB · {att.uploader_name || 'Guest'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition shrink-0
                                                ${isAlreadySelected 
                                                    ? 'bg-fuchsia-500 text-white' 
                                                    : 'text-fuchsia-400 bg-fuchsia-500/10 hover:bg-fuchsia-500/20'
                                                }`}
                                        >
                                            {isAlreadySelected ? 'Selected' : 'Select'}
                                        </button>
                                    </div>
                                )
                            })
                        )}
                    </div>
                    <div className="p-3 border-t border-white/10 flex justify-end shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowLibraryPicker(false)}
                            className="btn-primary text-xs py-1.5 px-4 rounded-xl"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        )}
        </div>
    )
}
