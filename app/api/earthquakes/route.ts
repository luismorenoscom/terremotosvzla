import { NextRequest, NextResponse } from 'next/server';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as http from 'node:http';
import path from 'node:path';

export const runtime = 'nodejs';

const BOUNDS = {
  minlatitude: 0.6,
  maxlatitude: 12.5,
  minlongitude: -73.4,
  maxlongitude: -59.8,
};

type EQResult = {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  depth: number;
  lat: number;
  lng: number;
  url: string;
  magType: string;
  source: string;
};

type EQCache = {
  updatedAt: number;
  lastMonthlySync: number;
  events: EQResult[];
};

type FDSNFeature = {
  id: string;
  properties: {
    mag?: number;
    place?: string;
    region?: string;
    flynn_region?: string;
    time?: number | string;
    url?: string;
    magType?: string;
    magtype?: string;
    unid?: string;
  };
  geometry: { coordinates: [number, number, number] };
};

type FunvisisFeature = {
  properties: {
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    state?: string;
    lat?: string;
    long?: string;
  };
  geometry?: { coordinates?: [number, number] };
};

function parseTime(t: number | string | undefined): number {
  if (!t) return 0;
  if (typeof t === 'number') return t;
  return new Date(t).getTime();
}

function parseFunvisisTime(date?: string, hour?: string): number {
  if (!date || !hour) return 0;
  const [day, month, year] = date.split('-');
  const [hours, minutes] = hour.split(':');
  return new Date(
    `${year}-${month}-${day}T${hours.padStart(2, '0')}:${(minutes ?? '00').padStart(2, '0')}:00-04:00`
  ).getTime();
}

function parseFunvisisSlashTime(date?: string, hour?: string): number {
  if (!date || !hour) return 0;
  const [day, month, year] = date.split('/');
  const [hours, minutes] = hour.split(':');
  return new Date(
    `${year}-${month}-${day}T${hours.padStart(2, '0')}:${(minutes ?? '00').padStart(2, '0')}:00-04:00`
  ).getTime();
}

function cutoffForVenezuelaCalendarDays(days: number): number {
  const localNow = new Date(Date.now() - 4 * 60 * 60 * 1000);
  return Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate() - days,
    4,
    0,
    0
  );
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&Oacute;/gi, 'Ó')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&iacute;/gi, 'í')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function postFunvisisMonth(month: string): Promise<string> {
  const body = new URLSearchParams({ select_m: month, s_mes: '' }).toString();

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'www.funvisis.gob.ve',
        path: '/old/sis_mes.php',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          'Accept-Encoding': 'identity',
        },
        timeout: FUNVISIS_MONTHLY_TIMEOUT,
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(Buffer.from(chunk)));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('latin1')));
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('FUNVISIS monthly request timed out'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function monthKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const final = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= final) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
}

function inVenezuela(coords: [number, number, number]): boolean {
  const [lng, lat] = coords;
  return (
    lat >= BOUNDS.minlatitude &&
    lat <= BOUNDS.maxlatitude &&
    lng >= BOUNDS.minlongitude &&
    lng <= BOUNDS.maxlongitude
  );
}

function mapFeature(f: FDSNFeature, source: string, fallbackUrl: string): EQResult {
  const unid = f.properties.unid ?? f.id;
  return {
    id: `${source.toLowerCase()}_${unid}`,
    magnitude: f.properties.mag ?? 0,
    place: f.properties.place ?? f.properties.region ?? f.properties.flynn_region ?? 'Venezuela',
    time: parseTime(f.properties.time),
    depth: f.geometry.coordinates[2],
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    url: f.properties.url ?? `${fallbackUrl}${unid}`,
    magType: (f.properties.magType ?? f.properties.magtype ?? '').toLowerCase(),
    source,
  };
}

function buildFDSNParams(days: number, format = 'geojson'): URLSearchParams {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return new URLSearchParams({
    format,
    starttime: start.toISOString(),
    endtime: end.toISOString(),
    minlatitude: BOUNDS.minlatitude.toString(),
    maxlatitude: BOUNDS.maxlatitude.toString(),
    minlongitude: BOUNDS.minlongitude.toString(),
    maxlongitude: BOUNDS.maxlongitude.toString(),
    orderby: 'time',
    limit: '1000',
  });
}

