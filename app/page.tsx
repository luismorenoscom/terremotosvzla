'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Earthquake } from '@/lib/types';
import { clearCache, fetchEarthquakes, getMagColor } from '@/lib/usgs';
import EarthquakeList from '@/components/EarthquakeList';
import InstallBanner from '@/components/InstallBanner';
import PullToRefresh from '@/components/PullToRefresh';
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

const LEGEND_ITEMS = [
  { range: 'M < 2.0',      label: 'Micro',     color: getMagColor(1.5), desc: 'Imperceptible, solo detectado por instrumentos' },
  { range: 'M 2.0 – 2.9',  label: 'Menor',     color: getMagColor(2.5), desc: 'Raramente sentido por las personas' },
  { range: 'M 3.0 – 3.9',  label: 'Ligero',    color: getMagColor(3.5), desc: 'Sentido por algunas personas cercanas al epicentro' },
  { range: 'M 4.0 – 4.9',  label: 'Moderado',  color: getMagColor(4.5), desc: 'Sentido por la mayoría, objetos se mueven' },
  { range: 'M 5.0 – 5.9',  label: 'Fuerte',    color: getMagColor(5.5), desc: 'Daños menores en estructuras débiles' },
  { range: 'M 6.0+',       label: 'Mayor',     color: getMagColor(6.5), desc: 'Daños importantes, potencialmente destructivo' },
];

function ColorLegendModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <>
      <div className="legend-overlay" onClick={onClose} aria-hidden="true" />
      <div className="legend-sheet" role="dialog" aria-modal="true" aria-label="Leyenda de colores">
        <div className="legend-header">
          <span className="legend-title">¿Qué significan los colores?</span>
          <button type="button" className="legend-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <p className="legend-subtitle">
          Cada círculo en el mapa representa un sismo. El color indica su magnitud y el tamaño refleja su intensidad.
        </p>
        <div className="legend-list">
          {LEGEND_ITEMS.map(item => (
            <div key={item.label} className="legend-item">
              <span className="legend-dot" style={{ background: item.color }} />
              <div className="legend-item-text">
                <div className="legend-item-top">
                  <span className="legend-item-label">{item.label}</span>
                  <span className="legend-item-range">{item.range}</span>
                </div>
                <span className="legend-item-desc">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="legend-note">
          A mayor magnitud, el círculo es más grande y oscuro.
        </p>
      </div>
    </>,
    document.body
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true">
      <rect y="0" width="22" height="2.5" rx="1.25" fill="currentColor" />
      <rect y="6.75" width="16" height="2.5" rx="1.25" fill="currentColor" />
      <rect y="13.5" width="22" height="2.5" rx="1.25" fill="currentColor" />
    </svg>
  );
}

function Header({
  tab,
  status,
  lastUpdate,
  loading,
  onRefresh,
  onBack,
  onLegend,
}: {
  tab: Tab;
  status: WSStatus;
  lastUpdate: Date | null;
  loading: boolean;
  onRefresh: () => void;
  onBack: () => void;
  onLegend: () => void;
}) {
  if (tab === 'mapa') {
    return (
      <header className="map-topbar">
        <button type="button" onClick={onBack} className="round-button" aria-label="Volver">
          &lt;
        </button>
        <div className="brand-orbit">T</div>
        <button type="button" onClick={onLegend} className="round-button" aria-label="Leyenda de colores">
          ?
        </button>
      </header>
    );
  }

  const updateText = lastUpdate
    ? `Actualizado ${lastUpdate.toLocaleTimeString('es-VE', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Caracas',
      })} VET · auto cada 5 min`
    : 'Consultando fuentes sísmicas...';

  return (
    <header className="event-hero">
      <div className="hero-world" />

      {/* Topbar: marca izquierda, menú derecha */}
      <div className="app-topbar">
        <div className="topbar-brand">
          <img src="/logo.png" className="header-logo" alt="TerremotosVzla" />
        </div>
        <div className="topbar-right">
          <LiveStatus status={status} />
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="topbar-refresh"
            aria-label="Actualizar"
          >
            {loading ? (
              <span className="topbar-spinner" />
            ) : (
              <HamburgerIcon />
            )}
          </button>
        </div>
      </div>

      {/* Hero body: título y subtítulo centrados */}
      <div className="hero-body">
        <h1 className="hero-heading">Registros de Terremotos</h1>
        <p className="hero-sub">{updateText}</p>
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="footer-brand">
        <img src="/logo.png" className="footer-logo" alt="TerremotosVzla" />
      </div>

      <p className="footer-disclaimer">
        Información con fines informativos. Para datos oficiales consulta{' '}
        <a href="http://www.funvisis.gob.ve" target="_blank" rel="noopener noreferrer">
          FUNVISIS
        </a>
        .
      </p>

      <div className="footer-sources">
        <span className="footer-sources-label">Fuentes</span>
        <div className="footer-sources-list">
          <a href="http://www.funvisis.gob.ve" target="_blank" rel="noopener noreferrer">FUNVISIS</a>
          <span>·</span>
          <a href="https://earthquake.usgs.gov" target="_blank" rel="noopener noreferrer">USGS</a>
          <span>·</span>
          <a href="https://www.seismicportal.eu" target="_blank" rel="noopener noreferrer">EMSC</a>
        </div>
      </div>

      <p className="footer-copy">© {new Date().getFullYear()} TerremotosVzla</p>
    </footer>
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
  const [minMag, setMinMag] = useState<number>(0);
  const [showLegend, setShowLegend] = useState(false);
  const alertTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadEarthquakes = useCallback(async () => {
    const data = await fetchEarthquakes(QUERY_DAYS);
    setEarthquakes(data);
    setSelected(current => current ?? data[0] ?? null);
    setLastUpdate(new Date());
  }, []);

  // Called when WebSocket reconnects — bypasses localStorage cache to recover missed events
  const silentRefresh = useCallback(async () => {
    clearCache();
    try {
      const data = await fetchEarthquakes(QUERY_DAYS);
      setEarthquakes(data);
      setLastUpdate(new Date());
    } catch { /* silent — no error banner for background catch-up */ }
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

  useEMSCWebSocket(handleNewEarthquake, setWsStatus, silentRefresh);

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
  const filtered = minMag > 0 ? allEarthquakes.filter(eq => eq.magnitude >= minMag) : allEarthquakes;

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
          onLegend={() => setShowLegend(true)}
        />

        {tab === 'eventos' && allEarthquakes.length > 0 && (
          <div className="summary-strip">
            <div className="summary-info">
              <strong>{filtered.length}</strong>
              <span> eventos · Mayor </span>
              <b style={{ color: getMagColor(maxMag) }}>{maxMag.toFixed(1)}</b>
            </div>
            <select
              className="mag-filter"
              value={minMag}
              onChange={e => setMinMag(Number(e.target.value))}
              aria-label="Filtrar por magnitud"
            >
              <option value={0}>Todos</option>
              <option value={1}>M 1.0+</option>
              <option value={2}>M 2.0+</option>
              <option value={3}>M 3.0+</option>
              <option value={4}>M 4.0+</option>
              <option value={5}>M 5.0+</option>
              <option value={6}>M 6.0+</option>
            </select>
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
          ) : (
            <div className="content-grid">
              {/* Panel lista — visible en mobile solo si tab=eventos, siempre visible en desktop */}
              <div className={`panel-list ${tab === 'eventos' ? 'panel-active' : ''}`}>
                <PullToRefresh onRefresh={refresh}>
                  <EarthquakeList
                    earthquakes={filtered}
                    realtimeIds={new Set(realtimeEqs.map(e => e.id))}
                    onSelect={eq => {
                      setSelected(eq);
                      setTab('mapa');
                    }}
                  />
                  <InstallBanner />
                  <AppFooter />
                </PullToRefresh>
              </div>

              {/* Panel mapa — visible en mobile solo si tab=mapa, siempre visible en desktop */}
              <div className={`panel-map ${tab === 'mapa' ? 'panel-active' : ''}`}>
                <EarthquakeMap earthquakes={filtered} selected={selected} onSelect={setSelected} />
              </div>
            </div>
          )}
        </main>

        <BottomNav tab={tab} onTab={setTab} />
      </div>
      {showLegend && <ColorLegendModal onClose={() => setShowLegend(false)} />}
    </div>
  );
}
