import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../utils/cropImage'
import { Loader2, Crop } from 'lucide-react'

interface ImageCropperProps {
    imageSrc: string
    aspect: number
    onCropComplete: (croppedFile: File) => Promise<void>
    onCancel: () => void
    fileName?: string
}

export default function ImageCropper({
    imageSrc,
    aspect,
    onCropComplete,
    onCancel,
    fileName = 'cropped.jpg'
}: ImageCropperProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
    const [processing, setProcessing] = useState(false)

    const onCropCompleteHandler = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const handleSave = async () => {
        if (!croppedAreaPixels) return
        setProcessing(true)
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, fileName)
            await onCropComplete(croppedImage)
        } catch (e) {
            console.error(e)
        } finally {
            setProcessing(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#0d1235] rounded-3xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Crop className="w-5 h-5 text-fuchsia-400" />
                    <h3 className="text-white font-bold">Adjust Image</h3>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        disabled={processing}
                        className="px-4 py-1.5 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={processing}
                        className="px-4 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-bold transition flex items-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(192,38,211,0.3)]"
                    >
                        {processing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save Crop
                    </button>
                </div>
            </div>
            
            <div className="relative flex-1 bg-black/50 min-h-[400px]">
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspect}
                    onCropChange={setCrop}
                    onCropComplete={onCropCompleteHandler}
                    onZoomChange={setZoom}
                    classes={{
                        containerClassName: 'absolute inset-0',
                    }}
                />
            </div>
            
            <div className="p-4 border-t border-white/10 shrink-0 bg-[#0d1235] flex items-center gap-4">
                <span className="text-sm font-bold text-slate-400 w-12">Zoom</span>
                <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                />
            </div>
        </div>
    )
}
