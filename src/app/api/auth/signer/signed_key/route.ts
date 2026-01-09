import { NextResponse } from 'next/server';
import { getNeynarClient } from '~/lib/neynar';
import { mnemonicToAccount } from 'viem/accounts';
import {
  SIGNED_KEY_REQUEST_TYPE,
  SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
} from '~/lib/constants';

const postRequiredFields = ['signerUuid', 'publicKey'];

export async function POST(request: Request) {
  const body = await request.json();

  // Validate required fields
  for (const field of postRequiredFields) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `${field} is required` },
        { status: 400 }
      );
    }
  }

  const { signerUuid, publicKey, redirectUrl } = body;

  if (redirectUrl && typeof redirectUrl !== 'string') {
    return NextResponse.json(
      { error: 'redirectUrl must be a string' },
      { status: 400 }
    );
  }

  try {
    // Get the app's account from seed phrase
    const seedPhrase = process.env.SEED_PHRASE;
    const shouldSponsor = process.env.SPONSOR_SIGNER === 'true';

    if (!seedPhrase) {
      console.error('❌ SEED_PHRASE not configured');
      return NextResponse.json(
        { error: 'App configuration missing (SEED_PHRASE)' },
        { status: 500 }
      );
    }

    console.log('🔑 Creating account from seed phrase...');
    const neynarClient = getNeynarClient();
    const account = mnemonicToAccount(seedPhrase);
    console.log('✅ Account address:', account.address);

    console.log('🔍 Looking up FID for custody address...');
    const lookupResult = await neynarClient.lookupUserByCustodyAddress({
      custodyAddress: account.address,
    });

    const appFid = lookupResult.user.fid;
    console.log('✅ App FID:', appFid);

    // Generate deadline (24 hours from now)
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    console.log('📝 Deadline:', deadline);
    console.log('📝 Public key:', publicKey);

    // Generate EIP-712 signature
    console.log('✍️ Signing typed data...');
    const signature = await account.signTypedData({
      domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
      types: {
        SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
      },
      primaryType: 'SignedKeyRequest',
      message: {
        requestFid: BigInt(appFid),
        key: publicKey,
        deadline: BigInt(deadline),
      },
    });
    console.log('✅ Signature generated');

    console.log('📤 Registering signed key with Neynar...');
    console.log('   signerUuid:', signerUuid);
    console.log('   appFid:', appFid);
    console.log('   shouldSponsor:', shouldSponsor);

    const signer = await neynarClient.registerSignedKey({
      appFid,
      deadline,
      signature,
      signerUuid,
      ...(redirectUrl && { redirectUrl }),
      ...(shouldSponsor && { sponsor: { sponsored_by_neynar: true } }),
    });

    console.log('✅ Signer registered:', signer);
    return NextResponse.json(signer);
  } catch (error: any) {
    console.error('❌ Error registering signed key:', error);
    console.error('   Error message:', error?.message);
    console.error('   Error response:', error?.response?.data);
    return NextResponse.json(
      { error: 'Failed to register signed key', details: error?.message },
      { status: 500 }
    );
  }
}
