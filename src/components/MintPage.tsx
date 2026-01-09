import React from "react";
import { ArrowLeft, LogIn } from "lucide-react";
import { useFarcaster } from "../contexts/FarcasterContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount, useReadContract, useSendTransaction, useConnect } from "wagmi";
import { readContract, writeContract, switchChain } from "wagmi/actions";
import { erc20Abi, maxUint256 } from "viem";
import { ACTIVE_CHAIN } from "~/lib/chain-config";
import {config} from "../components/providers/WagmiProvider";
import { saveMintToDatabase } from "~/lib/mint-save";
import { FriendsWhoMinted } from "./FriendsWhoMinted";
import { SCATTER_CONFIG } from "~/lib/nft-config";
import { isTier2Eligible } from "~/lib/tier2-whitelist";
const SCATTER_API_URL = SCATTER_CONFIG.apiUrl;
const COLLECTION_SLUG = SCATTER_CONFIG.collectionSlug;
const PROTARDIO_FID = 1118370;

interface MintedNFT {
  tokenId: string;
  name: string;
  image: string;
}

function MintPage({ onBack, onNavigateToGallery }: { onBack: () => void; onNavigateToGallery?: () => void }) {
  const {user, viewProfile} = useFarcaster()
  const { address, isConnected, chainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { connect, connectors } = useConnect();
  const [mintSuccess, setMintSuccess] = React.useState(false);
  const [mintedNFT, setMintedNFT] = React.useState<MintedNFT | null>(null);
  const [isLoadingMintedNFT, setIsLoadingMintedNFT] = React.useState(false);
  const [isSavingToDb, setIsSavingToDb] = React.useState(false);
  const [savedToDb, setSavedToDb] = React.useState(false);
  const [needsReconnect, setNeedsReconnect] = React.useState(false);
  const [isReconnecting, setIsReconnecting] = React.useState(false);
  const [tier2Eligible, setTier2Eligible] = React.useState<boolean>(false);
  const [tier3Status, setTier3Status] = React.useState<{ isRegistered: boolean; username?: string } | null>(null);
  const [quotientStatus, setQuotientStatus] = React.useState<{
    score: number;
    minScore: number;
    isEligible: boolean;
    checked: boolean;
    conditions: { type: string; target_name: string; meets_condition: boolean }[];
    meetsReputationThreshold: boolean;
  } | null>(null);
  const [isCheckingQuotient, setIsCheckingQuotient] = React.useState(false);
  const [quotientCheckTrigger, setQuotientCheckTrigger] = React.useState(0);

  // Check if user follows Protardio from Quotient conditions
  const followsProtardio = React.useMemo(() => {
    if (!quotientStatus?.conditions) return true; // Default to true if no conditions
    const followerCondition = quotientStatus.conditions.find(
      (c) => c.type === "farcaster-follower" && c.target_name === "protardio"
    );
    return followerCondition?.meets_condition ?? true;
  }, [quotientStatus?.conditions]);


  // Fetching collection data from Scatter API
  const { data: collection, isPending: _isCollectionPending } = useQuery({
    queryKey: ["collection", COLLECTION_SLUG],
    queryFn: async () => {
      const response = await fetch(
        `${SCATTER_API_URL}/collection/${COLLECTION_SLUG}`
      );
      const data = await response.json();
      return { ...data, abi: JSON.parse(data.abi) };
    },
  });

  // Fetching eligible invite lists from Scatter API
  // This endpoint checks if the provided address is whitelisted
  const { data: inviteLists, isPending: _isInviteListsPending } = useQuery({
    queryKey: ["eligibleInviteLists", COLLECTION_SLUG, address],
    queryFn: async () => {
      
      const url = `${SCATTER_API_URL}/collection/${COLLECTION_SLUG}/eligible-invite-lists${
        address ? `?minterAddress=${address}` : ""
      }`;
      
      
      const response = await fetch(url);
      const data = await response.json();
      
      return data;
    },
    enabled: !!address, // Only fetch when we have an address
  });

  // Check how many NFTs this wallet has minted from the eligible list
  const { data: walletMintedCount } = useReadContract({
    abi: collection?.abi,
    address: collection?.address as `0x${string}`,
    functionName: "minted",
    chainId: collection?.chain_id,
    args: [
      address as `0x${string}`, 
      inviteLists && inviteLists[0] ? inviteLists[0].root : "0x0"
    ],
    query: {
      enabled: !!address && !!collection && !!inviteLists && inviteLists.length > 0,
    },
  }) as { data: number | undefined };

  // Calculate if wallet has reached mint limit
  const walletLimit = inviteLists && inviteLists[0] ? inviteLists[0].wallet_limit : 0;
  const hasReachedLimit = walletMintedCount !== undefined && walletMintedCount >= walletLimit;

  // Check if Phase 1 is over (5000 NFTs minted)
  const isPhase1Over = collection?.num_items >= 5000;

  // Check Tier 2 and Tier 3 eligibility when not eligible from Scatter
  // Flow: Scatter API (T1) → Tier 2 CSV → Tier 3 DB → Quotient Score (Public)
  React.useEffect(() => {
    const checkTierEligibility = async () => {
      // Only check if we have an address and inviteLists has been fetched (even if empty)
      if (!address || inviteLists === undefined) return;
      
      // If already eligible from Scatter (T1), reset other tiers
      if (inviteLists && inviteLists.length > 0) {
        setTier2Eligible(false);
        setTier3Status(null);
        setQuotientStatus(null);
        return;
      }

      // Check Tier 2 (local CSV whitelist)
      const isT2 = isTier2Eligible(address);
      setTier2Eligible(isT2);
      
      // If eligible for T2, don't check T3 or Quotient
      if (isT2) {
        setTier3Status(null);
        setQuotientStatus(null);
        return;
      }

      // Check Tier 3 (database registrations)
      try {
        const response = await fetch(`/api/whitelist/check-wallet?address=${address}`);
        const data = await response.json();
        
        if (data.success && data.isRegistered) {
          setTier3Status({
            isRegistered: true,
            username: data.registration?.username,
          });
          setQuotientStatus(null);
          return; // T3 eligible, skip Quotient check
        } else {
          setTier3Status({ isRegistered: false });
        }
      } catch (error) {
        console.error("Failed to check Tier 3 eligibility:", error);
        setTier3Status({ isRegistered: false });
      }

      // If not eligible for T1/T2/T3, check Quotient score for public mint eligibility
      // Only check if user has a Farcaster account (needs FID)
      if (user?.fid) {
        setIsCheckingQuotient(true);
        try {
          const quotientResponse = await fetch('/api/quotient', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fid: user.fid })
          });
          const quotientData = await quotientResponse.json();
          console.log(quotientData)
          
          if (quotientData.success) {
            setQuotientStatus({
              score: quotientData.quotientScore,
              minScore: quotientData.minScore,
              isEligible: quotientData.isEligible,
              checked: true,
              conditions: quotientData.conditions || [],
              meetsReputationThreshold: quotientData.meetsReputationThreshold ?? false,
            });
          } else {
            console.warn("Quotient API error:", quotientData.error);
            setQuotientStatus({
              score: 0,
              minScore: 0.5,
              isEligible: false,
              checked: true,
              conditions: [],
              meetsReputationThreshold: false,
            });
          }
        } catch (error) {
          console.error("Failed to fetch Quotient score:", error);
          setQuotientStatus({
            score: 0,
            minScore: 0.5,
            isEligible: false,
            checked: true,
            conditions: [],
            meetsReputationThreshold: false,
          });
        } finally {
          setIsCheckingQuotient(false);
        }
      }
    };

    checkTierEligibility();
  }, [address, inviteLists, user?.fid, quotientCheckTrigger]);

  // Minting function
  const { mutate: mint, isPending: isMinting } = useMutation({
    mutationFn: async () => {
      if (!address || !collection || !inviteLists || inviteLists.length === 0) {
        throw new Error("Missing required data for minting");
      }

      if (!isConnected) {
        throw new Error("Wallet not connected. Please connect your wallet first.");
      }

      // Force switch to active chain if not already on it
      const targetChainId = ACTIVE_CHAIN.id;

      // Always try to switch to ensure we're on the right chain
      // This handles both undefined chainId and wrong chain cases
      if (!chainId || chainId !== targetChainId) {
        try {
          await switchChain(config, { chainId: targetChainId });
          // Wait a moment for the chain switch to propagate
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          console.error("❌ Failed to switch chain:", error);
          // If user rejected, throw a clearer message
          if (error?.code === 4001 || error?.message?.includes('rejected')) {
            throw new Error("Chain switch was rejected. Please approve the network switch to mint.");
          }
          throw new Error(`Please switch to ${ACTIVE_CHAIN.name} network to mint`);
        }
      } else {
      }

      // Use the first eligible list for minting
      const listToMint = inviteLists[0];
      
      
      // First we hit the Scatter API to generate the mint transaction data
      const mintResponse = await fetch(`${SCATTER_API_URL}/mint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          collectionAddress: collection.address,
          chainId: collection.chain_id,
          minterAddress: address,
          lists: [{ id: listToMint.id, quantity: 1 }],
        }),
      }).then((res) => res.json());


      const mintTransaction = mintResponse.mintTransaction;

      // If the mint costs ERC20s, we need to approve them first
      if (mintResponse.erc20s && mintResponse.erc20s.length > 0) {
        for (const erc20 of mintResponse.erc20s) {
          
          // Check if the user has enough allowance for the mint already
          const allowance = await readContract(config, {
            abi: erc20Abi,
            address: erc20.address as `0x${string}`,
            functionName: "allowance",
            chainId: collection.chain_id,
            args: [address as `0x${string}`, collection.address as `0x${string}`],
          });


          // If not, approve the max amount before minting
          if (allowance < BigInt(erc20.amount)) {
            await writeContract(config, {
              abi: erc20Abi,
              address: erc20.address as `0x${string}`,
              functionName: "approve",
              chainId: collection.chain_id,
              args: [collection.address as `0x${string}`, maxUint256],
            });
          } else {
          }
        }
      }

      // Now we trigger the mint transaction
      const txHash = await sendTransactionAsync({
        to: mintTransaction.to as `0x${string}`,
        value: BigInt(mintTransaction.value),
        data: mintTransaction.data as `0x${string}`,
        chainId: collection.chain_id,
      });

      
      return txHash;
    },
    onError: (error: any) => {
      console.error("❌ Mint mutation failed:", error);
      
      // Check if it's a wallet/connection error
      const errorMessage = error?.message?.toLowerCase() || '';
      const isWalletError = 
        errorMessage.includes('connect') ||
        errorMessage.includes('disconnect') ||
        errorMessage.includes('rejected') ||
        errorMessage.includes('user denied') ||
        errorMessage.includes('not connected') ||
        errorMessage.includes('no provider') ||
        errorMessage.includes('wallet') ||
        error?.code === 4001 ||
        error?.code === -32002 ||
        !isConnected;
      
      if (isWalletError) {
        setNeedsReconnect(true);
      } else {
        alert(`Mint failed: ${error.message}`);
      }
    },
    onSuccess: async (txHash) => {
      setMintSuccess(true);
      setIsLoadingMintedNFT(true);

      // Helper function to fetch and check for metadata
      const fetchNftWithMetadata = async (): Promise<any | null> => {
        const response = await fetch(
          `${SCATTER_API_URL}/collection/${COLLECTION_SLUG}/nfts?ownerAddress=${address}`
        );
        const result = await response.json();
        
        if (result.data && result.data.length > 0) {
          // Get the most recently minted NFT (highest token_id)
          const sortedNfts = [...result.data].sort((a: any, b: any) =>
            Number(b.token_id) - Number(a.token_id)
          );
          const latestNft = sortedNfts[0];
          
          // Check if metadata is available (image_url is set)
          if (latestNft.image_url || latestNft.image) {
            return { ...latestNft, hasMetadata: true };
          }
          return { ...latestNft, hasMetadata: false };
        }
        return null;
      };

      try {
        // Initial wait for Scatter to index the transaction
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Poll until we get the REAL metadata (not just the NFT record)
        const maxAttempts = 15; // Up to 45 seconds total
        let attempts = 0;
        let foundNftWithMetadata = false;

        while (attempts < maxAttempts && !foundNftWithMetadata) {
          attempts++;
          
          const latestNft = await fetchNftWithMetadata();
          
          if (latestNft) {
            
            // Only show the NFT when we have REAL metadata (actual image, not fallback)
            if (latestNft.hasMetadata && (latestNft.image_url || latestNft.image)) {
              const nftName = latestNft.name || `Protardio #${latestNft.token_id}`;
              const nftImage = latestNft.image_url || latestNft.image;
              
              setMintedNFT({
                tokenId: latestNft.token_id,
                name: nftName,
                image: nftImage,
              });
              setIsLoadingMintedNFT(false);
              foundNftWithMetadata = true;
              

              // 🚀 Call server-side save with actual metadata
              setIsSavingToDb(true);
              const saveResult = await saveMintToDatabase({
                tokenId: Number(latestNft.token_id),
                minterFid: user?.fid || 0,
                minterWallet: address || "",
                minterUsername: user?.username || undefined,
                txHash: txHash,
              });
              setSavedToDb(!!saveResult?.success);
              setIsSavingToDb(false);

          
            } else {
              // Metadata not ready yet, wait and try again
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          } else {
            // NFT not found yet, wait and try again
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }

        if (!foundNftWithMetadata) {
          console.warn("⚠️ [Mint] Timeout waiting for metadata - showing fallback");
          // Even on timeout, try to show something
          const latestNft = await fetchNftWithMetadata();
          if (latestNft) {
            setMintedNFT({
              tokenId: latestNft.token_id,
              name: latestNft.name || `Protardio #${latestNft.token_id}`,
              image: latestNft.image_url || latestNft.image || "",
            });

            // 🚀 Save mint even without full metadata - server will poll for metadata
            setIsSavingToDb(true);
            const saveResult = await saveMintToDatabase({
              tokenId: Number(latestNft.token_id),
              minterFid: user?.fid || 0,
              minterWallet: address || "",
              minterUsername: user?.username || undefined,
              txHash: txHash,
            });
            setSavedToDb(!!saveResult?.success);
            setIsSavingToDb(false);
          }
          setIsLoadingMintedNFT(false);
        }
      } catch (error) {
        console.error("Failed to fetch minted NFT:", error);
        setIsLoadingMintedNFT(false);

        // 🚀 Even on error, try to save the mint - attempt one final fetch
        try {
          const response = await fetch(
            `${SCATTER_API_URL}/collection/${COLLECTION_SLUG}/nfts?ownerAddress=${address}`
          );
          const result = await response.json();

          if (result.data && result.data.length > 0) {
            const sortedNfts = [...result.data].sort((a: any, b: any) =>
              Number(b.token_id) - Number(a.token_id)
            );
            const latestNft = sortedNfts[0];

            if (latestNft.token_id) {
              setIsSavingToDb(true);
              const saveResult = await saveMintToDatabase({
                tokenId: Number(latestNft.token_id),
                minterFid: user?.fid || 0,
                minterWallet: address || "",
                minterUsername: user?.username || undefined,
                txHash: txHash,
              });
              setSavedToDb(!!saveResult?.success);
              setIsSavingToDb(false);
            }
          }
        } catch (saveError) {
          console.error("❌ [Mint] Failed to save mint in error path:", saveError);
        }
      }
    },
  });

  const openFarcasterProfile = () => {
    window.open("https://warpcast.com/protardio", "_blank");
  };

  return (
     <div
      className="relative overflow-hidden font-victor text-white h-screen w-screen flex items-center justify-center bg-radial-mint"
    >
      {/* Content Layer */}
      <div className="relative z-20 flex flex-col items-center pt-3 px-4 h-full w-full">
        
        {/* Top Bar - Back | Title | Mint */}
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
           
           {/* Mint Label */}
           <div className="bg-[#51FF00] text-black rounded-[60px] px-4 h-[42px] flex items-center justify-center shadow-lg">
             <span className="font-victor font-bold italic text-[18px]">Mint</span>
           </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-start w-full max-w-[380px] mt-4">
          
          {/* Phase Label */}
          <div className="mb-3 pt-5">
            <span className="font-victor font-bold text-[#FFFF00] tracking-wider drop-shadow-md text-[15px]">
              {inviteLists && inviteLists[0] ? inviteLists[0].name : "Phase 1"}
            </span>
          </div>

          {/* Username Display */}
          <div className="w-full flex justify-center mb-3">
            <div className="w-[332px] h-[45px] bg-[#B011FF] text-white rounded-[60px] px-6 font-victor font-bold italic text-[23px] flex items-center justify-center shadow-lg shadow-purple-glow">
              <span>@{user?.username}</span>
            </div>
          </div>

          {/* Eligibility Message */}
          <div className="w-full flex justify-center mb-3">
            {inviteLists && inviteLists.length > 0 && !hasReachedLimit ? (
              <div
                className="w-[332px] h-[45px] bg-[#51FF01] text-black rounded-[60px] px-6 font-victor font-bold italic text-[20px] flex items-center justify-center shadow-lg shadow-green-glow"
              >
                eligible! 🎉 {walletLimit > 0 && `(${walletLimit - Number(walletMintedCount || 0)} left)`}
              </div>
            ) : hasReachedLimit ? (
              <div
                className="w-[332px] h-[45px] bg-[#FF0000] text-white rounded-[60px] px-6 font-victor font-bold italic text-[20px] flex items-center justify-center shadow-lg shadow-red-glow"
              >
                limit reached ({walletMintedCount}/{walletLimit})
              </div>
            ) : tier2Eligible ? (
              <div
                className="w-[332px] h-[45px] bg-[#FFFF00] text-black rounded-[60px] px-6 font-victor font-bold italic text-[16px] flex items-center justify-center shadow-lg"
              >
                T2 eligible ⏳ Coming Soon!
              </div>
            ) : tier3Status?.isRegistered ? (
              <div
                className="w-[332px] h-[45px] bg-[#FFFF00] text-black rounded-[60px] px-6 font-victor font-bold italic text-[16px] flex items-center justify-center shadow-lg"
              >
                T3 eligible ⏳ Coming Soon!
              </div>
            ) : isCheckingQuotient ? (
              <div
                className="w-[332px] h-[45px] bg-white/20 text-white rounded-[60px] px-6 font-victor font-bold italic text-[16px] flex items-center justify-center shadow-lg gap-2"
              >
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Checking eligibility...
              </div>
            ) : quotientStatus?.isEligible ? (
              <div
                className="w-[332px] h-[45px] bg-[#51FF01] text-black rounded-[60px] px-6 font-victor font-bold italic text-[16px] flex items-center justify-center shadow-lg shadow-green-glow"
              >
                Public mint eligible! 🎉 (Score: {(quotientStatus.score * 100).toFixed(0)}%)
              </div>
            ) : quotientStatus?.checked && !followsProtardio ? (
              <div
                className="w-[332px] h-[45px] bg-[#FFA500] text-black rounded-[60px] px-6 font-victor font-bold italic text-[16px] flex items-center justify-center shadow-lg"
              >
                Follow @protardio to mint
              </div>
            ) : quotientStatus?.checked && !quotientStatus.meetsReputationThreshold ? (
              <div
                className="w-[332px] h-[45px] bg-[#FF0000] text-white rounded-[60px] px-6 font-victor font-bold italic text-[14px] flex items-center justify-center shadow-lg shadow-red-glow"
              >
                Score too low: {(quotientStatus.score * 100).toFixed(0)}% (need {(quotientStatus.minScore * 100).toFixed(0)}%)
              </div>
            ) : (
              <div
                className="w-[332px] h-[45px] bg-[#FF0000] text-white rounded-[60px] px-6 font-victor font-bold italic text-[23px] flex items-center justify-center shadow-lg shadow-red-glow"
              >
                not eligible :(
              </div>
            )}
          </div>

          {/* Who's eligible link */}
          <div className="mb-3">
            <a
              href="https://farcaster.xyz/protardio/0x48272c73"
              target="_blank"
              rel="noopener noreferrer"
              className="font-victor font-bold text-[15px] text-[#FFFF00] tracking-wider hover:underline"
            >
              Who&apos;s eligible?
            </a>
          </div>

          {/* Friends who have already minted */}
          <FriendsWhoMinted />

          {/* Character/NFT Preview with 3D GIF */}
          <div className="relative mb-3">
            <div 
              className="relative w-[200px] h-[200px] "
              
            >
              {/* 3D GIF */}
              <img 
                src="/assets/gifs/3dgifmaker96061.gif"
                alt="NFT Preview"
                className="w-full h-full object-cover"
              />
              
              {/* Blue selection box overlay */}
              {/* <div className="absolute inset-0 border-2 border-blue-400 opacity-50"></div> */}
            </div>
            
            {/* Dimensions Label */}
           
          </div>

          {/* Minted Counter */}
          <div className="mb-3">
            <span className="font-victor font-bold text-[15px] text-[#FFFF00] tracking-wider">
              {collection ? `${collection.num_items}/${collection.max_items} minted` : "Loading..."}
            </span>
          </div>

          {/* Mint Button - Main Action */}
          <div className="w-full mb-2 max-w-[332px]">
            {needsReconnect ? (
              /* Sign in to mint button - shown when wallet disconnected */
              <button
                onClick={async () => {
                  setIsReconnecting(true);
                  try {
                    // Find the farcasterFrame connector first
                    const farcasterConnector = connectors.find(c => c.id === 'farcasterFrame');
                    const connector = farcasterConnector || connectors[0];

                    if (connector) {
                      await connect({ connector });
                      setNeedsReconnect(false);
                    }
                  } catch (e) {
                    console.error("Failed to reconnect:", e);
                  } finally {
                    setIsReconnecting(false);
                  }
                }}
                disabled={isReconnecting}
                className="w-full h-[60px] bg-[#B011FF] text-white rounded-[60px] font-victor font-bold italic text-[20px] flex items-center justify-center gap-3 hover:scale-105 transition-transform shadow-lg disabled:opacity-50"
              >
                {isReconnecting ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <LogIn size={24} />
                    Sign in to mint
                  </>
                )}
              </button>
            ) : quotientStatus?.checked && !followsProtardio ? (
              /* Follow Protardio button - shown when user doesn't follow */
              <button
                onClick={async () => {
                  await viewProfile(PROTARDIO_FID);
                  // Re-check eligibility after 3 seconds
                  setTimeout(() => {
                    setQuotientCheckTrigger((prev) => prev + 1);
                  }, 3000);
                }}
                className="w-full h-[60px] bg-[#B011FF] text-white rounded-[60px] font-victor font-bold italic text-[20px] flex items-center justify-center gap-3 hover:scale-105 transition-transform shadow-lg"
              >
                Follow @protardio to mint
              </button>
            ) : quotientStatus?.checked && !quotientStatus.meetsReputationThreshold ? (
              /* Score too low - show disabled button */
              <button
                disabled
                className="w-full h-[60px] bg-gray-500 text-white rounded-[60px] font-victor font-bold italic text-[18px] flex items-center justify-center shadow-lg opacity-50 cursor-not-allowed"
              >
                Score too low to mint
              </button>
            ) : isPhase1Over ? (
              /* Phase 1 Over - 5000 minted */
              <button
                disabled
                className="w-full h-[60px] bg-gray-500 text-white rounded-[60px] font-victor font-bold italic text-[24px] flex items-center justify-center shadow-lg opacity-50 cursor-not-allowed"
              >
                Phase 1 Over
              </button>
            ) : (
              /* Regular mint button */
              <button
                onClick={() => {
                  setNeedsReconnect(false); // Reset on new attempt
                  mint();
                }}
                disabled={!isConnected || !inviteLists || inviteLists.length === 0 || isMinting || hasReachedLimit}
                className="w-full h-[60px] bg-[#51FF01] text-black rounded-[60px] font-victor font-bold italic text-[24px] flex items-center justify-between px-6 hover:scale-105 transition-transform shadow-lg shadow-yellow-glow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-[16px]">{isMinting ? "Minting..." : "Hurry"}</span>
                <span className="text-[32px]">Mint</span>
                <span className="text-[16px]">
                  {inviteLists && inviteLists[0]
                    ? (inviteLists[0].token_price === "0" ? "FREE" : `${inviteLists[0].token_price} ${inviteLists[0].currency_symbol}`)
                    : "---"
                  }
                </span>
              </button>
            )}
          </div>

          {/* Mint Dropdown */}
          

        </div>

        {/* Footer */}
        <div className="flex justify-between px-8 pb-7 text-sm font-victor text-white/80 gap-7">
          <button onClick={openFarcasterProfile} className="hover:text-white">(farcaster)</button>
          <a href="https://x.com/protardio" target="_blank" rel="noopener noreferrer" className="hover:text-white">(x)</a>
          <a href="https://opensea.io/collection/protardio-citizens" target="_blank" rel="noopener noreferrer" className="hover:text-white">(opensea)</a>
        </div>

      </div>

      {/* Minting Loading Overlay */}
      {isMinting && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6">
            {/* Spinning NFT Preview */}
            <div className="relative">
              <img 
                src="/assets/gifs/3dgifmaker96061.gif"
                alt="Minting..."
                className="w-[200px] h-[200px] object-cover animate-pulse"
              />
              <div className="absolute inset-0 border-4 border-[#51FF01] rounded-lg animate-spin" style={{animationDuration: '3s'}}></div>
            </div>
            
            {/* Loading Text */}
            <div className="text-center">
              <h2 className="font-['Bitcount'] text-[32px] text-white mb-2 animate-pulse">
                Minting Your Protardio...
              </h2>
              <p className="font-victor text-[#FFFF00] text-[16px]">
                Please confirm the transaction in your wallet
              </p>
            </div>

            {/* Loading Dots */}
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-[#51FF01] rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
              <div className="w-3 h-3 bg-[#51FF01] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              <div className="w-3 h-3 bg-[#51FF01] rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {mintSuccess && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center animate-fadeIn">
          <div className="flex flex-col items-center gap-6 px-4 max-w-[400px] w-full">
            {/* Success Icon */}
            <div className="relative">
              <div className="w-20 h-20 bg-[#51FF01] rounded-full flex items-center justify-center  animate-scaleIn">
                <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Congratulations Text */}
            <div className="text-center">
              <h2 className="font-['Bitcount'] text-[36px] text-[#51FF01] mb-2 drop-shadow-[0_0_20px_rgba(81,255,0,0.5)]">
                Congratulations!
              </h2>
              <p className="font-victor text-white text-[18px] mb-4 ">
                You have successfully minted
              </p>
            </div>

            {/* NFT Preview */}
            <div className="relative mb-6 animate-scaleIn" style={{animationDelay: '0.2s'}}>
              {isLoadingMintedNFT ? (
                <div className="w-[220px] h-[220px] bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
                  <div className="flex flex-col items-center justify-center gap-3 text-center w-full">
                    <span className="text-[40px] animate-bounce">🎨</span>
                    <span className="text-white font-victor font-bold text-[16px] animate-pulse text-center">
                      Loading your Protardio...
                    </span>
                  </div>
                </div>
              ) : mintedNFT?.image ? (
                <img
                  src={mintedNFT.image}
                  alt={mintedNFT?.name || "Your Protardio NFT"}
                  className="w-[220px] h-[220px] object-cover rounded-lg shadow-2xl"
                />
              ) : (
                <div className="w-[220px] h-[220px] bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
                  <span className="text-white font-victor font-bold text-[14px] text-center px-4">
                    Image unavailable
                  </span>
                </div>
              )}
              <div className="absolute -inset-2 bg-gradient-to-r from-[#51FF01] via-[#FFFF00] to-[#B011FF] rounded-lg opacity-50 blur-xl -z-10"></div>
            </div>

            {/* Protardio Text */}
            <h3 className="font-['Bitcount'] text-[28px] text-white mb- tracking-wider drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
              {mintedNFT?.name || "Your Protardio!"}
            </h3>

            {/* View in Gallery Button */}
            <button
              onClick={() => {
                setMintSuccess(false);
                setMintedNFT(null);
                setSavedToDb(false);
                setIsSavingToDb(false);
                if (onNavigateToGallery) {
                  onNavigateToGallery();
                }
              }}
              disabled={isSavingToDb || isLoadingMintedNFT}
              className={`w-full max-w-[332px] h-[60px] rounded-[60px] font-victor font-bold italic text-[24px] flex items-center justify-center transition-transform shadow-lg animate-scaleIn ${
                isSavingToDb || isLoadingMintedNFT
                  ? 'bg-white/30 text-white/60 cursor-not-allowed'
                  : 'bg-[#51FF01] text-black hover:scale-105 shadow-green-glow'
              }`}
              style={{animationDelay: '0.4s'}}
            >
              {isSavingToDb ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : isLoadingMintedNFT ? (
                'Loading...'
              ) : (
                'View in Gallery'
              )}
            </button>

          </div>
        </div>
      )}
    </div>
  );
}

export default MintPage;
