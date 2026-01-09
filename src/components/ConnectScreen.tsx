'use client';

import { WalletMinimal } from "lucide-react";
import { useCallback, useState } from "react";
import { useConnect } from "wagmi";

interface ConnectScreenProps {
  onConnected: () => void;
}

/**
 * Initial connection screen shown when user first opens the mini app.
 * Prompts user to connect their wallet before accessing the main app.
 */
export function ConnectScreen({ onConnected }: ConnectScreenProps) {
  const { connect, connectors } = useConnect();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // Find the farcasterFrame connector first, then fallback to others
      const farcasterConnector = connectors.find(c => c.id === 'farcasterFrame');
      const connector = farcasterConnector || connectors[0];
      
      if (connector) {
        await connect({ connector });
        console.log("✅ Wallet connected!");
        onConnected();
      } else {
        setError("No wallet connector found");
      }
    } catch (e) {
      console.error("Failed to connect wallet:", e);
      setError("Failed to connect. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  }, [connect, connectors, onConnected]);

  return (
    <div className="relative min-w-screen h-screen overflow-hidden font-victor text-white max-w-[440px]">
      {/* Video Background Layer */}
      <div className="absolute inset-0 z-0 flex justify-center">
        <video
          src="/assets/gifs/3dgifmaker56274.webm"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-[402px] object-cover mix-blend-screen mask-gradient-bottom"
        />
      </div>

      {/* Content Layer */}
      <div className="relative z-20 flex flex-col items-center justify-center h-full px-4">
        {/* Logo/Title */}
        <h1 className="font-['Bitcount'] font-medium text-[62px] leading-none tracking-wider drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mb-4">
          Protardio
        </h1>

        {/* Subtitle */}
        <p className="font-victor font-bold text-[15px] text-[#FFFF00] tracking-wider mb-8 drop-shadow-md">
          wartime farcaster pfps
        </p>

        {/* Connect Card */}
        <div className="w-full max-w-[320px] bg-black/60 backdrop-blur-sm border border-white/20 rounded-2xl p-6 flex flex-col items-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#51FF01] to-[#00CC00] flex items-center justify-center mb-4 shadow-lg shadow-[#51FF01]/30">
            <WalletMinimal size={32} strokeWidth={2} className="text-black" />
          </div>

          {/* Text */}
          <h2 className="font-victor font-bold text-[18px] text-white mb-2">
            Connect Wallet
          </h2>
          <p className="text-white/60 font-victor text-[13px] text-center mb-6">
            Connect your wallet to access minting, gallery, and more
          </p>

          {/* Error message */}
          {error && (
            <p className="text-red-400 font-victor text-[12px] mb-4 text-center">
              {error}
            </p>
          )}

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full h-[48px] rounded-[60px] font-victor font-bold italic text-black flex items-center justify-center gap-2 bg-[#51FF01] hover:scale-105 transition-transform shadow-lg shadow-[#51FF01]/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <>
                <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <WalletMinimal size={20} strokeWidth={2.5} />
                Connect Wallet
              </>
            )}
          </button>

          {/* Powered by */}
          <p className="text-white/30 font-victor text-[10px] mt-4">
            Powered by Farcaster
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConnectScreen;
