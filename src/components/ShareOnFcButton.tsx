'use client';

import { useState, useCallback } from 'react';
import sdk from '@farcaster/miniapp-sdk';
import { Share2 } from 'lucide-react';

interface ShareOnFCButtonProps {
  imageUrl: string;
  className?: string;
  shareText?: string;
}

type ShareStatus = 'idle' | 'sharing' | 'success' | 'error';

export function ShareOnFCButton({ 
  imageUrl, 
  className = '',
  shareText = 'This Protardio is my declaration of war in the Farcaster wallet'
}: ShareOnFCButtonProps) {
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    setError(null);
    setStatus('sharing');

    try {
      // Use the Farcaster SDK to compose a cast with the image
      const result = await sdk.actions.composeCast({
        text: shareText,
        embeds: [imageUrl],
      });

      // If result has a cast, it was successful
      if (result?.cast) {
        setStatus('success');
        console.log('✅ Cast shared successfully:', result.cast.hash);
        
        // Reset to idle after 2 seconds
        setTimeout(() => {
          setStatus('idle');
        }, 2000);
      } else {
        // User cancelled
        setStatus('idle');
      }
    } catch (err) {
      console.error('❌ Error sharing to Farcaster:', err);
      setError(err instanceof Error ? err.message : 'Failed to share');
      setStatus('error');
      
      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus('idle');
        setError(null);
      }, 3000);
    }
  }, [imageUrl, shareText]);

  const getButtonText = () => {
    switch (status) {
      case 'sharing':
        return 'Sharing...';
      case 'success':
        return 'Shared!';
      case 'error':
        return 'Try Again';
      default:
        return 'Share ';
    }
  };

  const isLoading = status === 'sharing';

  return (
    <button
      onClick={handleShare}
      disabled={isLoading}
      className={`w-10 h-10 flex items-center justify-center rounded-full bg-white hover:scale-110 transition-all shadow-lg ${className}`}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
      ) : status === 'success' ? (
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <Share2 size={20} className="text-black" />
      )}
    </button>
  );
}

export default ShareOnFCButton;
