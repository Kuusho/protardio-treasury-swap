'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFarcaster } from '../contexts/FarcasterContext';
import { TraitTwinsResponse, TraitTwin } from '../types/mint';

interface TraitTwinButtonProps {
  tokenId: number;
  className?: string;
}

type ModalState = 'idle' | 'searching' | 'results' | 'error';

// Dummy token IDs for the "scanning" animation
const SCAN_ANIMATION_DURATION = 2500; // 2.5 seconds
const SCAN_INTERVAL = 80; // Change image every 80ms

export function TraitTwinButton({ tokenId, className = '' }: TraitTwinButtonProps) {
  const { viewProfile } = useFarcaster();
  const [isOpen, setIsOpen] = useState(false);
  const [modalState, setModalState] = useState<ModalState>('idle');
  const [data, setData] = useState<TraitTwinsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Animation state
  const [scanningTokenId, setScanningTokenId] = useState(1);
  const [allTokenImages, setAllTokenImages] = useState<string[]>([]);

  // Fetch some random protardio images for the scanning animation
  const preloadScanImages = useCallback(async () => {
    try {
      const response = await fetch('/api/gallery/all?page=1&pageSize=30');
      if (response.ok) {
        const data = await response.json();
        const images = data.items.map((item: any) => item.image_url).filter(Boolean);
        setAllTokenImages(images);
      }
    } catch (e) {
      console.error('Failed to preload scan images:', e);
    }
  }, []);

  // Scanning animation effect
  useEffect(() => {
    if (modalState !== 'searching') return;
    
    const interval = setInterval(() => {
      setScanningTokenId(prev => {
        const next = prev + Math.floor(Math.random() * 5) + 1;
        return next > 999 ? 1 : next;
      });
    }, SCAN_INTERVAL);

    return () => clearInterval(interval);
  }, [modalState]);

  const findTraitTwins = async () => {
    setIsOpen(true);
    setModalState('searching');
    setError(null);
    
    // Preload images for animation
    await preloadScanImages();

    // Start a minimum timer for the animation
    const animationPromise = new Promise(resolve => 
      setTimeout(resolve, SCAN_ANIMATION_DURATION)
    );

    // Fetch trait twins
    const fetchPromise = fetch(`/api/trait-twins?tokenId=${tokenId}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to find trait twins');
        }
        return res.json() as Promise<TraitTwinsResponse>;
      });

    try {
      // Wait for both animation and fetch
      const [, response] = await Promise.all([animationPromise, fetchPromise]);
      setData(response);
      setModalState('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setModalState('error');
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setModalState('idle');
    setData(null);
    setError(null);
  };

  const getMatchPercentage = (score: number) => Math.round(score * 100);

  const getRarityColor = (rarity: number) => {
    if (rarity <= 0.05) return 'text-[#FF00FF]'; // Ultra rare - magenta
    if (rarity <= 0.10) return 'text-[#FF6600]'; // Very rare - orange
    if (rarity <= 0.20) return 'text-[#FFFF00]'; // Rare - yellow
    return 'text-white/80'; // Common
  };

  const getRarityLabel = (rarity: number) => {
    if (rarity <= 0.05) return 'Ultra Rare';
    if (rarity <= 0.10) return 'Very Rare';
    if (rarity <= 0.20) return 'Rare';
    return 'Common';
  };

  return (
    <>
      {/* Find Twin Button */}
      <button
        onClick={findTraitTwins}
        className={`
          font-victor font-bold italic text-[18px]
          bg-[#B011FF] text-white rounded-[60px]
          px-6 py-3
          shadow-lg shadow-purple-500/30
          hover:bg-[#9900DD] hover:scale-105
          active:scale-95
          transition-all duration-200
          flex items-center gap-2
          ${className}
        `}
      >
        <span className="text-[18px]">🔍</span>
        Find Your Twin
      </button>

      {/* Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-fadeIn"
          onClick={closeModal}
        >
          <div 
            className="relative bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-2xl p-5 max-w-[380px] w-full max-h-[85vh] overflow-y-auto border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* ===== SEARCHING STATE ===== */}
            {modalState === 'searching' && (
              <div className="flex flex-col items-center py-8">
                <h2 className="font-victor font-bold text-[22px] text-white mb-6">
                  🔍 Finding Your Trait Twin...
                </h2>

                {/* Scanning Animation */}
                <div className="relative w-[180px] h-[180px] mb-6">
                  {/* Rotating border */}
                  <div className="absolute inset-0 rounded-xl border-2 border-[#B011FF] animate-spin" style={{ animationDuration: '3s' }} />
                  
                  {/* Scanning image - cycles through */}
                  <div className="absolute inset-2 rounded-lg overflow-hidden bg-black/50">
                    {allTokenImages.length > 0 ? (
                      <img
                        src={allTokenImages[scanningTokenId % allTokenImages.length] || '/assets/images/main-gallery-image.png'}
                        alt="Scanning..."
                        className="w-full h-full object-cover opacity-70 animate-pulse"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#B011FF]/20 to-[#51FF01]/20 animate-pulse" />
                    )}
                  </div>

                  {/* Scan line effect */}
                  <div 
                    className="absolute left-2 right-2 h-1 bg-gradient-to-r from-transparent via-[#51FF01] to-transparent animate-scanline"
                    style={{
                      animation: 'scanline 1s ease-in-out infinite',
                    }}
                  />
                </div>

                {/* Token counter */}
                <div className="font-victor text-white/60 text-[14px]">
                  Scanning Protardio #{scanningTokenId.toString().padStart(3, '0')}...
                </div>

                {/* Progress bar */}
                <div className="w-48 h-2 bg-white/10 rounded-full mt-4 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#B011FF] to-[#51FF01] animate-progressBar"
                    style={{
                      animation: 'progressBar 2.5s ease-out forwards',
                    }}
                  />
                </div>
              </div>
            )}

            {/* ===== RESULTS STATE ===== */}
            {modalState === 'results' && data && (
              <div className="pt-2">
                {/* Header */}
                <h2 className="font-victor font-bold text-[22px] text-white text-center mb-4">
                  🔍 YOUR TRAIT TWINS
                </h2>

                {/* Your Traits Section */}
                <div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/10">
                  <h3 className="font-victor font-bold text-[14px] text-white/60 mb-2">
                    YOUR TRAITS
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {data.yourTraits.map((trait, i) => (
                      <span 
                        key={i}
                        className={`px-2 py-1 rounded-full text-[11px] font-victor font-bold bg-white/10 ${getRarityColor(trait.rarity)}`}
                        title={`${getRarityLabel(trait.rarity)} - ${trait.holderCount} holders`}
                      >
                        {trait.value}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Exact Twins */}
                {data.exactTwins.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-victor font-bold text-[16px] text-[#51FF01] mb-2 flex items-center gap-2">
                      <span>✨</span> EXACT TWIN ({data.exactTwins[0].matchingTraits.length}/{data.yourTraits.length} traits match)
                    </h3>
                    <TwinCard 
                      twin={data.exactTwins[0]} 
                      onViewProfile={viewProfile}
                      highlight
                    />
                  </div>
                )}

                {/* Close Twins */}
                {data.closeTwins.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-victor font-bold text-[16px] text-[#FFFF00] mb-2">
                      🔥 CLOSE TWINS ({getMatchPercentage(data.closeTwins[0].matchScore)}%+ match)
                    </h3>
                    <div className="space-y-2">
                      {data.closeTwins.slice(0, 3).map((twin) => (
                        <TwinCard 
                          key={twin.tokenId} 
                          twin={twin} 
                          onViewProfile={viewProfile}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Trait Siblings */}
                {data.traitSiblings.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-victor font-bold text-[14px] text-white/70 mb-2">
                      👥 TRAIT SIBLINGS ({data.traitSiblings.length} found)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {data.traitSiblings.slice(0, 6).map((twin) => (
                        <div 
                          key={twin.tokenId}
                          onClick={() => twin.ownerFid && viewProfile(twin.ownerFid)}
                          className="w-14 h-14 rounded-lg overflow-hidden border border-white/20 hover:border-[#B011FF] hover:scale-110 transition-all cursor-pointer"
                          title={`#${twin.tokenId}${twin.ownerUsername ? ` @${twin.ownerUsername}` : ''} - ${getMatchPercentage(twin.matchScore)}% match`}
                        >
                          <img 
                            src={twin.imageUrl} 
                            alt={twin.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rarest Trait */}
                {data.rarestTrait && (
                  <div className="bg-gradient-to-r from-[#B011FF]/20 to-[#FF00FF]/20 rounded-xl p-3 border border-[#B011FF]/30">
                    <h3 className="font-victor font-bold text-[14px] text-[#FF00FF] mb-1">
                      💎 YOUR RAREST TRAIT
                    </h3>
                    <p className="font-victor text-white text-[18px] font-bold">
                      &ldquo;{data.rarestTrait.value}&rdquo;
                    </p>
                    <p className="font-victor text-white/60 text-[12px]">
                      Only {data.rarestTrait.holderCount} holder{data.rarestTrait.holderCount !== 1 ? 's' : ''} out of {data.totalProtardios}!
                    </p>
                    {data.rarestTrait.otherHolders.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-white/40 text-[11px]">Others:</span>
                        <div className="flex -space-x-2">
                          {data.rarestTrait.otherHolders.slice(0, 4).map((h) => (
                            <img 
                              key={h.tokenId}
                              src={h.imageUrl}
                              alt={`#${h.tokenId}`}
                              className="w-8 h-8 rounded-full border-2 border-[#1a1a2e] object-cover"
                              title={h.ownerUsername ? `@${h.ownerUsername}` : `#${h.tokenId}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* No twins found */}
                {data.exactTwins.length === 0 && data.closeTwins.length === 0 && data.traitSiblings.length === 0 && (
                  <div className="text-center py-8">
                    <span className="text-[40px] mb-4 block">🦄</span>
                    <p className="font-victor font-bold text-white text-[18px]">
                      You&apos;re One of a Kind!
                    </p>
                    <p className="font-victor text-white/60 text-[14px] mt-2">
                      No trait twins found. Your Protardio is truly unique!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ===== ERROR STATE ===== */}
            {modalState === 'error' && (
              <div className="flex flex-col items-center py-8">
                <span className="text-[48px] mb-4">😵</span>
                <h2 className="font-victor font-bold text-[20px] text-red-400 mb-2">
                  Oops!
                </h2>
                <p className="font-victor text-white/60 text-[14px] text-center mb-4">
                  {error || 'Failed to find trait twins'}
                </p>
                <button
                  onClick={findTraitTwins}
                  className="px-6 py-2 bg-[#B011FF] text-white rounded-full font-victor font-bold hover:bg-[#9900DD] transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom keyframes for animations */}
      <style jsx>{`
        @keyframes scanline {
          0%, 100% { top: 8px; }
          50% { top: calc(100% - 12px); }
        }
        @keyframes progressBar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </>
  );
}

// Twin Card Component
function TwinCard({ 
  twin, 
  onViewProfile,
  highlight = false 
}: { 
  twin: TraitTwin; 
  onViewProfile: (fid: number) => void;
  highlight?: boolean;
}) {
  return (
    <div 
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
        highlight 
          ? 'bg-gradient-to-r from-[#51FF01]/10 to-[#B011FF]/10 border-[#51FF01]/30' 
          : 'bg-white/5 border-white/10 hover:border-white/20'
      }`}
    >
      {/* Image */}
      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
        <img 
          src={twin.imageUrl} 
          alt={twin.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-victor font-bold text-white text-[15px]">
          {twin.name}
        </p>
        {twin.ownerUsername && (
          <button
            onClick={() => twin.ownerFid && onViewProfile(twin.ownerFid)}
            className="font-victor text-[#FFFF00] text-[12px] hover:underline"
          >
            @{twin.ownerUsername}
          </button>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {twin.matchingTraits.slice(0, 3).map((trait, i) => (
            <span 
              key={i}
              className="px-1.5 py-0.5 bg-[#51FF01]/20 rounded text-[10px] font-victor text-[#51FF01]"
            >
              {trait}
            </span>
          ))}
          {twin.matchingTraits.length > 3 && (
            <span className="text-white/40 text-[10px]">
              +{twin.matchingTraits.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Match Score */}
      <div className="text-right shrink-0">
        <span className={`font-victor font-bold text-[18px] ${highlight ? 'text-[#51FF01]' : 'text-[#FFFF00]'}`}>
          {Math.round(twin.matchScore * 100)}%
        </span>
        <p className="font-victor text-white/40 text-[10px]">match</p>
      </div>
    </div>
  );
}

export default TraitTwinButton;
