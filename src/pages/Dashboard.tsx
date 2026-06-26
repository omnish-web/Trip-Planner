import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
    Plus, Calendar, MapPin, LogOut, Trash2, User, Edit2,
    Images, FolderOpen, Search, X, Sparkles, TrendingUp,
} from 'lucide-react'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
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
import NextAdventure from '../components/NextAdventure'
import DashboardStats from '../components/DashboardStats'

export default function Dashboard() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const { data: user = null } = useCurrentUser()
    const { data: trips = [] } = useTrips(user?.id || null)

    const { isDark } = useTheme()

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
    const [showProfileModal, setShowProfileModal] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [tripToDelete, setTripToDelete] = useState<Trip | null>(null)
    const [expenseCount, setExpenseCount] = useState<number | null>(null)
    const [showImageManager, setShowImageManager] = useState(false)
    const [showFileManager, setShowFileManager] = useState(false)
    const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'past'>('all')
    const [searchQuery, setSearchQuery] = useState('')

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

    const activeTrips = trips.filter((t: Trip) => getTripCategory(t) === 'active')
    const upcomingTrips = trips.filter((t: Trip) => getTripCategory(t) === 'upcoming')
    const pastTrips = trips.filter((t: Trip) => getTripCategory(t) === 'past')

    // Next upcoming trip (soonest)
    const nextTrip = upcomingTrips
        .filter((t: Trip) => t.start_date)
        .sort((a: Trip, b: Trip) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0] || null

    // Active spotlight (first active trip)
    const spotlightTrip = activeTrips[0] || null

    const filterBase = filter === 'all' ? trips
        : filter === 'active' ? activeTrips
            : filter === 'upcoming' ? upcomingTrips
                : pastTrips

    const filteredTrips = searchQuery.trim()
        ? filterBase.filter((t: Trip) => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
        : filterBase

    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'



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
        <div className={`min-h-screen bg-[#060a1f] text-slate-200 font-work-sans pb-24 relative overflow-hidden selection:bg-fuchsia-500/30 selection:text-fuchsia-100 ${isDark ? 'dark' : ''}`}>
            {/*  Background  */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-bl from-fuchsia-600/20 via-purple-600/10 to-transparent blur-[120px] mix-blend-screen opacity-70 animate-[pulse_10s_ease-in-out_infinite]" />
                <div className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-tr from-blue-600/20 via-cyan-600/10 to-transparent blur-[100px] mix-blend-screen opacity-60" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-br from-violet-600/8 to-transparent blur-[80px] mix-blend-screen opacity-40" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060a1f]/50 to-[#060a1f]" />
            </div>

            {/*  Navbar  */}
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
                    <div className="hidden md:block">
                        <StorageMeter userId={user?.id || null} compact={true} />
                    </div>
                    <button onClick={() => setShowImageManager(true)} className="hidden sm:flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-300 transition-all outline-none focus:ring-2 focus:ring-fuchsia-500/50" title="Image Manager">
                        <Images className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowFileManager(true)} className="hidden sm:flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-300 transition-all outline-none focus:ring-2 focus:ring-fuchsia-500/50" title="File Manager">
                        <FolderOpen className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowProfileModal(true)} className="hidden sm:flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-300 transition-all outline-none focus:ring-2 focus:ring-fuchsia-500/50">
                        <User className="w-5 h-5" />
                    </button>
                    <div className="hidden sm:block w-px h-8 bg-white/10 mx-2" />
                    <button onClick={handleSignOut} className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl hover:bg-rose-500/10 text-rose-400 font-bold text-sm transition-all outline-none focus:ring-2 focus:ring-rose-500/50 border border-transparent hover:border-rose-500/20">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                    <button onClick={() => setShowProfileModal(true)} className="sm:hidden w-11 h-11 rounded-xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-md">
                        <User className="w-5 h-5 text-fuchsia-300" />
                    </button>
                </div>
            </header>

            <main className="pt-28 px-4 sm:px-8 max-w-[1600px] mx-auto w-full flex flex-col gap-8 relative z-10">

                {/*  Hero  */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1 pt-4 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-400/70 mb-2 flex items-center gap-2">
                            <Sparkles className="w-3 h-3" /> {greeting}
                        </p>
                        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40 capitalize tracking-tighter mb-3 pb-1">
                            {userName}.
                        </h2>
                        <p className="text-slate-400 text-base sm:text-lg font-medium">
                            {trips.length === 0
                                ? "Your adventure map is empty. Let's change that."
                                : <>{`Your passport holds `}<strong className="text-fuchsia-300">{activeTrips.length} active</strong>{`, `}<strong className="text-indigo-300">{upcomingTrips.length} upcoming</strong>{`, and `}<strong className="text-slate-300">{pastTrips.length} past</strong>{` journeys.`}</>
                            }
                        </p>
                    </div>
                    <div className="shrink-0">
                        <button
                            id="plan-journey-btn"
                            onClick={() => setShowCreateModal(true)}
                            className="group relative bg-white text-[#060a1f] px-8 py-4 sm:px-10 sm:py-5 rounded-2xl font-black text-base tracking-wide flex items-center justify-center gap-3 overflow-hidden transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:bg-slate-100 transform hover:-translate-y-1 active:scale-95 w-full sm:w-auto outline-none focus:ring-4 focus:ring-white/30"
                        >
                            <Plus className="w-6 h-6 transform group-hover:rotate-180 transition-transform duration-500" />
                            Plan Journey
                        </button>
                    </div>
                </div>

                {/*  Stats Bar  */}
                {trips.length > 0 && (
                    <div className="animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
                        <DashboardStats total={trips.length} active={activeTrips.length} upcoming={upcomingTrips.length} past={pastTrips.length} filter={filter} onFilterChange={setFilter} />
                    </div>
                )}

                {/*  Next Adventure Countdown  */}
                {nextTrip && (
                    <div className="animate-fade-in-up" style={{ animationDelay: '160ms', animationFillMode: 'both' }}>
                        <NextAdventure trip={nextTrip} />
                    </div>
                )}

                {/*  Active Trip Spotlight  */}
                {spotlightTrip && (
                    <div
                        className="animate-fade-in-up relative rounded-3xl overflow-hidden cursor-pointer group"
                        style={{ animationDelay: '200ms', animationFillMode: 'both' }}
                        onClick={() => navigate(`/trip/${spotlightTrip.id}`)}
                        id="active-spotlight"
                    >
                        <div className="absolute inset-0">
                            <img
                                src={spotlightTrip.card_image_url || spotlightTrip.header_image_url || getPresetForTrip(spotlightTrip.id)}
                                alt={spotlightTrip.title}
                                className="w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform duration-[3s] ease-out select-none"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80' }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-[#060a1f]/95 via-[#060a1f]/70 to-[#060a1f]/20" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#060a1f]/80 via-transparent to-transparent" />
                        </div>
                        <div className="absolute inset-0 rounded-3xl border border-fuchsia-500/30 group-hover:border-fuchsia-500/60 active-card-ring transition-colors duration-300 pointer-events-none" />
                        <div className="relative z-10 p-8 sm:p-10 min-h-[220px] flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-300 text-xs font-black uppercase tracking-widest backdrop-blur-sm">
                                        <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
                                        Active Journey
                                    </span>
                                    {spotlightTrip.start_date && (
                                        <span className="text-slate-400 text-sm font-medium">
                                            Day {differenceInDays(today, new Date(spotlightTrip.start_date)) + 1}
                                            {spotlightTrip.end_date && ` of ${differenceInDays(new Date(spotlightTrip.end_date), new Date(spotlightTrip.start_date)) + 1}`}
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-2 drop-shadow-lg max-w-2xl">
                                    {spotlightTrip.title}
                                </h3>
                                {spotlightTrip.start_date && spotlightTrip.end_date && (
                                    <p className="text-slate-300 text-sm font-medium flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        {format(new Date(spotlightTrip.start_date), 'MMM d')}  -  {format(new Date(spotlightTrip.end_date), 'MMM d, yyyy')}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-4 mt-6">
                                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white text-[#060a1f] font-black text-sm group-hover:bg-fuchsia-100 transition-colors shadow-lg">
                                    <TrendingUp className="w-4 h-4" />
                                    Open Trip
                                    <span className="transform group-hover:translate-x-1 transition-transform">&rarr;</span>
                                </div>
                                <span className="text-slate-400 text-sm font-medium hidden sm:block">Click anywhere to open</span>
                            </div>
                        </div>
                    </div>
                )}

                {/*  Search + Filter Bar  */}
                {trips.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up" style={{ animationDelay: '240ms', animationFillMode: 'both' }}>
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                            <input
                                id="trip-search"
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search trips..."
                                className="w-full pl-11 pr-10 py-3 bg-[#0a0f2c]/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl text-slate-200 placeholder-slate-600 text-sm font-medium outline-none focus:border-fuchsia-500/40 focus:ring-2 focus:ring-fuchsia-500/20 transition-all"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/*  Trip Grid  */}
                {trips.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center px-4 animate-fade-in-up" style={{ animationFillMode: 'both' }}>
                        <div className="relative mb-10">
                            <div className="w-36 h-36 rounded-full bg-gradient-to-br from-fuchsia-500/20 via-indigo-500/20 to-transparent border border-white/10 flex items-center justify-center animate-float shadow-[0_0_60px_rgba(192,38,211,0.1)]">
                                <MapPin className="w-14 h-14 text-fuchsia-400/50" />
                            </div>
                            <div className="absolute -inset-4 rounded-full border border-white/5 animate-ping opacity-20" style={{ animationDuration: '3s' }} />
                        </div>
                        <h3 className="text-4xl font-black mb-3 text-white tracking-tight">The Blank Canvas</h3>
                        <p className="text-lg text-slate-400 mb-8 max-w-md font-medium leading-relaxed">
                            Every great story starts with a single step. Create your first itinerary and watch the magic unfold.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3 mb-10">
                            {[{ icon: 'FAM', label: 'Family dependents' }, { icon: 'PDF', label: 'PDF snapshots' }, { icon: 'AI', label: 'Smart settlement' }].map(f => (
                                <div key={f.label} className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/[0.08] rounded-xl text-sm font-medium text-slate-400">
                                    <span>{f.icon}</span> {f.label}
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="group relative bg-gradient-to-r from-fuchsia-500 to-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-base flex items-center gap-3 transition-all duration-300 shadow-[0_0_40px_rgba(192,38,211,0.3)] hover:shadow-[0_0_60px_rgba(192,38,211,0.5)] hover:-translate-y-1 active:scale-95"
                        >
                            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                            Start your first journey
                        </button>
                    </div>
                ) : filteredTrips.length === 0 ? (
                    <div className="flex flex-col justify-center items-center py-24 gap-4 text-center px-4">
                        <div className="text-3xl font-black text-slate-700">
                            {searchQuery ? `No trips matching "${searchQuery}"` : 'No journeys match this view.'}
                        </div>
                        <button onClick={() => { setFilter('all'); setSearchQuery('') }} className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors border-b border-indigo-400/30 hover:border-indigo-300">
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredTrips.map((trip: any, index: number) => {
                            const category = getTripCategory(trip)
                            const animationDelay = `${index * 70}ms`
                            const glowClass = category === 'active'
                                ? 'border-fuchsia-500/30 hover:border-fuchsia-500/60 hover:shadow-[0_0_40px_rgba(192,38,211,0.15)]'
                                : category === 'upcoming'
                                    ? 'border-indigo-500/20 hover:border-indigo-500/50 hover:shadow-[0_0_30px_rgba(99,102,241,0.12)]'
                                    : 'border-white/[0.06] hover:border-white/15 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)]'
                            return (
                                <div
                                    key={trip.id}
                                    id={`trip-card-${trip.id}`}
                                    onClick={() => navigate(`/trip/${trip.id}`)}
                                    className={`group relative rounded-[2rem] overflow-hidden cursor-pointer flex flex-col transform hover:-translate-y-2 transition-all duration-500 focus-within:ring-4 focus-within:ring-fuchsia-500/30 outline-none hover:z-10 animate-fade-in-up border ${glowClass} ${category === 'active' ? 'active-card-ring' : ''}`}
                                    style={{ animationDelay, animationFillMode: 'both' }}
                                    tabIndex={0}
                                >
                                    <div className="absolute inset-0 bg-[#0a0f2c]/60 backdrop-blur-xl rounded-[2rem] group-hover:bg-[#0a0f2c]/40 transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-0" />
                                    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-[2rem] z-10 p-2 pb-0">
                                        <div className="w-full h-full rounded-[1.5rem] overflow-hidden relative border border-white/5">
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f2c] via-transparent to-transparent z-10 pointer-events-none" />
                                            <img
                                                src={trip.card_image_url || trip.header_image_url || getPresetForTrip(trip.id)}
                                                alt={trip.title}
                                                className="w-full h-full object-cover transform scale-[1.02] group-hover:scale-110 transition-transform duration-[2s] ease-out select-none"
                                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80' }}
                                            />
                                            {trip.user_role === 'owner' && (
                                                <div className="absolute top-4 right-4 flex gap-2 z-20 translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 focus-within:opacity-100 focus-within:translate-y-0">
                                                    <button onClick={(e) => handleEdit(e, trip)} className="w-9 h-9 bg-black/40 hover:bg-white text-white hover:text-[#060a1f] rounded-xl backdrop-blur-md flex items-center justify-center transition-all outline-none focus:ring-2 focus:ring-white/50 border border-white/10 hover:border-transparent" title="Edit Trip">
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={(e) => confirmDelete(e, trip)} className="w-9 h-9 bg-black/40 hover:bg-rose-500 text-white rounded-xl backdrop-blur-md flex items-center justify-center transition-all outline-none focus:ring-2 focus:ring-rose-500/50 border border-white/10 hover:border-transparent" title="Delete Trip">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                            <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
                                                <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-xl border shadow-2xl ${category === 'past'
                                                    ? 'bg-white/[0.08] text-slate-400 border-white/[0.08]'
                                                    : category === 'upcoming'
                                                        ? 'bg-indigo-500/30 text-indigo-200 border-indigo-500/40'
                                                        : 'bg-fuchsia-500/30 text-fuchsia-200 border-fuchsia-500/40'
                                                    }`}>
                                                    {category === 'past'
                                                        ? (trip.ended_at ? `Ended ${formatDistanceToNow(new Date(trip.ended_at))} ago` : 'Completed')
                                                        : category === 'upcoming' ? 'Upcoming' : 'Active Now'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-5 pt-4 flex-1 flex flex-col justify-between z-10 relative">
                                        <div className="mb-4">
                                            <h3 className="text-[20px] font-black text-white leading-tight mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-400 transition-all duration-300 line-clamp-2 pr-2">
                                                {trip.title}
                                            </h3>
                                            <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                                                <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                                </div>
                                                <span className="text-xs tracking-wide">
                                                    {trip.start_date ? (
                                                        trip.end_date ? (
                                                            new Date(trip.start_date).getFullYear() === new Date(trip.end_date).getFullYear()
                                                                ? `${format(new Date(trip.start_date), 'MMM d')}  -  ${format(new Date(trip.end_date), 'MMM d, yyyy')}`
                                                                : `${format(new Date(trip.start_date), 'MMM d, yyyy')}  -  ${format(new Date(trip.end_date), 'MMM d, yyyy')}`
                                                        ) : format(new Date(trip.start_date), 'MMM d, yyyy')
                                                    ) : 'Dates Pending'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-4 border-t border-white/5 group-hover:border-white/10 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center">
                                                    <User className="w-3 h-3 text-slate-400" />
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${trip.user_role === 'owner' ? 'text-fuchsia-500/70' : trip.user_role === 'admin' ? 'text-indigo-500/70' : 'text-slate-600'} group-hover:brightness-125 transition-all`}>
                                                    {trip.user_role}
                                                </span>
                                            </div>
                                            <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-3 group-hover:translate-x-0 transition-all duration-400 border border-white/10">
                                                <span className="text-white text-lg leading-none font-light">&rarr;</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/*  Journey Story Section  */}
                {trips.length > 0 && (
                    <div className="mt-4 mb-8">
                        <div className="flex items-center gap-4 mb-8 animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            <div className="flex items-center gap-2 px-4 py-2 bg-[#0a0f2c]/50 border border-white/[0.08] rounded-xl backdrop-blur-xl">
                                <MapPin className="w-4 h-4 text-fuchsia-400" />
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Your Journey Story</span>
                            </div>
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        </div>
                        <div className="grid lg:grid-cols-2 gap-8">
                            <div className="animate-fade-in-up" style={{ animationDelay: '360ms', animationFillMode: 'both' }}>
                                <TripTimeline trips={trips} />
                            </div>
                            <div className="animate-fade-in-up" style={{ animationDelay: '420ms', animationFillMode: 'both' }}>
                                <CosmicMap trips={trips} />
                            </div>
                        </div>
                    </div>
                )}

            </main>

            {/*  Modals  */}
            {showCreateModal && (
                <CreateTripModal
                    onClose={() => { setShowCreateModal(false); setEditingTrip(null) }}
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ['trips'] })}
                    trip={editingTrip}
                />
            )}
            {showProfileModal && (
                <EditProfileModal onClose={() => setShowProfileModal(false)} onSuccess={() => { }} />
            )}
            {showImageManager && (
                <ImageManagerModal onClose={() => setShowImageManager(false)} trips={trips} />
            )}
            {showFileManager && (
                <FileManagerModal onClose={() => setShowFileManager(false)} userId={user?.id ?? null} />
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