const CACHE_FILE = path.join(process.cwd(), 'data', 'earthquakes-cache.json');
const MONTHLY_SYNC_INTERVAL = 6 * 60 * 60 * 1000;
const MIN_CACHE_BEFORE_RECENT_ONLY = 80;
const FETCH_TIMEOUT = 12000;
const FUNVISIS_MONTHLY_TIMEOUT = 60000; // FUNVISIS mensual puede tardar porque trae cientos de filas.

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFDSN(
  baseUrl: string,
  source: string,
  fallbackUrl: string,
  days: number,
  format = 'geojson',
  filterBounds = false
): Promise<EQResult[]> {
  try {
    const params = buildFDSNParams(days, format);
    const res = await fetchWithTimeout(`${baseUrl}?${params}`);
    if (!res.ok) return [];
    const json = await res.json();
    const features: FDSNFeature[] = json.features ?? [];
    return (filterBounds ? features.filter(f => inVenezuela(f.geometry.coordinates)) : features)
      .map(f => mapFeature(f, source, fallbackUrl));
  } catch {
    return [];
  }
}

async function fetchUSGSFeed(): Promise<EQResult[]> {
  try {
    const res = await fetchWithTimeout(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.features ?? [])
      .filter((f: FDSNFeature) => inVenezuela(f.geometry.coordinates))
      .map((f: FDSNFeature) =>
        mapFeature(f, 'USGS', 'https://earthquake.usgs.gov/earthquakes/eventpage/')
      );
  } catch {
    return [];
  }
}

function parseFUNVISISMonthlyHtml(html: string, days: number): EQResult[] {
  const cutoff = cutoffForVenezuelaCalendarDays(days);
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  return rows
    .map((row): EQResult | null => {
      const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(match => match[1]);
      if (cells.length < 7) return null;

      const date = stripHtml(cells[0]);
      const hour = stripHtml(cells[1]);
      const lat = Number(stripHtml(cells[2]));
      const lng = Number(stripHtml(cells[3]));
      const depth = Number(stripHtml(cells[4]));
      const magnitude = Number(stripHtml(cells[5]));
      const place = stripHtml(cells[6]);
      const report = row.match(/href=['"]([^'"]*reporte_[^'"]+)['"]/i)?.[1];
      const time = parseFunvisisSlashTime(date, hour);

      if (!Number.isFinite(magnitude)) return null;
      if (!Number.isFinite(time) || time < cutoff) return null;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (!inVenezuela([lng, lat, 0])) return null;

      const idDate = `${date}_${hour}`.replace(/\W+/g, '_');
      const id = `funvisis_monthly_${idDate}_${lat.toFixed(2)}_${lng.toFixed(2)}_${magnitude.toFixed(1)}`;

      return {
        id,
        magnitude,
        place: place ? `${place}, Venezuela` : 'Venezuela',
        time,
        depth: Number.isFinite(depth) ? depth : 0,
        lat,
        lng,
        url: report ? `http://www.funvisis.gob.ve/old/${report}` : 'http://www.funvisis.gob.ve/old/sis_mes.php',
        magType: 'mw',
        source: 'FUNVISIS',
      };
    })
    .filter((eq): eq is EQResult => eq !== null);
}

async function fetchFUNVISISMonthly(days: number): Promise<EQResult[]> {
  try {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    const months = monthKeysBetween(start, end);
    const monthlyEvents = await Promise.all(
      months.map(async month => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const html = await postFunvisisMonth(month);
            const parsed = parseFUNVISISMonthlyHtml(html, days);
            if (parsed.length > 0) return parsed;
          } catch {
            // FUNVISIS a veces corta la respuesta mensual; se reintenta abajo.
          }
        }

        return [];
      })
    );

    return monthlyEvents.flat();
  } catch {
    return [];
  }
}

async function fetchFUNVISISRecent(days: number): Promise<EQResult[]> {
  try {
    const res = await fetchWithTimeout('http://www.funvisis.gob.ve/maravilla.json');
    if (!res.ok) return [];

    const json = await res.json();
    const features: FunvisisFeature[] = json.features ?? [];
    const cutoff = cutoffForVenezuelaCalendarDays(days);

    return features
      .map((f): EQResult | null => {
        const p = f.properties;
        const magnitude = Number(p.phone);
        const time = parseFunvisisTime(p.postalCode, p.city);
        const lat = Number(p.lat ?? f.geometry?.coordinates?.[1]);
        const lng = Number(p.long ?? f.geometry?.coordinates?.[0]);
        const depth = Number.parseFloat(p.state ?? '0');

        if (!Number.isFinite(magnitude)) return null;
        if (!Number.isFinite(time) || time < cutoff) return null;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (!inVenezuela([lng, lat, 0])) return null;

        const idDate = `${p.postalCode ?? 'date'}_${p.city ?? 'time'}`.replace(/\W+/g, '_');
        const id = `funvisis_${idDate}_${lat.toFixed(2)}_${lng.toFixed(2)}_${magnitude.toFixed(1)}`;

        return {
          id,
          magnitude,
          place: p.address ? `${p.address}, Venezuela` : 'Venezuela',
          time,
          depth: Number.isFinite(depth) ? depth : 0,
          lat,
          lng,
          url: 'http://www.funvisis.gob.ve/index.php',
          magType: 'ml',
          source: 'FUNVISIS',
        };
      })
      .filter((eq): eq is EQResult => eq !== null);
  } catch {
    return [];
  }
}

