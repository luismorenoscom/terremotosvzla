import { NextRequest, NextResponse } from 'next/server';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const runtime = 'nodejs';

// ── Server-side cache ────────────────────────────────────────────────────────
const CACHE_DAYS = 6;
const REFRESH_MS = 60 * 1000; // rebuild every 60 s in background

declare global {
  // eslint-disable-next-line no-var
  var _quakeCache: { data: EQResult[]; ts: number } | undefined;
  // eslint-disable-next-line no-var
  var _quakeFetching: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var _quakeTimer: ReturnType<typeof setInterval> | undefined;
  // last successful result per source — persists through outages
  // eslint-disable-next-line no-var
  var _sourceCache: Record<string, EQResult[]> | undefined;
  // eslint-disable-next-line no-var
  var _diskLoaded: boolean | undefined;
}
// ─────────────────────────────────────────────────────────────────────────────

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
    state?: string;
    postalCode?: string;
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
  const parts = date.split('-');
  if (parts.length !== 3) return 0;
  const [day, month, year] = parts;
  const timeParts = hour.split(':');
  const ts = new Date(
    `${year}-${month}-${day}T${timeParts[0].padStart(2, '0')}:${(timeParts[1] ?? '00').padStart(2, '0')}:00-04:00`
  ).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function parseFunvisisSlashTime(date?: string, hour?: string): number {
  if (!date || !hour) return 0;
  const parts = date.split('/');
  if (parts.length !== 3) return 0;
  const [day, month, year] = parts;
  const timeParts = hour.split(':');
  const ts = new Date(
    `${year}-${month}-${day}T${timeParts[0].padStart(2, '0')}:${(timeParts[1] ?? '00').padStart(2, '0')}:00-04:00`
  ).getTime();
  return Number.isFinite(ts) ? ts : 0;
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
  const place =
    f.properties.place ||
    f.properties.region ||
    f.properties.flynn_region ||
    'Venezuela';
  return {
    id: `${source.toLowerCase()}_${unid}`,
    magnitude: f.properties.mag ?? 0,
    place: place.trim() || 'Venezuela',
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

function monthKeys(days: number): string[] {
  const keys: string[] = [];
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const final = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= final) {
    keys.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&Oacute;/gi, 'Ó')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&iacute;/gi, 'í')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&Ntilde;/gi, 'Ñ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFUNVISISHtml(html: string, cutoff: number): EQResult[] {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const results: EQResult[] = [];

  for (const row of rows) {
    const cells = Array.from(
      row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)
    ).map(m => stripHtml(m[1]));

    if (cells.length < 7) continue;

    const date = cells[0];
    const hour = cells[1];
    const lat = Number(cells[2].replace(',', '.'));
    const lng = Number(cells[3].replace(',', '.'));
    const depth = Number((cells[4] ?? '0').replace(',', '.')) || 0;
    const magnitude = Number(cells[5].replace(',', '.'));
    const place = cells[6];

    if (!Number.isFinite(magnitude) || magnitude <= 0) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!inVenezuela([lng, lat, 0])) continue;

    const time = parseFunvisisSlashTime(date, hour);
    if (!time || time < cutoff) continue;

    const idStr = `${date}_${hour}_${lat.toFixed(2)}_${lng.toFixed(2)}_${magnitude.toFixed(1)}`
      .replace(/\W+/g, '_');
    const report = row.match(/href=['"]([^'"]*reporte_[^'"]+)['"]/i)?.[1];

    results.push({
      id: `funvisis_m_${idStr}`,
      magnitude,
      place: place ? `${place}, Venezuela` : 'Venezuela',
      time,
      depth,
      lat,
      lng,
      url: report
        ? `http://www.funvisis.gob.ve/old/${report}`
        : 'http://www.funvisis.gob.ve',
      magType: 'mw',
      source: 'FUNVISIS',
    });
  }

  return results;
}

