'use client';

import { useEffect, useRef } from 'react';
import { Earthquake } from '@/lib/types';

const WS_URL = 'wss://www.seismicportal.eu/standing_order/websocket';

const BOUNDS = {
  minLat: 0.6, maxLat: 12.5,
  minLng: -73.4, maxLng: -59.8,
};

type EMSCMessage = {
  action: 'create' | 'update' | 'delete';
  data: {
    geometry: { coordinates: [number, number, number] };
    properties: {
      unid?: string;
      source_id?: string;
      time?: string;
      lat?: number;
      lon?: number;
      depth?: number;
      mag?: number;
      magtype?: string;
      region?: string;
      flynn_region?: string;
      url?: string;
    };
  };
};

function inVenezuela(lat: number, lng: number): boolean {
  return (
    lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat &&
    lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng
  );
}

export type WSStatus = 'connecting' | 'connected' | 'disconnected';

export function useEMSCWebSocket(
  onNew: (eq: Earthquake) => void,
  onStatus: (s: WSStatus) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNewRef = useRef(onNew);
  const onStatusRef = useRef(onStatus);

  useEffect(() => { onNewRef.current = onNew; }, [onNew]);
  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);

  useEffect(() => {
    let stopped = false;

    const connect = () => {
      if (stopped || wsRef.current?.readyState === WebSocket.OPEN) return;

      onStatusRef.current('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => onStatusRef.current('connected');

      ws.onmessage = (event) => {
        try {
          const msg: EMSCMessage = JSON.parse(event.data);
          if (msg.action !== 'create') return;

          const p = msg.data.properties;
          const lat = p.lat ?? msg.data.geometry.coordinates[1];
          const lng = p.lon ?? msg.data.geometry.coordinates[0];

          if (!inVenezuela(lat, lng)) return;

          const unid = p.unid ?? p.source_id ?? String(Date.now());
          const eq: Earthquake = {
            id: `emsc_rt_${unid}`,
            magnitude: p.mag ?? 0,
            place: p.region ?? p.flynn_region ?? 'Venezuela',
            time: p.time ? new Date(p.time).getTime() : Date.now(),
            depth: p.depth ?? msg.data.geometry.coordinates[2] ?? 0,
            lat,
            lng,
            url:
              p.url ??
              `https://www.seismicportal.eu/eventdetails.html#${unid}`,
            magType: p.magtype ?? '',
            source: 'EMSC-RT',
          };

          onNewRef.current(eq);
        } catch {
          // ignorar mensajes malformados
        }
      };

      ws.onclose = () => {
        if (stopped) return;
        onStatusRef.current('disconnected');
        retryRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      stopped = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);
}
