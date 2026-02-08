import { X, Check } from 'lucide-react'

interface ImagePickerModalProps {
    onClose: () => void
    onSelect: (url: string) => Promise<void>
    currentUrl?: string
}

const PRESET_IMAGES = [
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80', // Switzerland
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', // Beach
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80', // Roadtrip
    'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80', // Greece
    'https://images.unsplash.com/photo-1499591934245-40b55745b905?auto=format&fit=crop&w=1200&q=80', // Camping
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80', // Hotel/Resort
    'https://images.unsplash.com/photo-1496417263034-38ec4f0d665a?auto=format&fit=crop&w=1200&q=80', // Osaka
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80', // Paris
    'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&w=1200&q=80', // Hiking
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80', // Yoga/Retreat
    'https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=1200&q=80', // Tokyo
    'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=1200&q=80', // Venice
]

export default function ImagePickerModal({ onClose, onSelect, currentUrl }: ImagePickerModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel w-full max-w-2xl p-6 relative bg-white dark:bg-gray-900 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <h3 className="text-xl font-bold dark:text-white">Choose Cover Image</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto custom-scroll pr-2">
                    {PRESET_IMAGES.map((url) => (
                        <button
                            key={url}
                            onClick={() => onSelect(url)}
                            className={`group relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${currentUrl === url ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                        >
                            <img
                                src={url}
                                alt="Preset"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            {currentUrl === url && (
                                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                    <div className="bg-blue-500 text-white p-1 rounded-full">
                                        <Check className="w-4 h-4" />
                                    </div>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
