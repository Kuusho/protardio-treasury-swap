import { Bell, Check } from "lucide-react";
import { useCallback, useState, useEffect } from "react";
import { useFarcaster } from "../contexts/FarcasterContext";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

// T2 (Tier 2) Mint opening date - Dec 19, 2025 at 12am (midnight) GMT+4 (20:00 UTC on Dec 18)
const MINT_OPEN_DATE = new Date('2025-12-27T20:00:00Z');

interface MainContentProps {
  onMintClick: () => void;
  onGalleryClick: () => void;
}

/**
 * Check if the app is in "coming soon" mode.
 * When true, hides navigation and shows "Coming soon..." instead.
 */
const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON === 'true';

function MainContent({ onMintClick, onGalleryClick }: MainContentProps) {
  const { addMiniApp, notificationStatus } = useFarcaster();
  const router = useRouter();
  const { address } = useAccount();
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [showAlreadyEnabled, setShowAlreadyEnabled] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<'home' | 'lore' | 'mint' | 'gallery'>('home');
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0 });

  // Countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const diff = MINT_OPEN_DATE.getTime() - now.getTime();
      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCountdown({ hours, minutes });
      } else {
        setCountdown({ hours: 0, minutes: 0 });
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const handleAddNotifications = useCallback(async () => {
    // If already enabled, show feedback
    if (notificationStatus.enabled) {
      setShowAlreadyEnabled(true);
      setTimeout(() => setShowAlreadyEnabled(false), 2000);
      return;
    }
    
    await addMiniApp();
  }, [addMiniApp, notificationStatus.enabled]);

  const openFarcasterProfile = () => {
    window.open("https://warpcast.com/protardio", "_blank");
  };

  const handleLoreClick = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      router.push('/lore');
    }, 500);
  };

  return (
    <div 
      className="relative min-w-screen h-screen overflow-hidden font-victor text-white max-w-[440px]"
      style={{
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
      }}
    >
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

      {/* Already Enabled Toast */}
      {showAlreadyEnabled && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#51FF01] text-black px-4 py-2 rounded-full font-victor font-bold text-[14px] flex items-center gap-2 animate-bounce shadow-lg">
          <Check size={18} strokeWidth={3} />
          Notifications already enabled!
        </div>
      )}

      {/* Content Layer */}
      <div className="relative z-20 flex flex-col items-center h-full pt-4 px-4">
        
        {/* Top Bar / Wallet */}
        <div className="w-full flex justify-between items-center max-w-[380px] pt-[5px]">
           {/* Countdown Badge */}
           <div className="bg-white text-black rounded-[60px] w-[83px] h-[41px] px-4 py-3 flex items-center justify-center shadow-lg">
             <span className="font-victor font-bold text-[20px]">{countdown.hours}hr</span>
           </div>
           
           {/* Wallet Address */}
           <div className="bg-white text-black rounded-[60px] px-4 py-2 flex items-center justify-center shadow-lg">
             <span className="font-mono text-[12px]">
               {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '---'}
             </span>
           </div>
        </div>

        {/* Central Visual Area with Overlays */}
        <div className="w-[400px] flex-1 relative mb-2 flex flex-col items-center justify-center">
           {/* Main Character Container */}
        
           {/* Text & Button Overlays - Positioned in the middle/bottom of the visual area */}
           <div className="relative z-5 flex flex-col items-center justify-center">
             {/* Title */}
             <h1 className="font-['Bitcount'] font-medium text-[62px] pt-20 leading-none tracking-wider drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] pb-8">
               Protardio
             </h1>

             {/* Subtitle */}
             <p className="font-victor font-bold text-[15px] text-[#FFFF00] tracking-wider mb-2 drop-shadow-md">
               {/* {isComingSoon ? "" : `${countdown.hours}h ${countdown.minutes}m till T2 mint`} */}
               {`Public mint live in ${countdown.hours}h ${countdown.minutes}m!`}
             </p>

             {/* Notification Button */}
             <button 
               onClick={handleAddNotifications}
               className={`font-victor font-bold italic text-[14px] px-5 py-1 rounded-[60px] hover:scale-105 transition-all shadow-lg flex items-center gap-2 ${
                 notificationStatus.enabled 
                   ? 'bg-[#51FF01] text-black' 
                   : 'bg-[#F6FF00] text-black'
               }`}
             >
               {notificationStatus.enabled ? (
                 <>
                   <Check size={16} strokeWidth={3} />
                   Notifications on
                 </>
               ) : (
                 <>
            
                   Add notifications!
                 </>
               )}
             </button>
           </div>

           {/* Navigation Buttons - Only show when not in coming soon mode */}
           {!isComingSoon && (
              <div className="w-full max-w-[380px] grid grid-cols-2 gap-3 mt-20 place-items-center">
             
               

                {/* Home Button */}
                <button
                  onMouseEnter={() => setHoveredNav('home')}
                  className={`w-[180px] h-[41px] rounded-[60px] font-victor font-bold italic flex items-center justify-center gap-2 border transition-all duration-200 ${
                    hoveredNav === 'home'
                      ? 'text-white border-white/40 bg-gradient-home-btn'
                      : 'text-[#FFFF00] border-white/20 bg-gradient-nav-btn'
                  }`}
                >
                  {hoveredNav === 'home' && <span className="text-yellow-400 blink-left">▶</span>}
                  Home
                  {hoveredNav === 'home' && <span className="text-yellow-400 blink-right">◀</span>}
                </button>

                {/* Lore Button */}
                <button
                  onClick={handleLoreClick}
                  onMouseEnter={() => setHoveredNav('lore')}
                  className={`w-[180px] h-[41px] rounded-[60px] font-victor font-bold italic flex items-center justify-center gap-2 border transition-all duration-200 ${
                    hoveredNav === 'lore'
                      ? 'text-white border-white/40 bg-gradient-home-btn'
                      : 'text-[#FFFF00] border-white/20 bg-gradient-nav-btn'
                  }`}
                >
                  {hoveredNav === 'lore' && <span className="text-yellow-400 blink-left">▶</span>}
                  Lore
                  {hoveredNav === 'lore' && <span className="text-yellow-400 blink-right">◀</span>}
                </button>

                {/* Mint Button */}
                <button
                  onClick={onMintClick}
                  onMouseEnter={() => setHoveredNav('mint')}
                  className={`w-[180px] h-[41px] rounded-[60px] font-victor font-bold italic flex items-center justify-center gap-2 border transition-all duration-200 ${
                    hoveredNav === 'mint'
                      ? 'text-white border-white/40 bg-gradient-home-btn'
                      : 'text-[#FFFF00] border-white/20 bg-gradient-nav-btn'
                  }`}
                >
                  {hoveredNav === 'mint' && <span className="text-yellow-400 blink-left">▶</span>}
                  Mint
                  {hoveredNav === 'mint' && <span className="text-yellow-400 blink-right">◀</span>}
                </button>

                {/* Gallery Button */}
                <button
                  onClick={onGalleryClick}
                  onMouseEnter={() => setHoveredNav('gallery')}
                  className={`w-[180px] h-[41px] rounded-[60px] font-victor font-bold italic flex items-center justify-center gap-2 border transition-all duration-200 ${
                    hoveredNav === 'gallery'
                      ? 'text-white border-white/40 bg-gradient-home-btn'
                      : 'text-[#FFFF00] border-white/20 bg-gradient-nav-btn'
                  }`}
                >
                  {hoveredNav === 'gallery' && <span className="text-yellow-400 blink-left">▶</span>}
                  Gallery
                  {hoveredNav === 'gallery' && <span className="text-yellow-400 blink-right">◀</span>}
                </button>
              </div>
            )}

           {/* Coming Soon - Only show when in coming soon mode */}
           {isComingSoon && (
             <div className="mt-16 flex flex-col items-center gap-6">
               <p className="font-victor font-bold italic text-[20px] text-white/70 tracking-wider animate-pulse">
                 Coming soon...
               </p>
               <button
                 onClick={() => router.push('/whitelist')}
                 className="bg-[#F6FF00] text-black font-victor font-bold italic text-[14px] px-6 py-2 rounded-[60px] hover:scale-105 transition-transform shadow-lg"
               >
                 Join Whitelist
               </button>
             </div>
           )}
        </div>

        {/* Footer - Only show when not in coming soon mode */}
        {!isComingSoon && (
          <div className="flex justify-between px-8 pb-6 text-sm font-victor text-white/80  gap-7">
            <button onClick={openFarcasterProfile} className="hover:text-white">(farcaster)</button>
            <a href="https://x.com/protardio" target="_blank" rel="noopener noreferrer" className="hover:text-white">(x)</a>
            <a href="https://opensea.io/collection/protardio-citizens" target="_blank" rel="noopener noreferrer" className="hover:text-white">(opensea)</a>
          </div>
        )}

      </div>
    </div>
  );
}

export default MainContent;
