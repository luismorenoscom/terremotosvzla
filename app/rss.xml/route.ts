import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 60;

const SITE_URL = 'https://terremotosvlza.com';
const SITE_NAME = 'TerremotosVzla';

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

declare global {
  // eslint-disable-next-line no-var
  var _quakeCache: { data: EQResult[]; ts: number } | undefined;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  let earthquakes: EQResult[] = global._quakeCache?.data ?? [];

  if (earthquakes.length === 0) {
    try {
      const res = await fetch(`${SITE_URL}/api/earthquakes`, { cache: 'no-store' });
      if (res.ok) earthquakes = (await res.json()) as EQResult[];
    } catch { /* empty feed if unavailable */ }
  }

  const items = earthquakes
    .filter(eq => eq.magnitude >= 2.5)
    .slice(0, 50);

  const now = new Date().toUTCString();

  const rssItems = items
    .map(eq => {
      const date = new Date(eq.time).toUTCString();
      const title = `M ${eq.magnitude.toFixed(1)} — ${escapeXml(eq.place)}`;
      const desc = `Sismo de magnitud ${eq.magnitude.toFixed(1)} ${eq.magType.toUpperCase()} registrado a ${eq.depth.toFixed(1)} km de profundidad en ${escapeXml(eq.place)}. Fuente: ${eq.source}.`;
      const link = eq.url || SITE_URL;
      return `
    <item>
      <title>${title}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(desc)}</description>
      <pubDate>${date}</pubDate>
      <guid isPermaLink="false">${escapeXml(eq.id)}</guid>
      <geo:lat>${eq.lat.toFixed(4)}</geo:lat>
      <geo:long>${eq.lng.toFixed(4)}</geo:long>
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME} — Sismos Venezuela en Tiempo Real</title>
    <link>${SITE_URL}</link>
    <description>Monitor de terremotos y sismos en Venezuela. Datos oficiales de FUNVISIS, USGS y EMSC actualizados cada 60 segundos.</description>
    <language>es-ve</language>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>1</ttl>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/icon.png</url>
      <title>${SITE_NAME}</title>
      <link>${SITE_URL}</link>
    </image>${rssItems}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
    },
  });
}
