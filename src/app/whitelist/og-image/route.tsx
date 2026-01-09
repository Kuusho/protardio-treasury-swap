import { ImageResponse } from 'next/og';
import { createServerClient } from '~/lib/whitelist-supabase';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://whitelist.protardio.xyz';

async function getSpotsRemaining(): Promise<number | null> {
  try {
    const cap = parseInt(process.env.REGISTRATION_CAP || '0');
    const currentPhase = process.env.NEXT_PUBLIC_CURRENT_PHASE || 'phase1_tier3';

    let supabase;
    try {
      supabase = createServerClient();
    } catch {
      return cap || null;
    }

    const { count, error } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('tier', currentPhase);

    if (error) {
      console.error('Error counting registrations:', error);
      return null;
    }

    const currentCount = count || 0;
    return cap > 0 ? Math.max(0, cap - currentCount) : null;
  } catch (error) {
    console.error('Error getting spots:', error);
    return null;
  }
}

export async function GET() {
  const spotsRemaining = await getSpotsRemaining();
  const spotsNumber = spotsRemaining !== null
    ? spotsRemaining.toLocaleString()
    : 'Join';
  const spotsLabel = spotsRemaining !== null ? 'spots left' : 'waitlist';

  // Load Victor Mono Bold font (TTF format required for ImageResponse)
  const fontPath = join(process.cwd(), 'public', 'fonts', 'VictorMono-Bold.ttf');
  const fontData = await readFile(fontPath);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
        }}
      >
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${APP_URL}/whitelist/new-og.jpeg`}
          alt=""
          width={1200}
          height={630}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />

        {/* Text overlay on the yellow bar */}
        <div
          style={{
            position: 'absolute',
            top: '405px',
            left: '0',
            right: '0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '55px',
            gap: '10px',
          }}
        >
          <span
            style={{
              fontFamily: 'VictorMono',
              fontSize: '28px',
              fontWeight: 700,
              color: '#033e9e',
            }}
          >
            ◀
          </span>
          <span
            style={{
              fontFamily: 'VictorMono',
              fontSize: '34px',
              fontWeight: 700,
              color: '#103990',
            }}
          >
            {spotsNumber}
          </span>
          <span
            style={{
              fontFamily: 'VictorMono',
              fontSize: '28px',
              fontWeight: 700,
              color: '#103990',
            }}
          >
            {spotsLabel}
          </span>
          <span
            style={{
              fontFamily: 'VictorMono',
              fontSize: '28px',
              fontWeight: 700,
              color: '#033e9e',
            }}
          >
            ▶
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'VictorMono',
          data: fontData,
          style: 'normal',
          weight: 700,
        },
      ],
    }
  );
}
