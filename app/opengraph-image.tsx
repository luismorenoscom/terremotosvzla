import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const alt = 'TerremotosVzla — Monitor de Sismos en Venezuela en Tiempo Real';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const logoData = await readFile(path.join(process.cwd(), 'public', 'logo.png'));
  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #0d0d12 0%, #1a0505 100%)',
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Borde rojo superior */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: '#ba2309',
            display: 'flex',
          }}
        />

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          width={620}
          height={93}
          style={{ objectFit: 'contain', marginBottom: 36 }}
          alt="TerremotosVzla"
        />

        {/* Tagline */}
        <div
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 30,
            letterSpacing: '0.03em',
            textAlign: 'center',
          }}
        >
          Monitor de Sismos en Venezuela · Tiempo Real
        </div>

        {/* Fuentes */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'rgba(255,255,255,0.28)',
            fontSize: 20,
            letterSpacing: '0.08em',
          }}
        >
          FUNVISIS · USGS · EMSC
        </div>
      </div>
    ),
    { ...size },
  );
}
