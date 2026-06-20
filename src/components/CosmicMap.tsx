import { useState, useEffect } from 'react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { MapPin, ZoomIn, ZoomOut } from 'lucide-react'
import { type Trip } from '../hooks/useTripData'

// Topology map of the world
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

// Cache for coordinates to prevent over-fetching
const MOCK_COORDINATES: Record<string, [number, number]> = {
    "Ladakh": [77.58, 34.15],
    "Goa": [74.12, 15.29],
    "Japan": [138.25, 36.20],
    "Paris": [2.35, 48.85],
    "New York": [-74.00, 40.71],
    "London": [-0.12, 51.50],
    "Dubai": [55.27, 25.20],
    "Maldives": [73.22, 3.20]
}

type CosmicMapProps = {
    trips: Trip[]
}

export default function CosmicMap({ trips }: CosmicMapProps) {
    const [mapMarkers, setMapMarkers] = useState<{ name: string, coordinates: [number, number], trip: Trip }[]>([])
    const [mapView, setMapView] = useState<'india' | 'world'>('india')
    const [position, setPosition] = useState({ coordinates: [80, 22], zoom: 1 })

    // Reset zoom and pan when switching views
    const handleViewChange = (view: 'india' | 'world') => {
        setMapView(view)
        setPosition({ coordinates: view === 'india' ? [80, 22] : [0, 20], zoom: 1 })
    }

    const handleZoomIn = () => {
        if (position.zoom >= 4) return
        setPosition(pos => ({ ...pos, zoom: pos.zoom * 1.5 }))
    }

    const handleZoomOut = () => {
        if (position.zoom <= 1) {
            // Snap back to default center if zooming all the way out
            setPosition({ coordinates: mapView === 'india' ? [80, 22] : [0, 20], zoom: 1 })
            return
        }
        setPosition(pos => ({ ...pos, zoom: pos.zoom / 1.5 }))
    }

    const handleMoveEnd = (newPosition: { coordinates: [number, number], zoom: number }) => {
        setPosition(prev => {
            // Prevent infinite re-render loops if the map continually fires onMoveEnd
            if (
                prev.zoom === newPosition.zoom &&
                prev.coordinates[0] === newPosition.coordinates[0] &&
                prev.coordinates[1] === newPosition.coordinates[1]
            ) {
                return prev
            }
            return newPosition
        })
    }

    useEffect(() => {
        const fetchCoordinates = async () => {
            const newMarkers: typeof mapMarkers = []

            for (const trip of trips) {
                if (!trip.destination) continue

                // Check cache first
                if (MOCK_COORDINATES[trip.destination]) {
                    newMarkers.push({
                        name: trip.destination,
                        coordinates: MOCK_COORDINATES[trip.destination],
                        trip
                    })
                    continue
                }

                // If not in cache, fallback to Nominatim API
                try {
                    // Respect rate limits of open API
                    await new Promise(r => setTimeout(r, 600))

                    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trip.destination)}&format=json&limit=1`)
                    const data = await res.json()

                    if (data && data.length > 0) {
                        const lon = parseFloat(data[0].lon)
                        const lat = parseFloat(data[0].lat)
                        const coords: [number, number] = [lon, lat]

                        // Cache it for the session
                        MOCK_COORDINATES[trip.destination] = coords

                        newMarkers.push({
                            name: trip.destination,
                            coordinates: coords,
                            trip
                        })
                    }
                } catch (e) {
                    console.error("Geocoding failed for:", trip.destination)
                }
            }

            setMapMarkers(newMarkers)
        }

        fetchCoordinates()
    }, [trips])

    return (
        <div className="w-full bg-[#0a0f2c]/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10 pointer-events-none group-hover:opacity-70 transition-opacity duration-1000"></div>

            <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-indigo-400" />
                    Footprint
                </h3>

                <div className="flex items-center gap-3">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                        <button
                            onClick={() => handleViewChange('india')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${mapView === 'india' ? 'bg-indigo-500/40 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Domestic
                        </button>
                        <button
                            onClick={() => handleViewChange('world')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${mapView === 'world' ? 'bg-indigo-500/40 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            World
                        </button>
                    </div>
                    <span className="text-xs font-bold text-slate-400 tracking-widest uppercase bg-white/5 px-3 py-1 rounded-full border border-white/5 hidden sm:block">
                        {mapMarkers.length} Destinations
                    </span>
                </div>
            </div>

            <div className="h-[300px] sm:h-[400px] w-full relative z-10 -mx-4 sm:mx-0 transition-all duration-700 ease-in-out">
                {/* Zoom Controls */}
                <div className="absolute right-6 top-4 flex flex-col gap-2 z-20">
                    <button
                        onClick={handleZoomIn}
                        className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 hover:scale-110 transition-all shadow-lg outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                        title="Zoom In"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleZoomOut}
                        className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 hover:scale-110 transition-all shadow-lg outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                        title="Zoom Out"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                </div>

                <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{
                        scale: mapView === 'india' ? 800 : 120,
                    }}
                    style={{ width: "100%", height: "100%" }}
                >
                    <ZoomableGroup
                        zoom={position.zoom}
                        center={position.coordinates as [number, number]}
                        onMoveEnd={handleMoveEnd}
                        maxZoom={4}
                    >
                        <Geographies geography={geoUrl}>
                            {({ geographies }: { geographies: any[] }) =>
                                geographies.map((geo: any) => (
                                    <Geography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        fill="rgba(255, 255, 255, 0.03)"
                                        stroke="rgba(255, 255, 255, 0.1)"
                                        strokeWidth={0.5}
                                        style={{
                                            default: { outline: "none" },
                                            hover: { fill: "rgba(255, 255, 255, 0.1)", outline: "none" },
                                            pressed: { outline: "none" },
                                        }}
                                    />
                                ))
                            }
                        </Geographies>

                        {mapMarkers.map(({ name, coordinates, trip }) => {
                            const isUpcoming = trip.start_date && new Date(trip.start_date) > new Date()
                            const pinColor = isUpcoming ? '#818cf8' : '#e879f9' // Indigo for upcoming, Fuchsia for past/active

                            return (
                                <Marker key={trip.id} coordinates={coordinates}>
                                    <g
                                        fill="none"
                                        stroke={pinColor}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        transform="translate(-12, -24)"
                                        className="cursor-pointer transition-transform hover:scale-125 drop-shadow-[0_0_8px_rgba(232,121,249,0.8)]"
                                    >
                                        <circle cx="12" cy="10" r="3" fill="#0a0f2c" />
                                        <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
                                    </g>
                                    <text
                                        textAnchor="middle"
                                        y={15}
                                        style={{ fontFamily: "'Work Sans', sans-serif", fill: "rgba(255,255,255,0.7)", fontSize: "10px", fontWeight: "bold" }}
                                    >
                                        {name}
                                    </text>
                                </Marker>
                            )
                        })}
                    </ZoomableGroup>
                </ComposableMap>
            </div>
        </div>
    )
}
