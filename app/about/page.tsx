import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sobre TerremotosVzla — Monitor de Sismos en Venezuela',
  description:
    'Conoce cómo funciona TerremotosVzla, el monitor de terremotos en Venezuela en tiempo real. Fuentes de datos, cobertura, preguntas frecuentes y sismicidad venezolana.',
  alternates: { canonical: 'https://terremotosvlza.com/about' },
};

const faq = [
  {
    q: '¿Cuándo fue el último terremoto en Venezuela?',
    a: 'TerremotosVzla actualiza su registro cada 60 segundos con los sismos más recientes detectados en Venezuela. Puedes consultar el evento más reciente en la página principal.',
  },
  {
    q: '¿Qué zonas de Venezuela tienen más terremotos?',
    a: 'Las zonas más sísmicas son: la falla de Boconó en los Andes (estados Mérida, Barinas, Portuguesa), la falla de San Sebastián en la costa central (Aragua, Miranda, Vargas), y la falla de El Pilar en el oriente (Sucre, Monagas).',
  },
  {
    q: '¿Qué significa la magnitud de un terremoto?',
    a: 'La magnitud mide la energía liberada. Un sismo M3.0 se siente levemente; M4.0–4.9 puede causar daños menores; M5.0–5.9 causa daños moderados; M6.0 o mayor puede ser destructivo. La escala es logarítmica: cada punto representa 32 veces más energía.',
  },
  {
    q: '¿Qué es FUNVISIS?',
    a: 'FUNVISIS es la Fundación Venezolana de Investigaciones Sismológicas, el organismo oficial del gobierno venezolano encargado del monitoreo sísmico del país. Su red de sensores cubre todo el territorio nacional.',
  },
  {
    q: '¿Cómo saber si hubo un sismo ahora en Venezuela?',
    a: 'Visita terremotosvlza.com desde cualquier dispositivo. La página muestra los sismos de las últimas horas ordenados por tiempo, con magnitud, profundidad y ubicación. También puedes suscribirte al feed RSS para recibir actualizaciones automáticas.',
  },
  {
    q: '¿Los datos son oficiales?',
    a: 'TerremotosVzla integra datos de tres fuentes oficiales: FUNVISIS (Venezuela), USGS (Estados Unidos) y EMSC (Europa). Los datos se combinan y deduplicán para ofrecer la cobertura más completa posible.',
  },
];

export default function AboutPage() {
  return (
    <div className="phone-stage">
      <div className="app-shell">
        <header className="event-hero">
          <div className="hero-world" />
          <div className="app-topbar">
            <div className="topbar-brand">
              <img src="/logo.png" className="header-logo" alt="TerremotosVzla" />
            </div>
            <div className="topbar-right">
              <Link href="/" className="about-back-link">← Inicio</Link>
            </div>
          </div>
          <div className="hero-body">
            <h1 className="hero-heading">Sobre TerremotosVzla</h1>
            <p className="hero-sub">Monitor de sismos en Venezuela en tiempo real</p>
          </div>
        </header>

        <main className="about-content">

          <section className="about-section">
            <h2>¿Qué es TerremotosVzla?</h2>
            <p>
              TerremotosVzla es una aplicación web gratuita que monitorea la actividad sísmica
              en Venezuela en tiempo real. Integra datos de tres fuentes sismológicas oficiales
              —FUNVISIS, USGS y EMSC— y los actualiza automáticamente cada 60 segundos.
            </p>
            <p>
              Está diseñada para funcionar como una aplicación nativa en tu teléfono (PWA):
              puedes instalarla desde el navegador sin pasar por ninguna tienda de aplicaciones.
            </p>
          </section>

          <section className="about-section">
            <h2>Fuentes de datos</h2>
            <div className="about-sources">
              <div className="about-source-card">
                <strong>FUNVISIS</strong>
                <span>Fundación Venezolana de Investigaciones Sismológicas</span>
                <p>Organismo oficial venezolano. Registra sismos desde M1.0 en todo el territorio nacional con su red de sensores locales.</p>
                <a href="http://www.funvisis.gob.ve" target="_blank" rel="noopener noreferrer">funvisis.gob.ve</a>
              </div>
              <div className="about-source-card">
                <strong>USGS</strong>
                <span>United States Geological Survey</span>
                <p>Agencia geológica de los Estados Unidos. Catálogo global con alta fiabilidad técnica y cobertura de sismos M2.5+ en Venezuela.</p>
                <a href="https://earthquake.usgs.gov" target="_blank" rel="noopener noreferrer">earthquake.usgs.gov</a>
              </div>
              <div className="about-source-card">
                <strong>EMSC</strong>
                <span>European-Mediterranean Seismological Centre</span>
                <p>Centro europeo de sismología. Ofrece alertas en tiempo real vía WebSocket y cobertura global de sismos M3.0+.</p>
                <a href="https://www.seismicportal.eu" target="_blank" rel="noopener noreferrer">seismicportal.eu</a>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Sismicidad en Venezuela</h2>
            <p>
              Venezuela es uno de los países más sísmicamente activos de Sudamérica. Su actividad
              está determinada principalmente por la interacción entre la placa Suramericana y la
              placa del Caribe, lo que genera varias fallas geológicas activas:
            </p>
            <ul className="about-list">
              <li><strong>Falla de Boconó</strong> — Atraviesa los Andes venezolanos (Mérida, Barinas, Portuguesa). Es la falla más activa del país.</li>
              <li><strong>Falla de San Sebastián</strong> — Corre paralela a la costa central (Aragua, Miranda, Vargas). Representa riesgo para Caracas.</li>
              <li><strong>Falla de El Pilar</strong> — Recorre el oriente del país (Sucre, Monagas). Causó el terremoto de Cariaco en 1997 (M6.8).</li>
              <li><strong>Zona norte de Falcón</strong> — Región con actividad sísmica frecuente en el occidente.</li>
            </ul>
            <p>
              El terremoto más destructivo registrado en Venezuela fue el de Caracas del 26 de marzo de 1812,
              estimado en ~7.7 Mw, que destruyó la ciudad durante las festividades del Jueves Santo.
            </p>
          </section>

          <section className="about-section">
            <h2>Acceso a datos</h2>
            <ul className="about-list">
              <li><strong>API JSON:</strong> <a href="/api/earthquakes">/api/earthquakes</a> — Lista completa de sismos recientes en formato JSON.</li>
              <li><strong>Feed RSS:</strong> <a href="/rss.xml">/rss.xml</a> — Sismos M2.5+ para suscripción en lectores RSS.</li>
              <li><strong>LLMs:</strong> <a href="/llms.txt">/llms.txt</a> — Descripción del sitio para crawlers de inteligencia artificial.</li>
            </ul>
          </section>

          <section className="about-section">
            <h2>Preguntas frecuentes</h2>
            <div className="about-faq">
              {faq.map((item, i) => (
                <details key={i} className="about-faq-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="about-section about-disclaimer">
            <p>
              TerremotosVzla es un proyecto informativo independiente. Para información oficial
              y alertas de emergencia, consulta{' '}
              <a href="http://www.funvisis.gob.ve" target="_blank" rel="noopener noreferrer">FUNVISIS</a>{' '}
              y la Protección Civil venezolana.
            </p>
          </section>

        </main>

        <footer className="app-footer">
          <div className="footer-brand">
            <img src="/logo.png" className="footer-logo" alt="TerremotosVzla" />
          </div>
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
      </div>
    </div>
  );
}
