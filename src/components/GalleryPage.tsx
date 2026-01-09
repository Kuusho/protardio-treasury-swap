import { ChevronDown, Clock, ArrowUpDown, Bell, Check, ArrowLeft, X, Filter } from "lucide-react";
import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useFarcaster } from "../contexts/FarcasterContext";
import { NFT_CONFIG } from "../lib/nft-config";
import { useQuery } from "@tanstack/react-query";
import { SetPfpButton } from "./SetPfpButton";
import { TraitTwinButton } from "./TraitTwinButton";
import ShareOnFCButton from "./ShareOnFcButton";
import sdk from '@farcaster/miniapp-sdk';

type GalleryMode = 'my' | 'all' | 'friends';

// Friend who minted interface (from the existing API)
interface FriendWhoMinted {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  tokenId: number;
  protardioName: string;
  protardioImage: string;
  mintedAt: string;
}

interface FriendsWhoMintedResponse {
  friends: FriendWhoMinted[];
  totalCount: number;
  uniqueFriendsCount?: number;
}
type SortOption = 'newest' | 'oldest' | 'tokenId-asc' | 'tokenId-desc';

interface AllNft {
  tokenId: number;
  name: string;
  image: string;
  minterFid?: number;
  minterUsername?: string;
  mintedAt?: string;
  // Listing info (if for sale)
  isListed?: boolean;
  listingPrice?: string;
  listingCurrency?: string;
  openseaUrl?: string;
}


// T2 (Tier 2) Mint opening date - Dec 27, 2025 at 4pm GMT+4 (12:00 UTC)
const MINT_OPEN_DATE = new Date('2025-12-27T20:00:00Z');

