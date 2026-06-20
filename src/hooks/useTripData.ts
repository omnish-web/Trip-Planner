
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Types
export interface Trip {
    id: string
    title: string
    start_date: string
    end_date: string
    header_image_url: string        // Cover Image — used as TripDetail banner
    card_image_url?: string         // Card Image — used as Dashboard thumbnail
    currency: string
    user_role: string
    destination?: string
    categories?: string[]
    settled_history?: any[]
    status?: 'active' | 'ended'
    ended_at?: string | null
    notes?: string
}

interface Expense {
    id: string
    title: string
    amount: number
    date: string
    created_at?: string
    category: string
    paid_by: string
    comments?: string
    expense_splits: {
        participant_id: string
        amount: number
    }[]
    expense_payers: {
        participant_id: string
        amount: number
    }[]
    trip_id: string
    attachment_url?: string | null
    attachment_name?: string | null
    attachment_type?: string | null
    attachment_size?: number | null
}

// --- Trip Notes Types ---

export interface TripNoteAttachment {
    id: string
    note_id: string
    file_name: string
    file_url: string
    file_type: string
    file_size: number
    created_at: string
}

export interface TripNote {
    id: string
    trip_id: string
    user_id: string | null
    content: string
    created_at: string
    trip_note_attachments: TripNoteAttachment[]
    // Joined from profiles
    author_name?: string
    author_email?: string
}

export interface NewNotePayload {
    tripId: string
    content: string
    files: File[]
}

// 1. Fetch All Trips (for Dashboard)
export function useTrips(userId: string | null) {
    return useQuery({
        queryKey: ['trips', userId],
        queryFn: async () => {
            if (!userId) return []

            // First get trips where user is a participant
            const { data: participations, error: partError } = await supabase
                .from('trip_participants')
                .select('trip_id, role')
                .eq('user_id', userId)

            if (partError) throw partError

            if (!participations || participations.length === 0) return []

            const tripIds = participations.map(p => p.trip_id)
            const roleMap = participations.reduce((acc, p) => {
                acc[p.trip_id] = p.role
                return acc
            }, {} as Record<string, string>)

            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .in('id', tripIds)
                .order('start_date', { ascending: false, nullsFirst: false })

            if (error) throw error

            return data.map((trip: any) => ({
                ...trip,
                user_role: roleMap[trip.id] || 'viewer'
            })) as Trip[]
        },
        enabled: !!userId,
    })
}

// 2. Fetch Single Trip (for TripDetail)
export function useTrip(tripId: string | undefined) {
    return useQuery({
        queryKey: ['trip', tripId],
        queryFn: async () => {
            if (!tripId) throw new Error('No trip ID')
            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .eq('id', tripId)
                .single()
            if (error) throw error
            return data as Trip
        },
        enabled: !!tripId,
    })
}

// 3. Fetch Trip Participants
export function useTripParticipants(tripId: string | undefined) {
    return useQuery({
        queryKey: ['participants', tripId],
        queryFn: async () => {
            if (!tripId) return []
            const { data, error } = await supabase
                .from('trip_participants')
                .select(`
                    id,
                    user_id,
                    name,
                    role,
                    parent_id,
                    profiles:user_id (
                        full_name,
                        email,
                        id
                    )
                `)
                .eq('trip_id', tripId)

            if (error) throw error

            // Normalize data structure
            return (data as any[])?.map(p => ({
                ...p,
                profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
            })) || []
        },
        enabled: !!tripId,
    })
}

// 4. Fetch Expenses
export function useExpenses(tripId: string | undefined) {
    return useQuery({
        queryKey: ['expenses', tripId],
        queryFn: async () => {
            if (!tripId) return []
            const { data, error } = await supabase
                .from('expenses')
                .select(`
                    *,
                    expense_splits (
                        participant_id,
                        amount
                    ),
                    expense_payers (
                        participant_id,
                        amount
                    )
                `)
                .eq('trip_id', tripId)
                .order('date', { ascending: false })

            if (error) throw error
            return data as Expense[]
        },
        enabled: !!tripId,
    })
}

// 5. Update Trip Mutation (Optimistic Update)
export function useUpdateTrip() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<Trip> }) => {
            const { error } = await supabase
                .from('trips')
                .update(updates)
                .eq('id', id)
            if (error) throw error
        },
        onSuccess: (_, variables) => {
            // Invalidate relevant queries to refetch
            queryClient.invalidateQueries({ queryKey: ['trip', variables.id] })
            queryClient.invalidateQueries({ queryKey: ['trips'] })
        },
    })
}
// 6. Delete Trip Mutation
export function useDeleteTrip() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('trips')
                .delete()
                .eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trips'] })
        },
    })
}

