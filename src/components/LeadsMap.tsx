'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, GeoJSON } from 'react-leaflet';
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

interface RiskZonesMeta {
  windEventCount: number;
  parcelCount: number;
  matchingZones: number;
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

  // Risk zone overlay
  const [showRisk, setShowRisk] = useState(true);
  const [riskData, setRiskData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [riskMeta, setRiskMeta] = useState<RiskZonesMeta | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);

  useEffect(() => {
    setRiskLoading(true);
    setRiskError(null);
    fetch('/api/risk-zones')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Failed to load risk zones');
        setRiskMeta(json.meta ?? null);
        setRiskData({ type: 'FeatureCollection', features: json.features ?? [] });
      })
      .catch((err) => setRiskError(String(err)))
      .finally(() => setRiskLoading(false));
  }, []);

  const mapped = leads.filter(l => l.lat != null && l.lng != null);

  const center: [number, number] = mapped.length
    ? [
        mapped.reduce((s, l) => s + l.lat!, 0) / mapped.length,
        mapped.reduce((s, l) => s + l.lng!, 0) / mapped.length,
      ]
    : [40.76, -111.89]; // Salt Lake City default

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
        zoom={mapped.length ? 11 : 10}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onMapClick={handleMapClick} />

        {/* Risk zone overlay — red grid cells where wind ≥60mph + qualifying homes overlap */}
        {showRisk && riskData && riskData.features.length > 0 && (
          <GeoJSON
            key={riskData.features.length}
            data={riskData}
            style={() => ({
              fillColor: '#111827',
              fillOpacity: 0.15,
              color: '#111827',
              weight: 2,
              opacity: 0.9,
            })}
          />
        )}

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

        {pending && (
          <Marker
            position={[pending.lat, pending.lng]}
            icon={coloredIcon('New')}
          />
        )}
      </MapContainer>

      {/* Risk zone toggle panel — top right */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 1000,
        background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
        padding: '10px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        minWidth: 200, fontSize: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 14, height: 14, borderRadius: 2,
            background: 'rgba(17,24,39,0.15)', border: '2px solid #111827', flexShrink: 0,
          }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Shingle Risk Zones</span>
          <button
            onClick={() => setShowRisk(v => !v)}
            style={{
              marginLeft: 'auto', fontSize: 11, padding: '2px 8px',
              border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer',
              background: showRisk ? '#f3f4f6' : '#f9fafb', color: showRisk ? '#111827' : '#6b7280',
            }}
          >
            {showRisk ? 'Hide' : 'Show'}
          </button>
        </div>

        <div style={{ color: '#6b7280', lineHeight: 1.5 }}>
          {riskLoading && <span>Loading wind data…</span>}
          {riskError && <span style={{ color: '#b91c1c' }}>Error: {riskError}</span>}
          {riskMeta && !riskLoading && (
            <>
              <div>Homes 15+ yrs, 4000+ sqft</div>
              <div>Wind events ≥45 mph (last 2 yrs)</div>
              <div style={{ marginTop: 4, borderTop: '1px solid #f3f4f6', paddingTop: 4 }}>
                <span style={{ color: riskMeta.windEventCount > 0 ? '#111827' : '#6b7280' }}>
                  {riskMeta.windEventCount} wind events
                </span>
                {' · '}
                <span>{riskMeta.parcelCount.toLocaleString()} qualifying homes</span>
              </div>
              <div style={{ fontWeight: 600, color: riskMeta.matchingZones > 0 ? '#111827' : '#6b7280' }}>
                {riskMeta.matchingZones} overlapping zone{riskMeta.matchingZones !== 1 ? 's' : ''}
              </div>
            </>
          )}
          {!riskLoading && !riskError && riskMeta?.windEventCount === 0 && (
            <div style={{ color: '#6b7280', marginTop: 2 }}>
              No 45+ mph events recorded in Utah in the last 2 years.
            </div>
          )}
        </div>
      </div>

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