async function fetchWithTimeout(
  url: string,
  ms = 10000,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal, ...init });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchUSGSWeekFeed(): Promise<EQResult[]> {
  try {
    const res = await fetchWithTimeout(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
      15000
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

async function fetchUSGSCatalog(days: number): Promise<EQResult[]> {
  try {
    const params = buildFDSNParams(days, 'geojson');
    const res = await fetchWithTimeout(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`,
      12000
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.features ?? []).map((f: FDSNFeature) =>
      mapFeature(f, 'USGS', 'https://earthquake.usgs.gov/earthquakes/eventpage/')
    );
  } catch {
    return [];
  }
}

async function fetchEMSC(days: number): Promise<EQResult[]> {
  try {
    const params = buildFDSNParams(days, 'json');
    const res = await fetchWithTimeout(
      `https://www.seismicportal.eu/fdsnws/event/1/query?${params}`,
      12000
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.features ?? []).map((f: FDSNFeature) =>
      mapFeature(f, 'EMSC', 'https://www.seismicportal.eu/eventdetails.html#')
    );
  } catch {
    return [];
  }
}

async function fetchFUNVISISRecent(): Promise<EQResult[]> {
  try {
    const res = await fetchWithTimeout('http://www.funvisis.gob.ve/maravilla.json', 10000);
    if (!res.ok) return [];
    const json = await res.json();
    const features: FunvisisFeature[] = json.features ?? [];

    return features
      .map((f): EQResult | null => {
        const p = f.properties;
        const magnitude = Number(p.phone);
        const time = parseFunvisisTime(p.postalCode, p.city);
        const lat = Number(p.lat ?? f.geometry?.coordinates?.[1]);
        const lng = Number(p.long ?? f.geometry?.coordinates?.[0]);
        const depth = parseFloat((p.state ?? '0').replace(/[^\d.]/g, '')) || 0;

        if (!Number.isFinite(magnitude) || magnitude <= 0) return null;
        if (!time || !Number.isFinite(time)) return null;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (!inVenezuela([lng, lat, 0])) return null;

        const idStr = `${p.postalCode ?? ''}_${p.city ?? ''}_${lat.toFixed(2)}_${lng.toFixed(2)}_${magnitude.toFixed(1)}`
          .replace(/\W+/g, '_');

        return {
          id: `funvisis_r_${idStr}`,
          magnitude,
          place: p.address ? `${p.address}, Venezuela` : 'Venezuela',
          time,
          depth,
          lat,
          lng,
          url: 'http://www.funvisis.gob.ve',
          magType: 'ml',
          source: 'FUNVISIS',
        };
      })
      .filter((eq): eq is EQResult => eq !== null);
  } catch {
    return [];
  }
}

function httpPost(month: string, timeoutMs: number): Promise<string> {
  const body = `select_m=${month}&s_mes=`;
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
          'User-Agent': 'Mozilla/5.0',
        },
        timeout: timeoutMs,
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(Buffer.from(chunk)));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('latin1')));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchFUNVISISMonthly(days: number): Promise<EQResult[]> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const months = monthKeys(days);
  const all: EQResult[] = [];

  await Promise.allSettled(
    months.map(async month => {
      try {
        const html = await httpPost(month, 22000);
        all.push(...parseFUNVISISHtml(html, cutoff));
      } catch {
        // timeout o error de red — ignorar
      }
    })
  );

  return all;
}

