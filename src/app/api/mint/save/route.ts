import { NextRequest, NextResponse } from 'next/server';
import { NFT_CONFIG, SCATTER_CONFIG } from '~/lib/nft-config';
import { createServerClient } from '~/lib/whitelist-supabase';

const SCATTER_API_URL = SCATTER_CONFIG.apiUrl;
const COLLECTION_SLUG = SCATTER_CONFIG.collectionSlug;

// Max polling time: 2 minutes (safe for serverless)
const MAX_POLL_TIME_MS = 120000;
const POLL_INTERVAL_MS = 5000;

interface MintSaveRequest {
  tokenId: number;
  minterFid: number;
  minterWallet: string;
  minterUsername?: string;
  txHash: string;
}

/**
 * POST /api/mint/save
 * 
 * Server-side mint save with IMMEDIATE save + background metadata update.
 * 
 * NEW FLOW (never loses a mint):
 * 1. IMMEDIATELY save basic data (tokenId, minter, txHash) with metadata_status: 'pending'
 * 2. Then poll Scatter API for metadata
 * 3. Update the record with full metadata when available
 * 
 * This ensures we never lose a mint, even if:
 * - User closes the app
 * - Scatter API is slow
 * - Metadata polling times out
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  
  try {
    const body: MintSaveRequest = await request.json();
    const { tokenId, minterFid, minterWallet, minterUsername, txHash } = body;

    console.log(`🎯 [MintSave] Starting server-side save for token #${tokenId}`);
    console.log(`   minterFid: ${minterFid}, wallet: ${minterWallet}`);

    // Validate required fields
    if (tokenId === undefined || tokenId === null) {
      return NextResponse.json(
        { error: 'tokenId is required' },
        { status: 400 }
      );
    }

    if (!minterFid || !minterWallet || !txHash) {
      return NextResponse.json(
        { error: 'Missing required fields: minterFid, minterWallet, txHash' },
        { status: 400 }
      );
    }

    // Check if this token already exists with real metadata
    const { data: existing } = await supabase
      .from('protardio_mints')
      .select('id, token_id, image_url, metadata_status')
      .eq('token_id', tokenId)
      .single();

    if (existing && existing.image_url && existing.metadata_status === 'complete') {
      // Token already saved with real metadata
      console.log(`✅ [MintSave] Token #${tokenId} already exists with complete metadata, skipping`);
      return NextResponse.json({
        success: true,
        message: 'Mint already saved with metadata',
        alreadyExists: true,
        data: existing,
      });
    }

    // ========================================
    // STEP 1: IMMEDIATELY save basic data
    // ========================================
    console.log(`💾 [MintSave] IMMEDIATELY saving basic data for token #${tokenId}...`);
    
    const { data: savedRecord, error: saveError } = await supabase
      .from('protardio_mints')
      .upsert({
        token_id: tokenId,
        name: `Protardio #${tokenId}`,
        image_url: null, // Will be updated when metadata is available
        thumbnail_url: null,
        attributes: null,
        minter_fid: minterFid,
        minter_wallet: minterWallet.toLowerCase(),
        minter_username: minterUsername || null,
        tx_hash: txHash,
        minted_at: new Date().toISOString(),
        metadata_status: 'pending', // Track metadata status
      }, {
        onConflict: 'token_id',
      })
      .select()
      .single();

    if (saveError) {
      console.error(`❌ [MintSave] Failed to save basic data:`, saveError);
      return NextResponse.json(
        { error: 'Failed to save mint', details: saveError.message },
        { status: 500 }
      );
    }

    console.log(`✅ [MintSave] Basic data saved for token #${tokenId}! Now polling for metadata...`);

    // ========================================
    // STEP 2: Poll for metadata and update
    // ========================================
    const startTime = Date.now();
    let nftWithMetadata = null;
    let pollAttempt = 0;

    while (Date.now() - startTime < MAX_POLL_TIME_MS) {
      pollAttempt++;
      console.log(`🔄 [MintSave] Poll attempt ${pollAttempt} for token #${tokenId}...`);

      try {
        // Fetch NFTs for the minter's wallet
        const response = await fetch(
          `${SCATTER_API_URL}/collection/${COLLECTION_SLUG}/nfts?ownerAddress=${minterWallet}`
        );
        
        if (!response.ok) {
          console.warn(`⚠️ [MintSave] Scatter API returned ${response.status}`);
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
          continue;
        }

        const result = await response.json();
        
        // Find our specific token
        const targetNft = result.data?.find((nft: any) => Number(nft.token_id) === tokenId);
        
        if (targetNft) {
          const hasMetadata = !!(targetNft.image_url || targetNft.image);
          console.log(`📦 [MintSave] Found token #${tokenId}: hasMetadata=${hasMetadata}`);

          // Check if metadata is available (real image URL)
          if (targetNft.image_url || targetNft.image) {
            nftWithMetadata = targetNft;
            console.log(`✅ [MintSave] Metadata available for token #${tokenId}!`);
            console.log(`   image_url: ${targetNft.image_url}`);
            console.log(`   name: ${targetNft.name}`);
            console.log(`   attributes:`, targetNft.attributes || 'none');
            break;
          }
        } else {
          console.log(`🔍 [MintSave] Token #${tokenId} not found in Scatter response (${result.data?.length || 0} NFTs)`);
        }
      } catch (fetchError) {
        console.error(`❌ [MintSave] Fetch error:`, fetchError);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    // ========================================
    // STEP 3: Update record with metadata (or mark as failed)
    // ========================================
    if (nftWithMetadata) {
      const nftName = nftWithMetadata.name || `Protardio #${tokenId}`;
      const imageUrl = nftWithMetadata.image_url || nftWithMetadata.image;
      const thumbnailUrl = nftWithMetadata.thumbnail_url || nftWithMetadata.image_url || null;
      const attributes = nftWithMetadata.attributes || null;

      console.log(`💾 [MintSave] Updating with full metadata:`, {
        tokenId,
        name: nftName,
        imageUrl,
        attributesCount: attributes?.length || 0,
      });

      const { data: updatedRecord, error: updateError } = await supabase
        .from('protardio_mints')
        .update({
          name: nftName,
          image_url: imageUrl,
          thumbnail_url: thumbnailUrl,
          attributes: attributes,
          metadata_status: 'complete',
        })
        .eq('token_id', tokenId)
        .select()
        .single();

      if (updateError) {
        console.error(`❌ [MintSave] Failed to update metadata:`, updateError);
        // Still return success since basic data was saved
        return NextResponse.json({
          success: true,
          message: 'Basic data saved, but failed to update metadata',
          tokenId,
          metadataStatus: 'pending',
          data: savedRecord,
        });
      }

      console.log(`✅ [MintSave] Successfully saved token #${tokenId} with COMPLETE metadata!`);

      return NextResponse.json({
        success: true,
        tokenId,
        name: nftName,
        imageUrl,
        thumbnailUrl,
        metadataStatus: 'complete',
        data: updatedRecord,
      });
    } else {
      // Metadata polling timed out - but basic data is saved!
      console.warn(`⚠️ [MintSave] Metadata timeout for token #${tokenId}, but basic data IS SAVED`);
      
      // Update status to indicate retry needed
      await supabase
        .from('protardio_mints')
        .update({ metadata_status: 'retry_needed' })
        .eq('token_id', tokenId);

      return NextResponse.json({
        success: true, // Still success because basic data is saved!
        message: 'Mint saved with pending metadata. Sync job will retry later.',
        tokenId,
        metadataStatus: 'retry_needed',
        pollAttempts: pollAttempt,
        data: savedRecord,
      });
    }

  } catch (error) {
    console.error('❌ [MintSave] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mint/save
 * Health check / info endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/mint/save',
    method: 'POST',
    description: 'Save mint data with IMMEDIATE save + background metadata polling',
    requiredFields: ['tokenId', 'minterFid', 'minterWallet', 'txHash'],
    optionalFields: ['minterUsername'],
    behavior: 'Immediately saves basic data, then polls Scatter API for metadata (max 2 minutes). Never loses a mint.',
    metadataStatuses: ['pending', 'complete', 'retry_needed'],
  });
}
