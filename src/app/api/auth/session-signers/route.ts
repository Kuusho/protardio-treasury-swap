import { NextResponse } from 'next/server';
import { getNeynarClient } from '~/lib/neynar';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const message = searchParams.get('message');
    const signature = searchParams.get('signature');

    if (!message || !signature) {
      return NextResponse.json(
        { error: 'Message and signature are required' },
        { status: 400 }
      );
    }

    console.log('📝 Fetching signers with message length:', message.length);
    console.log('📝 Signature:', signature.substring(0, 20) + '...');

    const client = getNeynarClient();

    let signers: any[] = [];
    let user = null;

    try {
      const data = await client.fetchSigners({ message, signature });
      signers = data.signers || [];
      console.log('✅ Found signers:', signers.length);
    } catch (fetchError: any) {
      // If no signers exist yet, this might throw - that's okay
      console.log('⚠️ fetchSigners error (may be expected if no signers):', fetchError?.message || fetchError);
      // Return empty signers instead of failing
      signers = [];
    }

    // Fetch user data if signers exist
    if (signers && signers.length > 0 && signers[0].fid) {
      const {
        users: [fetchedUser],
      } = await client.fetchBulkUsers({
        fids: [signers[0].fid],
      });
      user = fetchedUser;
    }

    return NextResponse.json({
      signers,
      user,
    });
  } catch (error: any) {
    console.error('Error in session-signers API:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to fetch signers', details: error?.message },
      { status: 500 }
    );
  }
}
