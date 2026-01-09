'use client';

import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const VIDEO_URL = '/assets/videos/protardio-bg.webm';

export default function LorePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [showRotateHint, setShowRotateHint] = useState(false);

  // Detect portrait mode on mobile
  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 768;
      setIsPortrait(portrait);
      if (portrait) {
        setShowRotateHint(true);
        // Auto-hide hint after 4 seconds
        setTimeout(() => setShowRotateHint(false), 4000);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Auto-play video when mounted
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(console.error);
    }
  }, []);

  // When video ends, go back to main page
  const handleVideoEnd = () => {
    router.push('/');
  };

  // Skip button handler
  const handleSkip = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    router.push('/');
  };

  return (
    <div style={{ 
      background: '#000', 
      minHeight: '100vh',
      width: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Skip button */}
      <button
        onClick={handleSkip}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'transparent',
          border: '1px solid rgba(255, 215, 0, 0.4)',
          color: 'rgba(255, 215, 0, 0.7)',
          padding: '10px 20px',
          fontSize: '14px',
          fontFamily: 'monospace',
          cursor: 'pointer',
          zIndex: 100,
          transition: 'all 0.2s',
          borderRadius: '4px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#ffd700';
          e.currentTarget.style.color = '#ffd700';
          e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.4)';
          e.currentTarget.style.color = 'rgba(255, 215, 0, 0.7)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        SKIP →
      </button>

      {/* Rotate hint for mobile portrait */}
      {showRotateHint && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 215, 0, 0.4)',
            borderRadius: '8px',
            padding: '12px 20px',
            zIndex: 101,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeInOut 4s ease-in-out',
          }}
        >
          <span style={{ fontSize: '20px' }}>📱↔️</span>
          <span style={{
            color: 'rgba(255, 215, 0, 0.9)',
            fontSize: '13px',
            fontFamily: 'monospace',
          }}>
            Rotate for best experience
          </span>
        </div>
      )}

      {/* Lore Video (Local MP4) */}
      <video
        ref={videoRef}
        src={VIDEO_URL}
        playsInline
        onEnded={handleVideoEnd}
        style={{
          width: isPortrait ? '180%' : '100%',
          height: isPortrait ? 'auto' : '100%',
          objectFit: 'contain',
          maxHeight: isPortrait ? '60vh' : '100%',
        }}
      />

      <style jsx>{`
        @keyframes fadeInOut {
          0% { opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

