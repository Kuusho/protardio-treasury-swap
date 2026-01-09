import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '~/lib/whitelist-supabase';

interface NFTAttribute {
  trait_type: string;
  value: string;
}

interface ProtardioWithTraits {
  token_id: number;
  name: string;
  image_url: string;
  minter_fid: number | null;
  minter_username: string | null;
  attributes: NFTAttribute[] | null;
}

interface TraitRarityMap {
  [traitKey: string]: {
    count: number;
    tokens: Array<{
      tokenId: number;
      ownerUsername?: string;
      imageUrl: string;
    }>;
  };
}

/**
 * Parse attributes from database - handles both array and JSON string formats
 */
function parseAttributes(attributes: unknown): NFTAttribute[] | null {
  if (!attributes) return null;
  
  // If it's already an array, return it
  if (Array.isArray(attributes)) {
    return attributes as NFTAttribute[];
  }
  
  // If it's a string, try to parse it as JSON
  if (typeof attributes === 'string') {
    try {
      const parsed = JSON.parse(attributes);
      if (Array.isArray(parsed)) {
        return parsed as NFTAttribute[];
      }
    } catch (e) {
      console.error('Failed to parse attributes JSON:', e);
    }
  }
  
  return null;
}

/**
 * GET /api/trait-twins?tokenId=42
 * 
 * Find trait twins for a given Protardio NFT.
 * Returns tokens with similar traits, weighted by rarity.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenIdParam = searchParams.get('tokenId');

  if (!tokenIdParam) {
    return NextResponse.json(
      { error: 'tokenId is required' },
      { status: 400 }
    );
  }

  const tokenId = parseInt(tokenIdParam);
  if (isNaN(tokenId)) {
    return NextResponse.json(
      { error: 'Invalid tokenId' },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerClient();

    // Fetch ALL protardios with attributes (limit set to 5000 in Supabase config)
    const { data: allProtardios, error } = await supabase
      .from('protardio_mints')
      .select('token_id, name, image_url, minter_fid, minter_username, attributes')
      .not('attributes', 'is', null)
      .limit(5000);

    if (error) {
      console.error('Failed to fetch protardios:', error);
      return NextResponse.json(
        { error: 'Failed to fetch protardios' },
        { status: 500 }
      );
    }

    console.log(`🔍 Trait Twins: Scanning ${allProtardios?.length || 0} protardios with attributes`);

    // Find the target token
    const targetTokenRaw = allProtardios?.find(p => p.token_id === tokenId);
    const targetAttrs = parseAttributes(targetTokenRaw?.attributes);

    if (!targetTokenRaw || !targetAttrs) {
      return NextResponse.json(
        { error: 'Token not found or has no attributes' },
        { status: 404 }
      );
    }

    const protardios = (allProtardios || []);
    const totalCount = protardios.length;

    // Build trait rarity map
    const traitRarityMap: TraitRarityMap = {};
    
    for (const p of protardios) {
      const attrs = parseAttributes(p.attributes);
      if (!attrs) continue;
      
      for (const attr of attrs) {
        const key = `${attr.trait_type}:${attr.value}`;
        if (!traitRarityMap[key]) {
          traitRarityMap[key] = { count: 0, tokens: [] };
        }
        traitRarityMap[key].count++;
        traitRarityMap[key].tokens.push({
          tokenId: p.token_id,
          ownerUsername: p.minter_username || undefined,
          imageUrl: p.image_url,
        });
      }
    }

    // Calculate rarity for target token's traits
    const yourTraits = targetAttrs.map(attr => {
      const key = `${attr.trait_type}:${attr.value}`;
      const data = traitRarityMap[key] || { count: 1, tokens: [] };
      return {
        trait_type: attr.trait_type,
        value: attr.value,
        rarity: data.count / totalCount,
        holderCount: data.count,
      };
    });

    // Find rarest trait
    const sortedTraits = [...yourTraits].sort((a, b) => a.holderCount - b.holderCount);
    const rarestTrait = sortedTraits[0];
    const rarestTraitKey = `${rarestTrait.trait_type}:${rarestTrait.value}`;
    const rarestTraitData = traitRarityMap[rarestTraitKey];

    // Compare with other tokens and calculate similarity
    const targetTraitKeys = new Set(
      targetAttrs.map(attr => `${attr.trait_type}:${attr.value}`)
    );
    const totalTraitCount = targetAttrs.length;

    interface ScoredToken {
      tokenId: number;
      name: string;
      imageUrl: string;
      ownerFid?: number;
      ownerUsername?: string;
      matchScore: number;
      matchingTraits: string[];
      totalTraits: number;
    }

    const scoredTokens: ScoredToken[] = [];

    for (const p of protardios) {
      const pAttrs = parseAttributes(p.attributes);
      if (p.token_id === tokenId || !pAttrs) continue;

      const matchingTraits: string[] = [];
      let weightedScore = 0;

      for (const attr of pAttrs) {
        const key = `${attr.trait_type}:${attr.value}`;
        if (targetTraitKeys.has(key)) {
          matchingTraits.push(attr.value);
          // Weight by rarity - rarer traits = more points
          const rarity = (traitRarityMap[key]?.count || 1) / totalCount;
          // Inverse of rarity gives more weight to rare traits
          weightedScore += (1 - rarity);
        }
      }

      if (matchingTraits.length > 0) {
        // Normalize score to 0-1 based on max possible score
        const maxScore = yourTraits.reduce((sum, t) => sum + (1 - t.rarity), 0);
        const normalizedScore = maxScore > 0 ? weightedScore / maxScore : 0;

        scoredTokens.push({
          tokenId: p.token_id,
          name: p.name,
          imageUrl: p.image_url,
          ownerFid: p.minter_fid || undefined,
          ownerUsername: p.minter_username || undefined,
          matchScore: normalizedScore,
          matchingTraits,
          totalTraits: totalTraitCount,
        });
      }
    }

    // Sort by match score (highest first), then by number of matching traits
    scoredTokens.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return b.matchingTraits.length - a.matchingTraits.length;
    });

    // Categorize twins - use lower thresholds since weighted scoring is strict
    // Also consider raw trait matches as fallback
    const exactTwins = scoredTokens.filter(t => t.matchScore >= 0.85 || t.matchingTraits.length >= 8);
    const closeTwins = scoredTokens.filter(t => 
      (t.matchScore >= 0.5 && t.matchScore < 0.85) || 
      (t.matchingTraits.length >= 4 && t.matchingTraits.length < 8)
    ).slice(0, 5);
    let traitSiblings = scoredTokens.filter(t => 
      (t.matchScore >= 0.2 && t.matchScore < 0.5) || 
      (t.matchingTraits.length >= 2 && t.matchingTraits.length < 4)
    ).slice(0, 10);

    // If still no matches, just show anyone with 1+ matching traits
    if (exactTwins.length === 0 && closeTwins.length === 0 && traitSiblings.length === 0) {
      traitSiblings = scoredTokens.filter(t => t.matchingTraits.length >= 1).slice(0, 10);
    }

    console.log(`🔍 Trait Twins for token #${tokenId}: ${exactTwins.length} exact, ${closeTwins.length} close, ${traitSiblings.length} siblings`);

    return NextResponse.json({
      yourToken: {
        tokenId: targetTokenRaw.token_id,
        name: targetTokenRaw.name,
        imageUrl: targetTokenRaw.image_url,
      },
      yourTraits,
      exactTwins,
      closeTwins,
      traitSiblings,
      rarestTrait: rarestTrait ? {
        trait_type: rarestTrait.trait_type,
        value: rarestTrait.value,
        holderCount: rarestTrait.holderCount,
        otherHolders: rarestTraitData?.tokens
          .filter(t => t.tokenId !== tokenId)
          .slice(0, 5) || [],
      } : null,
      totalProtardios: totalCount,
    });

  } catch (error) {
    console.error('Error in /api/trait-twins:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
