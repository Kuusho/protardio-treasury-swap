import { NextResponse } from 'next/server';

// POST /api/neynar/update-pfp
// Updates user's Farcaster PFP using an approved signer
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
    const { signer_uuid, pfp_url } = body;

    if (!signer_uuid) {
      return NextResponse.json(
        { error: 'signer_uuid is required' },
        { status: 400 }
      );
    }

    if (!pfp_url) {
      return NextResponse.json(
        { error: 'pfp_url is required' },
        { status: 400 }
      );
    }

    // Update user profile via Neynar API
    const response = await fetch('https://api.neynar.com/v2/farcaster/user', {
      method: 'PATCH',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        signer_uuid,
        pfp_url,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Neynar update PFP error:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Failed to update PFP' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    console.log('✅ PFP updated successfully:', pfp_url);

    return NextResponse.json({
      success: true,
      user: data,
    });

  } catch (error) {
    console.error('Update PFP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
