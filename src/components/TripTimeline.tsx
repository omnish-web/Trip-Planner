import { type Trip } from '../hooks/useTripData'
import { format } from 'date-fns'
import { VerticalTimeline, VerticalTimelineElement }
    from 'react-vertical-timeline-component'
import 'react-vertical-timeline-component/style.min.css'
import { Plane, Calendar, MapPin, CheckCircle2 } from 'lucide-react'

type TimelineProps = {
    trips: Trip[]
}

export default function TripTimeline({ trips }: TimelineProps) {
    // Sort trips chronologically
    const sortedTrips = [...trips].sort((a, b) => {
        if (!a.start_date) return 1
        if (!b.start_date) return -1
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    })

    const now = new Date()

    return (
        <div className="w-full bg-[#0a0f2c]/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-600/5 to-transparent pointer-events-none"></div>
            <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-3 relative z-10">
                <Calendar className="w-6 h-6 text-fuchsia-400" />
                Journey Timeline
            </h3>

            <div className="relative z-10 timeline-container custom-timeline-styles">
                <VerticalTimeline lineColor="rgba(255,255,255,0.05)" animate={true}>
                    {sortedTrips.map(trip => {
                        if (!trip.start_date) return null

                        const startDate = new Date(trip.start_date)
                        const endDate = trip.end_date ? new Date(trip.end_date) : null
                        const isPast = endDate ? now > endDate : now > startDate
                        const isActive = startDate <= now && (!endDate || now <= endDate)

                        const iconBg = isActive ? '#c026d3' : isPast ? '#334155' : '#4f46e5'
                        const Icon = isActive ? Plane : isPast ? CheckCircle2 : Calendar
                        const boxColor = isActive
                            ? 'rgba(192, 38, 211, 0.1)'
                            : isPast
                                ? 'rgba(255, 255, 255, 0.02)'
                                : 'rgba(79, 70, 229, 0.1)'

                        const borderColor = isActive
                            ? 'rgba(192, 38, 211, 0.3)'
                            : isPast
                                ? 'rgba(255, 255, 255, 0.05)'
                                : 'rgba(79, 70, 229, 0.3)'

                        return (
                            <VerticalTimelineElement
                                key={trip.id}
                                className="vertical-timeline-element--work"
                                contentStyle={{
                                    background: boxColor,
                                    color: '#fff',
                                    boxShadow: 'none',
                                    border: `1px solid ${borderColor}`,
                                    borderRadius: '16px',
                                    backdropFilter: 'blur(10px)'
                                }}
                                contentArrowStyle={{ borderRight: `7px solid ${borderColor}` }}
                                date={format(startDate, 'MMM d, yyyy')}
                                dateClassName="text-slate-400 font-bold tracking-wide"
                                iconStyle={{
                                    background: iconBg,
                                    color: '#fff',
                                    boxShadow: isActive ? '0 0 20px rgba(192, 38, 211, 0.5)' : 'none'
                                }}
                                icon={<Icon />}
                            >
                                <h4 className="vertical-timeline-element-title font-black text-xl mb-1">{trip.title}</h4>
                                {trip.destination && (
                                    <div className="flex items-center gap-1 text-slate-400 text-sm mt-2">
                                        <MapPin className="w-4 h-4" />
                                        <span>{trip.destination}</span>
                                    </div>
                                )}
                            </VerticalTimelineElement>
                        )
                    })}
                </VerticalTimeline>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-timeline-styles .vertical-timeline-element-date { padding-top: 0 !important; color: #94a3b8 !important; }
                .custom-timeline-styles .vertical-timeline-element-icon { border: 2px solid rgba(255,255,255,0.1); }
             `}} />
        </div>
    )
}
