import { Earthquake } from './types';

const CACHE_KEY = 'sismo_vzla_data_v8';
const CACHE_TS_KEY = 'sismo_vzla_ts_v8';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function fetchEarthquakes(days = 6): Promise<Earthquake[]> {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (cached && ts && Date.now() - Number(ts) < CACHE_TTL) {
      return JSON.parse(cached);
    }
  }

  const res = await fetch(`/api/earthquakes?days=${days}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error al obtener datos');

  const earthquakes: Earthquake[] = await res.json();

  if (typeof window !== 'undefined') {
    localStorage.setItem(CACHE_KEY, JSON.stringify(earthquakes));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  }

  return earthquakes;
}

export function clearCache() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TS_KEY);
  }
}

export function getMagColor(mag: number): string {
  if (mag < 2) return '#4ade80';
  if (mag < 3) return '#facc15';
  if (mag < 4) return '#fb923c';
  if (mag < 5) return '#f87171';
  return '#dc2626';
}

export function getMagLabel(mag: number): string {
  if (mag < 2) return 'Micro';
  if (mag < 3) return 'Menor';
  if (mag < 4) return 'Ligero';
  if (mag < 5) return 'Moderado';
  if (mag < 6) return 'Fuerte';
  return 'Mayor';
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Caracas',
  });
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}
