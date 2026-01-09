'use client';

import Image from 'next/image';

interface HeaderProps {
  onLogoClick?: () => void;
}

export function Header({ onLogoClick }: HeaderProps) {
  return (
    <header className="border-b-2 border-protardio-green/40 bg-black/90 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-lg mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
        <button 
          onClick={onLogoClick}
          className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity cursor-pointer"
          type="button"
        >
          {/* Logo */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 relative shrink-0">
            <Image
              src="/whitelist/logo.png"
              alt="Protardio"
              fill
              className="object-contain"
            />
          </div>
          <h1 
            className="text-protardio-green text-sm sm:text-base tracking-wider font-pixel"
            style={{ 
              textShadow: '1px 1px 0 #003300, 0 0 8px rgba(0,255,0,0.5)'
            }}
          >
            PROTARDIO
          </h1>
        </button>
        <div className="flex items-center">
          <span className="text-protardio-yellow font-mono text-[10px] sm:text-xs tracking-wide">
            ▶ WL
          </span>
        </div>
      </div>
    </header>
  );
}
