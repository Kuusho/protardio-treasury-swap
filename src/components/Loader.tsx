import { useEffect, useState } from "react";

interface LoaderProps {
  onComplete: () => void;
}

function Loader({ onComplete }: LoaderProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Calculate total animation time: 
    // Logo: 1.5s
    // Title: starts at 2.3s + 0.8s = 3.1s total
    // Wait 1 second after animations complete
    const animationTime = 3100 + 1000; // 4.1 seconds total
    
    // Start fade out 500ms before completion
    const fadeOutTimer = setTimeout(() => {
      setFadeOut(true);
    }, animationTime - 500);

    // Complete transition after fade out
    const completeTimer = setTimeout(() => {
      onComplete();
    }, animationTime);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`h-full bg-[#131313] flex items-center justify-center relative overflow-hidden transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      {/* Main content */}
      <div className="flex flex-col items-center justify-center z-10 px-4">
        {/* Logo with fade-in animation */}
        <div className="mb-8">
          <div className="opacity-0 animate-[logo-fadein_1.5s_steps(3)_forwards]">
            <img 
              src="/assets/logo/ProdardioLogo.png" 
              alt="Protardio Logo" 
              className="w-48 h-48 object-contain drop-shadow-2xl filter-[drop-shadow(0_0_20px_rgba(255,0,0,0.5))_drop-shadow(0_0_40px_rgba(255,0,0,0.3))] [image-rendering:pixelated]"
            />
          </div>
        </div>

        {/* Protardio title */}
        <h1 
          className="text-white font-victor text-[40px] font-medium mb-4 tracking-[0.05em] opacity-0 animate-[title-fadein_0.8s_ease-in-out_2.3s_forwards] [text-shadow:0_0_10px_rgba(255,255,255,0.5),0_0_20px_rgba(255,255,255,0.3)]"
        >
          Protardio
        </h1>

        {/* Subtitle */}
        <p 
          className="text-white font-victor text-[15px] font-bold text-center tracking-[0.02em] opacity-0 animate-[subtitle-fadein_0.8s_ease-in-out_1.5s_forwards]"
        >
          farcaster wartime pfps<br />
          by @kuusho &amp; @qt
        </p>
      </div>
    </div>
  );
}

export default Loader;