// 8. Update Member Role Mutation
export function useUpdateMemberRole() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, role }: { id: string, role: 'owner' | 'editor' | 'viewer' }) => {
            const { error } = await supabase
                .from('trip_participants')
                .update({ role })
                .eq('id', id)
            if (error) throw error
        },
        onSuccess: (_) => {
            queryClient.invalidateQueries({ queryKey: ['participants'] })
            queryClient.invalidateQueries({ queryKey: ['trips'] }) // Refresh trips for that user potentially
        },
    })
}

// 7. Fetch Current User (Cached)
// 7. Fetch Current User (Cached)
export function useCurrentUser() {
    return useQuery({
        queryKey: ['currentUser'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return null

            // Fetch profile data to get up-to-date name
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single()

            return {
                ...user,
                user_metadata: {
                    ...user.user_metadata,
                    full_name: profile?.full_name || user.user_metadata.full_name
                }
            }
        },
        staleTime: 1000 * 60 * 60, // 1 hour
        refetchOnWindowFocus: false,
    })
}

// ============================================================
// Trip Notes Hooks
// ============================================================

// Fetch all timeline notes for a trip (newest first)
export function useTripNotes(tripId: string | undefined) {
    return useQuery({
        queryKey: ['tripNotes', tripId],
        queryFn: async () => {
            if (!tripId) return []

            const { data, error } = await supabase
                .from('trip_notes')
                .select(`
                    *,
                    trip_note_attachments (*),
                    profiles:user_id (
                        full_name,
                        email
                    )
                `)
                .eq('trip_id', tripId)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Normalize the joined profile
            return (data as any[]).map(note => ({
                ...note,
                author_name: note.profiles?.full_name ?? null,
                author_email: note.profiles?.email ?? null,
                profiles: undefined,  // remove raw join
                trip_note_attachments: note.trip_note_attachments ?? [],
            })) as TripNote[]
        },
        enabled: !!tripId,
    })
}

// Add a new note (uploads files to storage first, then inserts DB rows)
export function useAddTripNote() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ tripId, content, files }: NewNotePayload) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // 1. Insert the note row
            const { data: note, error: noteError } = await supabase
                .from('trip_notes')
                .insert({ trip_id: tripId, user_id: user.id, content })
                .select()
                .single()

            if (noteError) throw noteError

            // 2. Upload each file to storage and insert attachment rows
            if (files.length > 0) {
                const attachmentRows = []

                for (const file of files) {
                    const ext = file.name.split('.').pop()
                    const storagePath = `${user.id}/${tripId}/${crypto.randomUUID()}.${ext}`

                    const { error: uploadError } = await supabase.storage
                        .from('trip-files')
                        .upload(storagePath, file, { contentType: file.type, upsert: false })

                    if (uploadError) throw uploadError

                    const { data: urlData } = supabase.storage
                        .from('trip-files')
                        .getPublicUrl(storagePath)

                    attachmentRows.push({
                        note_id: note.id,
                        file_name: file.name,
                        file_url: urlData.publicUrl,
                        file_type: file.type,
                        file_size: file.size,
                    })
                }

                const { error: attachError } = await supabase
                    .from('trip_note_attachments')
                    .insert(attachmentRows)

                if (attachError) throw attachError
            }

            return note
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tripNotes', variables.tripId] })
            queryClient.invalidateQueries({ queryKey: ['allAttachments'] })
        },
    })
}

// Delete a note (DB cascade removes attachment rows; we also clean up storage files)
export function useDeleteTripNote() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ noteId, tripId: _tripId, attachments }: { noteId: string, tripId: string, attachments: TripNoteAttachment[] }) => {
            // 1. Remove files from storage
            for (const att of attachments) {
                // Extract storage path from public URL
                const url = new URL(att.file_url)
                // Path format: /storage/v1/object/public/trip-files/{storagePath}
                const pathParts = url.pathname.split('/trip-files/')
                if (pathParts.length === 2) {
                    await supabase.storage.from('trip-files').remove([pathParts[1]])
                }
            }

            // 2. Delete the note (cascade removes trip_note_attachments rows)
            const { error } = await supabase
                .from('trip_notes')
                .delete()
                .eq('id', noteId)

            if (error) throw error
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tripNotes', variables.tripId] })
            queryClient.invalidateQueries({ queryKey: ['allAttachments'] })
        },
    })
}

