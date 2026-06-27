'use client';

import { Earthquake } from '@/lib/types';
import { getMagColor, timeAgo } from '@/lib/usgs';

interface Props {
  earthquakes: Earthquake[];
  realtimeIds?: Set<string>;
  onSelect?: (earthquake: Earthquake) => void;
}

function dayKey(timestamp: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}

function groupTitle(key: string): string {
  const today = dayKey(Date.now());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = dayKey(yesterdayDate.getTime());

  if (key === today) return 'HOY - VENEZUELA';
  if (key === yesterday) return 'AYER - VENEZUELA';

  return `${new Date(`${key}T12:00:00`).toLocaleDateString('es-VE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).toUpperCase()} - VENEZUELA`;
}

function eventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('es-VE', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Caracas',
  });
}

function mainPlace(place: string): string {
  return place.split(',')[0].trim().toUpperCase();
}

function subPlace(eq: Earthquake): string {
  const parts = eq.place.split(',').slice(1).join(',').trim();
  return parts || `${eq.source} · ${eq.depth.toFixed(1)} km`;
}

export default function EarthquakeList({ earthquakes, realtimeIds, onSelect }: Props) {
  const groups = earthquakes.reduce<Map<string, Earthquake[]>>((acc, eq) => {
    const key = dayKey(eq.time);
    const list = acc.get(key) ?? [];
    list.push(eq);
    acc.set(key, list);
    return acc;
  }, new Map());

  if (earthquakes.length === 0) {
    return (
      <div className="app-empty">
        <div className="app-spinner" />
        <p>Consultando fuentes sismológicas...</p>
      </div>
    );
  }

  return (
    <div className="quake-list">
      {Array.from(groups.entries()).map(([key, items]) => (
        <section key={key}>
          <div className="day-heading">{groupTitle(key)}</div>
          {items.map(eq => {
            const isNew = realtimeIds?.has(eq.id);
            const color = getMagColor(eq.magnitude);

            return (
              <button
                key={eq.id}
                type="button"
                onClick={() => onSelect?.(eq)}
                className="quake-row"
              >
                <div className="quake-row-main">
                  <div className="quake-title-line">
                    <span className="quake-dot" style={{ borderColor: color }} />
                    <span className="quake-title">{mainPlace(eq.place)}</span>
                    {isNew && <span className="new-chip">NUEVO</span>}
                  </div>
                  <div className="quake-subtitle">{subPlace(eq)}</div>
                </div>

                <div className="quake-row-meta">
                  <div className="quake-time">{eventTime(eq.time)}</div>
                  <div className="quake-ago">({timeAgo(eq.time)})</div>
                </div>

                <div className="quake-mag" style={{ color }}>
                  {eq.magnitude.toFixed(1)}
                </div>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
