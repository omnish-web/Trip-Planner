
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Types
export interface Trip {
    id: string
    title: string
    start_date: string
    end_date: string
    header_image_url: string
    currency: string
    user_role: string
    categories?: string[]
}

interface Expense {
    id: string
    title: string
    amount: number
    date: string
    category: string
    paid_by: string
    expense_splits: {
        participant_id: string
        amount: number
    }[]
    trip_id: string
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
                .order('created_at', { ascending: false })

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
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['participants'] })
            queryClient.invalidateQueries({ queryKey: ['trips'] }) // Refresh trips for that user potentially
        },
    })
}

// 7. Fetch Current User (Cached)
export function useCurrentUser() {
    return useQuery({
        queryKey: ['currentUser'],
        queryFn: async () => {
            const { data } = await supabase.auth.getUser()
            return data.user?.id || null
        },
        staleTime: 1000 * 60 * 60, // 1 hour
        refetchOnWindowFocus: false,
    })
}
