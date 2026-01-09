import { NextResponse } from 'next/server';
import { createServerClient } from '~/lib/whitelist-supabase';

interface NFTAttribute {
  trait_type: string;
  value: string;
}

/**
 * Parse attributes from database - handles both array and JSON string formats
 */
function parseAttributes(attributes: unknown): NFTAttribute[] | null {
  if (!attributes) return null;
  
  if (Array.isArray(attributes)) {
    return attributes as NFTAttribute[];
  }
  
  if (typeof attributes === 'string') {
    try {
      const parsed = JSON.parse(attributes);
      if (Array.isArray(parsed)) return parsed as NFTAttribute[];
    } catch (e) {
      console.error('Failed to parse attributes JSON:', e);
    }
  }
  
  return null;
}

/**
 * GET /api/gallery/all
 * 
 * Fetches all minted Protardios from the database.
 * Supports pagination with page and pageSize query params.
 * Supports filtering by trait type (e.g., filter=pet to show only NFTs with a "pet" trait)
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 100, max: 100)
 * - filter: Comma-separated trait types to filter by (e.g., "pet,hat,skin")
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  // Allow higher pageSize for internal filtering (e.g., for-sale filter needs all NFTs)
  const pageSize = Math.min(5000, Math.max(1, parseInt(searchParams.get('pageSize') || '100')));
  const filterParam = searchParams.get('filter') || '';
  const filters = filterParam.split(',').map(f => f.trim()).filter(Boolean);
  
  try {
    const supabase = createServerClient();

    // If filters are applied, we need to fetch all with attributes and filter in memory
    // because Supabase doesn't support JSON array searching easily
    if (filters.length > 0) {
      // Fetch all items with attributes for filtering
      const { data: allItems, error: itemsError } = await supabase
        .from('protardio_mints')
        .select('token_id, name, image_url, thumbnail_url, minter_fid, minter_username, minted_at, attributes')
        .not('attributes', 'is', null)
        .order('minted_at', { ascending: false })
        .limit(5000);

      if (itemsError) {
        console.error('Failed to fetch gallery:', itemsError);
        return NextResponse.json(
          { error: 'Failed to fetch gallery' },
          { status: 500 }
        );
      }

      // Filter items that have matching trait types
      const filteredItems = (allItems || []).filter(item => {
        const attrs = parseAttributes(item.attributes);
        if (!attrs) return false;
        
        // Check if the NFT has ALL the required trait types (case-insensitive)
        const traitTypes = attrs.map(a => a.trait_type.toLowerCase());
        return filters.every(filter => traitTypes.includes(filter.toLowerCase()));
      });

      const total = filteredItems.length;
      const offset = (page - 1) * pageSize;
      const paginatedItems = filteredItems.slice(offset, offset + pageSize);
      const hasMore = offset + pageSize < total;

      console.log(`📸 Gallery (filtered by ${filters.join(', ')}): Returning ${paginatedItems.length} items (page ${page}, total ${total})`);

      return NextResponse.json({
        items: paginatedItems.map(item => ({
          ...item,
          attributes: parseAttributes(item.attributes),
        })),
        total,
        page,
        pageSize,
        hasMore,
        totalPages: Math.ceil(total / pageSize),
        activeFilters: filters,
      });
    }

    // No filters - use standard pagination
    const offset = (page - 1) * pageSize;

    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('protardio_mints')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Failed to get count:', countError);
      return NextResponse.json(
        { error: 'Failed to fetch gallery count' },
        { status: 500 }
      );
    }

    // Get paginated items
    const { data: items, error: itemsError } = await supabase
      .from('protardio_mints')
      .select('token_id, name, image_url, thumbnail_url, minter_fid, minter_username, minted_at, attributes')
      .order('minted_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (itemsError) {
      console.error('Failed to fetch gallery:', itemsError);
      return NextResponse.json(
        { error: 'Failed to fetch gallery' },
        { status: 500 }
      );
    }

    const total = totalCount || 0;
    const hasMore = offset + pageSize < total;

    console.log(`📸 Gallery: Returning ${items?.length || 0} items (page ${page}, total ${total})`);

    return NextResponse.json({
      items: (items || []).map(item => ({
        ...item,
        attributes: parseAttributes(item.attributes),
      })),
      total,
      page,
      pageSize,
      hasMore,
      totalPages: Math.ceil(total / pageSize),
      activeFilters: [],
    });

  } catch (error) {
    console.error('Error in /api/gallery/all:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
