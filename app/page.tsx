'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Earthquake } from '@/lib/types';
import { clearCache, fetchEarthquakes, getMagColor } from '@/lib/usgs';
import EarthquakeList from '@/components/EarthquakeList';
import { useEMSCWebSocket, WSStatus } from '@/hooks/useEMSCWebSocket';

const QUERY_DAYS = 6;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const EarthquakeMap = dynamic(() => import('@/components/EarthquakeMap'), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <div className="app-spinner" />
    </div>
  ),
});

type Tab = 'eventos' | 'mapa';

function LiveStatus({ status }: { status: WSStatus }) {
  const label =
    status === 'connected' ? 'En vivo' : status === 'connecting' ? 'Conectando' : 'Sin vivo';

  return (
    <span className={`live-pill ${status}`}>
      <span />
      {label}
    </span>
  );
}

function Header({
  tab,
  status,
  lastUpdate,
  loading,
  onRefresh,
  onBack,
}: {
  tab: Tab;
  status: WSStatus;
  lastUpdate: Date | null;
  loading: boolean;
  onRefresh: () => void;
  onBack: () => void;
}) {
  if (tab === 'mapa') {
    return (
      <header className="map-topbar">
        <button type="button" onClick={onBack} className="round-button" aria-label="Volver">
          &lt;
        </button>
        <div className="brand-orbit">T</div>
        <button type="button" onClick={onRefresh} className="round-button" aria-label="Actualizar">
          R
        </button>
      </header>
    );
  }

  return (
    <header className="event-hero">
      <div className="status-row">
        <span className="clock">
          {new Date().toLocaleTimeString('es-VE', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/Caracas',
          })}
        </span>
        <LiveStatus status={status} />
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="hero-refresh"
          aria-label="Actualizar"
        >
          {loading ? '...' : 'R'}
        </button>
      </div>
      <div className="hero-world" />
      <div className="hero-title">
        <span className="brand-mark">T</span>
        <h1>TerremotosVzla</h1>
      </div>
      <p>
        {lastUpdate
          ? `Actualizado ${lastUpdate.toLocaleTimeString('es-VE')} - auto cada 5 min`
          : 'Consultando fuentes...'}
      </p>
    </header>
  );
}

function BottomNav({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: 'eventos', label: 'Eventos', icon: 'E' },
    { id: 'mapa', label: 'Mapa', icon: 'M' },
  ];

  return (
    <nav className="bottom-nav two-items" aria-label="Navegacion principal">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onTab(item.id)}
          className={tab === item.id ? 'active' : ''}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('eventos');
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [realtimeEqs, setRealtimeEqs] = useState<Earthquake[]>([]);
  const [selected, setSelected] = useState<Earthquake | null>(null);
  const [alert, setAlert] = useState<Earthquake | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [wsStatus, setWsStatus] = useState<WSStatus>('connecting');
  const alertTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadEarthquakes = useCallback(async () => {
    const data = await fetchEarthquakes(QUERY_DAYS);
    setEarthquakes(data);
    setSelected(current => current ?? data[0] ?? null);
    setLastUpdate(new Date());
  }, []);

  const refresh = useCallback(async () => {
    clearCache();
    setLoading(true);
    setError(null);
    try {
      await loadEarthquakes();
    } catch {
      setError('No se pudo conectar. Verifica tu conexion a internet.');
    } finally {
      setLoading(false);
    }
  }, [loadEarthquakes]);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const data = await fetchEarthquakes(QUERY_DAYS);
        if (cancelled) return;
        setEarthquakes(data);
        setSelected(data[0] ?? null);
        setLastUpdate(new Date());
      } catch {
        if (!cancelled) setError('No se pudo conectar. Verifica tu conexion a internet.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadInBackground = async () => {
      try {
        await loadEarthquakes();
      } catch {
        setError('No se pudo conectar. Verifica tu conexion a internet.');
      }
    };

    void loadInitial();
    const id = setInterval(() => {
      void loadInBackground();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [loadEarthquakes]);

  const handleNewEarthquake = useCallback((eq: Earthquake) => {
    setRealtimeEqs(prev => {
      const dup = prev.some(
        e =>
          Math.abs(e.time - eq.time) < 30000 &&
          Math.abs(e.lat - eq.lat) < 0.2 &&
          Math.abs(e.lng - eq.lng) < 0.2
      );
      if (dup) return prev;
      return [eq, ...prev];
    });

    if (eq.magnitude >= 2.5) {
      setAlert(eq);
      if (alertTimeout.current) clearTimeout(alertTimeout.current);
      alertTimeout.current = setTimeout(() => setAlert(null), 15000);
    }
  }, []);

  useEMSCWebSocket(handleNewEarthquake, setWsStatus);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [tab]);

  const allEarthquakes = useMemo(() => {
    const merged = [...realtimeEqs];
    const rtIds = new Set(realtimeEqs.map(e => e.id));

    for (const eq of earthquakes) {
      const dup = realtimeEqs.some(
        r =>
          Math.abs(r.time - eq.time) < 30000 &&
          Math.abs(r.lat - eq.lat) < 0.2 &&
          Math.abs(r.lng - eq.lng) < 0.2
      );
      if (!dup && !rtIds.has(eq.id)) merged.push(eq);
    }

    return merged.sort((a, b) => b.time - a.time);
  }, [earthquakes, realtimeEqs]);

  const maxMag = allEarthquakes.reduce((max, eq) => Math.max(max, eq.magnitude), 0);

  return (
    <div className="phone-stage">
      <div className={`app-shell ${tab === 'mapa' ? 'map-mode' : ''}`}>
        {alert && (
          <button
            type="button"
            onClick={() => setAlert(null)}
            className="quake-alert"
            style={{ backgroundColor: getMagColor(alert.magnitude) }}
          >
            <strong>M {alert.magnitude.toFixed(1)}</strong>
            <span>{alert.place}</span>
          </button>
        )}

        <Header
          tab={tab}
          status={wsStatus}
          lastUpdate={lastUpdate}
          loading={loading}
          onRefresh={refresh}
          onBack={() => setTab('eventos')}
        />

        {tab === 'eventos' && allEarthquakes.length > 0 && (
          <div className="summary-strip">
            <strong>{allEarthquakes.length}</strong> eventos - Mayor{' '}
            <b style={{ color: getMagColor(maxMag) }}>{maxMag.toFixed(1)}</b>
          </div>
        )}

        {error && (
          <button type="button" onClick={refresh} className="error-strip">
            {error}
          </button>
        )}

        <main className="app-content">
          {loading && allEarthquakes.length === 0 ? (
            <EarthquakeList earthquakes={[]} />
          ) : tab === 'eventos' ? (
            <EarthquakeList
              earthquakes={allEarthquakes}
              realtimeIds={new Set(realtimeEqs.map(e => e.id))}
              onSelect={eq => {
                setSelected(eq);
                setTab('mapa');
              }}
            />
          ) : (
            <EarthquakeMap earthquakes={allEarthquakes} selected={selected} onSelect={setSelected} />
          )}
        </main>

        <BottomNav tab={tab} onTab={setTab} />
      </div>
    </div>
  );
}
