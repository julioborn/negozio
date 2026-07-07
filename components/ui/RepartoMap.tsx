'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export interface DeliveryPoint {
  lat:            number;
  lng:            number;
  customer_name:  string;
  total_amount:   number;
  created_at:     string;
  payment_status: 'paid' | 'pending';
  payment_method?: string | null;
}

interface Props {
  deliveryPoints: DeliveryPoint[];
  className?:     string;
}

const PAY_LABEL: Record<string, string> = {
  cash:       'Efectivo',
  transfer:   'Transferencia',
  pending_7:  'Pendiente 7 días',
  pending_15: 'Pendiente 15 días',
};

// Ajusta el mapa para que entren todos los puntos
function FitBounds({ points }: { points: DeliveryPoint[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || points.length === 0) return;
    fitted.current = true;
    if (points.length === 1) {
      map.setView([points[0]!.lat, points[0]!.lng], 15);
    } else {
      const lats = points.map(p => p.lat);
      const lngs = points.map(p => p.lng);
      map.fitBounds(
        [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
        { padding: [40, 40] }
      );
    }
  }, [map, points]);
  return null;
}

export default function RepartoMap({ deliveryPoints, className = '' }: Props) {
  const center: [number, number] = deliveryPoints.length > 0
    ? [
        deliveryPoints.reduce((s, p) => s + p.lat, 0) / deliveryPoints.length,
        deliveryPoints.reduce((s, p) => s + p.lng, 0) / deliveryPoints.length,
      ]
    : [-34.6, -58.4];

  return (
    <MapContainer
      center={center}
      zoom={14}
      className={`h-full w-full rounded-xl ${className}`}
      style={{ minHeight: 256 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
      />

      <FitBounds points={deliveryPoints} />

      {deliveryPoints.map((d, i) => {
        const paid   = d.payment_status === 'paid';
        const color  = paid ? '#16a34a' : '#d97706';
        const fill   = paid ? '#bbf7d0' : '#fde68a';
        const time   = new Date(d.created_at).toLocaleTimeString('es-AR', {
          hour: '2-digit', minute: '2-digit',
        });
        const method = d.payment_method ? (PAY_LABEL[d.payment_method] ?? d.payment_method) : '';

        return (
          <CircleMarker
            key={i}
            center={[d.lat, d.lng]}
            radius={13}
            pathOptions={{
              color,
              fillColor: fill,
              fillOpacity: 0.95,
              weight: 2.5,
            }}
          >
            <Popup>
              <div style={{ minWidth: 160, fontFamily: 'sans-serif', lineHeight: 1.4 }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                  {d.customer_name}
                </p>
                <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 16, color: paid ? '#15803d' : '#b45309' }}>
                  ${d.total_amount.toLocaleString('es-AR')}
                </p>
                {method && (
                  <p style={{ margin: '0 0 2px', fontSize: 12, color: '#64748b' }}>{method}</p>
                )}
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#94a3b8' }}>{time}</p>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: paid ? '#dcfce7' : '#fef3c7',
                  color: paid ? '#166534' : '#92400e',
                }}>
                  {paid ? '✓ Cobrado' : '⏳ Pendiente'}
                </span>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
