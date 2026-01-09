'use client';

import { X } from 'lucide-react';
import { useFarcaster } from '~/contexts/FarcasterContext';

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

interface FriendsModalProps {
  friends: FriendWhoMinted[];
  totalCount: number;
  onClose: () => void;
}

/**
 * Modal showing all friends who have minted Protardios.
 * Displays their PFP, username, and which Protardio they minted.
 * Click on a friend to open their Farcaster profile.
 */
export function FriendsModal({ friends, totalCount, onClose }: FriendsModalProps) {
  const { viewProfile } = useFarcaster();

  // Format date to relative time
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const handleFriendClick = (fid: number) => {
    viewProfile(fid);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[#1a1a2e] rounded-2xl w-full max-w-[380px] max-h-[70vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="font-victor font-bold text-white text-[18px]">
            Friends who minted ({totalCount})
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Friends List */}
        <div className="overflow-y-auto max-h-[calc(70vh-80px)] p-2">
          {friends.map((friend) => (
            <button
              key={friend.fid}
              onClick={() => handleFriendClick(friend.fid)}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors w-full text-left cursor-pointer"
            >
              {/* PFP */}
              <div className="shrink-0">
                {friend.pfpUrl ? (
                  <img
                    src={friend.pfpUrl}
                    alt={friend.username}
                    className="w-12 h-12 rounded-full object-cover border-2 border-[#51FF01]"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg font-bold border-2 border-[#51FF01]">
                    {friend.username[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-victor font-bold text-white text-[15px] truncate">
                    @{friend.username}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-[#FFFF00]">
                    {friend.protardioName}
                  </span>
                  <span className="text-white/40">•</span>
                  <span className="text-white/40">
                    {formatDate(friend.mintedAt)}
                  </span>
                </div>
              </div>

              {/* Protardio Thumbnail */}
              <div className="shrink-0">
                <img
                  src={friend.protardioImage}
                  alt={friend.protardioName}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              </div>
            </button>
          ))}

          {/* Load More hint if there are more */}
          {friends.length < totalCount && (
            <div className="text-center py-4 text-white/40 text-[13px] font-victor">
              Showing {friends.length} of {totalCount} friends
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