async function fetchFUNVISIS(days: number): Promise<EQResult[]> {
  const monthly = await fetchFUNVISISMonthly(days);
  const recent = await fetchFUNVISISRecent(days);
  return [...monthly, ...recent];
}

async function readCache(days: number): Promise<EQCache> {
  try {
    const content = await readFile(CACHE_FILE, 'utf8');
    const cache = JSON.parse(content) as Partial<EQCache>;
    return {
      updatedAt: Number(cache.updatedAt) || 0,
      lastMonthlySync: Number(cache.lastMonthlySync) || 0,
      events: pruneByDays(Array.isArray(cache.events) ? cache.events : [], days),
    };
  } catch {
    return { updatedAt: 0, lastMonthlySync: 0, events: [] };
  }
}

async function writeCache(cache: EQCache): Promise<void> {
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function pruneByDays(events: EQResult[], days: number): EQResult[] {
  const cutoff = cutoffForVenezuelaCalendarDays(days);
  return events.filter(eq => Number.isFinite(eq.time) && eq.time >= cutoff);
}

function mergeEvents(events: EQResult[]): EQResult[] {
  const unique: EQResult[] = [];

  for (const eq of events) {
    if (!unique.some(u => isDuplicate(u, eq))) {
      unique.push(eq);
    }
  }

  unique.sort((a, b) => b.time - a.time);
  return unique;
}

function isDuplicate(a: EQResult, b: EQResult): boolean {
  if (a.source === b.source) {
    return (
      a.id === b.id ||
      (
        Math.abs(a.time - b.time) < 60000 &&
        Math.abs(a.lat - b.lat) < 0.05 &&
        Math.abs(a.lng - b.lng) < 0.05 &&
        Math.abs(a.magnitude - b.magnitude) < 0.15
      )
    );
  }

  return (
    Math.abs(a.time - b.time) < 30000 &&
    Math.abs(a.lat - b.lat) < 0.2 &&
    Math.abs(a.lng - b.lng) < 0.2
  );
}

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '6');
  const cache = await readCache(days);
  const shouldSyncMonthly =
    cache.events.length < MIN_CACHE_BEFORE_RECENT_ONLY ||
    Date.now() - cache.lastMonthlySync > MONTHLY_SYNC_INTERVAL;

  // Si ya tenemos histórico local, solo consultamos lo reciente cada 5 minutos.
  // El mensual queda como respaldo periódico para recuperar huecos.
  const results = await Promise.allSettled([
    shouldSyncMonthly ? fetchFUNVISIS(days) : fetchFUNVISISRecent(days),
    fetchUSGSFeed(),
    fetchFDSN(
      'https://earthquake.usgs.gov/fdsnws/event/1/query',
      'USGS',
      'https://earthquake.usgs.gov/earthquakes/eventpage/',
      days
    ),
    fetchFDSN(
      'https://www.seismicportal.eu/fdsnws/event/1/query',
      'EMSC',
      'https://www.seismicportal.eu/eventdetails.html#',
      days,
      'json'
    ),
    fetchFDSN(
      'https://service.iris.edu/fdsnws/event/1/query',
      'IRIS',
      'https://ds.iris.edu/ds/nodes/dmc/tools/event/',
      days
    ),
  ]);

  const all: EQResult[] = results.flatMap(r =>
    r.status === 'fulfilled' ? r.value : []
  );
  const freshFunvisisCount = all.filter(eq => eq.source === 'FUNVISIS').length;
  const nextEvents = mergeEvents(pruneByDays([...all, ...cache.events], days));

  await writeCache({
    updatedAt: Date.now(),
    lastMonthlySync:
      shouldSyncMonthly && freshFunvisisCount >= MIN_CACHE_BEFORE_RECENT_ONLY
        ? Date.now()
        : cache.lastMonthlySync,
    events: nextEvents,
  });

  return NextResponse.json(nextEvents, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
