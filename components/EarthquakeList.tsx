'use client';

import { useState, useEffect } from 'react';
import { Earthquake } from '@/lib/types';
import { getMagColor, timeAgo } from '@/lib/usgs';

const PAGE_SIZE = 15;

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

function extractCity(place: string): string | null {
  // "41 km al norte de Maracay, Venezuela"  →  "Maracay"
  // "35 km NNE of El Limón, Venezuela"      →  "El Limón"
  const raw = place.split(',')[0];
  const m = raw.match(/\bde\s+(.+)$/i) ?? raw.match(/\bof\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function subPlace(eq: Earthquake): string {
  const city = extractCity(eq.place);
  const depth = eq.depth > 0 ? `${eq.depth.toFixed(1)} km prof.` : null;
  return [city, depth].filter(Boolean).join(' · ');
}

export default function EarthquakeList({ earthquakes, realtimeIds, onSelect }: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Resetea al inicio cuando llegan datos completamente nuevos
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [earthquakes[0]?.id]);

  if (earthquakes.length === 0) {
    return (
      <div className="app-empty">
        <div className="app-spinner" />
        <p>Consultando fuentes sismológicas...</p>
      </div>
    );
  }

  const shown = earthquakes.slice(0, visible);
  const hasMore = visible < earthquakes.length;

  const groups = shown.reduce<Map<string, Earthquake[]>>((acc, eq) => {
    const key = dayKey(eq.time);
    const list = acc.get(key) ?? [];
    list.push(eq);
    acc.set(key, list);
    return acc;
  }, new Map());

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

      {hasMore && (
        <div className="load-more-wrap">
          <button
            type="button"
            className="load-more-btn"
            onClick={() => setVisible(v => v + PAGE_SIZE)}
          >
            Ver más ({earthquakes.length - visible} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
