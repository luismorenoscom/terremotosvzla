'use client';

import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Earthquake } from '@/lib/types';
import { getMagColor, timeAgo } from '@/lib/usgs';

interface Props {
  earthquakes: Earthquake[];
  selected?: Earthquake | null;
  onSelect?: (earthquake: Earthquake) => void;
}

const VENEZUELA_CENTER: [number, number] = [10.1, -67.2];

function eventDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Caracas',
  });
}

function primaryName(place: string): string {
  return place.split(',')[0].trim();
}

function regionName(place: string): string {
  return place.split(',').slice(1).join(',').trim() || 'Venezuela';
}

function DetailCard({ earthquake }: { earthquake: Earthquake }) {
  const color = getMagColor(earthquake.magnitude);

  return (
    <div className="map-detail-card">
      <div className="map-detail-header">
        <div>
          <h2>{primaryName(earthquake.place)}</h2>
          <p>{regionName(earthquake.place)}</p>
        </div>
        <span className="flag">🇻🇪</span>
      </div>
      <div className="map-detail-grid">
        <span>magnitud:</span>
        <strong style={{ color }}>{earthquake.magnitude.toFixed(1)} {earthquake.magType}</strong>
        <span className="source-badge">{earthquake.source}</span>

        <span>profundidad:</span>
        <strong>{earthquake.depth.toFixed(1)} km</strong>
        <small>({timeAgo(earthquake.time)})</small>

        <span>fecha/hora:</span>
        <strong>{eventDate(earthquake.time)}</strong>
        <small>VET</small>
      </div>
      <div className="card-grabber" />
    </div>
  );
}

export default function EarthquakeMap({ earthquakes, selected, onSelect }: Props) {
  const active = selected ?? earthquakes[0] ?? null;

  return (
    <div className="map-screen">
      {active && <DetailCard earthquake={active} />}
      <MapContainer
        center={active ? [active.lat, active.lng] : VENEZUELA_CENTER}
        zoom={active ? 8 : 6}
        className="app-map"
        scrollWheelZoom
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {earthquakes.map(eq => {
          const color = getMagColor(eq.magnitude);

          return (
            <CircleMarker
              key={eq.id}
              center={[eq.lat, eq.lng]}
              radius={Math.max(4, Math.min(18, eq.magnitude * 2.2))}
              eventHandlers={{ click: () => onSelect?.(eq) }}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: selected?.id === eq.id ? 0.95 : 0.78,
                weight: selected?.id === eq.id ? 3 : 1,
              }}
            >
              <Popup>
                <strong>M {eq.magnitude.toFixed(1)}</strong>
                <br />
                {eq.place}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