// Helper function to generate page numbers for pagination
function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 5) {
    // Show all pages if 5 or fewer
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  
  const pages: (number | '...')[] = [];
  
  // Always show first page
  pages.push(1);
  
  if (currentPage <= 3) {
    // Near the start: show 1, 2, 3, 4, ..., last
    pages.push(2, 3, 4, '...', totalPages);
  } else if (currentPage >= totalPages - 2) {
    // Near the end: show 1, ..., last-3, last-2, last-1, last
    pages.push('...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
  } else {
    // In the middle: show 1, ..., current-1, current, current+1, ..., last
    pages.push('...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
  }
  
  // Remove duplicates and sort
  const uniquePages = [...new Set(pages)];
  return uniquePages;
}

function GalleryPage({ onBack }: { onBack: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [galleryMode, setGalleryMode] = useState<GalleryMode>('my');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedNft, setSelectedNft] = useState<AllNft | null>(null);
  const [selectedFriendProtardio, setSelectedFriendProtardio] = useState<FriendWhoMinted | null>(null);
  const [showAlreadyEnabled, setShowAlreadyEnabled] = useState(false);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [friendsPage, setFriendsPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Available trait filters (based on actual database trait_types)
  const AVAILABLE_FILTERS = [
    { id: 'for-sale', label: 'For Sale', emoji: '🏷️', isSpecial: true },
    { id: 'Friend', label: 'Friend', emoji: '🐕' },
    { id: 'Hat', label: 'Hat', emoji: '🎩' },
    { id: 'Glasses', label: 'Glasses', emoji: '👓' },
    { id: 'Costume', label: 'Costume', emoji: '👻' },
    { id: 'Style Transfer', label: 'Style', emoji: '🎨' },
    { id: 'Weapon', label: 'Weapon', emoji: '⚔️' },
    { id: 'Face Decoration', label: 'Face Deco', emoji: '💫' },
    { id: 'Earrings', label: 'Earrings', emoji: '💎' },
  ] as const;
  const PAGE_SIZE = 12; // 4 rows of 3
  const FRIENDS_PAGE_SIZE = 20; // 20 items per page for friends
  const { user, viewProfile, notificationStatus, requestNotifications } = useFarcaster();
  const {address, isConnected} = useAccount()

  // Countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const diff = MINT_OPEN_DATE.getTime() - now.getTime();
      if (diff > 0) {
        const totalHours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCountdown({ hours: totalHours, minutes });
      } else {
        setCountdown({ hours: 0, minutes: 0 });
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const handleAddNotifications = async () => {
    if (notificationStatus.enabled) {
      setShowAlreadyEnabled(true);
      setTimeout(() => setShowAlreadyEnabled(false), 2000);
      return;
    }
    await requestNotifications();
  };

  // Fetch NFT balance for display
  const { data: nftBalance } = useReadContract({
    address: NFT_CONFIG.contractAddress,
    abi: [
      {
        inputs: [{ name: "owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "balanceOf",
    args: [isConnected ? address! : "0x93fA0E828Ab8b72EEEE42747DE3f9C66D1B43a5c"],
    chainId: NFT_CONFIG.chainId,
  }) as { data: bigint | undefined };

  const balance = nftBalance ? Number(nftBalance) : 0;

  // Fetch user's NFTs from Scatter API (My Gallery)
  const { data: myNftData, isLoading: isMyNftsLoading } = useQuery({
    queryKey: ["nfts", address],
    queryFn: async () => {
      
      const response = await fetch(
        `https://api.scatter.art/v1/collection/${NFT_CONFIG.collectionSlug}/nfts?ownerAddress=${address}`
      );
      const result = await response.json();
      
      
      const nfts = result.data.map((nft: any) => ({
        tokenId: nft.token_id,
        name: nft.name || `Protardio #${nft.token_id}`,
        image: nft.image_url || nft.image || "/assets/images/main-gallery-image.png",
        description: nft.description || "",
      }));
      
      
      return nfts;
    },
    enabled: !!address && galleryMode === 'my',
    staleTime: 30000,
  });

  // Fetch ALL Protardios from our database (All Gallery)
  const { data: allNftData, isLoading: isAllNftsLoading } = useQuery({
    queryKey: ["all-protardios", currentPage, activeFilters],
    queryFn: async () => {
      // Separate trait filters from special filters
      const traitFilters = activeFilters.filter(f => f !== 'for-sale');
      const isForSaleFilter = activeFilters.includes('for-sale');
      
      // Build filter param for trait filters only
      const filterParam = traitFilters.length > 0 ? `&filter=${traitFilters.join(',')}` : '';
      
      // If for-sale filter is active, fetch listings first
      let listingsMap: Record<number, { price: string; currency: string; openseaUrl: string }> = {};
      let listedTokenIds: number[] = [];
      
      if (isForSaleFilter) {
        const listingsResponse = await fetch('/api/listings');
        if (listingsResponse.ok) {
          const listingsData = await listingsResponse.json();
          listingsMap = listingsData.listings || {};
          listedTokenIds = listingsData.listedTokenIds || [];
          console.log(`📊 Found ${listedTokenIds.length} listings from OpenSea`);
        }
      }
      
      // Fetch NFTs - if for-sale, we need all NFTs to match against listings
      const nftResponse = await fetch(`/api/gallery/all?page=1&pageSize=5000${filterParam}`);
      if (!nftResponse.ok) throw new Error('Failed to fetch all protardios');
      const result = await nftResponse.json();
      
      console.log(`📊 Fetched ${result.items?.length || 0} NFTs from database`);
      
      // Map NFTs and add listing info
      let nfts: AllNft[] = result.items.map((item: any) => {
        const tokenId = item.token_id;
        const listing = listingsMap[tokenId];
        return {
          tokenId,
          name: item.name,
          image: item.image_url || "/assets/images/main-gallery-image.png",
          minterFid: item.minter_fid,
          minterUsername: item.minter_username,
          mintedAt: item.minted_at,
          isListed: !!listing,
          listingPrice: listing?.price,
          listingCurrency: listing?.currency,
          openseaUrl: listing?.openseaUrl,
        };
      });
      
      // Apply for-sale filter client-side
      if (isForSaleFilter) {
        const beforeCount = nfts.length;
        nfts = nfts.filter(nft => nft.isListed);
        console.log(`📊 Filtered to ${nfts.length} listed NFTs (from ${beforeCount})`);
      }
      
      // Paginate client-side
      const total = nfts.length;
      const offset = (currentPage - 1) * PAGE_SIZE;
      const paginatedNfts = nfts.slice(offset, offset + PAGE_SIZE);
      
      return { 
        items: paginatedNfts, 
        total, 
        hasMore: offset + PAGE_SIZE < total, 
        totalPages: Math.ceil(total / PAGE_SIZE) 
      };
    },
    enabled: galleryMode === 'all',
    staleTime: 60000,
  });

  // Toggle a filter
  const toggleFilter = (filterId: string) => {
    setActiveFilters(prev => {
      if (prev.includes(filterId)) {
        return prev.filter(f => f !== filterId);
      } else {
        return [...prev, filterId];
      }
    });
    setCurrentPage(1); // Reset to page 1 when filters change
    setShowFilterDropdown(false);
  };

  // Remove a specific filter
  const removeFilter = (filterId: string) => {
    setActiveFilters(prev => prev.filter(f => f !== filterId));
    setCurrentPage(1);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setActiveFilters([]);
    setCurrentPage(1);
  };

  // Fetch Friends' Protardios (using existing friends-who-minted API)
  // Uses same query key as FriendsWhoMinted component to share cache
  const { data: friendsData, isLoading: isFriendsLoading } = useQuery<FriendsWhoMintedResponse>({
    queryKey: ['friends-who-minted', user?.fid],
    queryFn: async () => {
      if (!user?.fid) throw new Error('No FID');
      const response = await fetch(`/api/friends-who-minted?fid=${user.fid}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch friends protardios');
      return response.json();
    },
    enabled: !!user?.fid, // Always fetch when user is available to share cache with MintPage
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  // Sort the all-protardios data
  const sortedAllNfts = (() => {
    if (!allNftData?.items) return [];
    const items = [...allNftData.items];
    switch (sortBy) {
      case 'newest':
        return items.sort((a, b) => new Date(b.mintedAt || 0).getTime() - new Date(a.mintedAt || 0).getTime());
      case 'oldest':
        return items.sort((a, b) => new Date(a.mintedAt || 0).getTime() - new Date(b.mintedAt || 0).getTime());
      case 'tokenId-asc':
        return items.sort((a, b) => a.tokenId - b.tokenId);
      case 'tokenId-desc':
        return items.sort((a, b) => b.tokenId - a.tokenId);
      default:
        return items;
    }
  })();

  // Select the right data based on mode
  const nfts = galleryMode === 'my' ? (myNftData || []) : sortedAllNfts;
  const isLoading = galleryMode === 'my' ? isMyNftsLoading : isAllNftsLoading;

  // Reset index when switching modes
  const handleModeChange = (mode: GalleryMode) => {
    setGalleryMode(mode);
    setCurrentIndex(0);
    setCurrentPage(1);
    setFriendsPage(1);
    setShowDropdown(false);
    setSelectedNft(null);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : nfts.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < nfts.length - 1 ? prev + 1 : 0));
  };

  const openFarcasterProfile = () => {
    window.open("https://warpcast.com/protardio", "_blank");
  };

  const getSortLabel = (sort: SortOption) => {
    switch (sort) {
      case 'newest': return 'Newest';
      case 'oldest': return 'Oldest';
      case 'tokenId-asc': return 'Token # ↑';
      case 'tokenId-desc': return 'Token # ↓';
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  // Download the current NFT image
  const handleDownload = async () => {
    if (!nfts[currentIndex]) return;
    
    const nft = nfts[currentIndex];
    try {
      const response = await fetch(nft.image);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nft.name || `protardio-${nft.token_id}`}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
      // Fallback: open in new tab
      window.open(nft.image, '_blank');
    }
  };

  return (
    <div
      className="relative overflow-hidden font-victor text-white h-screen w-screen flex items-center justify-center bg-radial-gallery"
    >
      {/* Content Layer */}
      <div className="relative z-20 flex flex-col items-center pt-3 px-4 w-[445px] h-full">

        {/* Top Bar - Back | Title | Gallery */}
        <div className="w-full flex justify-between items-center max-w-[400px] pt-[5px]">
           {/* Back Button */}
           <button 
             onClick={onBack}
             className="bg-white/10 backdrop-blur-sm rounded-full w-[42px] h-[42px] flex items-center justify-center hover:bg-white/20 transition-colors"
           >
             <ArrowLeft size={24} strokeWidth={2} className="text-white" />
           </button>

           {/* Title */}
           <h1 className="font-['Bitcount'] font-medium text-[32px] leading-none tracking-wider drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
             protardio
           </h1>

           {/* Gallery Label */}
           <div className="bg-[#FF0000] text-white rounded-[60px] px-4 h-[42px] flex items-center justify-center shadow-lg">
             <span className="font-victor font-bold italic text-[18px]">Gallery</span>
           </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-start w-full max-w-[380px] mt-4 overflow-hidden">

          {/* Gallery Mode Dropdown */}
          <div className="w-full flex justify-center mb-4 pt-4">
            <div className="relative w-[332px]">
              <button
                onClick={() => { setShowDropdown(!showDropdown); setShowSortDropdown(false); }}
                className="w-full h-[45px] bg-[#B011FF] text-white rounded-[60px] px-6 font-victor font-bold italic text-[23px] flex items-center justify-between shadow-lg shadow-purple-glow cursor-pointer hover:bg-[#9900DD] transition-colors"
              >
                <span>
                  {galleryMode === 'my' 
                    ? user?.username 
                    : galleryMode === 'friends' 
                      ? "Friends'" 
                      : 'All Protardios'}
                </span>
                <ChevronDown 
                  size={24} 
                  className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                />
              </button>
              
              {showDropdown && (
                <div className="absolute top-[50px] left-0 w-full bg-[#1a1a2e] rounded-2xl overflow-hidden shadow-xl z-50 border border-white/10">
                  <button
                    onClick={() => handleModeChange('my')}
                    className={`w-full px-6 py-3 text-left font-victor font-bold text-[18px] hover:bg-white/10 transition-colors ${
                      galleryMode === 'my' ? 'text-[#51FF01]' : 'text-white'
                    }`}
                  >
                    {user?.username} (My Gallery)
                  </button>
                  <button
                    onClick={() => handleModeChange('all')}
                    className={`w-full px-6 py-3 text-left font-victor font-bold text-[18px] hover:bg-white/10 transition-colors ${
                      galleryMode === 'all' ? 'text-[#51FF01]' : 'text-white'
                    }`}
                  >
                    All Protardios
                  </button>
                  <button
                    onClick={() => handleModeChange('friends')}
                    className={`w-full px-6 py-3 text-left font-victor font-bold text-[18px] hover:bg-white/10 transition-colors ${
                      galleryMode === 'friends' ? 'text-[#51FF01]' : 'text-white'
                    }`}
                  >
                    Friends&apos;
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sorting & Filtering Controls - Only for All Protardios */}
          {galleryMode === 'all' && (
            <div className="w-full flex flex-col items-center gap-2 mb-3">
              {/* Controls Row */}
              <div className="flex items-center gap-3">
                {/* Sort Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => { setShowSortDropdown(!showSortDropdown); setShowDropdown(false); setShowFilterDropdown(false); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white/80 hover:bg-white/20 transition-colors text-[14px] font-victor"
                  >
                    <ArrowUpDown size={16} />
                    <span>{getSortLabel(sortBy)}</span>
                    <ChevronDown size={14} className={`transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showSortDropdown && (
                    <div className="absolute top-[40px] left-1/2 -translate-x-1/2 w-[140px] bg-[#1a1a2e] rounded-xl overflow-hidden shadow-xl z-50 border border-white/10">
                      {(['newest', 'oldest', 'tokenId-asc', 'tokenId-desc'] as SortOption[]).map((option) => (
                        <button
                          key={option}
                          onClick={() => { setSortBy(option); setShowSortDropdown(false); }}
                          className={`w-full px-4 py-2 text-left text-[14px] font-victor hover:bg-white/10 transition-colors ${
                            sortBy === option ? 'text-[#51FF01]' : 'text-white'
                          }`}
                        >
                          {getSortLabel(option)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Filter Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowDropdown(false); setShowSortDropdown(false); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors text-[14px] font-victor ${
                      activeFilters.length > 0 
                        ? 'bg-[#B011FF] text-white' 
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    <Filter size={16} />
                    <span>Filter{activeFilters.length > 0 ? ` (${activeFilters.length})` : ''}</span>
                    <ChevronDown size={14} className={`transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showFilterDropdown && (
                    <div className="absolute top-[40px] left-1/2 -translate-x-1/2 w-[160px] bg-[#1a1a2e] rounded-xl overflow-hidden shadow-xl z-50 border border-white/10">
                      {AVAILABLE_FILTERS.map((filter) => (
                        <button
                          key={filter.id}
                          onClick={() => toggleFilter(filter.id)}
                          className={`w-full px-4 py-2 text-left text-[14px] font-victor hover:bg-white/10 transition-colors flex items-center gap-2 ${
                            activeFilters.includes(filter.id) ? 'text-[#51FF01]' : 'text-white'
                          }`}
                        >
                          <span>{filter.emoji}</span>
                          <span>{filter.label}</span>
                          {activeFilters.includes(filter.id) && <Check size={14} className="ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Active Filters Chips */}
              {activeFilters.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {activeFilters.map(filterId => {
                    const filter = AVAILABLE_FILTERS.find(f => f.id === filterId);
                    if (!filter) return null;
                    return (
                      <button
                        key={filterId}
                        onClick={() => removeFilter(filterId)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[#B011FF]/30 border border-[#B011FF] rounded-full text-[12px] font-victor text-white hover:bg-[#B011FF]/50 transition-colors group"
                      >
                        <span>{filter.emoji}</span>
                        <span>{filter.label}</span>
                        <X size={12} className="opacity-60 group-hover:opacity-100" />
                      </button>
                    );
                  })}
                  {activeFilters.length > 1 && (
                    <button
                      onClick={clearAllFilters}
                      className="flex items-center gap-1 px-3 py-1 bg-white/10 rounded-full text-[12px] font-victor text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== All Protardios Grid View ===== */}
          {galleryMode === 'all' && (
            <div className="flex-1 w-full overflow-y-auto pb-4 pt-3">
              {isLoading ? (
                <div className="grid grid-cols-3 gap-3 px-2">
                  {Array(9).fill(0).map((_, i) => (
                    <div key={i} className="aspect-square bg-white/10 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : nfts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] gap-3">
                  <span className="text-white/60 font-victor text-center">
                    {activeFilters.length > 0 
                      ? `No Protardios found with ${activeFilters.map(f => AVAILABLE_FILTERS.find(af => af.id === f)?.label).join(' + ')} traits`
                      : 'No Protardios minted yet'
                    }
                  </span>
                  {activeFilters.length > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="px-4 py-2 bg-[#B011FF] text-white rounded-full text-[14px] font-victor font-bold hover:bg-[#9900DD] transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 px-2">
                  {sortedAllNfts.map((nft) => (
                    <div
                      key={nft.tokenId}
                      onClick={() => {
                        if (nft.isListed && nft.openseaUrl) {
                          window.open(nft.openseaUrl, '_blank');
                        } else {
                          setSelectedNft(nft);
                        }
                      }}
                      className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 cursor-pointer ${
                        nft.isListed 
                          ? 'border-[#51FF01] shadow-[0_0_12px_rgba(81,255,1,0.3)]' 
                          : 'border-transparent hover:border-[#51FF01]'
                      }`}
                    >
                      <img
                        src={nft.image}
                        alt={nft.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Price Badge - For listed items */}
                      {nft.isListed && nft.listingPrice && (
                        <div className="absolute top-1 right-1 bg-[#51FF01] text-black px-1.5 py-0.5 rounded-md text-[10px] font-victor font-bold shadow-lg">
                          {nft.listingPrice} {nft.listingCurrency === 'WETH' ? 'ETH' : nft.listingCurrency}
                        </div>
                      )}
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                        <span className="text-white font-victor font-bold text-[12px]">#{nft.tokenId}</span>
                        {nft.isListed ? (
                          <span className="text-[#51FF01] text-[10px] font-bold">Buy on OpenSea →</span>
                        ) : nft.minterUsername ? (
                          <span className="text-[#FFFF00] text-[10px]">@{nft.minterUsername}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Total count */}
              <div className="text-center mt-4 mb-2">
                <span className="font-victor font-bold text-[#FFFF00] tracking-wider text-[15px]">
                  {allNftData?.total || 0} protardios minted
                </span>
              </div>

              {/* Pagination Controls */}
              {allNftData && allNftData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-2 mb-4">
                  {/* Left Arrow */}
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`text-[20px] transition-transform hover:scale-110 ${currentPage === 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-yellow-400">◀</span>
                  </button>

                  {/* Page Label */}
                  <span className="font-victor font-bold text-white text-[18px]">page</span>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-2">
                    {getPageNumbers(currentPage, allNftData.totalPages).map((page, idx) => (
                      page === '...' ? (
                        <span key={`ellipsis-${idx}`} className="font-victor font-bold text-white text-[18px]">...</span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`font-victor font-bold text-[18px] min-w-[24px] transition-all ${
                            currentPage === page
                              ? 'text-[#FFFF00] border-2 border-black px-2 py-0.5 rounded drop-shadow-[0_4px_16px_rgba(255,255,255,0.5)]'
                              : 'text-white hover:text-[#FFFF00]'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    ))}
                  </div>

                  {/* Right Arrow */}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(allNftData.totalPages, p + 1))}
                    disabled={currentPage === allNftData.totalPages}
                    className={`text-[20px] transition-transform hover:scale-110 ${currentPage === allNftData.totalPages ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-yellow-400">▶</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===== Friends' Protardios Grid View ===== */}
          {galleryMode === 'friends' && (
            <div className="flex-1 w-full overflow-y-auto pb-4 pt-3">
              {isFriendsLoading ? (
                <>
                  <div className="text-center mb-4">
                    <div className="h-5 bg-white/10 rounded animate-pulse w-48 mx-auto" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 px-2">
                    {Array(4).fill(0).map((_, i) => (
                      <div key={i} className="flex flex-col gap-2">
                        <div className="aspect-square bg-white/10 rounded-xl animate-pulse" />
                        <div className="h-4 bg-white/10 rounded animate-pulse" />
                        <div className="h-8 bg-white/10 rounded-full animate-pulse" />
                      </div>
                    ))}
                  </div>
                </>
              ) : !friendsData || friendsData.friends.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                  <span className="text-[40px]">👥</span>
                  <span className="text-white/60 font-victor text-center px-4">
                    No friends have minted Protardios yet
                  </span>
                  <span className="text-[#FFFF00] font-victor text-[14px] text-center">
                    Follow more people to see their Protardios here!
                  </span>
                </div>
              ) : (() => {
                // Pagination logic
                const totalItems = friendsData.friends.length;
                const totalPages = Math.ceil(totalItems / FRIENDS_PAGE_SIZE);
                const startIndex = (friendsPage - 1) * FRIENDS_PAGE_SIZE;
                const endIndex = startIndex + FRIENDS_PAGE_SIZE;
                const paginatedFriends = friendsData.friends.slice(startIndex, endIndex);
                
                return (
                  <>
                    {/* Header - Count at top */}
                    <div className="text-center mb-4">
                      <span className="font-victor font-bold text-[#FFFF00] tracking-wider text-[15px]">
                        Your {friendsData.uniqueFriendsCount || 0} friend{(friendsData.uniqueFriendsCount || 0) !== 1 ? 's' : ''} have in total of {friendsData.totalCount} protardio{friendsData.totalCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-2 gap-4 px-2">
                      {paginatedFriends.map((friend) => (
                        <div
                          key={`${friend.fid}-${friend.tokenId}`}
                          className="flex flex-col gap-2 bg-white/5 rounded-xl p-3 border border-white/10"
                        >
                          {/* Protardio Image - Clickable */}
                          <div
                            onClick={() => setSelectedFriendProtardio(friend)}
                            className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer"
                          >
                            <img
                              src={friend.protardioImage}
                              alt={friend.protardioName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                              <span className="text-white font-victor text-[12px]">View</span>
                            </div>
                            {/* Share Button - Bottom Right */}
                            <div 
                              className="absolute bottom-2 right-2 z-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ShareOnFCButton 
                                imageUrl={friend.protardioImage} 
                                shareText={`Look at my dawg @${friend.username}'s Protardio 🔥 /protardio`}
                                className="w-8 h-8"
                              />
                            </div>
                          </div>
                          
                          {/* Owned By */}
                          <button
                            onClick={() => viewProfile(friend.fid)}
                            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                          >
                            <span className="text-white/60 text-[11px] font-victor">owned by:</span>
                            <div className="flex items-center gap-1 min-w-0">
                              {friend.pfpUrl && (
                                <img
                                  src={friend.pfpUrl}
                                  alt={friend.username}
                                  className="w-5 h-5 rounded-full object-cover shrink-0"
                                />
                              )}
                              <span className="text-[#FFFF00] text-[12px] font-victor font-bold truncate">
                                @{friend.username}
                              </span>
                            </div>
                          </button>
                          
                          {/* Set as PFP Button */}
                          <SetPfpButton 
                            imageUrl={friend.protardioImage} 
                            className="text-[12px]! px-4! py-2!"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-3 mt-4 mb-2">
                        {/* Left Arrow */}
                        <button
                          onClick={() => setFriendsPage(p => Math.max(1, p - 1))}
                          disabled={friendsPage === 1}
                          className={`text-[20px] transition-transform hover:scale-110 ${friendsPage === 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                          <span className="text-yellow-400">◀</span>
                        </button>

                        {/* Page Label */}
                        <span className="font-victor font-bold text-white text-[18px]">page</span>

                        {/* Page Numbers */}
                        <div className="flex items-center gap-2">
                          {getPageNumbers(friendsPage, totalPages).map((page, idx) => (
                            page === '...' ? (
                              <span key={`ellipsis-${idx}`} className="font-victor font-bold text-white text-[18px]">...</span>
                            ) : (
                              <button
                                key={page}
                                onClick={() => setFriendsPage(page)}
                                className={`font-victor font-bold text-[18px] min-w-[24px] transition-all ${
                                  friendsPage === page
                                    ? 'text-[#FFFF00] border-2 border-black px-2 py-0.5 rounded drop-shadow-[0_4px_16px_rgba(255,255,255,0.5)]'
                                    : 'text-white hover:text-[#FFFF00]'
                                }`}
                              >
                                {page}
                              </button>
                            )
                          ))}
                        </div>

                        {/* Right Arrow */}
                        <button
                          onClick={() => setFriendsPage(p => Math.min(totalPages, p + 1))}
                          disabled={friendsPage === totalPages}
                          className={`text-[20px] transition-transform hover:scale-110 ${friendsPage === totalPages ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                          <span className="text-yellow-400">▶</span>
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* ===== Friend Protardio Modal ===== */}
          {selectedFriendProtardio && (
            <div
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fadeIn"
              onClick={() => setSelectedFriendProtardio(null)}
            >
              <div
                className="relative bg-[#1a1a2e] rounded-2xl p-4 max-w-[360px] w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => setSelectedFriendProtardio(null)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>

                {/* Large Image */}
                <div className="relative rounded-xl overflow-hidden mb-4">
                  <img
                    src={selectedFriendProtardio.protardioImage}
                    alt={selectedFriendProtardio.protardioName}
                    className="w-full aspect-square object-cover"
                  />
                  {/* Share Button - Bottom Right */}
                  <div className="absolute bottom-3 right-3 z-10">
                    <ShareOnFCButton 
                      imageUrl={selectedFriendProtardio.protardioImage}
                      shareText={`Look at my dawg @${selectedFriendProtardio.username}'s Protardio 🔥 /protardio`}
                    />
                  </div>
                </div>

                {/* Protardio Name */}
                <h3 className="font-victor font-bold text-white text-[18px] mb-2 text-center">
                  {selectedFriendProtardio.protardioName}
                </h3>

                {/* Owner Info */}
                <button
                  onClick={() => {
                    viewProfile(selectedFriendProtardio.fid);
                  }}
                  className="flex items-center justify-center gap-2 mb-4 w-full hover:opacity-80 transition-opacity"
                >
                  <span className="text-white/60 text-[14px] font-victor">owned by:</span>
                  <div className="flex items-center gap-2">
                    {selectedFriendProtardio.pfpUrl && (
                      <img
                        src={selectedFriendProtardio.pfpUrl}
                        alt={selectedFriendProtardio.username}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    )}
                    <span className="text-[#FFFF00] text-[16px] font-victor font-bold">
                      @{selectedFriendProtardio.username}
                    </span>
                  </div>
                </button>

                {/* Set as PFP Button */}
                <SetPfpButton 
                  imageUrl={selectedFriendProtardio.protardioImage} 
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* ===== NFT Detail Modal ===== */}
          {selectedNft && (
            <div
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
              onClick={() => setSelectedNft(null)}
            >
              <div
                className="relative bg-[#1a1a2e] rounded-2xl p-4 max-w-[340px] w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Share Button - Top Right */}
               
                {/* Image */}
                <div className="relative rounded-xl overflow-hidden mb-4">
                  <img
                    src={selectedNft.image}
                    alt={selectedNft.name}
                    className="w-full aspect-square object-cover"
                  />
                  {/* Share Button - Bottom Right */}
                  <div className="absolute bottom-3 right-3 z-10">
                    <ShareOnFCButton 
                      imageUrl={selectedNft.image}
                      shareText={selectedNft.minterUsername 
                        ? `Check out this Protardio by @${selectedNft.minterUsername} 🔥 /protardio`
                        : `Check out Protardio #${selectedNft.tokenId} 🔥 /protardio`
                      }
                    />
                  </div>
                </div>
                
                {/* Info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-victor font-bold text-white text-[20px]">{selectedNft.name}</h3>
                    <span className="text-white/60 text-[14px]">#{selectedNft.tokenId}</span>
                  </div>
                  
                  {selectedNft.minterUsername && (
                    <button
                      onClick={() => selectedNft.minterFid && viewProfile(selectedNft.minterFid)}
                      className="flex items-center gap-2 text-[#FFFF00] hover:underline"
                    >
                      <span className="text-white/60 text-[14px]">Minted by</span>
                      <span className="font-victor font-bold">@{selectedNft.minterUsername}</span>
                    </button>
                  )}
                  
                  {selectedNft.mintedAt && (
                    <div className="flex items-center gap-2 text-white/60 text-[14px]">
                      <Clock size={14} />
                      <span>{formatRelativeTime(selectedNft.mintedAt)}</span>
                    </div>
                  )}
                </div>
                
                {/* Close button */}
                <button
                  onClick={() => setSelectedNft(null)}
                  className="w-full mt-4 py-3 bg-white/10 rounded-xl text-white font-victor font-bold hover:bg-white/20 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* ===== My Gallery Carousel View ===== */}
          {galleryMode === 'my' && (
            <>
              {/* Show special view when no NFTs owned */}
              {!isLoading && nfts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center px-4">
                  {/* Already Enabled Toast */}
                  {showAlreadyEnabled && (
                    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#51FF01] text-black px-4 py-2 rounded-full font-victor font-bold text-[14px] flex items-center gap-2 animate-bounce shadow-lg">
                      <Check size={18} strokeWidth={3} />
                      Notifications already enabled!
                    </div>
                  )}

                  {/* Check another wallet */}
                  <p className="text-white/80 font-victor text-[15px] mb-12">
                    Check another wallet?
                  </p>

                  {/* You don't own any protardios */}
                  <p className="text-[#FFFF00] font-victor font-bold text-[16px] mb-6">
                    You don&apos;t own any protardios :(
                  </p>

                  {/* Add Notifs Button */}
                  <button
                    onClick={handleAddNotifications}
                    className={`flex items-center gap-3 px-6 py-3 rounded-full font-['Bitcount'] text-[28px] shadow-lg hover:scale-105 transition-transform mb-4 ${
                      notificationStatus.enabled 
                        ? 'bg-[#51FF01] text-black' 
                        : 'bg-white text-black'
                    }`}
                  >
                    {notificationStatus.enabled ? (
                      <>
                        <Check size={24} strokeWidth={3} />
                        Notifs on
                      </>
                    ) : (
                      <>
                        Add notifs
                        <span className="text-[28px]">🔔</span>
                      </>
                    )}
                  </button>

                  {/* T2 mint countdown */}
                  <p className="font-victor text-[15px]">
                    <span className="text-white/80">{`Public mint live in ${countdown.hours}h ${countdown.minutes}m !`}</span>
                    {/* <span className="text-[#FFFF00] font-bold">{countdown.hours}h {countdown.minutes}m</span> */}
                  </p>
                </div>
              ) : (
                <>
              {/* Main Gallery Image */}
              <div className="flex justify-center mb-4">
                <div className="relative w-[220px] h-[220px] flex items-center justify-center">
                  {isLoading ? (
                    <div className="w-full h-full bg-white/10 rounded-lg animate-pulse border border-white/20" />
                  ) : (
                    <>
                      <img
                        src={nfts[currentIndex]?.image || "/assets/images/main-gallery-image.png"}
                        alt={nfts[currentIndex]?.name || "Protardio"}
                        className="w-full h-full object-contain"
                      />
                      {/* Share Button - Bottom Right */}
                      {nfts[currentIndex]?.image && (
                        <div className="absolute bottom-3 right-3 z-10">
                          <ShareOnFCButton imageUrl={nfts[currentIndex].image} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
                
                {/* Action Buttons */}
                {!isLoading && nfts.length > 0 && nfts[currentIndex] && (
                  <div className="flex flex-col items-center gap-3 w-full max-w-[320px] mx-auto">
                    {/* Button Row - Set PFP (left) & Find Twin (right) - Same size */}
                    <div className="flex items-stretch gap-3 w-full">
                      <SetPfpButton 
                        imageUrl={nfts[currentIndex].image} 
                        className="flex-1 text-[14px]! px-3! py-2! justify-center"
                      />
                      <TraitTwinButton 
                        tokenId={nfts[currentIndex].tokenId} 
                        className="flex-1 text-[14px]! px-3! py-2! justify-center"
                      />
                    </div>
                    {/* Revoke Access Link */}
                    <a 
                      href="https://app.neynar.com/connections" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-victor text-[12px] text-white/50 hover:text-white/80 underline transition-colors"
                    >
                      Revoke Neynar Access
                    </a>
                  </div>
                )}

              {/* Thumbnail Carousel */}
              <div className="flex items-center justify-center gap-2 mb-3 w-full pt-0">
                <button onClick={handlePrev} className="hover:scale-110 transition-transform mr-[15px]">
                  <span className="text-yellow-400 blink-left">◀</span>
                </button>

                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="justify-between flex w-full max-w-[275px]">
                    <img src="/assets/images/Ellipse.png" alt=""/>
                    <img src="/assets/images/Ellipse.png" alt=""/>
                    <img src="/assets/images/Ellipse.png" alt=""/>
                    <img src="/assets/images/Ellipse.png" alt=""/>
                  </div>
                  <div className="flex w-full gap-8 justify-center">
                    {isLoading ? (
                      Array(3).fill(0).map((_, index) => (
                        <div key={index} className="w-[57px] h-[57px] bg-white/10 rounded-lg animate-pulse border border-white/20 rotate-15" />
                      ))
                    ) : (
                      (() => {
                        let startIndex = currentIndex - 1;
                        if (startIndex < 0) startIndex = 0;
                        if (startIndex + 3 > nfts.length) {
                          startIndex = Math.max(0, nfts.length - 3);
                        }
                        return Array(3).fill(null).map((_, slotIndex) => {
                          const nftIndex = startIndex + slotIndex;
                          const nft = nfts[nftIndex];
                          if (!nft) {
                            return (
                              <div
                                key={`empty-${slotIndex}`}
                                className="w-[57px] h-[57px] bg-white/5 rounded-lg border border-white/10 rotate-15 opacity-30"
                              />
                            );
                          }
                          return (
                            <div
                              key={nft.tokenId}
                              className="relative cursor-pointer"
                              onClick={() => setCurrentIndex(nftIndex)}
                            >
                              <img
                                src={nft.image}
                                height="57"
                                width="57"
                                className="rotate-15 relative"
                                alt={nft.name}
                              />
                              {currentIndex === nftIndex && (
                                <div className="absolute z-20 rounded-full pointer-events-none w-[133px] h-[133px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glow-selected" />
                              )}
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                  <div className="justify-between flex w-full max-w-[275px]">
                    <img src="/assets/images/Ellipse.png" alt=""/>
                    <img src="/assets/images/Ellipse.png" alt=""/>
                    <img src="/assets/images/Ellipse.png" alt=""/>
                    <img src="/assets/images/Ellipse.png" alt=""/>
                  </div>
                </div>

                <button onClick={handleNext} className="hover:scale-110 transition-transform ml-[15px]">
                  <span className="text-yellow-400 blink-right">▶</span>
                </button>
              </div>

              {/* Protardios Counter */}
              <div className="mb-3">
                <span className="font-victor font-bold text-[#FFFF00] tracking-wider text-[15px]">
                  {balance} protardio{balance !== 1 ? 's' : ''}
                </span>
              </div>
              </>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-between px-8 pb-7 text-sm font-victor text-white/80 gap-7">
          <button onClick={openFarcasterProfile} className="hover:text-white">(farcaster)</button>
          <a href="https://x.com/protardio" target="_blank" rel="noopener noreferrer" className="hover:text-white">(x)</a>
          <a href="https://opensea.io/collection/protardio-citizens" target="_blank" rel="noopener noreferrer" className="hover:text-white">(opensea)</a>
        </div>

      </div>
    </div>
  );
}

export default GalleryPage;
