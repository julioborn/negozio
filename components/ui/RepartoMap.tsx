'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon (Next.js no sirve los assets de leaflet automáticamente)
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
  waypoints:       Waypoint[];
  deliveryPoints:  DeliveryPoint[];
  className?:      string;
}

export default function RepartoMap({ waypoints, deliveryPoints, className = '' }: Props) {
  useEffect(() => {
    // Nada — solo asegura que el componente se monte en cliente
  }, []);

  const allPoints = [
    ...waypoints.map(w => [w.lat, w.lng] as [number, number]),
    ...deliveryPoints.map(d => [d.lat, d.lng] as [number, number]),
  ];

  const center: [number, number] = allPoints.length > 0
    ? [
        allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length,
        allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length,
      ]
    : [-34.6, -58.4]; // Buenos Aires por defecto

  const routePositions = waypoints.map(w => [w.lat, w.lng] as [number, number]);

  return (
    <MapContainer
      center={center}
      zoom={13}
      className={`h-full w-full rounded-xl ${className}`}
      style={{ minHeight: 320 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
      />

      {/* Ruta del recorrido */}
      {routePositions.length > 1 && (
        <Polyline positions={routePositions} color="#1700a5" weight={3} opacity={0.7} />
      )}

      {/* Punto de inicio */}
      {waypoints[0] && (
        <Marker position={[waypoints[0].lat, waypoints[0].lng]} icon={pinIcon('#22c55e')}>
          <Popup>Inicio del reparto</Popup>
        </Marker>
      )}

      {/* Punto de cierre */}
      {waypoints.length > 1 && waypoints[waypoints.length - 1] && (
        <Marker
          position={[waypoints[waypoints.length - 1]!.lat, waypoints[waypoints.length - 1]!.lng]}
          icon={pinIcon('#ef4444')}
        >
          <Popup>Cierre del reparto</Popup>
        </Marker>
      )}

      {/* Puntos de entrega */}
      {deliveryPoints.map((d, i) => (
        <CircleMarker
          key={i}
          center={[d.lat, d.lng]}
          radius={10}
          pathOptions={{ color: '#1700a5', fillColor: '#6366f1', fillOpacity: 0.9 }}
        >
          <Popup>
            <strong>{d.customer_name}</strong><br />
            ${d.total_amount.toFixed(2)}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
