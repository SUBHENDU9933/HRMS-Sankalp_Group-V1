/** Geo helpers — Haversine distance + GPS getter. */

/** Distance in metres between two GPS points. */
export function haversineMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371000; // m
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/** Return true if (lat,lng) is inside the office geofence. */
export function isInsideOffice(lat, lng, settings) {
  if (!settings?.office_lat || !settings?.office_lng) return true;
  const d = haversineMeters(lat, lng, settings.office_lat, settings.office_lng);
  if (d == null) return false;
  return d <= (settings.office_radius_m || 100);
}

/** Pretty-print distance like "42 m" / "1.3 km" */
export function fmtDistance(m) {
  if (m == null) return "—";
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(2)} km`;
}
