'use client';

import type { VerificationState } from '~/types/whitelist';

interface StatusIndicatorProps {
  state: VerificationState;
  label: string;
  value?: string;
  failMessage?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export function StatusIndicator({ 
  state, 
  label, 
  value, 
  failMessage, 
  onAction, 
  actionLabel 
}: StatusIndicatorProps) {
  return (
    <div className={`
      border-2 bg-black/60 p-3 mb-3 transition-all duration-300
      ${state === 'passed' ? 'border-protardio-green/60' : state === 'failed' ? 'border-red-500/60' : 'border-protardio-green/20'}
    `}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-protardio-green font-mono text-xs sm:text-sm uppercase tracking-wider flex-shrink-0">
          {label}
        </span>
        <div className="flex items-center gap-2 min-w-0">
          {state === 'idle' && (
            <span className="text-gray-500 font-mono text-[10px] sm:text-xs truncate">
              [ PENDING ]
            </span>
          )}
          {state === 'checking' && (
            <span className="text-yellow-400 font-mono text-[10px] sm:text-xs animate-pulse truncate">
              [ SCANNING... ]
            </span>
          )}
          {state === 'passed' && (
            <div className="flex items-center gap-1 sm:gap-2">
              {value && (
                <span className="text-protardio-green font-mono text-[10px] sm:text-xs">
                  {value}
                </span>
              )}
              <span className="text-protardio-green font-mono text-[10px] sm:text-xs">
                [ ✓ ]
              </span>
            </div>
          )}
          {state === 'failed' && (
            <span className="text-red-500 font-mono text-[10px] sm:text-xs">
              [ ✗ FAILED ]
            </span>
          )}
        </div>
      </div>
      {state === 'failed' && failMessage && (
        <div className="mt-2">
          <p className="text-red-400 font-mono text-[10px] sm:text-xs">{failMessage}</p>
          {onAction && (
            <button
              onClick={onAction}
              className="mt-2 px-3 py-1.5 border border-red-500 text-red-400 font-mono text-[10px] uppercase hover:bg-red-500 hover:text-black transition-all active:scale-95"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
