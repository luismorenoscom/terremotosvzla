import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import SWRegister from './sw-register';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'TerremotosVzla',
  description: 'Monitor de terremotos en Venezuela con datos en tiempo real',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png' }],
    apple: [{ url: '/icon.png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TerremotosVzla',
  },
};

export const viewport: Viewport = {
  themeColor: '#ba2309',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={geist.variable}>
      <body className="min-h-screen antialiased">
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
