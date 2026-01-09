import { NextResponse } from 'next/server';

// Whitelist subdomain configuration
const WHITELIST_URL = 'https://whitelist.protardio.xyz';

// Whitelist account association (from Farcaster - for whitelist.protardio.xyz)
const WHITELIST_ACCOUNT_ASSOCIATION = {
  header: "eyJmaWQiOjExMTgzNzAsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg0RTE1ZTI1MDRmOGQ1NkE2NjhFRTQyRWYwNTg4MGMxQTJhNjRkNEIwIn0",
  payload: "eyJkb21haW4iOiJ3aGl0ZWxpc3QucHJvdGFyZGlvLnh5eiJ9",
  signature: "zU1fg5355KEu2cAxb38GakREdKDJYYWSct1adkhZn2Fs9Os3O/9YcDmZfIQrdBZnuafoGvAyLE5vvHBCBA3tPBs="
};

export async function GET() {
  const manifest = {
    accountAssociation: WHITELIST_ACCOUNT_ASSOCIATION,
    frame: {
      version: '1',
      name: 'Protardio Whitelist',
      iconUrl: `${WHITELIST_URL}/whitelist/logo.png`,
      splashImageUrl: `${WHITELIST_URL}/whitelist/splash.gif`,
      splashBackgroundColor: '#0a0a0a',
      homeUrl: WHITELIST_URL,
    },
  };

  return NextResponse.json(manifest);
}
