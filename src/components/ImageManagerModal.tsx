import { useState } from 'react'
import { X, Upload, Trash2, Loader2, ImageIcon, Images } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import type { Trip } from '../hooks/useTripData'
import { getPresetForTrip } from './ImagePickerModal'
import ImagePickerModal from './ImagePickerModal'

interface ImageManagerModalProps {
    onClose: () => void
    trips: Trip[]
    /** If provided, shows only this single trip (used from TripSettingsModal) */
    singleTripId?: string
    /** When true, renders inline (no fixed overlay) — for embedding inside other modals */
    embedded?: boolean
}

type ImageSlot = 'card' | 'cover' | 'google_photos_cover'

interface UploadState {
    tripId: string
    slot: ImageSlot
}

export default function ImageManagerModal({ onClose, trips, singleTripId, embedded = false }: ImageManagerModalProps) {
    const queryClient = useQueryClient()
    const [deleting, setDeleting] = useState<UploadState | null>(null)
    const [activePicker, setActivePicker] = useState<{ tripId: string, slot: ImageSlot, currentUrl?: string } | null>(null)

    // Filter to single trip if specified, otherwise show all trips user can edit
    const displayTrips = singleTripId
        ? trips.filter(t => t.id === singleTripId)
        : trips.filter(t => t.user_role === 'owner' || t.user_role === 'editor')

    const triggerFilePick = (tripId: string, slot: ImageSlot, currentUrl?: string) => {
        setActivePicker({ tripId, slot, currentUrl })
    }

    const handleUpdateSlotImage = async (url: string) => {
        if (!activePicker) return;
        const column = activePicker.slot === 'card' ? 'card_image_url' : activePicker.slot === 'cover' ? 'header_image_url' : 'google_photos_cover_url';
        const { error } = await supabase.from('trips').update({ [column]: url }).eq('id', activePicker.tripId);
        if (error) {
            toast.error('Failed to update image');
        } else {
            toast.success(`${activePicker.slot === 'card' ? 'Card' : activePicker.slot === 'cover' ? 'Cover' : 'Google Photos'} image updated`);
            queryClient.invalidateQueries({ queryKey: ['trips'] });
            queryClient.invalidateQueries({ queryKey: ['trip', activePicker.tripId] });
            setActivePicker(null);
        }
    };

    const handleDelete = async (trip: Trip, slot: ImageSlot) => {
        setDeleting({ tripId: trip.id, slot })
        const column = slot === 'card' ? 'card_image_url' : slot === 'cover' ? 'header_image_url' : 'google_photos_cover_url'

        try {
            // Only unlink — do NOT delete the file from Storage.
            // The same image may be reused by other trips or the other slot.
            const { error } = await supabase
                .from('trips')
                .update({ [column]: null })
                .eq('id', trip.id)
            if (error) throw error

            toast.success(`${slot === 'card' ? 'Card' : slot === 'cover' ? 'Cover' : 'Google Photos'} image unlinked (file kept in your library)`)
            queryClient.invalidateQueries({ queryKey: ['trips'] })
            queryClient.invalidateQueries({ queryKey: ['trip', trip.id] })
        } catch (err: any) {
            toast.error('Failed to remove image')
        } finally {
            setDeleting(null)
        }
    }

    const isDeleting = (tripId: string, slot: ImageSlot) =>
        deleting?.tripId === tripId && deleting?.slot === slot

    const content = (
        <div className={`${embedded ? 'w-full flex flex-col bg-transparent border-none' : 'w-full max-w-3xl flex flex-col max-h-[90vh] rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1235] shadow-[0_32px_80px_rgba(0,0,0,0.6)]'}`}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(192,38,211,0.4)]">
                        <Images className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Image Manager</h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                            {singleTripId
                                ? 'Manage images for this trip'
                                : `Managing images across ${displayTrips.length} trip${displayTrips.length !== 1 ? 's' : ''}`}
                        </p>
                    </div>
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

            {/* Legend */}
            <div className="px-6 py-3 border-b border-gray-200 dark:border-white/5 shrink-0 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                    <span className="w-3 h-3 rounded bg-indigo-500/60 border border-indigo-400/40 inline-block" />
                    <span><strong className="text-gray-700 dark:text-slate-300">Card Image</strong> — thumbnail on Dashboard</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                    <span className="w-3 h-3 rounded bg-fuchsia-500/60 border border-fuchsia-400/40 inline-block" />
                    <span><strong className="text-gray-700 dark:text-slate-300">Cover Image</strong> — banner on trip page</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                    <span className="w-3 h-3 rounded bg-blue-500/60 border border-blue-400/40 inline-block" />
                    <span><strong className="text-gray-700 dark:text-slate-300">Google Photos</strong> — portal card background</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
                    <span>Removing a custom image reverts to a preset.</span>
                </div>
            </div>

            {/* Trip list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">
                {displayTrips.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                        <ImageIcon className="w-12 h-12 text-gray-400 dark:text-slate-600" />
                        <p className="text-gray-500 dark:text-slate-400 font-medium">No trips to manage images for.</p>
                    </div>
                ) : (
                    displayTrips.map(trip => {
                        const fallback = getPresetForTrip(trip.id)
                        const cardImg = trip.card_image_url || fallback
                        const coverImg = trip.header_image_url || fallback
                        const googlePhotosImg = trip.google_photos_cover_url || fallback
                        const hasCustomCard = !!trip.card_image_url
                        const hasCustomCover = !!trip.header_image_url
                        const hasCustomGooglePhotos = !!trip.google_photos_cover_url

                        return (
                            <div
                                key={trip.id}
                                className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] p-5 flex flex-col gap-4"
                            >
                                {/* Trip title */}
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-base leading-tight truncate">{trip.title}</h4>
                                    {trip.destination && (
                                        <span className="text-xs text-gray-500 dark:text-slate-500 font-medium shrink-0">· {trip.destination}</span>
                                    )}
                                </div>

                                {/* Three image slots */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(['card', 'cover', 'google_photos_cover'] as ImageSlot[]).map(slot => {
                                        const imgSrc = slot === 'card' ? cardImg : slot === 'cover' ? coverImg : googlePhotosImg
                                        const hasCustom = slot === 'card' ? hasCustomCard : slot === 'cover' ? hasCustomCover : hasCustomGooglePhotos
                                        const slotLabel = slot === 'card' ? 'Card Image' : slot === 'cover' ? 'Cover Image' : 'Google Photos'
                                        const accentColor = slot === 'card' ? 'indigo' : slot === 'cover' ? 'fuchsia' : 'blue'
                                        const deletingSlot = isDeleting(trip.id, slot)

                                        return (
                                            <div key={slot} className="flex flex-col gap-2">
                                                {/* Slot label */}
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${slot === 'card' ? 'bg-indigo-500' : slot === 'cover' ? 'bg-fuchsia-500' : 'bg-blue-500'}`} />
                                                    <span className="text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">{slotLabel}</span>
                                                    {hasCustom ? (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/20 font-medium">
                                                            Custom
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-white/10 font-medium">
                                                            Preset
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Image preview */}
                                                <div
                                                    className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all duration-300 cursor-pointer group border-gray-200 dark:border-white/10 hover:border-${accentColor}-500/50`}
                                                    onClick={() => !deletingSlot && triggerFilePick(trip.id, slot, imgSrc)}
                                                >
                                                    <img
                                                        src={imgSrc}
                                                        alt={slotLabel}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                    {/* Hover overlay */}
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                                                        {!deletingSlot && (
                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1">
                                                                <Upload className="w-6 h-6 text-white" />
                                                                <span className="text-xs text-white font-bold">Change Image</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Loading overlay */}
                                                    {deletingSlot && (
                                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action buttons */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => triggerFilePick(trip.id, slot, imgSrc)}
                                                        disabled={deletingSlot}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                                                    >
                                                        <Upload className="w-3.5 h-3.5" />
                                                        Change
                                                    </button>
                                                    {hasCustom && (
                                                        <button
                                                            onClick={() => handleDelete(trip, slot)}
                                                            disabled={deletingSlot}
                                                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                                                            title="Remove custom image (reverts to preset)"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Footer note */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-white/5 shrink-0">
                <p className="text-[11px] text-gray-400 dark:text-slate-600 text-center">
                    Images stored securely in Supabase Storage · Max 5 MB · JPG, PNG, WebP
                </p>
            </div>

            {/* Smart Image Picker Modal overlay */}
            {activePicker && (
                <ImagePickerModal
                    onClose={() => setActivePicker(null)}
                    onSelect={handleUpdateSlotImage}
                    currentUrl={activePicker.currentUrl}
                    tripId={activePicker.tripId}
                    imageType={activePicker.slot}
                />
            )}
        </div>
    )

    if (embedded) return content

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            {content}
        </div>
    )
}
