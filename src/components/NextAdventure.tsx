import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns'
import { Compass, ArrowRight, Clock } from 'lucide-react'

// Assuming Trip is typed as 'any' here for simplicity, or we can import the type if exported
type NextAdventureProps = {
    trip: any
}

export default function NextAdventure({ trip }: NextAdventureProps) {
    const navigate = useNavigate()
    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
    })

    useEffect(() => {
        if (!trip) return

        const updateTimer = () => {
            const now = new Date()
            const startDate = new Date(trip.start_date)

            if (now >= startDate) {
                // Trip has started
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
                return
            }

            setTimeLeft({
                days: differenceInDays(startDate, now),
                hours: differenceInHours(startDate, now) % 24,
                minutes: differenceInMinutes(startDate, now) % 60,
                seconds: differenceInSeconds(startDate, now) % 60
            })
        }

        updateTimer()
        const interval = setInterval(updateTimer, 1000)
        return () => clearInterval(interval)
    }, [trip])

    if (!trip) return null

    return (
        <div 
            onClick={() => navigate(`/trip/${trip.id}`)}
            className="group relative cursor-pointer overflow-hidden rounded-3xl p-[1px] bg-gradient-to-br from-fuchsia-500/30 via-indigo-500/30 to-transparent hover:from-fuchsia-500 hover:via-indigo-500 hover:to-fuchsia-600 transition-all duration-500 shadow-[0_0_40px_rgba(192,38,211,0.1)] hover:shadow-[0_0_60px_rgba(192,38,211,0.2)] hover:-translate-y-1"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/10 via-indigo-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="relative h-full bg-[#0a0f2c]/90 backdrop-blur-xl rounded-[23px] p-6 flex flex-col sm:flex-row items-center gap-6 overflow-hidden">
                {/* Decorative Background Element */}
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-[60px] pointer-events-none group-hover:bg-fuchsia-500/20 transition-all duration-500"></div>

                {/* Left Side: Icon & Title */}
                <div className="flex-1 min-w-0 w-full flex items-center gap-4 z-10">
                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 p-[1px] shadow-[0_0_20px_rgba(192,38,211,0.3)]">
                        <div className="w-full h-full bg-[#060a1f] rounded-[15px] flex items-center justify-center group-hover:bg-transparent transition-colors duration-300">
                            <Compass className="w-7 h-7 text-white group-hover:animate-[spin_4s_linear_infinite]" />
                        </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-fuchsia-400 font-bold text-sm tracking-wider uppercase flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4" /> Next Adventure
                        </span>
                        <h3 className="text-2xl font-black text-white truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/60 transition-all">
                            {trip.title}
                        </h3>
                    </div>
                </div>

                {/* Right Side: Countdown */}
                <div className="flex items-center gap-3 sm:gap-6 z-10 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
                    
                    <div className="flex items-center gap-2 sm:gap-4 bg-black/40 px-4 py-3 border border-white/5 rounded-2xl">
                        {[
                            { label: 'Days', value: timeLeft.days },
                            { label: 'Hrs', value: timeLeft.hours.toString().padStart(2, '0') },
                            { label: 'Min', value: timeLeft.minutes.toString().padStart(2, '0') },
                            { label: 'Sec', value: timeLeft.seconds.toString().padStart(2, '0') }
                        ].map((unit, i) => (
                            <div key={unit.label} className="flex items-baseline gap-1">
                                <span className="text-xl sm:text-2xl font-black text-white tabular-nums drop-shadow-md">
                                    {unit.value}
                                </span>
                                <span className="text-[10px] sm:text-xs font-bold font-mono text-slate-400 uppercase tracking-widest">
                                    {unit.label}
                                </span>
                                {i < 3 && <span className="text-white/20 mx-1">:</span>}
                            </div>
                        ))}
                    </div>

                    <div className="w-12 h-12 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:border-white transition-all duration-300">
                        <ArrowRight className="w-5 h-5 text-white group-hover:text-black transition-colors" />
                    </div>

                </div>
            </div>
        </div>
    )
}
