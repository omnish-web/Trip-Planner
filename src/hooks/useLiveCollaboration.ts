import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useLiveCollaboration(tripId: string | undefined) {
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!tripId) return

        // Subscribe to all changes in the relevant tables for this trip
        const channel = supabase
            .channel(`trip-${tripId}`)
            // Listen to Trips
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
                    queryClient.invalidateQueries({ queryKey: ['trips'] })
                }
            )
            // Listen to Participants
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'trip_participants', filter: `trip_id=eq.${tripId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['participants', tripId] })
                    queryClient.invalidateQueries({ queryKey: ['trips'] }) // Refresh dashboard list in case role changed or member added
                }
            )
            // Listen to Expenses
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['expenses', tripId] })
                }
            )
            // Listen to Expense Splits
            // Note: Expense splits don't have trip_id, so we just invalidate the whole expenses list if ANY split changes
            // (In a highly optimized app we might filter by checking expense_id against the trip, but invalidating the list is fine for now)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'expense_splits' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['expenses', tripId] })
                }
            )
            // Listen to Trip Notes
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'trip_notes', filter: `trip_id=eq.${tripId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['notes', tripId] })
                }
            )
            // Listen to Trip Note Attachments
            // Note: Attachments don't have trip_id directly on the table, so we invalidate on any change
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'trip_note_attachments' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['notes', tripId] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [tripId, queryClient])
}
