import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, X, MapPin } from "lucide-react";
import { getGPS, watermarkImage } from "@/lib/utils-app";
import { toast } from "sonner";

/**
 * Selfie capture component with watermark.
 * Props:
 * - employeeName: string (used in watermark)
 * - onCapture: (dataUrl, gps) => void
 * - onClose: () => void
 */
export default function SelfieCapture({ employeeName, onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [gps, setGps] = useState(null);
  const [gpsErr, setGpsErr] = useState("");
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (e) {
        toast.error("Camera unavailable: " + (e.message || "permission denied"));
      }
    })();
    // GPS in parallel
    getGPS().then(setGps).catch((e) => setGpsErr(e.message || "GPS failed"));
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const capture = async () => {
    if (!videoRef.current || capturing) return;
    setCapturing(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0);
    const raw = canvas.toDataURL("image/jpeg", 0.9);
    let gpsData = gps;
    if (!gpsData) {
      try { gpsData = await getGPS(); setGps(gpsData); } catch {}
    }
    const watermarked = await watermarkImage(raw, {
      name: employeeName || "Employee",
      latitude: gpsData?.latitude,
      longitude: gpsData?.longitude,
    });
    onCapture(watermarked, gpsData || null);
    setCapturing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" data-testid="selfie-capture">
      {flash && <div className="sk-flash" />}
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20"
          data-testid="capture-close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="w-4 h-4 text-[#FFA94D]" />
          {gps ? (
            <span className="font-mono">{gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}</span>
          ) : gpsErr ? (
            <span className="text-red-300">GPS off</span>
          ) : (
            <span className="opacity-70">Locating…</span>
          )}
        </div>
      </div>

      {/* Video */}
      <div className="flex-1 grid place-items-center overflow-hidden">
        <div className="relative w-full h-full max-w-md mx-auto">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          {!ready && (
            <div className="absolute inset-0 grid place-items-center text-white text-sm">
              Starting camera…
            </div>
          )}
          {ready && (
            <div className="watermark-overlay" style={{ pointerEvents: "none" }}>
              <div className="text-[#FFA94D] font-bold">Sankalp Interior Solution</div>
              <div>{employeeName}</div>
              <div>{new Date().toLocaleString()}</div>
              <div>{gps ? `Lat ${gps.latitude.toFixed(5)}, Lng ${gps.longitude.toFixed(5)}` : "GPS pending"}</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action */}
      <div className="bg-black/80 px-6 py-6 flex items-center justify-center gap-6">
        <div className="w-14" />
        <button
          onClick={capture}
          disabled={!ready || capturing}
          data-testid="capture-shutter"
          className="w-20 h-20 rounded-full bg-white border-[6px] border-[#FFA94D] active:scale-90 transition shadow-lg grid place-items-center disabled:opacity-50"
        >
          <Camera className="w-7 h-7 text-slate-900" />
        </button>
        <div className="w-14 text-white/60 text-xs text-center">
          Selfie<br/>+ Watermark
        </div>
      </div>
    </div>
  );
}
