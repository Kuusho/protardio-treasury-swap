"use client";

import { useState, useEffect, useRef } from "react";
import Loader from "~/components/Loader";
import { ConsoleErrorSuppressor } from "~/components/ConsoleErrorSuppressor";
import { sdk } from "@farcaster/miniapp-sdk";

// Track if the app has been loaded before (survives client-side navigation)
let hasLoadedOnce = false;

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  // Only show loader on first app load, not on client-side navigation
  const initialLoad = useRef(!hasLoadedOnce);
  const [showLoader, setShowLoader] = useState(initialLoad.current);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    sdk.actions.ready();
    
    // If we've already loaded before, make sure we don't show loader
    if (hasLoadedOnce) {
      setShowLoader(false);
    }
  }, []);

  const handleLoaderComplete = () => {
    hasLoadedOnce = true; // Mark that we've loaded once
    setFadeOut(true);
    setTimeout(() => {
      setShowLoader(false);
    }, 500);
  };

  return (
    <>
      <ConsoleErrorSuppressor />
      {showLoader && (
        <div className={`fixed inset-0 z-50 ${fadeOut ? "fade-out" : ""}`}>
          <Loader onComplete={handleLoaderComplete} />
        </div>
      )}
      <div className={showLoader ? "opacity-0" : "opacity-100 transition-opacity duration-500"}>
        {children}
      </div>
    </>
  );
}
