'use client';

import { useEffect, useState } from 'react';
import { useMap, CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Earthquake } from '@/lib/types';
import { getMagColor, timeAgo } from '@/lib/usgs';

interface Props {
  earthquakes: Earthquake[];
  selected?: Earthquake | null;
  onSelect?: (earthquake: Earthquake) => void;
}

const VENEZUELA_CENTER: [number, number] = [8.0, -66.5];

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

// Forces Leaflet to recalculate tile coverage whenever the container resizes
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // Immediate + delayed calls to cover fast and slow renders
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 600);

    // ResizeObserver: re-fires whenever the container dimensions change
    const container = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

function BottomSheet({ earthquake }: { earthquake: Earthquake }) {
  const color = getMagColor(earthquake.magnitude);

  return (
    <div className="map-sheet">
      <div className="map-sheet-grab" />
      <div className="map-sheet-row">
        <div className="map-sheet-mag" style={{ borderColor: color }}>
          <span className="map-sheet-mag-num" style={{ color }}>
            {earthquake.magnitude.toFixed(1)}
          </span>
          <span className="map-sheet-mag-type" style={{ color }}>
            {earthquake.magType}
          </span>
        </div>
        <div className="map-sheet-info">
          <div className="map-sheet-place">{primaryName(earthquake.place)}</div>
          <div className="map-sheet-region">{regionName(earthquake.place)}</div>
        </div>
        <span className="map-sheet-source">{earthquake.source}</span>
      </div>
      <div className="map-sheet-meta">
        <span>{earthquake.depth.toFixed(1)} km prof.</span>
        <span className="map-sheet-sep">·</span>
        <span>{eventDate(earthquake.time)} VET</span>
        <span className="map-sheet-sep">·</span>
        <span>{timeAgo(earthquake.time)}</span>
      </div>
    </div>
  );
}

export default function EarthquakeMap({ earthquakes, selected, onSelect }: Props) {
  const active = selected ?? earthquakes[0] ?? null;

  // Guard against React Strict Mode double-invocation: only mount Leaflet
  // when the component is truly in the DOM (not in the cleanup pass).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  return (
    <div className="map-screen">
      {!mounted && <div className="map-loading"><div className="app-spinner" /></div>}
      {mounted && (
        <MapContainer
          center={active ? [active.lat, active.lng] : VENEZUELA_CENTER}
          zoom={active ? 8 : 6}
          className="app-map"
          scrollWheelZoom
          zoomControl={false}
        >
          <MapResizer />
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
                  fillOpacity: selected?.id === eq.id ? 0.95 : 0.72,
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
      )}
      {active && <BottomSheet earthquake={active} />}
    </div>
  );
}
