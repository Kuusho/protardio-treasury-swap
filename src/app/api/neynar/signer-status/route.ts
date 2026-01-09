import { NextRequest, NextResponse } from 'next/server';

// GET /api/neynar/signer-status?signer_uuid=xxx
// Checks the approval status of a managed signer
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.NEYNAR_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Neynar API key not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const signerUuid = searchParams.get('signer_uuid');

    if (!signerUuid) {
      return NextResponse.json(
        { error: 'signer_uuid is required' },
        { status: 400 }
      );
    }

    // Check signer status via Neynar API
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/signer?signer_uuid=${signerUuid}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Neynar signer status error:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Failed to get signer status' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      signer_uuid: data.signer_uuid,
      status: data.status, // 'pending_approval' | 'approved' | 'revoked'
      fid: data.fid, // Will be populated after approval
    });

  } catch (error) {
    console.error('Signer status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
