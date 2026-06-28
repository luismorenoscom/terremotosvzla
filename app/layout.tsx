import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import SWRegister from './sw-register';
import InstallPrompt from '@/components/InstallPrompt';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

const GA_ID = 'G-10LB72ZK6N';
const SITE_URL = 'https://terremotosvlza.com';
const SITE_NAME = 'TerremotosVzla';
const TITLE = 'TerremotosVzla — Sismos y Terremotos en Venezuela en Tiempo Real';
const DESCRIPTION =
  'Monitor de terremotos y sismos en Venezuela actualizado en tiempo real. Consulta el último sismo, magnitudes, profundidad y ubicación. Datos oficiales de FUNVISIS, USGS y EMSC.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    'terremotos venezuela',
    'sismos venezuela',
    'terremoto hoy venezuela',
    'sismo hoy venezuela',
    'sismo venezuela hoy',
    'monitor sismos venezuela',
    'FUNVISIS',
    'mapa sismico venezuela',
    'alerta sismica venezuela',
    'ultima hora sismo venezuela',
    'earthquake venezuela',
    'temblor venezuela',
    'actividad sismica venezuela',
    'red sismica venezuela',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: SITE_URL,
    languages: { 'es-VE': SITE_URL },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — Monitor de Sismos en Venezuela`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png' }],
    apple: [{ url: '/icon.png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: SITE_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: '#ba2309',
  width: 'device-width',
  initialScale: 1,
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DESCRIPTION,
      inLanguage: 'es-VE',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      inLanguage: 'es-VE',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      about: {
        '@type': 'Thing',
        name: 'Sismología',
        description: 'Monitoreo de actividad sísmica en Venezuela',
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={geist.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
        <SWRegister />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
