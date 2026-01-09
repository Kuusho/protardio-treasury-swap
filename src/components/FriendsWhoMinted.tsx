'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFarcaster } from '~/contexts/FarcasterContext';
import { FriendsModal } from './FriendsModal';

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
}

/**
 * Displays friends who have already minted Protardios.
 * Shows first 3 PFPs with "+X more" button that opens a modal.
 */
export function FriendsWhoMinted() {
  const { user, viewProfile } = useFarcaster();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery<FriendsWhoMintedResponse>({
    queryKey: ['friends-who-minted', user?.fid],
    queryFn: async () => {
      if (!user?.fid) throw new Error('No FID');
      
      const response = await fetch(`/api/friends-who-minted?fid=${user.fid}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch');
      
      return response.json();
    },
    enabled: !!user?.fid,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 2,
  });
  console.log(data, "data")

  // Don't render if no user or still loading
  if (!user?.fid) return null;
  
  // Show skeleton while loading
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 mb-3">
        <span className="text-white/60 text-[13px] font-victor">Friends minting:</span>
        <div className="flex -space-x-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full bg-white/10 animate-pulse border-2 border-black"
            />
          ))}
        </div>
      </div>
    );
  }

  // Don't render if no friends have minted
  if (!data || data.totalCount === 0) return null;

  // Get unique friends by FID (since API now returns all protardios per friend)
  const uniqueFriends = data.friends.reduce((acc, friend) => {
    if (!acc.some(f => f.fid === friend.fid)) {
      acc.push(friend);
    }
    return acc;
  }, [] as typeof data.friends);

  const previewFriends = uniqueFriends.slice(0, 3);
  const remainingCount = uniqueFriends.length - previewFriends.length;

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-white/60 text-[13px] font-victor">Friends minting:</span>
        
        {/* PFP Stack - Clickable to open profile */}
        <div className="flex -space-x-2">
          {previewFriends.map((friend) => (
            <button
              key={friend.fid}
              onClick={() => viewProfile(friend.fid)}
              className="relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#51FF01] rounded-full"
              title={`@${friend.username} - Click to view profile`}
            >
              {friend.pfpUrl ? (
                <img
                  src={friend.pfpUrl}
                  alt={friend.username}
                  className="w-8 h-8 rounded-full border-2 border-black object-cover hover:scale-110 hover:border-[#51FF01] transition-all"
                />
              ) : (
                <div className="w-8 h-8 rounded-full border-2 border-black bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold hover:scale-110 hover:border-[#51FF01] transition-all">
                  {friend.username[0]?.toUpperCase() || '?'}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* +X more button */}
        {remainingCount > 0 && (
          <button
            onClick={() => setShowModal(true)}
            className="text-[#FFFF00] text-[13px] font-victor font-bold hover:underline"
          >
            +{remainingCount} more
          </button>
        )}
        
        {/* Show all button if no remaining but has friends */}
        {remainingCount === 0 && uniqueFriends.length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            className="text-[#FFFF00] text-[13px] font-victor font-bold hover:underline"
          >
            view all
          </button>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <FriendsModal
          friends={uniqueFriends}
          totalCount={uniqueFriends.length}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
