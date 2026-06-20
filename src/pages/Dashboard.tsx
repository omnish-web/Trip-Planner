import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Calendar, MapPin, LogOut, Sun, Moon, Trash2, User, Edit2, Images, FolderOpen } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'react-hot-toast'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import EditProfileModal from '../components/EditProfileModal'
import { useTrips, type Trip, useCurrentUser } from '../hooks/useTripData'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../hooks/useTheme'
import TripTimeline from '../components/TripTimeline'
import CosmicMap from '../components/CosmicMap'
import CreateTripModal from '../components/CreateTripModal'
import ImageManagerModal from '../components/ImageManagerModal'
import FileManagerModal from '../components/FileManagerModal'
import { getPresetForTrip } from '../components/ImagePickerModal'
import StorageMeter from '../components/StorageMeter'

export default function Dashboard() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const { data: user = null } = useCurrentUser()
    const { data: trips = [] } = useTrips(user?.id || null)

    const { isDark, toggleTheme } = useTheme()

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
    const [showProfileModal, setShowProfileModal] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [tripToDelete, setTripToDelete] = useState<Trip | null>(null)
    const [expenseCount, setExpenseCount] = useState<number | null>(null)
    const [showImageManager, setShowImageManager] = useState(false)
    const [showFileManager, setShowFileManager] = useState(false)

    // New state for filtering
    const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'past'>('all')

    // Derived User display name
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Traveler'

    // Date logic for derived categories
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const getTripCategory = (trip: Trip): 'active' | 'upcoming' | 'past' => {
        if (!trip.start_date && !trip.end_date) return 'upcoming' // Default pending to upcoming

        const start = trip.start_date ? new Date(trip.start_date) : null
        if (start) start.setHours(0, 0, 0, 0)

        const end = trip.end_date ? new Date(trip.end_date) : null
        if (end) end.setHours(0, 0, 0, 0)

        if (start && end) {
            if (today < start) return 'upcoming'
            if (today > end) return 'past'
            return 'active'
        } else if (start) {
            if (today < start) return 'upcoming'
            return 'active'
        } else if (end) {
            if (today > end) return 'past'
            return 'active'
        }
        return 'upcoming'
    }

    // Derived stats
    const activeTrips = trips.filter((t: Trip) => getTripCategory(t) === 'active')
    const upcomingTrips = trips.filter((t: Trip) => getTripCategory(t) === 'upcoming')
    const pastTrips = trips.filter((t: Trip) => getTripCategory(t) === 'past')

    // Derived filtered trips
    const filteredTrips = filter === 'all'
        ? trips
        : filter === 'active'
            ? activeTrips
            : filter === 'upcoming'
                ? upcomingTrips
                : pastTrips

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
        <div className="min-h-screen bg-[#060a1f] text-slate-200 font-work-sans pb-24 relative overflow-hidden selection:bg-fuchsia-500/30 selection:text-fuchsia-100">
            {/* Immersive Twilight Background Elements */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                {/* Deep purple/pink ambient glow top right */}
                <div className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-bl from-fuchsia-600/20 via-purple-600/10 to-transparent blur-[120px] mix-blend-screen opacity-70 animate-[pulse_10s_ease-in-out_infinite]"></div>
                {/* Midnight blue ambient glow bottom left */}
                <div className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-tr from-blue-600/20 via-cyan-600/10 to-transparent blur-[100px] mix-blend-screen opacity-60"></div>
                {/* Subtle starlight noise opacity */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060a1f]/50 to-[#060a1f] pointer-events-none"></div>
            </div>

            {/* Ultra-Frosted Glass Navigation Bar */}
            <header className="fixed top-0 left-0 w-full h-[80px] bg-[#060a1f]/40 backdrop-blur-2xl border-b border-white/[0.05] z-40 px-6 sm:px-10 flex items-center justify-between transition-colors duration-300">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(192,38,211,0.3)] border border-white/10">
                        <MapPin className="text-white w-5 h-5 drop-shadow-md" />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-white hidden sm:block drop-shadow-sm">
                        Trip<span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400">Planner</span>
                    </h1>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    <button onClick={toggleTheme} className="p-3 rounded-xl hover:bg-white/5 text-slate-300 transition-all outline-none focus:ring-2 focus:ring-fuchsia-500/50 hidden">
                        {/* Hiding theme toggle, forcing dark mode for this twilight theme to look right */}
                        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                    <div className="hidden md:block">
                        <StorageMeter userId={user?.id || null} compact={true} />
                    </div>
                    <button
                        onClick={() => setShowImageManager(true)}
                        className="hidden sm:flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-300 transition-all outline-none focus:ring-2 focus:ring-fuchsia-500/50 shadow-inner"
                        title="Image Manager"
                    >
                        <Images className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setShowFileManager(true)}
                        className="hidden sm:flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-300 transition-all outline-none focus:ring-2 focus:ring-fuchsia-500/50 shadow-inner"
                        title="File Manager"
                    >
                        <FolderOpen className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowProfileModal(true)} className="hidden sm:flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-300 transition-all outline-none focus:ring-2 focus:ring-fuchsia-500/50 shadow-inner">
                        <User className="w-5 h-5" />
                    </button>
                    <div className="hidden sm:block w-px h-8 bg-white/10 mx-2"></div>
                    <button onClick={handleSignOut} className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl hover:bg-rose-500/10 text-rose-400 font-bold text-sm transition-all outline-none focus:ring-2 focus:ring-rose-500/50 border border-transparent hover:border-rose-500/20">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>

                    {/* Mobile Menu */}
                    <button onClick={() => setShowProfileModal(true)} className="sm:hidden w-11 h-11 rounded-xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center overflow-hidden shadow-lg backdrop-blur-md">
                        <User className="w-5 h-5 text-fuchsia-300" />
                    </button>
                </div>
            </header>

            <main className="pt-32 px-4 sm:px-8 max-w-[1600px] mx-auto w-full flex flex-col gap-12 relative z-10">

                {/* Immersive Hero Section */}
                <div className="relative w-full flex flex-col md:flex-row md:items-end justify-between gap-8 px-2 sm:px-4">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40 capitalize tracking-tighter mb-4 pb-2">
                            Hello, {userName}.
                        </h2>
                        <p className="text-slate-400 text-lg sm:text-xl font-medium leading-relaxed">
                            Your passport holds <strong className="text-fuchsia-300">{activeTrips.length} active</strong>, <strong className="text-indigo-300">{upcomingTrips.length} upcoming</strong>, and <strong className="text-slate-300">{pastTrips.length} past</strong> journeys. The world is waiting.
                        </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-4">
                        {/* Filter Tabs */}
                        <div className="hidden lg:flex items-center gap-2 p-1.5 bg-[#0a0f2c]/50 backdrop-blur-xl border border-white/5 rounded-2xl shadow-inner mr-6">
                            {(['all', 'active', 'upcoming', 'past'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-6 py-3 rounded-xl text-sm font-bold capitalize transition-all duration-300 outline-none focus:ring-2 focus:ring-fuchsia-500/50 ${filter === f
                                        ? 'bg-white/10 text-white shadow-lg border border-white/10'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="group relative bg-white text-[#060a1f] px-8 py-4 sm:px-10 sm:py-5 rounded-2xl font-black text-base tracking-wide flex items-center justify-center gap-3 overflow-hidden transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:bg-slate-100 transform hover:-translate-y-1 active:scale-95 w-full sm:w-auto outline-none focus:ring-4 focus:ring-white/30"
                        >
                            <Plus className="w-6 h-6 transform group-hover:rotate-180 transition-transform duration-500" />
                            Plan Journey
                        </button>
                    </div>
                </div>

                {/* Mobile/Tablet Filters */}
                <div className="lg:hidden flex items-center gap-2 p-1.5 bg-[#0a0f2c]/50 backdrop-blur-xl border border-white/5 rounded-2xl overflow-x-auto custom-scroll w-full shadow-inner sticky top-[90px] z-30">
                    {(['all', 'active', 'upcoming', 'past'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold capitalize whitespace-nowrap transition-all outline-none ${filter === f
                                ? 'bg-white/10 text-white shadow-lg border border-white/10'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {f}
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-lg bg-black/30 text-slate-400">
                                {f === 'all' ? trips.length : f === 'active' ? activeTrips.length : f === 'upcoming' ? upcomingTrips.length : pastTrips.length}
                            </span>
                        </button>
                    ))}
                </div>


                {trips.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center px-4">
                        <div className="w-40 h-40 bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(255,255,255,0.05)] backdrop-blur-xl">
                            <MapPin className="w-16 h-16 text-slate-400 opacity-50" />
                        </div>
                        <h3 className="text-4xl font-black mb-4 text-white tracking-tight">The Blank Canvas</h3>
                        <p className="text-xl text-slate-400 mb-10 max-w-lg font-medium">Every great story starts with a single step. Create your first itinerary and watch the magic unfold.</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="text-fuchsia-400 font-bold hover:text-fuchsia-300 text-lg flex items-center gap-2 group transition-colors"
                        >
                            Start your journey <span className="transform group-hover:translate-x-2 transition-transform">&rarr;</span>
                        </button>
                    </div>
                ) : filteredTrips.length === 0 ? (
                    <div className="flex flex-col justify-center items-center py-32 gap-6 text-center px-4">
                        <div className="text-2xl font-black text-slate-600">No journeys match this view.</div>
                        <button onClick={() => setFilter('all')} className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors border-b border-indigo-400/30 hover:border-indigo-300">Return to All Trips</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {filteredTrips.map((trip: any, index: number) => {
                            const category = getTripCategory(trip)
                            // Staggered fade in animation using standard CSS
                            const animationDelay = `${index * 100}ms`

                            return (
                                <div
                                    key={trip.id}
                                    onClick={() => navigate(`/trip/${trip.id}`)}
                                    className="group relative rounded-[2rem] overflow-hidden cursor-pointer flex flex-col transform hover:-translate-y-2 transition-all duration-500 focus-within:ring-4 focus-within:ring-fuchsia-500/30 outline-none hover:z-10 animate-fade-in-up"
                                    style={{ animationDelay, animationFillMode: 'both' }}
                                    tabIndex={0}
                                >
                                    {/* Immersive Card Background - Heavy Blur */}
                                    <div className="absolute inset-0 bg-[#0a0f2c]/60 backdrop-blur-xl border border-white/10 rounded-[2rem] group-hover:bg-[#0a0f2c]/40 group-hover:border-white/20 transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.5)] group-hover:shadow-[0_20px_40px_rgba(192,38,211,0.15)] z-0"></div>

                                    {/* Cover Image */}
                                    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-[2rem] z-10 p-2 pb-0">
                                        <div className="w-full h-full rounded-[1.5rem] overflow-hidden relative border border-white/5">
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f2c] via-transparent to-transparent z-10 pointer-events-none"></div>
                                            <img
                                                src={trip.card_image_url || trip.header_image_url || getPresetForTrip(trip.id)}
                                                alt={trip.title}
                                                className="w-full h-full object-cover transform scale-[1.02] group-hover:scale-110 transition-transform duration-[2s] ease-out select-none"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80'
                                                }}
                                            />

                                            {/* Top Actions overlay (Edit/Delete) - Blurred */}
                                            {trip.user_role === 'owner' && (
                                                <div className="absolute top-4 right-4 flex gap-2 z-20 translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-400 focus-within:opacity-100 focus-within:translate-y-0">
                                                    <button
                                                        onClick={(e) => handleEdit(e, trip)}
                                                        className="w-10 h-10 bg-black/40 hover:bg-white text-white hover:text-[#060a1f] rounded-xl backdrop-blur-md flex items-center justify-center transition-all outline-none focus:ring-2 focus:ring-white/50 border border-white/10 hover:border-transparent"
                                                        title="Edit Trip"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => confirmDelete(e, trip)}
                                                        className="w-10 h-10 bg-black/40 hover:bg-rose-500 text-white rounded-xl backdrop-blur-md flex items-center justify-center transition-all outline-none focus:ring-2 focus:ring-rose-500/50 border border-white/10 hover:border-transparent"
                                                        title="Delete Trip"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Status Badge floating at bottom of image inside the padding */}
                                            <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
                                                <div className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest backdrop-blur-xl border shadow-2xl ${category === 'past'
                                                    ? 'bg-white/10 text-slate-300 border-white/10'
                                                    : category === 'upcoming'
                                                        ? 'bg-indigo-500/30 text-indigo-200 border-indigo-500/40'
                                                        : 'bg-fuchsia-500/30 text-fuchsia-200 border-fuchsia-500/40'
                                                    }`}>
                                                    {category === 'past'
                                                        ? (trip.ended_at ? `Ended ${formatDistanceToNow(new Date(trip.ended_at))} ago` : 'Ended')
                                                        : category === 'upcoming' ? 'Upcoming' : 'Active Now'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    <div className="p-6 pt-5 flex-1 flex flex-col justify-between z-10 relative">
                                        <div className="mb-6">
                                            <h3 className="text-[22px] font-black text-white leading-tight mb-4 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-400 transition-all duration-300 line-clamp-2 pr-4 drop-shadow-sm">
                                                {trip.title}
                                            </h3>

                                            {/* Date Logic */}
                                            <div className="flex items-center gap-3 text-sm text-slate-400 font-medium">
                                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                                                    <Calendar className="w-4 h-4 text-slate-300" />
                                                </div>
                                                <span className="tracking-wide">
                                                    {trip.start_date ? (
                                                        trip.end_date ? (
                                                            new Date(trip.start_date).getFullYear() === new Date(trip.end_date).getFullYear()
                                                                ? `${format(new Date(trip.start_date), 'MMM d')} - ${format(new Date(trip.end_date), 'MMM d, yyyy')}`
                                                                : `${format(new Date(trip.start_date), 'MMM d, yyyy')} - ${format(new Date(trip.end_date), 'MMM d, yyyy')}`
                                                        ) : (
                                                            format(new Date(trip.start_date), 'MMM d, yyyy')
                                                        )
                                                    ) : 'Dates Pending'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between mt-auto pt-5 border-t border-white/5 group-hover:border-white/10 transition-colors">
                                            <div className="flex items-center gap-3 border-t-transparent">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center p-[2px]">
                                                    <div className="w-full h-full rounded-full bg-[#0a0f2c] flex items-center justify-center">
                                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-400 transition-colors">
                                                    {trip.user_role}
                                                </span>
                                            </div>

                                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-500 border border-white/10">
                                                <span className="text-white text-xl leading-none font-light">&rarr;</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Timeline & Map Full Width Section Below Grid */}
                {trips.length > 0 && (
                    <div className="grid lg:grid-cols-2 gap-8 mt-12 mb-20">
                        <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                            <TripTimeline trips={trips} />
                        </div>
                        <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                            <CosmicMap trips={trips} />
                        </div>
                    </div>
                )}

            </main>

            {/* Modals remain structurally unchanged */}
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
                    onSuccess={() => {/* Optional */ }}
                />
            )}

            {showImageManager && (
                <ImageManagerModal
                    onClose={() => setShowImageManager(false)}
                    trips={trips}
                />
            )}

            {showFileManager && (
                <FileManagerModal
                    onClose={() => setShowFileManager(false)}
                    userId={user?.id ?? null}
                />
            )}

            <DeleteConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteTrip}
                tripTitle={tripToDelete?.title || 'this trip'}
                additionalWarning={expenseCount !== null && expenseCount > 0 ? (
                    <div className="flex flex-col gap-2 text-sm bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 backdrop-blur-md">
                        <strong className="text-rose-400 tracking-wide uppercase text-xs">Critical Warning</strong>
                        <span className="text-rose-200">This trip contains <strong className="text-white">{expenseCount}</strong> financial entries. Deleting it will permanently vaporize all related data.</span>
                    </div>
                ) : undefined}
            />
        </div>
    )
}
