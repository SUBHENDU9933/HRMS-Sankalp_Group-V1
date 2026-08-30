import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Lightweight camera capture for candidate photos on the public application form.
 * Unlike SelfieCapture (attendance), this does NOT embed GPS/timestamp/name watermark —
 * a candidate's photo shouldn't be permanently stamped with location/time data.
 * Props: onCapture(dataUrl), onClose()
 */
export default function PhotoCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        setReady(true);
      } catch (e) {
        toast.error("Camera unavailable: " + (e.message || "permission denied"));
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const capture = () => {
    if (!videoRef.current || capturing) return;
    setCapturing(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onCapture(dataUrl);
    setCapturing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" data-testid="photo-capture">
      {flash && <div className="sk-flash" />}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white">
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20" data-testid="photo-capture-close">
          <X className="w-5 h-5" />
        </button>
        <div className="text-xs opacity-70">Center your face in frame</div>
      </div>
      <div className="flex-1 grid place-items-center overflow-hidden">
        <div className="relative w-full h-full max-w-md mx-auto">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
          {!ready && <div className="absolute inset-0 grid place-items-center text-white text-sm">Starting camera…</div>}
        </div>
      </div>
      <div className="bg-black/80 px-6 py-6 flex items-center justify-center gap-6">
        <div className="w-14" />
        <button onClick={capture} disabled={!ready || capturing} data-testid="photo-capture-shutter"
          className="w-20 h-20 rounded-full bg-white border-[6px] border-[#FFA94D] active:scale-90 transition shadow-lg grid place-items-center disabled:opacity-50">
          <Camera className="w-7 h-7 text-slate-900" />
        </button>
        <div className="w-14" />
      </div>
    </div>
  );
}
