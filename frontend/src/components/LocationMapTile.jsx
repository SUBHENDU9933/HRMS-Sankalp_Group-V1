// Reusable "where were they when they responded" map — used anywhere we
// show geo-evidence (Agreements, Digital Approvals, etc). Fetches real tiles
// directly from the official OpenStreetMap production tile server and draws
// the marker ourselves at the exact pixel position, instead of depending on
// an unofficial "give me a composed map image" service — see
// AgreementDocument.jsx's latLngToTile for the original reasoning (that
// third-party service has a documented history of multi-day outages).

export function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const xExact = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yExact = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.floor(xExact);
  const y = Math.floor(yExact);
  return { x, y, zoom, pixelX: Math.round((xExact - x) * 256), pixelY: Math.round((yExact - y) * 256) };
}

export default function LocationMapTile({ lat, lng, zoom = 16, size = 220, className = "" }) {
  if (lat == null || lng == null) return null;
  const tile = latLngToTile(lat, lng, zoom);
  const targetX = 256 + tile.pixelX;
  const targetY = 256 + tile.pixelY;
  const gridLeft = size / 2 - targetX;
  const gridTop = size / 2 - targetY;
  const offsets = [-1, 0, 1];

  return (
    <div
      className={className}
      style={{ position: "relative", width: size, height: size, overflow: "hidden", border: "2px solid #0f172a", borderRadius: 4 }}
      data-testid="location-map-tile"
    >
      <div style={{ position: "absolute", width: 768, height: 768, left: gridLeft, top: gridTop }}>
        {offsets.map((dy) => offsets.map((dx) => (
          <img
            key={`${dx}_${dy}`}
            src={`https://tile.openstreetmap.org/${tile.zoom}/${tile.x + dx}/${tile.y + dy}.png`}
            alt=""
            crossOrigin="anonymous"
            width={256}
            height={256}
            style={{ position: "absolute", left: (dx + 1) * 256, top: (dy + 1) * 256 }}
          />
        )))}
      </div>
      <div
        style={{
          position: "absolute", left: size / 2, top: size / 2,
          width: 16, height: 16, marginLeft: -8, marginTop: -16,
          background: "#dc2626", border: "2px solid #fff", borderRadius: "50% 50% 50% 0",
          transform: "rotate(-45deg)", boxShadow: "0 1px 3px rgba(0,0,0,0.5)", zIndex: 1,
        }}
      />
    </div>
  );
}