function isDuplicate(a: EQResult, b: EQResult): boolean {
  if (a.source === b.source) {
    return (
      a.id === b.id ||
      (Math.abs(a.time - b.time) < 60000 &&
        Math.abs(a.lat - b.lat) < 0.05 &&
        Math.abs(a.lng - b.lng) < 0.05 &&
        Math.abs(a.magnitude - b.magnitude) < 0.15)
    );
  }
  return (
    Math.abs(a.time - b.time) < 90000 &&
    Math.abs(a.lat - b.lat) < 0.3 &&
    Math.abs(a.lng - b.lng) < 0.3
  );
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

const DISK_CACHE_PATH = path.join(process.cwd(), 'cache', 'quake-cache.json');

function saveToDisk(data: EQResult[], sources: Record<string, EQResult[]>): void {
  try {
    fs.mkdirSync(path.dirname(DISK_CACHE_PATH), { recursive: true });
    fs.writeFileSync(
      DISK_CACHE_PATH,
      JSON.stringify({ data, sources, ts: Date.now() }),
      'utf8'
    );
  } catch { /* disk write failure is non-fatal */ }
}

function loadFromDisk(): void {
  if (global._diskLoaded) return;
  global._diskLoaded = true;
  try {
    const raw = fs.readFileSync(DISK_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { data: EQResult[]; sources: Record<string, EQResult[]>; ts: number };
    if (!global._quakeCache && Array.isArray(parsed.data) && parsed.data.length > 0) {
      global._quakeCache = { data: parsed.data, ts: parsed.ts };
    }
    if (parsed.sources && typeof parsed.sources === 'object') {
      if (!global._sourceCache) global._sourceCache = {};
      for (const [k, v] of Object.entries(parsed.sources)) {
        if (!global._sourceCache[k] && Array.isArray(v) && v.length > 0) {
          global._sourceCache[k] = v as EQResult[];
        }
      }
    }
  } catch { /* no disk cache yet — first run */ }
}

function useOrUpdate(key: string, fresh: EQResult[]): EQResult[] {
  if (!global._sourceCache) global._sourceCache = {};
  if (fresh.length > 0) global._sourceCache[key] = fresh;
  return global._sourceCache[key] ?? [];
}

async function buildCache(): Promise<void> {
  if (global._quakeFetching) return global._quakeFetching;

  global._quakeFetching = (async () => {
    try {
      // FUNVISIS first so its magnitude wins deduplication
      const [fr, fm, uw, uc, em] = await Promise.allSettled([
        fetchFUNVISISRecent(),
        fetchFUNVISISMonthly(CACHE_DAYS),
        fetchUSGSWeekFeed(),
        fetchUSGSCatalog(CACHE_DAYS),
        fetchEMSC(CACHE_DAYS),
      ]);

      // If a source fails, fall back to its last known-good data
      const all = [
        ...useOrUpdate('funvisis_recent',  fr.status === 'fulfilled' ? fr.value : []),
        ...useOrUpdate('funvisis_monthly', fm.status === 'fulfilled' ? fm.value : []),
        ...useOrUpdate('usgs_week',        uw.status === 'fulfilled' ? uw.value : []),
        ...useOrUpdate('usgs_catalog',     uc.status === 'fulfilled' ? uc.value : []),
        ...useOrUpdate('emsc',             em.status === 'fulfilled' ? em.value : []),
      ];

      const merged = mergeEvents(all);
      global._quakeCache = { data: merged, ts: Date.now() };
      saveToDisk(merged, global._sourceCache ?? {});
    } finally {
      global._quakeFetching = undefined;
    }
  })();

  return global._quakeFetching;
}

function ensureTimer(): void {
  if (global._quakeTimer) return;
  global._quakeTimer = setInterval(() => { void buildCache(); }, REFRESH_MS);
}

export async function GET(_req: NextRequest) {
  ensureTimer();

  // Cold start: try disk cache first (instant), then fetch fresh in background
  if (!global._quakeCache) {
    loadFromDisk();
  }

  if (!global._quakeCache) {
    await buildCache();
  } else {
    // Disk data loaded — refresh in background without blocking the request
    void buildCache();
  }

  const age = Math.floor((Date.now() - (global._quakeCache?.ts ?? 0)) / 1000);

  return NextResponse.json(global._quakeCache!.data, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Cache-Age': String(age),
    },
  });
}
