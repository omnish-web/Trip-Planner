import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Check, Upload, Image as ImageIcon, Loader2, AlertCircle, FolderOpen, Trash2, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import ImageCropper from './ImageCropper'

// Deterministic fallback preset based on trip ID
export const PRESET_IMAGES = [
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1499591934245-40b55745b905?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1496417263034-38ec4f0d665a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=1200&q=80',
]

/** Returns a deterministic preset image for a given trip ID as fallback */
export function getPresetForTrip(tripId: string): string {
    const hash = tripId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    return PRESET_IMAGES[hash % PRESET_IMAGES.length]
}

interface DeleteConfirmState {
    url: string
    filePath: string
    usedByCount: number
    checking: boolean
}

interface ImagePickerModalProps {
    onClose: () => void
    onSelect: (url: string) => Promise<void>
    currentUrl?: string
    tripId: string
    imageType: 'card' | 'cover' | 'google_photos_cover'
}

type Tab = 'library' | 'upload' | 'gallery'

export default function ImagePickerModal({
    onClose,
    onSelect,
    currentUrl,
    imageType,
}: ImagePickerModalProps) {
    const queryClient = useQueryClient()

    const [activeTab, setActiveTab] = useState<Tab>('library')
    const [saving, setSaving] = useState(false)

    // Upload state
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Cropping state
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
    const [originalFileName, setOriginalFileName] = useState<string>('cropped.jpg')

    // Library state
    const [libraryImages, setLibraryImages] = useState<string[]>([])
    const [loadingLibrary, setLoadingLibrary] = useState(false)
    const [libraryError, setLibraryError] = useState<string | null>(null)

    // Delete from library state
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null)
    const [deleting, setDeleting] = useState(false)

    const label = imageType === 'card' ? 'Card Image' : imageType === 'cover' ? 'Cover Image' : 'Google Photos Cover'

    // ── Load Library ──────────────────────────────────────────────
    const loadLibrary = useCallback(async () => {
        setLoadingLibrary(true)
        setLibraryError(null)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase.storage
                .from('trip-images')
                .list(user.id, {
                    limit: 100,
                    sortBy: { column: 'created_at', order: 'desc' },
                })

            if (error) throw error

            const urls = (data || [])
                .filter(f => f.name !== '.emptyFolderPlaceholder' && f.id)
                .map(f => supabase.storage
                    .from('trip-images')
                    .getPublicUrl(`${user.id}/${f.name}`).data.publicUrl
                )

            setLibraryImages(urls)
        } catch (err: any) {
            setLibraryError('Could not load your image library.')
        } finally {
            setLoadingLibrary(false)
        }
    }, [])

    useEffect(() => {
        if (activeTab === 'library') loadLibrary()
    }, [activeTab, loadLibrary])

    // ── Upload ────────────────────────────────────────────────────
    // Stage 1: File selection & enter crop mode
    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith('image/')) {
            setUploadError('Please select an image file (JPG, PNG, WebP, etc.)')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setUploadError('Image must be under 5 MB')
            return
        }

        setUploadError(null)
        setOriginalFileName(file.name)
        
        // Read file as Data URL to pass to cropper
        const reader = new FileReader()
        reader.onload = () => {
            setCropImageSrc(reader.result as string)
        }
        reader.readAsDataURL(file)
    }

    // Stage 2: Upload the cropped file
    const handleUploadCropped = useCallback(async (croppedFile: File) => {
        setCropImageSrc(null)
        setUploading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const safeName = croppedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const fileName = `${Date.now()}_${safeName}`
            const filePath = `${user.id}/${fileName}`

            const { error: uploadErr } = await supabase.storage
                .from('trip-images')
                .upload(filePath, croppedFile, { upsert: false })

            if (uploadErr) throw uploadErr

            const { data: { publicUrl } } = supabase.storage
                .from('trip-images')
                .getPublicUrl(filePath)

            setPreviewUrl(publicUrl)
            queryClient.invalidateQueries({ queryKey: ['tripImagesSize'] })
        } catch (err: any) {
            setUploadError(err.message || 'Upload failed. Please try again.')
        } finally {
            setUploading(false)
        }
    }, [queryClient])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleFileSelect(file)
        e.target.value = ''
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) handleFileSelect(file)
    }

    const handleSelect = async (url: string) => {
        setSaving(true)
        try {
            await onSelect(url)
        } finally {
            setSaving(false)
        }
    }

    // ── Delete from Library ───────────────────────────────────────
    const initiateDelete = async (url: string, e: React.MouseEvent) => {
        e.stopPropagation() // Don't trigger select

        // Extract file path from public URL
        const match = url.split('/trip-images/')
        const filePath = match[1] ? decodeURIComponent(match[1]) : ''

        // Start with checking state
        setDeleteConfirm({ url, filePath, usedByCount: 0, checking: true })

        try {
            // Check how many trips currently reference this URL
            const [cardResult, coverResult] = await Promise.all([
                supabase.from('trips').select('id', { count: 'exact', head: true }).eq('card_image_url', url),
                supabase.from('trips').select('id', { count: 'exact', head: true }).eq('header_image_url', url),
            ])
            const total = (cardResult.count || 0) + (coverResult.count || 0)
            setDeleteConfirm({ url, filePath, usedByCount: total, checking: false })
        } catch {
            setDeleteConfirm(prev => prev ? { ...prev, checking: false } : null)
        }
    }

    const confirmDelete = async () => {
        if (!deleteConfirm || deleteConfirm.checking) return
        setDeleting(true)

        try {
            // 1. Delete file from Supabase Storage
            const { error: storageErr } = await supabase.storage
                .from('trip-images')
                .remove([deleteConfirm.filePath])

            if (storageErr) throw storageErr

            // 2. Nullify any trips still referencing this URL
            if (deleteConfirm.usedByCount > 0) {
                await Promise.all([
                    supabase.from('trips').update({ card_image_url: null }).eq('card_image_url', deleteConfirm.url),
                    supabase.from('trips').update({ header_image_url: null }).eq('header_image_url', deleteConfirm.url),
                ])
                queryClient.invalidateQueries({ queryKey: ['trips'] })
                queryClient.invalidateQueries({ queryKey: ['trip'] })
            }

            // 3. Remove from local library state instantly
            setLibraryImages(prev => prev.filter(u => u !== deleteConfirm.url))
            setDeleteConfirm(null)
            queryClient.invalidateQueries({ queryKey: ['tripImagesSize'] })
            toast.success('Image permanently deleted from library')
        } catch (err: any) {
            toast.error('Failed to delete image: ' + (err.message || 'Unknown error'))
        } finally {
            setDeleting(false)
        }
    }

    const tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'library', label: 'My Library', icon: '📁' },
        { id: 'upload', label: 'Upload New', icon: '⬆' },
        { id: 'gallery', label: 'Presets', icon: '🖼' },
    ]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            {cropImageSrc ? (
                <div className="w-full max-w-4xl h-[80vh] flex flex-col">
                    <ImageCropper
                        imageSrc={cropImageSrc}
                        aspect={imageType === 'cover' ? 21 / 9 : imageType === 'card' ? 4 / 3 : 16 / 9}
                        fileName={originalFileName}
                        onCropComplete={handleUploadCropped}
                        onCancel={() => setCropImageSrc(null)}
                    />
                </div>
            ) : (
                <div className="w-full max-w-2xl flex flex-col max-h-[90vh] rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)] border border-white/10 bg-[#0d1235]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">Change {label}</h3>
                            <p className="text-xs text-slate-400">
                                {imageType === 'card' ? 'Dashboard thumbnail' : imageType === 'cover' ? 'Trip page banner' : 'Google Photos Portal backdrop'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-xl transition text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6 pt-4 shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id
                                ? 'bg-white/10 text-white border border-white/15'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4">

                    {/* ── Library Tab ── */}
                    {activeTab === 'library' && (
                        <div className="flex flex-col gap-3">
                            <p className="text-xs text-slate-500">
                                All your uploaded images. Click to use, or hover and press 🗑 to permanently delete.
                            </p>

                            {loadingLibrary && (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="w-6 h-6 text-fuchsia-400 animate-spin" />
                                </div>
                            )}

                            {libraryError && (
                                <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {libraryError}
                                </div>
                            )}

                            {!loadingLibrary && !libraryError && libraryImages.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                        <FolderOpen className="w-7 h-7 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-300">No images yet</p>
                                        <p className="text-xs text-slate-500 mt-1">Switch to "Upload New" to add your first image</p>
                                    </div>
                                </div>
                            )}

                            {!loadingLibrary && libraryImages.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {libraryImages.map((url) => (
                                        <div key={url} className="relative group">
                                            <button
                                                onClick={() => handleSelect(url)}
                                                disabled={saving || !!deleteConfirm}
                                                className={`w-full relative aspect-video rounded-xl overflow-hidden border-2 transition-all duration-300 ${currentUrl === url
                                                    ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/40'
                                                    : 'border-transparent hover:border-white/30'
                                                    }`}
                                            >
                                                <img
                                                    src={url}
                                                    alt="Library image"
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                                {currentUrl === url && (
                                                    <div className="absolute inset-0 bg-fuchsia-500/20 flex items-center justify-center">
                                                        <div className="bg-fuchsia-500 text-white p-1.5 rounded-full shadow-lg">
                                                            <Check className="w-3.5 h-3.5" />
                                                        </div>
                                                    </div>
                                                )}
                                                {currentUrl !== url && (
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all" />
                                                )}
                                            </button>

                                            {/* Delete button — top-right corner on hover */}
                                            <button
                                                onClick={(e) => initiateDelete(url, e)}
                                                disabled={saving || deleting || !!deleteConfirm}
                                                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg backdrop-blur-sm disabled:cursor-not-allowed"
                                                title="Delete from library"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ── Delete Confirm Panel ── */}
                            {deleteConfirm && (
                                <div className="mt-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex flex-col gap-3 animate-fade-in">
                                    {deleteConfirm.checking ? (
                                        <div className="flex items-center gap-2 text-sm text-slate-400">
                                            <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                                            Checking usage across your trips…
                                        </div>
                                    ) : (
                                        <>
                                            {/* Preview */}
                                            <div className="flex gap-3 items-start">
                                                <img
                                                    src={deleteConfirm.url}
                                                    alt="To delete"
                                                    className="w-20 h-14 object-cover rounded-xl border border-white/10 shrink-0"
                                                />
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                                        <span className="text-sm font-bold text-rose-300">Permanently delete this image?</span>
                                                    </div>
                                                    {deleteConfirm.usedByCount > 0 ? (
                                                        <p className="text-xs text-rose-300/80 leading-relaxed">
                                                            This image is currently used by <strong className="text-white">{deleteConfirm.usedByCount} trip slot{deleteConfirm.usedByCount > 1 ? 's' : ''}</strong>. Deleting it will revert those trips to their preset image.
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-slate-400">
                                                            This image isn't used by any trip. It's safe to delete.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setDeleteConfirm(null)}
                                                    disabled={deleting}
                                                    className="flex-1 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-sm font-bold transition"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={confirmDelete}
                                                    disabled={deleting}
                                                    className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                                                >
                                                    {deleting
                                                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting…</>
                                                        : <><Trash2 className="w-3.5 h-3.5" /> Delete Forever</>
                                                    }
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Upload Tab ── */}
                    {activeTab === 'upload' && (
                        <div className="flex flex-col gap-4">
                            <p className="text-xs text-slate-500">
                                Upload a new image — it's saved to your library and can be reused across trips for free.
                            </p>

                            <div
                                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => !uploading && fileInputRef.current?.click()}
                                className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-3 py-10
                                    ${isDragging
                                        ? 'border-fuchsia-400 bg-fuchsia-500/10 scale-[1.01]'
                                        : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                                    }`}
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-8 h-8 text-fuchsia-400 animate-spin" />
                                        <p className="text-sm text-slate-400">Uploading to your library…</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                            <Upload className="w-6 h-6 text-fuchsia-400" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-semibold text-white">Drop image here or click to browse</p>
                                            <p className="text-xs text-slate-500 mt-1">JPG, PNG, WebP · Max 5 MB</p>
                                        </div>
                                    </>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            {uploadError && (
                                <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {uploadError}
                                </div>
                            )}

                            {previewUrl && (
                                <>
                                    <div className="rounded-2xl overflow-hidden border border-white/10 relative">
                                        <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                            <span className="text-xs text-green-400 font-bold bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-1">
                                                ✓ Saved to your library
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleSelect(previewUrl)}
                                        disabled={saving}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-bold transition shadow-[0_0_20px_rgba(192,38,211,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Use as {label}
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── Gallery / Presets Tab ── */}
                    {activeTab === 'gallery' && (
                        <div className="flex flex-col gap-3">
                            <p className="text-xs text-slate-500">
                                Curated travel presets. Trips fall back to these when a custom image is removed.
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {PRESET_IMAGES.map((url) => (
                                    <button
                                        key={url}
                                        onClick={() => handleSelect(url)}
                                        disabled={saving}
                                        className={`group relative aspect-video rounded-xl overflow-hidden border-2 transition-all duration-300 ${currentUrl === url
                                            ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/40'
                                            : 'border-transparent hover:border-white/30'
                                            }`}
                                    >
                                        <img
                                            src={url}
                                            alt="Preset"
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                        {currentUrl === url && (
                                            <div className="absolute inset-0 bg-fuchsia-500/20 flex items-center justify-center">
                                                <div className="bg-fuchsia-500 text-white p-1.5 rounded-full shadow-lg">
                                                    <Check className="w-3.5 h-3.5" />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-white/5 shrink-0 flex items-center justify-between">
                    <p className="text-[11px] text-slate-600">
                        Library images are stored once and reused across trips
                    </p>
                    {activeTab === 'library' && !loadingLibrary && (
                        <button
                            onClick={loadLibrary}
                            className="text-[11px] text-slate-500 hover:text-slate-300 transition"
                        >
                            ↻ Refresh
                        </button>
                    )}
                </div>
            </div>
            )}
        </div>
    )
}
