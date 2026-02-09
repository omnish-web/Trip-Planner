import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Calendar, MapPin, LogOut, Sun, Moon, Loader2, Trash2, User, Edit2 } from 'lucide-react'
import { format } from 'date-fns'
import CreateTripModal from '../components/CreateTripModal'
import { toast } from 'react-hot-toast'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import EditProfileModal from '../components/EditProfileModal'
import { useTrips, type Trip, useCurrentUser } from '../hooks/useTripData'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../hooks/useTheme'



export default function Dashboard() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const { data: user = null } = useCurrentUser()
    const { data: trips = [], isLoading, error } = useTrips(user?.id || null)

    const { isDark, toggleTheme } = useTheme()

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
    const [showProfileModal, setShowProfileModal] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [tripToDelete, setTripToDelete] = useState<Trip | null>(null)
    const [expenseCount, setExpenseCount] = useState<number | null>(null)

    // Derived User display name
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Traveler'

    const confirmDelete = async (e: React.MouseEvent, trip: Trip) => {
        e.stopPropagation()
        if (trip.user_role !== 'owner') {
            toast.error('Only the owner can delete this trip')
            return
        }
        setTripToDelete(trip)
        setExpenseCount(null)
        setDeleteModalOpen(true)

        try {
            const { count, error } = await supabase
                .from('expenses')
                .select('*', { count: 'exact', head: true })
                .eq('trip_id', trip.id)

            if (!error && count !== null) {
                setExpenseCount(count)
            }
        } catch (err) {
            console.error('Error fetching expense count:', err)
        }
    }

    const handleEdit = (e: React.MouseEvent, trip: Trip) => {
        e.stopPropagation()
        if (trip.user_role !== 'owner') {
            toast.error('Only the owner can edit this trip')
            return
        }
        setEditingTrip(trip)
        setShowCreateModal(true)
    }

    const handleDeleteTrip = async () => {
        if (!tripToDelete) return

        try {
            const { error } = await supabase.from('trips').delete().eq('id', tripToDelete.id)
            if (error) throw error

            // Invalidate queries to refresh list
            queryClient.invalidateQueries({ queryKey: ['trips'] })
            setDeleteModalOpen(false)
            setTripToDelete(null)
        } catch (error: any) {
            console.error('Error deleting trip:', error)
            alert('Failed to delete trip: ' + error.message)
        }
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        navigate('/')
    }

    return (
        <div className="flex flex-col h-screen w-full overflow-hidden">
            {/* Header */}
            <div className="glass-panel m-4 mb-0 p-4 flex justify-between items-center shrink-0">
                <h1 className="text-xl font-bold tracking-tight">Trip<span className="text-blue-600 dark:text-blue-400">Planner</span></h1>

                <div className="flex items-center gap-3">
                    {/* User Name Display */}
                    <div className="hidden sm:flex flex-col items-end mr-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Welcome</span>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200 max-w-[150px] truncate">
                            {userName}
                        </span>
                    </div>

                    <button
                        onClick={() => setShowProfileModal(true)}
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300 relative group"
                        title="Edit Profile"
                    >
                        <User className="w-5 h-5" />
                        {/* Tooltip for user name on mobile */}
                        <div className="absolute top-full right-0 mt-2 p-2 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap sm:hidden z-10">
                            {userName}
                        </div>
                    </button>

                    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300">
                        {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-500 transition-colors ml-2"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Sign Out</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scroll">
                <div className="max-w-7xl mx-auto">

                    {/* Action Bar */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Your Trips</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your travel plans and expenses</p>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Trip</span>
                        </button>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                            <strong>Error:</strong> {(error as Error).message || 'Failed to load trips'}
                        </div>
                    )}

                    {/* Grid */}
                    {isLoading || !user ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                    ) : trips.length === 0 ? (
                        <div className="glass-panel p-12 flex flex-col items-center justify-center text-center">
                            <MapPin className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">No trips found</h3>
                            <p className="text-gray-500 max-w-sm mt-2 mb-6">You haven't planned any trips yet. Create one to start tracking expenses with friends.</p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="btn-primary"
                            >
                                Create First Trip
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {trips.map((trip: any) => (
                                <div
                                    key={trip.id}
                                    onClick={() => navigate(`/trip/${trip.id}`)}
                                    className="glass-panel p-0 overflow-hidden hover:shadow-xl hover:scale-[1.02] cursor-pointer group relative"
                                >
                                    <div className="h-32 bg-gray-200 dark:bg-gray-700 relative">
                                        <img
                                            src={trip.header_image_url || `https://source.unsplash.com/random/800x600/?travel,${trip.title}`}
                                            alt={trip.title}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80'
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                        <div className="absolute bottom-3 left-4 text-white">
                                            <h3 className="text-lg font-bold shadow-sm">{trip.title}</h3>
                                        </div>

                                        {/* Edit and Delete Buttons (Only for owners) */}
                                        {trip.user_role === 'owner' && (
                                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => handleEdit(e, trip)}
                                                    className="p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm transition-colors"
                                                    title="Edit Trip"
                                                >
                                                    <div className="w-4 h-4 flex items-center justify-center">
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={(e) => confirmDelete(e, trip)}
                                                    className="p-1.5 bg-black/40 hover:bg-red-500/80 text-white rounded-full backdrop-blur-sm transition-colors"
                                                    title="Delete Trip"
                                                >
                                                    <div className="w-4 h-4 flex items-center justify-center">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </div>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                                            <Calendar className="w-4 h-4" />
                                            <span>
                                                {trip.start_date ? (
                                                    trip.end_date ? (
                                                        new Date(trip.start_date).getFullYear() === new Date(trip.end_date).getFullYear()
                                                            ? `${format(new Date(trip.start_date), 'MMM d')} - ${format(new Date(trip.end_date), 'MMM d, yyyy')}`
                                                            : `${format(new Date(trip.start_date), 'MMM d, yyyy')} - ${format(new Date(trip.end_date), 'MMM d, yyyy')}`
                                                    ) : (
                                                        format(new Date(trip.start_date), 'MMM d, yyyy')
                                                    )
                                                ) : 'Date TBD'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center mt-4">
                                            <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded uppercase">
                                                {trip.user_role || 'Viewer'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showCreateModal && (
                <CreateTripModal
                    onClose={() => {
                        setShowCreateModal(false)
                        setEditingTrip(null)
                    }}
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ['trips'] })}
                    trip={editingTrip}
                />
            )}

            {showProfileModal && (
                <EditProfileModal
                    onClose={() => setShowProfileModal(false)}
                    onSuccess={() => {/* Optional: refresh anything if needed */ }}
                />
            )}

            <DeleteConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteTrip}
                tripTitle={tripToDelete?.title || 'this trip'}
                additionalWarning={expenseCount !== null && expenseCount > 0 ? (
                    <div className="flex flex-col gap-1">
                        <strong>Warning: This trip has {expenseCount} logged expenses.</strong>
                        <span>Deleting this trip will permanently remove all expenses, settlements, and member data. This action cannot be undone.</span>
                    </div>
                ) : undefined}
            />
            <div className="shrink-0 py-3 text-center text-xs text-gray-400 dark:text-gray-600 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800">
                A proprietary framework designed and developed by Omnish Singhal
            </div>
        </div>
    )
}
