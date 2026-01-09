import { NextResponse } from 'next/server';

/**
 * GET /api/listings
 * 
 * Fetches active OpenSea listings for the Protardio collection.
 * Returns a map of tokenId -> listing info for easy lookup.
 * 
 * Query params:
 * - limit: Max listings to fetch (default: 100, max: 100)
 */

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const COLLECTION_SLUG = 'protardio-citizens';
const CONTRACT_ADDRESS = '0x5d38451841Ee7A2E824A88AFE47b00402157b08d';

interface OpenSeaListing {
  order_hash: string;
  chain: string;
  type: string;
  price: {
    current: {
      currency: string;
      decimals: number;
      value: string;
    };
  };
  protocol_data: {
    parameters: {
      offer: Array<{
        token: string;
        identifierOrCriteria: string;
      }>;
    };
  };
}

interface OpenSeaListingsResponse {
  listings: OpenSeaListing[];
  next?: string;
}

export interface ListingInfo {
  tokenId: number;
  price: string;
  priceWei: string;
  currency: string;
  orderHash: string;
  openseaUrl: string;
}

// Cache listings for 2 minutes to avoid hitting rate limits
let listingsCache: { data: Map<number, ListingInfo>; timestamp: number } | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

async function fetchAllListings(): Promise<Map<number, ListingInfo>> {
  if (!OPENSEA_API_KEY) {
    console.warn('⚠️ OPENSEA_API_KEY not configured');
    return new Map();
  }

  // Check cache
  if (listingsCache && Date.now() - listingsCache.timestamp < CACHE_TTL_MS) {
    console.log('📦 Using cached listings data');
    return listingsCache.data;
  }

  const listings = new Map<number, ListingInfo>();
  let cursor: string | undefined;
  let pageCount = 0;
  const maxPages = 10; // Safety limit

  try {
    do {
      const url = new URL(`https://api.opensea.io/api/v2/listings/collection/${COLLECTION_SLUG}/all`);
      url.searchParams.set('limit', '100');
      if (cursor) {
        url.searchParams.set('next', cursor);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'x-api-key': OPENSEA_API_KEY,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenSea API error:', response.status, errorText);
        break;
      }

      const data: OpenSeaListingsResponse = await response.json();
      
      // Process listings
      for (const listing of data.listings || []) {
        try {
          // Extract token ID from the offer
          const offer = listing.protocol_data?.parameters?.offer?.[0];
          if (!offer) continue;

          const tokenId = parseInt(offer.identifierOrCriteria);
          if (isNaN(tokenId)) continue;

          // Parse price
          const priceData = listing.price?.current;
          if (!priceData) continue;

          const priceWei = priceData.value;
          const decimals = priceData.decimals || 18;
          const priceNum = parseFloat(priceWei) / Math.pow(10, decimals);
          const priceFormatted = priceNum.toFixed(4).replace(/\.?0+$/, '');

          listings.set(tokenId, {
            tokenId,
            price: priceFormatted,
            priceWei,
            currency: priceData.currency || 'ETH',
            orderHash: listing.order_hash,
            openseaUrl: `https://opensea.io/assets/base/${CONTRACT_ADDRESS}/${tokenId}`,
          });
        } catch (e) {
          // Skip malformed listings
          continue;
        }
      }

      cursor = data.next;
      pageCount++;
    } while (cursor && pageCount < maxPages);

    console.log(`🏷️ Fetched ${listings.size} active listings from OpenSea (${pageCount} pages)`);

    // Update cache
    listingsCache = { data: listings, timestamp: Date.now() };

    return listings;
  } catch (error) {
    console.error('Error fetching OpenSea listings:', error);
    return listings;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenIds = searchParams.get('tokenIds'); // Optional: comma-separated list of token IDs to check

  try {
    const allListings = await fetchAllListings();

    // If specific token IDs requested, filter
    if (tokenIds) {
      const ids = tokenIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      const filtered: Record<number, ListingInfo> = {};
      for (const id of ids) {
        const listing = allListings.get(id);
        if (listing) {
          filtered[id] = listing;
        }
      }
      return NextResponse.json({
        listings: filtered,
        totalListings: allListings.size,
      });
    }

    // Return all listings as an object keyed by tokenId
    const listingsObject: Record<number, ListingInfo> = {};
    allListings.forEach((listing, tokenId) => {
      listingsObject[tokenId] = listing;
    });

    return NextResponse.json({
      listings: listingsObject,
      totalListings: allListings.size,
      listedTokenIds: Array.from(allListings.keys()).sort((a, b) => a - b),
    });
  } catch (error) {
    console.error('Error in /api/listings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}
