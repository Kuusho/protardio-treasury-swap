'use client';

import dynamic from 'next/dynamic';

const WhitelistApp = dynamic(
  () => import('./WhitelistApp').then((mod) => mod.WhitelistApp),
  { ssr: false }
);

export default function ClientWhitelistPage() {
  return <WhitelistApp />;
}
