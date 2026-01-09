'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useFarcaster } from '~/contexts/FarcasterContext';

interface VerificationStatus {
  verified: boolean;
  discord_username?: string;
  nft_balance?: number;
  verified_at?: string;
}

export function DiscordVerification() {
  const { address } = useAccount();
  const { user } = useFarcaster();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  const fid = user?.fid;

  // Check verification status
  const checkStatus = useCallback(async () => {
    if (!fid) return;

    try {
      const response = await fetch(`/api/discord/status?fid=${fid}`);
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error checking Discord status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fid]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Listen for verification completion (when popup closes)
  useEffect(() => {
    const handleFocus = () => {
      // Re-check status when window regains focus (after popup closes)
      if (isVerifying) {
        setIsVerifying(false);
        checkStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isVerifying, checkStatus]);

  const handleVerify = () => {
    if (!fid || !address) {
      alert('Please connect your wallet first');
      return;
    }

    setIsVerifying(true);

    // Open verification flow in popup
    const verifyUrl = `/api/discord/link?fid=${fid}&wallet=${address}`;
    const popup = window.open(verifyUrl, 'discord-verify', 'width=500,height=700');

    // Poll for popup close
    const checkPopup = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkPopup);
        setIsVerifying(false);
        checkStatus();
      }
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-900 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
          <span className="text-gray-400">Checking Discord status...</span>
        </div>
      </div>
    );
  }

  if (status?.verified) {
    return (
      <div className="p-4 bg-gray-900 rounded-lg border border-green-500/30">
        <div className="flex items-center gap-3">
          <DiscordIcon />
          <div>
            <div className="font-semibold text-green-400">Discord Connected</div>
            <div className="text-sm text-gray-400">
              @{status.discord_username} &middot; {status.nft_balance} Protardio{status.nft_balance !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="mb-3">
        <div className="font-semibold text-white mb-1">Join the Community</div>
        <div className="text-sm text-gray-400">
          Link your Discord to access exclusive holder channels
        </div>
      </div>

      {!address ? (
        <div className="text-sm text-yellow-400">
          Connect your wallet first
        </div>
      ) : (
        <button
          onClick={handleVerify}
          disabled={isVerifying}
          className="w-full px-4 py-3 bg-[#5865F2] hover:bg-[#4752C4] disabled:bg-[#5865F2]/50
                     text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isVerifying ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Connecting...
            </>
          ) : (
            <>
              <DiscordIcon />
              Link Discord
            </>
          )}
        </button>
      )}
    </div>
  );
}

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

export default DiscordVerification;
