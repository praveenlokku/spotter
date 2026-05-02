import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon paths
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const STOP_COLORS: Record<string, string> = {
  start:         '#22d3ee',
  pickup:        '#10b981',
  dropoff:       '#3b82f6',
  fuel:          '#f59e0b',
  rest_break:    '#c084fc',
  sleeper_berth: '#818cf8',
};

const STOP_ICONS: Record<string, string> = {
  start:         '🏠',
  pickup:        '📦',
  dropoff:       '🏁',
  fuel:          '⛽',
  rest_break:    '☕',
  sleeper_berth: '😴',
};

const makeIcon = (type: string) => {
  const color = STOP_COLORS[type] || '#94a3b8';
  const emoji = STOP_ICONS[type] || '📍';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color}22;
      border:2px solid ${color};
      border-radius:50%;
      width:32px;height:32px;
      display:flex;align-items:center;justify-content:center;
      font-size:14px;
      box-shadow:0 0 8px ${color}55;
      cursor:pointer;
    ">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const FitBounds = ({ positions }: { positions: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions, { padding: [40, 40] });
    }
  }, [positions, map]);
  return null;
};

interface Stop {
  type: string;
  location: string;
  lat: number;
  lng: number;
  arrival: string;
  departure: string;
  duration_hrs: number;
  duty_status: string;
}

interface MapViewProps {
  geometry: [number, number][];
  stops: Stop[];
}

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
    }) + ' UTC';
  } catch { return iso; }
};

const STATUS_LABEL: Record<string, string> = {
  D: 'Driving', ON: 'On Duty', SB: 'Sleeper Berth', OFF: 'Off Duty'
};

const MapView: React.FC<MapViewProps> = ({ geometry, stops }) => {
  const markerStops = stops.filter(s => s.lat && s.lng && s.type !== 'start' || s.type === 'start');

  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={4}
      style={{ height: '100%', width: '100%', borderRadius: '12px', background: '#1a1d26' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

      {geometry.length > 1 && (
        <Polyline
          positions={geometry}
          pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.85, dashArray: undefined }}
        />
      )}

      {markerStops.map((stop, i) => (
        <Marker key={i} position={[stop.lat, stop.lng]} icon={makeIcon(stop.type)}>
          <Popup>
            <div style={{ fontFamily: 'Inter, sans-serif', minWidth: '200px', color: '#1e293b' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{STOP_ICONS[stop.type] || '📍'}</span>
                <span style={{ textTransform: 'capitalize' }}>{stop.type.replace('_', ' ')}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '6px', lineClamp: '2' }}>
                {stop.location?.split(',').slice(0, 3).join(',')}
              </div>
              <div style={{ fontSize: '0.78rem', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                <div><b>Arrival:</b> {formatTime(stop.arrival)}</div>
                {stop.duration_hrs > 0 && <div><b>Duration:</b> {stop.duration_hrs.toFixed(1)} hrs</div>}
                <div><b>Status:</b> {STATUS_LABEL[stop.duty_status] || stop.duty_status}</div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      <FitBounds positions={geometry as [number, number][]} />
    </MapContainer>
  );
};

export default MapView;
