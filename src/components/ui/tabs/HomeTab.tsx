"use client";

import { DiscordVerification } from '~/components/DiscordVerification';

/**
 * HomeTab component displays the main landing content for the mini app.
 *
 * This is the default tab that users see when they first open the mini app.
 * It provides Discord linking and other holder-specific content.
 *
 * @example
 * ```tsx
 * <HomeTab />
 * ```
 */
export function HomeTab() {
  return (
    <div className="flex flex-col gap-6 px-6 py-4">
      <div className="w-full max-w-md mx-auto">
        {/* Discord Link */}
        <DiscordVerification />
      </div>
    </div>
  );
} 