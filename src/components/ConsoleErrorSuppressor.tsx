'use client';

import { useEffect } from 'react';

/**
 * Suppresses known console errors from third-party libraries that are noise.
 * Currently suppresses:
 * - useInsertionEffect warning from @neynar/react (React 19 incompatibility)
 */
export function ConsoleErrorSuppressor() {
  useEffect(() => {
    const originalError = console.error;
    
    console.error = (...args: unknown[]) => {
      // Suppress useInsertionEffect warning from Neynar
      const message = args[0]?.toString?.() || '';
      if (message.includes('useInsertionEffect must not schedule updates')) {
        return; // Suppress this specific error
      }
      
      // Pass through all other errors
      originalError.apply(console, args);
    };
    
    return () => {
      console.error = originalError;
    };
  }, []);

  return null;
}
