'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pinIcon = (color: string) => L.divIcon({
  className: '',
  html: `<div style="
    width:28px;height:28px;border-radius:50% 50% 50% 0;
    background:${color};border:2px solid white;
    transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.35)
  "></div>`,
  iconSize:   [28, 28],
  iconAnchor: [14, 28],
  popupAnchor:[0, -30],
});

export interface Waypoint {
  lat: number;
  lng: number;
  recorded_at: string;
}

export interface DeliveryPoint {
  lat: number;
  lng: number;
  customer_name: string;
  total_amount: number;
  created_at: string;
}

interface Props {
  waypoints:      Waypoint[];
  deliveryPoints: DeliveryPoint[];
  className?:     string;
}

// ── OSRM Route API: traza ruta por calles entre los puntos GPS ───────────────
// Usamos /route en lugar de /match porque es más robusto:
// no requiere timestamps monotónicos ni densidad de puntos uniforme.
const CHUNK_SIZE = 25; // máx waypoints por request (OSRM limita ~100 pero 25 da respuestas rápidas)

async function snapToRoads(pts: Waypoint[]): Promise<[number, number][]> {
  if (pts.length < 2) return pts.map(p => [p.lat, p.lng]);

  // Submuestrear si hay demasiados puntos (mantener inicio, fin y puntos uniformes)
  const MAX_PTS = 200;
  const sampled: Waypoint[] = pts.length > MAX_PTS
    ? pts.filter((_, i) => i === 0 || i === pts.length - 1 ||
        i % Math.ceil(pts.length / MAX_PTS) === 0)
    : pts;

  const result: [number, number][] = [];

  // Procesar en chunks solapados (el último punto del chunk = primero del siguiente)
  for (let i = 0; i < sampled.length - 1; i += CHUNK_SIZE - 1) {
    const chunk = sampled.slice(i, i + CHUNK_SIZE);
    if (chunk.length < 2) break;

    const coords = chunk.map(p => `${p.lng},${p.lat}`).join(';');

    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}` +
        `?overview=full&geometries=geojson`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error('OSRM ' + res.status);
      const data = await res.json();

      if (data.code === 'Ok' && data.routes?.[0]) {
        const snapped = (data.routes[0].geometry.coordinates as [number, number][])
          .map(([lng, lat]) => [lat, lng] as [number, number]);
        if (result.length > 0) snapped.shift(); // evitar duplicar el punto de empalme
        result.push(...snapped);
      } else {
        const raw = chunk.map(p => [p.lat, p.lng] as [number, number]);
        if (result.length > 0) raw.shift();
        result.push(...raw);
      }
    } catch {
      const raw = chunk.map(p => [p.lat, p.lng] as [number, number]);
      if (result.length > 0) raw.shift();
      result.push(...raw);
    }
  }

  return result;
}

export default function RepartoMap({ waypoints, deliveryPoints, className = '' }: Props) {
  const [roadRoute, setRoadRoute] = useState<[number, number][]>([]);
  const [snapping,  setSnapping]  = useState(false);

  const rawRoute = waypoints.map(w => [w.lat, w.lng] as [number, number]);

  useEffect(() => {
    if (waypoints.length < 2) { setRoadRoute([]); return; }
    setSnapping(true);
    setRoadRoute([]);
    snapToRoads(waypoints)
      .then(route => setRoadRoute(route))
      .finally(() => setSnapping(false));
  }, [waypoints]);

  const allPoints = [
    ...rawRoute,
    ...deliveryPoints.map(d => [d.lat, d.lng] as [number, number]),
  ];
  const center: [number, number] = allPoints.length > 0
    ? [
        allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length,
        allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length,
      ]
    : [-34.6, -58.4];

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={14}
        className={`h-full w-full rounded-xl ${className}`}
        style={{ minHeight: 320 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
        />

        {/* Ruta por calles (OSRM) */}
        {roadRoute.length > 1 && (
          <Polyline positions={roadRoute} color="#1d4ed8" weight={4} opacity={0.85} />
        )}

        {/* Línea directa temporal mientras OSRM calcula */}
        {snapping && rawRoute.length > 1 && (
          <Polyline positions={rawRoute} color="#94a3b8" weight={2} opacity={0.4} dashArray="6 8" />
        )}

        {/* Pin inicio */}
        {waypoints[0] && (
          <Marker position={[waypoints[0].lat, waypoints[0].lng]} icon={pinIcon('#22c55e')}>
            <Popup>Inicio del reparto</Popup>
          </Marker>
        )}

        {/* Pin fin */}
        {waypoints.length > 1 && (
          <Marker
            position={[waypoints[waypoints.length - 1]!.lat, waypoints[waypoints.length - 1]!.lng]}
            icon={pinIcon('#ef4444')}
          >
            <Popup>Último punto registrado</Popup>
          </Marker>
        )}

        {/* Puntos de entrega */}
        {deliveryPoints.map((d, i) => (
          <CircleMarker
            key={i}
            center={[d.lat, d.lng]}
            radius={10}
            pathOptions={{ color: '#7c3aed', fillColor: '#a78bfa', fillOpacity: 0.9 }}
          >
            <Popup>
              <strong>{d.customer_name}</strong><br />
              ${d.total_amount.toFixed(2)}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {snapping && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 shadow">
          Calculando ruta por calles…
        </div>
      )}
    </div>
  );
}
