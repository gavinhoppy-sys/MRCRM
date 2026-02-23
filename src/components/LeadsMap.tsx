'use client';

import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Lead } from '@/lib/db';
import { STATUSES, SOURCES } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';

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

interface PendingPoint {
  lat: number;
  lng: number;
  address: string;
  city: string;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface Props {
  leads: Lead[];
}

export default function LeadsMap({ leads: initialLeads }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [pending, setPending] = useState<PendingPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('New');
  const [source, setSource] = useState('');

  const mapped = leads.filter(l => l.lat != null && l.lng != null);

  const center: [number, number] = mapped.length
    ? [
        mapped.reduce((s, l) => s + l.lat!, 0) / mapped.length,
        mapped.reduce((s, l) => s + l.lng!, 0) / mapped.length,
      ]
    : [39.5, -98.35];

  async function handleMapClick(lat: number, lng: number) {
    setLoading(true);
    setPending({ lat, lng, address: '', city: '' });
    setName('');
    setPhone('');
    setStatus('New');
    setSource('');

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'User-Agent': 'RoofingCRM/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        const a = data.address ?? {};
        const address = [a.house_number, a.road].filter(Boolean).join(' ');
        const city = a.city ?? a.town ?? a.village ?? a.suburb ?? '';
        setPending({ lat, lng, address, city });
      }
    } catch {
      // keep blank address/city if reverse geocode fails
    }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!pending || !name.trim()) return;
    setSaving(true);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          address: pending.address || null,
          city: pending.city || null,
          status,
          source: source || null,
          lat: pending.lat,
          lng: pending.lng,
        }),
      });

      if (res.ok) {
        const newLead = await res.json();
        setLeads(prev => [newLead, ...prev]);
        setPending(null);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={mapped.length ? 11 : 4}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onMapClick={handleMapClick} />

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
                <a href={`/leads/${lead.id}`} className="text-blue-600 underline">
                  Edit lead
                </a>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Preview marker for the tapped point */}
        {pending && (
          <Marker
            position={[pending.lat, pending.lng]}
            icon={coloredIcon('New')}
          />
        )}
      </MapContainer>

      {/* Add-lead panel */}
      {pending && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
          background: 'white', borderTop: '1px solid #e5e7eb',
          padding: '16px', boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
        }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 14 }}>Looking up address…</p>
          ) : (
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>New Lead</span>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  style={{ fontSize: 18, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <input
                    placeholder="Name *"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
                <input
                  placeholder="Phone"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={inputStyle}
                />
                <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                <input
                  placeholder="Address"
                  value={pending.address}
                  onChange={e => setPending(p => p ? { ...p, address: e.target.value } : p)}
                  style={inputStyle}
                />
                <input
                  placeholder="City"
                  value={pending.city}
                  onChange={e => setPending(p => p ? { ...p, city: e.target.value } : p)}
                  style={inputStyle}
                />
                <div style={{ gridColumn: '1 / -1' }}>
                  <select value={source} onChange={e => setSource(e.target.value)} style={inputStyle}>
                    <option value="">Source (optional)</option>
                    {SOURCES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || !name.trim()}
                style={{
                  width: '100%', padding: '8px', background: saving || !name.trim() ? '#9ca3af' : '#2563eb',
                  color: 'white', border: 'none', borderRadius: 6, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: 14,
                }}
              >
                {saving ? 'Saving…' : 'Save Lead'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', border: '1px solid #d1d5db',
  borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
};
