'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-banner-dismissed';
const DISMISS_TTL = 30 * 24 * 60 * 60 * 1000;

function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginBottom: 2 }}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export default function InstallBanner() {
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Preview mode: ?banner=ios o ?banner=android
    const preview = new URLSearchParams(window.location.search).get('banner') as 'ios' | 'android' | null;
    if (preview === 'ios' || preview === 'android') {
      setPlatform(preview);
      setVisible(true);
      return;
    }

    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const ts = localStorage.getItem(DISMISS_KEY);
    if (ts && Date.now() - Number(ts) < DISMISS_TTL) return;

    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);

    if (isIOS) {
      const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
      if (!isSafari) return;
      setPlatform('ios');
      setVisible(true);
      return;
    }

    if (isAndroid) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setPlatform('android');
        setVisible(true);
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

  return (
    <div className="install-banner">
      <button type="button" className="install-banner-close" onClick={dismiss} aria-label="Cerrar">✕</button>

      <div className="install-banner-header">
        <div className="install-banner-icon-wrap">
          <PhoneIcon />
        </div>
        <div>
          <div className="install-banner-title">
            {platform === 'android' ? 'Instala la app' : 'Instala en tu iPhone'}
          </div>
          <div className="install-banner-sub">Acceso rápido desde tu pantalla de inicio</div>
        </div>
      </div>

      {platform === 'android' && (
        <button type="button" className="install-banner-btn" onClick={install}>
          Agregar a pantalla de inicio
        </button>
      )}

      {platform === 'ios' && (
        <div className="install-banner-ios">
          <div className="install-banner-step">
            <span className="install-banner-num">1</span>
            <span>Toca <strong>Compartir</strong> <ShareIcon /> en la barra de Safari</span>
          </div>
          <div className="install-banner-step">
            <span className="install-banner-num">2</span>
            <span>Selecciona <strong>"Agregar a pantalla de inicio"</strong></span>
          </div>
          <button type="button" className="install-banner-dismiss" onClick={dismiss}>Entendido</button>
        </div>
      )}
    </div>
  );
}
