// Tiny helper utilities
export const LOGO = "https://customer-assets.emergentagent.com/job_032cfb7b-1dca-4592-80d4-e7ef37892f05/artifacts/mn589atq_logo.png";

export const fmtINR = (n) => {
  const v = Number(n || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
};

export const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
};

export const fmtDateTime = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return d; }
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const getGPS = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

// Watermark a captured image (data URL) with date/time, GPS, name
export async function watermarkImage(srcDataUrl, { name, latitude, longitude, address }) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.width, h = img.height;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      const pad = Math.round(Math.min(w, h) * 0.025);
      const fontSize = Math.round(Math.min(w, h) * 0.028);
      const lineGap = Math.round(fontSize * 0.45);
      const ts = new Date().toLocaleString("en-IN", { hour12: true });
      const lines = [
        `Sankalp Interior Solution`,
        `${name}`,
        `${ts}`,
        latitude && longitude ? `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}` : "GPS unavailable",
      ];
      if (address) lines.push(address.length > 60 ? address.slice(0, 60) + "…" : address);

      const boxH = lines.length * (fontSize + lineGap) + pad * 1.2;
      const boxY = h - boxH - pad;
      // Translucent backdrop
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(pad, boxY, w - pad * 2, boxH);
      // Orange accent strip
      ctx.fillStyle = "#FFA94D";
      ctx.fillRect(pad, boxY, Math.round(fontSize * 0.35), boxH);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = `600 ${fontSize}px IBM Plex Sans, Arial`;
      ctx.textBaseline = "top";
      let y = boxY + pad * 0.5;
      lines.forEach((l, i) => {
        if (i === 0) ctx.fillStyle = "#FFA94D";
        else ctx.fillStyle = "#FFFFFF";
        ctx.fillText(l, pad * 1.8, y);
        y += fontSize + lineGap;
      });

      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(srcDataUrl);
    img.src = srcDataUrl;
  });
}
