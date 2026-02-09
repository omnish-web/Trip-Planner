
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Loader2 } from 'lucide-react'
import type { Trip } from '../hooks/useTripData'

interface CreateTripModalProps {
    onClose: () => void
    onSuccess: () => void
    trip?: Trip | null
}

export default function CreateTripModal({ onClose, onSuccess, trip }: CreateTripModalProps) {
    const [loading, setLoading] = useState(false)
    const [title, setTitle] = useState(trip?.title || '')
    const [startDate, setStartDate] = useState(trip?.start_date || '')
    const [endDate, setEndDate] = useState(trip?.end_date || '')
    const [currency, setCurrency] = useState(trip?.currency || 'INR')

    useEffect(() => {
        if (trip) {
            setTitle(trip.title)
            setStartDate(trip.start_date || '')
            setEndDate(trip.end_date || '')
            setCurrency(trip.currency || 'INR')
        }
    }, [trip])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No user found')

            if (trip) {
                // Update existing trip
                const { error } = await supabase
                    .from('trips')
                    .update({
                        title,
                        start_date: startDate ? startDate : null,
                        end_date: endDate ? endDate : null,
                        currency
                    })
                    .eq('id', trip.id)

                if (error) throw error
            } else {
                // Create new trip
                const { error } = await supabase
                    .from('trips')
                    .insert({
                        created_by: user.id,
                        title,
                        start_date: startDate ? startDate : null,
                        end_date: endDate ? endDate : null,
                        currency
                    })

                if (error) throw error
            }

            onSuccess()
            onClose()
        } catch (error: any) {
            console.error('Error saving trip:', error)
            alert(`Failed to save trip: ${error.message || 'Unknown error'}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="glass-panel w-full max-w-md p-6 bg-white dark:bg-gray-800 relative animate-fade-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold mb-4">{trip ? 'Edit Trip' : 'Plan a New Trip'}</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="compact-label">Trip Name</label>
                        <input
                            type="text"
                            required
                            className="compact-input"
                            placeholder="e.g. Summer in Paris"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="compact-label">Start Date</label>
                            <input
                                type="date"
                                required
                                className="compact-input"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="compact-label">End Date</label>
                            <input
                                type="date"
                                required
                                className="compact-input"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="compact-label">Currency</label>
                        <select
                            className="compact-input"
                            value={currency}
                            onChange={e => setCurrency(e.target.value)}
                        >
                            <option value="INR">INR (₹)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="JPY">JPY (¥)</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full flex justify-center items-center gap-2 mt-4"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (trip ? 'Save Changes' : 'Create Trip')}
                    </button>
                </form>
            </div>
        </div>
    )
}
