import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  async redirects() {
    return [
      // Main domain: protardio.xyz → existing hosted manifest
      {
        source: '/.well-known/farcaster.json',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/019ae79c-8b9f-e307-e1b5-af2e20c3cb6f',
        permanent: false,
        has: [
          {
            type: 'host',
            value: 'protardio.xyz',
          },
        ],
      },
      // Main domain with www
      {
        source: '/.well-known/farcaster.json',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/019ae79c-8b9f-e307-e1b5-af2e20c3cb6f',
        permanent: false,
        has: [
          {
            type: 'host',
            value: 'www.protardio.xyz',
          },
        ],
      },
      // Vercel preview URL for main app
      {
        source: '/.well-known/farcaster.json',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/019ae79c-8b9f-e307-e1b5-af2e20c3cb6f',
        permanent: false,
        has: [
          {
            type: 'host',
            value: 'protardio.vercel.app',
          },
        ],
      },
      // Whitelist subdomain: serve static manifest file
      {
        source: '/.well-known/farcaster.json',
        destination: '/whitelist-farcaster.json',
        permanent: false,
        has: [
          {
            type: 'host',
            value: 'whitelist.protardio.xyz',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
