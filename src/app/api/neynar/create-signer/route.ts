import { NextResponse } from 'next/server';

// POST /api/neynar/create-signer
// Creates a new managed signer for a user
export async function POST(request: Request) {
  try {
    const apiKey = process.env.NEYNAR_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Neynar API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { fid } = body;

    if (!fid) {
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    // Create a new managed signer via Neynar API
    const response = await fetch('https://api.neynar.com/v2/farcaster/signer', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      // Note: Neynar's managed signers don't require fid to create,
      // but we log it for debugging
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Neynar create signer error:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Failed to create signer' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    console.log(`🔑 Created signer for FID ${fid}:`, data.signer_uuid);

    return NextResponse.json({
      signer_uuid: data.signer_uuid,
      public_key: data.public_key,
      signer_approval_url: data.signer_approval_url,
      status: data.status,
    });

  } catch (error) {
    console.error('Create signer error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
