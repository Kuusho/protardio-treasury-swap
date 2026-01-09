'use client';

import { useEffect, useState } from 'react';

export function CRTEffects() {
  const [scanlineOffset, setScanlineOffset] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setScanlineOffset(prev => (prev + 0.5) % 100);
    }, 30);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <>
      {/* Scanlines overlay */}
      <div 
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.15) 2px,
            rgba(0, 0, 0, 0.15) 4px
          )`,
        }}
      />
      
      {/* Noise overlay */}
      <div 
        className="pointer-events-none fixed inset-0 z-40 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Moving scanline */}
      <div 
        className="pointer-events-none fixed left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-protardio-green/20 to-transparent z-40"
        style={{ top: `${scanlineOffset}%` }}
      />

      {/* Vignette */}
      <div 
        className="pointer-events-none fixed inset-0 z-30"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 60%, rgba(0,0,0,0.4) 100%)'
        }}
      />
    </>
  );
}
