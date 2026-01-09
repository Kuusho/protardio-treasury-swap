import { NextRequest, NextResponse } from 'next/server';
import { getFarcasterDomainManifest } from '~/lib/utils';

// Whitelist subdomain configuration
const WHITELIST_URL = 'https://whitelist.protardio.xyz';

// Whitelist account association (from Farcaster - for whitelist.protardio.xyz)
const WHITELIST_ACCOUNT_ASSOCIATION = {
  header: "eyJmaWQiOjExMTgzNzAsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg0RTE1ZTI1MDRmOGQ1NkE2NjhFRTQyRWYwNTg4MGMxQTJhNjRkNEIwIn0",
  payload: "eyJkb21haW4iOiJ3aGl0ZWxpc3QucHJvdGFyZGlvLnh5eiJ9",
  signature: "zU1fg5355KEu2cAxb38GakREdKDJYYWSct1adkhZn2Fs9Os3O"
};

function getWhitelistManifest() {
  return {
    accountAssociation: WHITELIST_ACCOUNT_ASSOCIATION,
    frame: {
      version: '1',
      name: 'Protardio Whitelist',
      iconUrl: `${WHITELIST_URL}/whitelist/logo.png`,
      splashImageUrl: `${WHITELIST_URL}/whitelist/splash.gif`,
      splashBackgroundColor: '#f7f7f7',
      homeUrl: WHITELIST_URL,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const host = request.headers.get('host') || '';
    
    // Check if this is the whitelist subdomain
    if (host.includes('whitelist.')) {
      const config = getWhitelistManifest();
      return NextResponse.json(config);
    }
    
    // Default: main domain config
    const config = await getFarcasterDomainManifest();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error generating metadata:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
