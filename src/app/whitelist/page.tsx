import { Metadata } from 'next';
import ClientWhitelistPage from './client';

export const revalidate = 300;

const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://whitelist.protardio.xyz';

export async function generateMetadata(): Promise<Metadata> {
  const frame = {
    version: "next",
    imageUrl: `${APP_URL}/whitelist/og-image`,
    button: {
      title: "join the wartime effort!",
      action: {
        type: "launch_frame",
        name: "Protardio Whitelist",
        url: "https://whitelist.protardio.xyz",
        splashImageUrl: `${APP_URL}/whitelist/splash.gif`,
        splashBackgroundColor: "#0a0a0a",
      },
    },
  };

  return {
    title: "Protardio Whitelist - Phase 1 Tier 3",
    description: "Register for the Protardio Phase 1 Tier 3 allowlist. 10,000 wartime farcaster pfps.",
    openGraph: {
      title: "Protardio Whitelist - Phase 1 Tier 3",
      description: "Register for the Protardio Phase 1 Tier 3 allowlist. 10,000 wartime farcaster pfps.",
      images: [{ url: `${APP_URL}/whitelist/og-image` }],
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default function WhitelistPage() {
  return <ClientWhitelistPage />;
}
