'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 días

export default function InstallPrompt() {
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Modo preview (solo desarrollo): ?install=ios o ?install=android
    const preview = new URLSearchParams(window.location.search).get('install') as 'ios' | 'android' | null;
    if (preview === 'ios' || preview === 'android') {
      setPlatform(preview);
      setVisible(true);
      return;
    }

    // Ya está instalada como app
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Ya fue descartada recientemente
    const ts = localStorage.getItem(DISMISS_KEY);
    if (ts && Date.now() - Number(ts) < DISMISS_TTL) return;

    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);

    if (isIOS) {
      const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
      if (!isSafari) return;
      setPlatform('ios');
      const t = setTimeout(() => setVisible(true), 4000);
      return () => clearTimeout(t);
    }

    if (isAndroid) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setPlatform('android');
        setTimeout(() => setVisible(true), 4000);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setDeferredPrompt(null);
  };

  if (!visible || !platform) return null;

  return createPortal(
    <>
      <div className="install-overlay" onClick={dismiss} aria-hidden="true" />
      <div className="install-sheet" role="dialog" aria-label="Instalar aplicación">
      <button type="button" className="install-close" onClick={dismiss} aria-label="Cerrar">
        ×
      </button>

      <div className="install-row">
        <img src="/icon.png" className="install-icon" alt="TerremotosVzla" />
        <div className="install-text">
          <strong>TerremotosVzla</strong>
          <span>Acceso rápido desde tu pantalla de inicio</span>
        </div>
      </div>

      {platform === 'android' && (
        <button type="button" className="install-btn" onClick={install}>
          Agregar a inicio
        </button>
      )}

      {platform === 'ios' && (
        <div className="install-ios">
          <p className="install-ios-step">
            <span className="install-ios-num">1</span>
            Toca el botón{' '}
            <strong>Compartir</strong>
            {' '}
            <ShareIcon />
            {' '}en la barra de Safari
          </p>
          <p className="install-ios-step">
            <span className="install-ios-num">2</span>
            Selecciona <strong>"Agregar a pantalla de inicio"</strong>
          </p>
          <button type="button" className="install-dismiss" onClick={dismiss}>
            Entendido
          </button>
        </div>
      )}
    </div>
    </>,
    document.body,
  );
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline', verticalAlign: 'middle', marginBottom: 2 }}
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
