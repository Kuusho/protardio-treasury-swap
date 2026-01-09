'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface LoadingScreenProps {
  onComplete: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 300);
          return 100;
        }
        // Chunky progress like Windows XP
        const increment = Math.random() > 0.7 
          ? Math.floor(Math.random() * 15) + 5 
          : Math.floor(Math.random() * 8) + 2;
        return Math.min(prev + increment, 100);
      });
    }, 200);
    
    return () => clearInterval(interval);
  }, [onComplete]);
  
  // Calculate filled segments
  const segments = 20;
  const filledSegments = Math.floor((progress / 100) * segments);
  
  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-end">
      {/* Background image - full screen */}
      <div className="absolute inset-0">
        <Image
          src="/whitelist/loading-bg.png"
          alt=""
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* XP-style loading bar at bottom */}
      <div className="pb-20 sm:pb-24 relative z-10">
        <div
          className="w-64 sm:w-80 h-6 bg-gray-200 border-2 border-gray-400 flex items-center px-0.5"
          style={{ borderStyle: 'inset' }}
        >
          {Array.from({ length: segments }).map((_, i) => (
            <div
              key={i}
              className={`
                h-4 w-3 mx-px transition-all duration-75
                ${i < filledSegments ? 'bg-[#0a246a]' : 'bg-transparent'}
              `}
            />
          ))}
        </div>
        <p className="text-center text-gray-600 font-mono text-xs mt-2">
          {progress < 100 ? 'Loading Protardio...' : 'Ready'}
        </p>
      </div>
    </div>
  );
}
