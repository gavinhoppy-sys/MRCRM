'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Lead } from '@/lib/db';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's broken default icon paths in webpack/Next.js
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const STATUS_MARKER_COLORS: Record<string, string> = {
  New: '#3b82f6',
  Contacted: '#eab308',
  Quoted: '#a855f7',
  Won: '#22c55e',
  Lost: '#ef4444',
};

function coloredIcon(status: string) {
  const color = STATUS_MARKER_COLORS[status] ?? '#6b7280';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2px solid white;
      box-shadow:0 1px 3px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

interface Props {
  leads: Lead[];
}

export default function LeadsMap({ leads }: Props) {
  const mapped = leads.filter(l => l.lat != null && l.lng != null);

  const center: [number, number] = mapped.length
    ? [
        mapped.reduce((s, l) => s + l.lat!, 0) / mapped.length,
        mapped.reduce((s, l) => s + l.lng!, 0) / mapped.length,
      ]
    : [39.5, -98.35]; // geographic center of the US as fallback

  return (
    <MapContainer
      center={center}
      zoom={mapped.length ? 11 : 4}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {mapped.map(lead => (
        <Marker
          key={lead.id}
          position={[lead.lat!, lead.lng!]}
          icon={coloredIcon(lead.status)}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{lead.name}</p>
              <p className="text-gray-500">{[lead.address, lead.city].filter(Boolean).join(', ')}</p>
              <p>
                <span style={{ color: STATUS_MARKER_COLORS[lead.status] }} className="font-medium">
                  {lead.status}
                </span>
              </p>
              <a
                href={`/leads/${lead.id}`}
                className="text-blue-600 underline"
              >
                Edit lead
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
