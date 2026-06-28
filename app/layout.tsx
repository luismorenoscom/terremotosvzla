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
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
      sameAs: [SITE_URL],
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
      author: { '@id': `${SITE_URL}/#org` },
      about: {
        '@type': 'Thing',
        name: 'Sismología',
        description: 'Monitoreo de actividad sísmica en Venezuela',
      },
    },
    {
      '@type': 'Dataset',
      '@id': `${SITE_URL}/#dataset`,
      name: 'Registro de Sismos y Terremotos en Venezuela',
      description:
        'Base de datos en tiempo real de sismos registrados en Venezuela, integrada de FUNVISIS, USGS y EMSC. Actualización cada 60 segundos.',
      url: SITE_URL,
      inLanguage: 'es-VE',
      temporalCoverage: '2020/..',
      spatialCoverage: {
        '@type': 'Place',
        name: 'Venezuela',
        geo: { '@type': 'GeoShape', box: '0.6 -73.4 12.5 -59.8' },
      },
      creator: [
        { '@type': 'Organization', name: 'FUNVISIS', url: 'http://www.funvisis.gob.ve' },
        { '@type': 'Organization', name: 'USGS', url: 'https://earthquake.usgs.gov' },
        { '@type': 'Organization', name: 'EMSC', url: 'https://www.seismicportal.eu' },
      ],
      distribution: [
        {
          '@type': 'DataDownload',
          encodingFormat: 'application/json',
          contentUrl: `${SITE_URL}/api/earthquakes`,
        },
        {
          '@type': 'DataDownload',
          encodingFormat: 'application/rss+xml',
          contentUrl: `${SITE_URL}/rss.xml`,
        },
      ],
      measurementTechnique: 'Sismógrafo',
      variableMeasured: 'Magnitud sísmica',
      isAccessibleForFree: true,
      publisher: { '@id': `${SITE_URL}/#org` },
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: '¿Cuándo fue el último terremoto en Venezuela?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'TerremotosVzla actualiza su registro cada 60 segundos. El evento más reciente siempre aparece primero en terremotosvlza.com.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Qué zonas de Venezuela tienen más terremotos?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Las zonas más sísmicas son: la falla de Boconó en los Andes (Mérida, Barinas), la falla de San Sebastián en la costa central (Aragua, Miranda, Vargas) y la falla de El Pilar en el oriente (Sucre, Monagas).',
          },
        },
        {
          '@type': 'Question',
          name: '¿Qué significa la magnitud de un terremoto?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'La magnitud mide la energía liberada. M3.0 se siente levemente; M4.0–4.9 puede causar daños menores; M5.0–5.9 daños moderados; M6.0 o mayor puede ser destructivo. La escala es logarítmica: cada punto equivale a 32 veces más energía.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Qué es FUNVISIS?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'FUNVISIS es la Fundación Venezolana de Investigaciones Sismológicas, el organismo oficial del gobierno venezolano responsable del monitoreo sísmico nacional.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Cómo saber si hubo un sismo ahora en Venezuela?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Visita terremotosvlza.com desde cualquier dispositivo. La página muestra sismos de las últimas horas en tiempo real con magnitud, profundidad y ubicación. También disponible como app instalable (PWA).',
          },
        },
      ],
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
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${SITE_NAME} — Sismos Venezuela`}
          href={`${SITE_URL}/rss.xml`}
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