// Update a note's content (author-only; enforced by RLS)
export function useUpdateTripNote() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ noteId, content, tripId: _tripId }: { noteId: string; content: string; tripId: string }) => {
            const { error } = await supabase
                .from('trip_notes')
                .update({ content: content.trim() })
                .eq('id', noteId)
            if (error) throw error
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tripNotes', variables.tripId] })
        },
    })
}


// ============================================================

export interface EnrichedAttachment {
    id: string
    note_id?: string
    expense_id?: string
    trip_id: string
    trip_title: string
    file_name: string
    file_url: string
    file_type: string
    file_size: number
    created_at: string
    uploader_name: string | null
    uploader_email: string | null
}

// Fetch ALL attachments across all trips the user participates in (RLS scopes automatically)
export function useAllTripAttachments(userId: string | null) {
    return useQuery({
        queryKey: ['allAttachments', userId],
        queryFn: async () => {
            if (!userId) return []

            // 1. Fetch note attachments
            const { data: noteAtts, error: noteError } = await supabase
                .from('trip_note_attachments')
                .select(`
                    id,
                    note_id,
                    file_name,
                    file_url,
                    file_type,
                    file_size,
                    created_at,
                    trip_notes (
                        trip_id,
                        user_id,
                        trips (
                            id,
                            title
                        ),
                        profiles:user_id (
                            full_name,
                            email
                        )
                    )
                `)

            if (noteError) throw noteError

            const noteAttachments = (noteAtts as any[]).map(att => ({
                id: att.id,
                note_id: att.note_id,
                trip_id: att.trip_notes?.trip_id ?? '',
                trip_title: att.trip_notes?.trips?.title ?? 'Unknown Trip',
                file_name: att.file_name,
                file_url: att.file_url,
                file_type: att.file_type,
                file_size: att.file_size ?? 0,
                created_at: att.created_at,
                uploader_name: att.trip_notes?.profiles?.full_name ?? null,
                uploader_email: att.trip_notes?.profiles?.email ?? null,
            }))

            // 2. Fetch expense attachments
            const { data: expAtts, error: expError } = await supabase
                .from('expenses')
                .select(`
                    id,
                    trip_id,
                    attachment_url,
                    attachment_name,
                    attachment_type,
                    attachment_size,
                    created_at,
                    trips (
                        id,
                        title
                    ),
                    trip_participants!paid_by (
                        name,
                        profiles:user_id (
                            full_name,
                            email
                        )
                    )
                `)
                .not('attachment_url', 'is', null)

            if (expError) throw expError

            const expenseAttachments = (expAtts as any[]).map(exp => {
                const participant = exp.trip_participants;
                const profile = participant?.profiles;
                const uploaderName = participant?.name || profile?.full_name || 'Guest';
                const uploaderEmail = profile?.email || null;

                return {
                    id: exp.id,
                    expense_id: exp.id,
                    trip_id: exp.trip_id,
                    trip_title: exp.trips?.title ?? 'Unknown Trip',
                    file_name: exp.attachment_name || 'Receipt',
                    file_url: exp.attachment_url!,
                    file_type: exp.attachment_type || 'application/octet-stream',
                    file_size: exp.attachment_size ?? 0,
                    created_at: exp.created_at,
                    uploader_name: uploaderName,
                    uploader_email: uploaderEmail,
                };
            })

            // 3. Merge and sort
            return [...noteAttachments, ...expenseAttachments].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ) as EnrichedAttachment[]
        },
        enabled: !!userId,
    })
}

// Rename an attachment's display name (updates file_name column; storage key is unchanged)
export function useRenameAttachment() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
            const { error } = await supabase
                .from('trip_note_attachments')
                .update({ file_name: newName.trim() })
                .eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['allAttachments'] })
            queryClient.invalidateQueries({ queryKey: ['tripNotes'] })
        },
    })
}

// Delete a single attachment: removes from storage + deletes DB row; note itself is preserved
export function useDeleteAttachment() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, fileUrl, tripId: _tripId }: { id: string; fileUrl: string; tripId: string }) => {
            // 1. Remove file from Supabase storage (non-fatal if it fails)
            try {
                const url = new URL(fileUrl)
                const pathParts = url.pathname.split('/trip-files/')
                if (pathParts.length === 2) {
                    await supabase.storage.from('trip-files').remove([pathParts[1]])
                }
            } catch { /* intentionally swallowed */ }

            // 2. Delete the DB row
            const { error } = await supabase
                .from('trip_note_attachments')
                .delete()
                .eq('id', id)
            if (error) throw error
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['allAttachments'] })
            queryClient.invalidateQueries({ queryKey: ['tripNotes', variables.tripId] })
        },
    })
}
