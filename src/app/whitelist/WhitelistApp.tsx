'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useAccount, useConnect } from 'wagmi';
import { CRTEffects } from '~/components/whitelist/CRTEffects';
import { LoadingScreen } from '~/components/whitelist/LoadingScreen';
import { Header } from '~/components/whitelist/Header';
import { StatusIndicator } from '~/components/whitelist/StatusIndicator';
import { AllowlistFullModal } from '~/components/whitelist/AllowlistFullModal';
import { initializeSdk, signInWithFarcaster, composeCast, openUrl } from '~/lib/whitelist-farcaster';
import type { FarcasterUser, VerificationState, NftHolding } from '~/types/whitelist';
import { RotateCcw, Loader2 } from 'lucide-react';

type Screen = 'loading' | 'landing' | 'verification' | 'success' | 'already-registered';

interface UserData extends FarcasterUser {
  neynarScore: number;
  walletAddress: string;
  nftHoldings?: NftHolding[];
}

interface RegistrationStatus {
  count: number;
  cap: number;
  isFull: boolean;
  spotsRemaining: number | null;
}

export function WhitelistApp() {
  // SDK wallet - connected wallet from Farcaster/Warpcast
  const { address: sdkWalletAddress, isConnected: isWalletConnected } = useAccount();
  const { connect, connectors } = useConnect();

  const [screen, setScreen] = useState<Screen>('loading');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [glitchActive, setGlitchActive] = useState(false);

  // Registration capacity
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus | null>(null);
  const [showFullModal, setShowFullModal] = useState(false);
  
  // Verification states
  const [nftCheck, setNftCheck] = useState<VerificationState>('idle');
  const [scoreCheck, setScoreCheck] = useState<VerificationState>('idle');
  const [followCheck, setFollowCheck] = useState<VerificationState>('idle');
  const [hasShared, setHasShared] = useState(false);
  const [isVerifyingShare, setIsVerifyingShare] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Error states
  const [nftError, setNftError] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);

  // Ref to prevent double initialization in React StrictMode
  const hasInitializedRef = useRef(false);

  // Initialize SDK on mount - call ready() to dismiss splash
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    initializeSdk().catch(console.error);
  }, []);
  
  // Check registration status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/whitelist/registration-status');
        const data = await response.json();
        if (data.success) {
          setRegistrationStatus({
            count: data.count,
            cap: data.cap,
            isFull: data.isFull,
            spotsRemaining: data.spotsRemaining,
          });
          // Show modal immediately if full
          if (data.isFull) {
            setShowFullModal(true);
          }
        }
      } catch (error) {
        console.error('Error checking registration status:', error);
      }
    };
    checkStatus();
  }, []);
  
  // Random glitch effect
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.97) {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 100);
      }
    }, 100);
    return () => clearInterval(glitchInterval);
  }, []);
  
  const triggerGlitch = useCallback(() => {
    setGlitchActive(true);
    setTimeout(() => setGlitchActive(false), 150);
  }, []);
  
  const handleLoadingComplete = useCallback(() => {
    setScreen('landing');
  }, []);
  
  // Go back to landing (reset state but skip loading animation)
  const handleGoToLanding = useCallback(() => {
    // Reset verification states
    setScoreCheck('idle');
    setNftCheck('idle');
    setFollowCheck('idle');
    setHasShared(false);
    setScoreError(null);
    setNftError(null);
    setFollowError(null);
    setUserData(null);
    setIsConnecting(false);
    setIsCheckingEligibility(false);
    // Go to landing without triggering loading animation
    setScreen('landing');
  }, []);
  
  // Verify NFT holdings
  const verifyNft = useCallback(async (walletAddress: string) => {
    setNftCheck('checking');
    setNftError(null);
    
    try {
      const response = await fetch('/api/whitelist/verify-nft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setNftCheck('failed');
        setNftError(data.error || 'Verification failed');
        return null;
      }
      
      if (!data.holds) {
        setNftCheck('failed');
        setNftError(`No eligible NFTs found. Must hold FIDPUNKS, Warplets, World Computer Club, or ICCM Syndicate`);
        return null;
      }
      
      setNftCheck('passed');
      return {
        holdings: data.holdings,
        totalBalance: data.totalBalance,
      };
    } catch (error) {
      console.error('NFT verification error:', error);
      setNftCheck('failed');
      setNftError('Network error. Try again.');
      return null;
    }
  }, []);
  
  // Verify Neynar score
  const verifyScore = useCallback(async (fid: number) => {
    setScoreCheck('checking');
    setScoreError(null);
    
    try {
      const response = await fetch('/api/whitelist/verify-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setScoreCheck('failed');
        setScoreError(data.error || 'Verification failed');
        return null;
      }
      
      if (!data.meetsThreshold) {
        setScoreCheck('failed');
        setScoreError(`Score ${data.score} below ${data.threshold} threshold. not eligible :(`);
        return null;
      }
      
      setScoreCheck('passed');
      return {
        score: data.score,
        user: data.user,
      };
    } catch (error) {
      console.error('Score verification error:', error);
      setScoreCheck('failed');
      setScoreError('Network error. Try again.');
      return null;
    }
  }, []);
  
  // Verify follow status
  const verifyFollow = useCallback(async (fid: number) => {
    setFollowCheck('checking');
    setFollowError(null);
    
    try {
      const response = await fetch('/api/whitelist/verify-follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setFollowCheck('failed');
        setFollowError(data.error || 'Verification failed');
        return false;
      }
      
      if (!data.isFollowing) {
        setFollowCheck('failed');
        setFollowError('Must follow @protardio to register');
        return false;
      }
      
      setFollowCheck('passed');
      return true;
    } catch (error) {
      console.error('Follow verification error:', error);
      setFollowCheck('failed');
      setFollowError('Network error. Try again.');
      return false;
    }
  }, []);
  
  // Check existing registration
  const checkExistingRegistration = useCallback(async (fid: number) => {
    try {
      const response = await fetch(`/api/whitelist/check-registration?fid=${fid}`);
      const data = await response.json();
      
      if (data.success && data.isRegistered) {
        return data.registration;
      }
      return null;
    } catch {
      return null;
    }
  }, []);
  
  // Handle sign in
  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    triggerGlitch();
    
    try {
      const user = await signInWithFarcaster();
      
      if (!user) {
        setIsConnecting(false);
        return;
      }
      
      // Check if already registered
      const existingReg = await checkExistingRegistration(user.fid);
      if (existingReg) {
        setUserData({
          ...user,
          neynarScore: existingReg.neynar_score,
          walletAddress: existingReg.wallet_address,
        });
        setScreen('already-registered');
        setIsConnecting(false);
        return;
      }
      
      // Switch to checking eligibility state
      setIsConnecting(false);
      setIsCheckingEligibility(true);

      // Try to connect wallet if not already connected
      if (!isWalletConnected && connectors.length > 0) {
        try {
          // Try farcasterFrame connector first (index 0)
          connect({ connector: connectors[0] });
          // Give it a moment to connect
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.error('Failed to connect wallet:', e);
        }
      }

      // Get wallet address from SDK (connected wallet in Warpcast)
      // Fall back to Neynar if SDK wallet not available
      const scoreResult = await verifyScore(user.fid);

      // Use SDK wallet if available, otherwise fall back to Neynar wallet
      const walletAddress = sdkWalletAddress
        || scoreResult?.user.primaryAddress
        || scoreResult?.user.verifiedAddresses[0]
        || scoreResult?.user.custodyAddress
        || '';

      if (!walletAddress) {
        setUserData({
          ...user,
          neynarScore: scoreResult?.score || 0,
          walletAddress: '',
        });
        setNftCheck('failed');
        setNftError('No wallet connected. Please connect your wallet in Warpcast.');
        setIsCheckingEligibility(false);
        setScreen('verification');
        return;
      }

      if (scoreResult) {
        // Verify NFT holdings using SDK wallet
        const nftResult = await verifyNft(walletAddress);

        setUserData({
          ...user,
          username: scoreResult.user.username,
          displayName: scoreResult.user.displayName,
          pfpUrl: scoreResult.user.pfpUrl,
          neynarScore: scoreResult.score,
          walletAddress: walletAddress,
          nftHoldings: nftResult?.holdings || [],
        });

        // Start follow verification (parallel with NFT check result)
        await verifyFollow(user.fid);
      } else {
        // Score failed but still show user data
        setUserData({
          ...user,
          neynarScore: 0,
          walletAddress: walletAddress,
        });
      }
      
      setIsCheckingEligibility(false);
      setScreen('verification');
    } catch (error) {
      console.error('Connection error:', error);
      setIsCheckingEligibility(false);
    } finally {
      setIsConnecting(false);
    }
  }, [triggerGlitch, checkExistingRegistration, verifyScore, verifyNft, verifyFollow, sdkWalletAddress, isWalletConnected, connect, connectors]);
  
  // Handle share
  const handleShare = useCallback(async () => {
    const appUrl = "https://whitelist.protardio.xyz"
    const shareText = `Registering for Protardio Phase 1! 🎨\n\n10,000 wartime farcaster pfps\n\nJoin the allowlist:`;
    
    await composeCast(shareText, appUrl);
    
    // Simulate verification delay (honor system with friction)
    setIsVerifyingShare(true);
    await new Promise(r => setTimeout(r, 2500));
    setHasShared(true);
    setIsVerifyingShare(false);
  }, []);
  
  // Handle follow action
  const handleFollowAction = useCallback(async () => {
    await openUrl('https://warpcast.com/protardio');
    
    // Re-verify after delay
    setTimeout(async () => {
      if (userData) {
        await verifyFollow(userData.fid);
      }
    }, 3000);
  }, [userData, verifyFollow]);
  
  // Handle refresh all checks
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefreshChecks = useCallback(async () => {
    if (!userData) return;
    
    setIsRefreshing(true);
    
    // Reset states
    setScoreCheck('idle');
    setNftCheck('idle');
    setFollowCheck('idle');
    setScoreError(null);
    setNftError(null);
    setFollowError(null);
    
    try {
      // Re-run all verifications
      const scoreResult = await verifyScore(userData.fid);
      
      if (scoreResult) {
        const walletAddress = scoreResult.user.verifiedAddresses[0] || scoreResult.user.custodyAddress;
        await verifyNft(walletAddress);
        
        // Update user data with fresh info
        setUserData(prev => prev ? {
          ...prev,
          neynarScore: scoreResult.score,
          walletAddress: walletAddress,
        } : null);
      }
      
      await verifyFollow(userData.fid);
    } catch (error) {
      console.error('Refresh checks error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [userData, verifyScore, verifyNft, verifyFollow]);
  
  // Handle registration
  const handleRegister = useCallback(async () => {
    if (!userData || isRegistering) return;
    
    // Check if already known to be full
    if (registrationStatus?.isFull) {
      setShowFullModal(true);
      return;
    }
    
    setIsRegistering(true);
    triggerGlitch();
    
    try {
      const response = await fetch('/api/whitelist/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid: userData.fid,
          walletAddress: userData.walletAddress,
          // Server verifies everything else (score, NFT, follow status)
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setScreen('success');
      } else if (data.alreadyRegistered) {
        setScreen('already-registered');
      } else if (data.isFull) {
        // Allowlist is full
        setRegistrationStatus({
          count: data.count,
          cap: data.cap,
          isFull: true,
          spotsRemaining: 0,
        });
        setShowFullModal(true);
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  }, [userData, triggerGlitch, registrationStatus, isRegistering]);
  
  const canRegister = nftCheck === 'passed' && scoreCheck === 'passed' && followCheck === 'passed' && hasShared;
  
  return (
    <div 
      className={`min-h-screen w-full bg-protardio-bg relative overflow-hidden ${glitchActive ? 'animate-glitch' : ''}`}
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        backgroundColor: '#0a0a0a'
      }}
    >
      <CRTEffects />
      
      {/* Eligibility Checking Overlay */}
      {isCheckingEligibility && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="text-center px-6">
            {/* Animated Scanner */}
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-protardio-green/30 rounded-lg" />
              <div className="absolute inset-0 border-t-4 border-protardio-green rounded-lg animate-spin" style={{ animationDuration: '1.5s' }} />
              <div className="absolute inset-3 border-2 border-protardio-magenta/30 rounded" />
              <div className="absolute inset-3 border-t-2 border-protardio-magenta rounded animate-spin" style={{ animationDuration: '1s', animationDirection: 'reverse' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl animate-pulse">🔍</span>
              </div>
            </div>
            
            {/* Text */}
            <h2 
              className="text-protardio-green text-sm sm:text-base mb-2 font-pixel tracking-wider"
              style={{ textShadow: '0 0 20px rgba(0, 255, 0, 0.6)' }}
            >
              CHECKING ELIGIBILITY
            </h2>
            
            {/* Animated dots */}
            <div className="flex items-center justify-center gap-1 mb-4">
              <span className="text-protardio-green text-xl animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
              <span className="text-protardio-green text-xl animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
              <span className="text-protardio-green text-xl animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
            </div>
            
            {/* Status indicators */}
            <div className="space-y-2 font-mono text-xs text-left max-w-xs mx-auto">
              <div className="flex items-center gap-2">
                <span className={scoreCheck === 'checking' ? 'text-yellow-400 animate-pulse' : scoreCheck === 'passed' ? 'text-protardio-green' : 'text-gray-500'}>
                  {scoreCheck === 'checking' ? '⏳' : scoreCheck === 'passed' ? '✓' : '○'}
                </span>
                <span className={scoreCheck === 'checking' ? 'text-yellow-400' : scoreCheck === 'passed' ? 'text-protardio-green' : 'text-gray-500'}>
                  Neynar Score
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={nftCheck === 'checking' ? 'text-yellow-400 animate-pulse' : nftCheck === 'passed' ? 'text-protardio-green' : nftCheck === 'failed' ? 'text-red-500' : 'text-gray-500'}>
                  {nftCheck === 'checking' ? '⏳' : nftCheck === 'passed' ? '✓' : nftCheck === 'failed' ? '✗' : '○'}
                </span>
                <span className={nftCheck === 'checking' ? 'text-yellow-400' : nftCheck === 'passed' ? 'text-protardio-green' : nftCheck === 'failed' ? 'text-red-500' : 'text-gray-500'}>
                  NFT Holdings
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={followCheck === 'checking' ? 'text-yellow-400 animate-pulse' : followCheck === 'passed' ? 'text-protardio-green' : 'text-gray-500'}>
                  {followCheck === 'checking' ? '⏳' : followCheck === 'passed' ? '✓' : '○'}
                </span>
                <span className={followCheck === 'checking' ? 'text-yellow-400' : followCheck === 'passed' ? 'text-protardio-green' : 'text-gray-500'}>
                  Follow Status
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading Screen */}
      {screen === 'loading' && (
        <LoadingScreen onComplete={handleLoadingComplete} />
      )}
      
      {/* Main App */}
      {screen !== 'loading' && (
        <div className="relative z-10 min-h-screen flex flex-col overflow-y-auto">
          <Header onLogoClick={handleGoToLanding} />
          
          {/* Landing Screen */}
          {screen === 'landing' && (
            <main className="flex-1 flex flex-col items-center px-4 py-4 sm:py-6 pb-8 overflow-y-auto">
              {/* Logo */}
              {/* <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4 relative">
                <Image
                  src="/whitelist/logo.png"
                  alt="Protardio"
                  fill
                  className="object-contain drop-shadow-[0_0_20px_rgba(255,0,0,0.3)]"
                  unoptimized
                />
              </div> */}
              
              {/* Phase banner */}
              <div className="mb-4 sm:mb-6 relative inline-block">
                <div className="bg-protardio-red px-4 sm:px-6 py-1.5 sm:py-2 transform -rotate-1 border-2 sm:border-4 border-red-900 shadow-lg">
                  <span className="text-white text-lg sm:text-2xl tracking-widest font-pixel" style={{ textShadow: '2px 2px 0 #000' }}>
                    PHASE 1
                  </span>
                </div>
              </div>
              
              <h2 className="text-protardio-green text-base sm:text-xl mb-2 font-pixel" style={{ textShadow: '0 0 15px rgba(0,255,0,0.6)' }}>
                TIER 3 ALLOWLIST
              </h2>
              
              <p className="text-gray-400 font-mono text-xs sm:text-sm max-w-xs mx-auto leading-relaxed px-4 text-center">
                10,000 wartime farcaster pfps<br/>
                <span className="text-protardio-magenta">remilio-chan subculturae</span>
              </p>
              
              {/* Spots remaining indicator */}
              {registrationStatus && registrationStatus.cap > 0 && (
                <div className="mt-6 mb-2 px-4 w-full max-w-sm">
                  <div className="border border-protardio-green/30 bg-black/60 p-3 max-w-sm mx-auto">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500 font-mono text-[10px] uppercase">Spots Remaining</span>
                      <span className={`font-mono text-sm ${
                        registrationStatus.isFull 
                          ? 'text-red-500' 
                          : registrationStatus.spotsRemaining && registrationStatus.spotsRemaining < 100 
                            ? 'text-yellow-400' 
                            : 'text-protardio-green'
                      }`}>
                        {registrationStatus.isFull 
                          ? 'FULL' 
                          : registrationStatus.spotsRemaining?.toLocaleString()
                        }
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-gray-800 border border-protardio-green/20">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          registrationStatus.isFull ? 'bg-red-500' : 'bg-protardio-green'
                        }`}
                        style={{ 
                          width: `${Math.min(100, (registrationStatus.count / registrationStatus.cap) * 100)}%` 
                        }}
                      />
                    </div>
                    <p className="text-gray-600 font-mono text-[10px] mt-1 text-right">
                      {registrationStatus.count.toLocaleString()} / {registrationStatus.cap.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Requirements */}
              <div className="w-full max-w-sm border-2 sm:border-4 border-protardio-green bg-black/80 p-3 sm:p-4 my-2 mx-4">
                <div className="border-b border-protardio-green/30 pb-2 mb-3">
                  <span className="text-protardio-green text-[10px] sm:text-xs font-pixel">
                    REQUIREMENTS:
                  </span>
                </div>
                
                <ul className="space-y-2 font-mono text-xs sm:text-sm">
                  <li className="flex items-start gap-2 text-gray-300">
                    <span className="text-protardio-green text-lg">▶</span>
                    <span>Hold NFT: FIDPUNKS, Warplets, WCC, or ICCM Syndicate</span>
                  </li>
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="text-protardio-green text-lg">▶</span>
                    <span>Neynar Score 0.3+</span>
                  </li>
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="text-protardio-green text-lg">▶</span>
                    <span>Follow @protardio</span>
                  </li>
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="text-protardio-green text-lg">▶</span>
                    <span>Share registration</span>
                  </li>
                </ul>
              </div>
              
              {/* Connect button */}
              <button
                onClick={handleConnect}
                disabled={isConnecting || registrationStatus?.isFull}
                className={`
                  relative px-5 sm:px-8 py-3 sm:py-4 font-mono text-xs sm:text-sm uppercase tracking-wider
                  border-2 sm:border-4 transition-all duration-150 active:scale-95 font-pixel mt-4 mb-6
                  ${isConnecting || registrationStatus?.isFull
                    ? 'border-gray-600 bg-gray-900 text-gray-500 cursor-not-allowed' 
                    : 'border-protardio-green bg-protardio-green text-black hover:bg-black hover:text-protardio-green hover:shadow-[0_0_30px_rgba(0,255,0,0.5)]'
                  }
                `}
              >
                {registrationStatus?.isFull ? (
                  <span>ALLOWLIST FULL</span>
                ) : isConnecting ? (
                  <span className="animate-pulse">CONNECTING...</span>
                ) : (
                  <>
                    <span className="hidden sm:inline">SIGN IN WITH FARCASTER</span>
                    <span className="sm:hidden">SIGN IN</span>
                  </>
                )}
              </button>
             
            </main>
          )}
          
          {/* Verification Screen */}
          {screen === 'verification' && userData && (
            <main className="flex-1 px-3 sm:px-4 py-4 sm:py-6 max-w-lg mx-auto w-full">
              {/* User card */}
              <div className="border-2 sm:border-4 border-protardio-magenta bg-black/80 p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-protardio-magenta to-purple-900 border-2 border-protardio-magenta flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                    {userData.pfpUrl ? (
                      <Image src={userData.pfpUrl} alt="" fill className="object-cover" />
                    ) : (
                      <span className="text-white font-mono text-base sm:text-lg">⚔</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-protardio-magenta text-xs sm:text-sm truncate font-pixel">
                      @{userData.username}
                    </p>
                    <p className="text-gray-500 font-mono text-[10px] sm:text-xs">
                      FID: {userData.fid}
                    </p>
                  </div>
                </div>
                <div className="border-t border-protardio-magenta/30 pt-3">
                  <p className="text-gray-400 font-mono text-[10px] sm:text-xs break-all">
                    <span className="text-gray-600">WALLET:</span>{' '}
                    <span className="text-protardio-green">
                      {userData.walletAddress 
                        ? `${userData.walletAddress.slice(0, 6)}...${userData.walletAddress.slice(-4)}`
                        : 'Not available'
                      }
                    </span>
                  </p>
                </div>
              </div>
              
              {/* Verification checklist */}
              <div className="mb-4 sm:mb-6">
                <div className="mb-3 sm:mb-4">
                  <span className="text-protardio-green text-[10px] sm:text-xs font-pixel">
                    VERIFICATION:
                  </span>
                </div>
                
                <StatusIndicator
                  state={scoreCheck}
                  label="Neynar Score"
                  value={scoreCheck === 'passed' ? `${userData.neynarScore}` : undefined}
                  failMessage={scoreError || undefined}
                />
                
                <StatusIndicator
                  state={nftCheck}
                  label="NFT Holding"
                  value={nftCheck === 'passed' && userData.nftHoldings && userData.nftHoldings.length > 0 
                    ? userData.nftHoldings.map(h => h.name).join(', ')
                    : undefined
                  }
                  failMessage={nftError || undefined}
                />
                
                <StatusIndicator
                  state={followCheck}
                  label="@protardio"
                  failMessage={followError || undefined}
                  onAction={handleFollowAction}
                  actionLabel="Follow Now"
                />
                
                {/* Share requirement */}
                <div className={`
                  border-2 bg-black/60 p-3 mb-3 transition-all duration-300
                  ${hasShared ? 'border-protardio-green/60' : 'border-protardio-green/20'}
                `}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-protardio-green font-mono text-xs sm:text-sm uppercase tracking-wider">
                      Share
                    </span>
                    {hasShared ? (
                      <span className="text-protardio-green font-mono text-[10px] sm:text-xs">[ ✓ ]</span>
                    ) : (
                      <span className="text-gray-500 font-mono text-[10px] sm:text-xs">[ REQUIRED ]</span>
                    )}
                  </div>
                  
                  {!hasShared && nftCheck === 'passed' && scoreCheck === 'passed' && followCheck === 'passed' && (
                    <button
                      onClick={handleShare}
                      disabled={isVerifyingShare}
                      className={`
                        w-full mt-2 px-3 sm:px-4 py-2 font-mono text-[10px] sm:text-xs uppercase tracking-wider
                        border-2 transition-all duration-150 active:scale-95
                        ${isVerifyingShare
                          ? 'border-yellow-600 bg-yellow-900/30 text-yellow-400 cursor-wait'
                          : 'border-protardio-magenta bg-protardio-magenta/20 text-protardio-magenta hover:bg-protardio-magenta hover:text-black'
                        }
                      `}
                    >
                      {isVerifyingShare ? '⏳ VERIFYING...' : '▶ SHARE TO FARCASTER'}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Refresh and Register buttons */}
              <div className="flex gap-3">
                {/* Refresh button */}
               
                
                {/* Register button */}
                <button
                  onClick={handleRegister}
                  disabled={!canRegister || isRegistering}
                  className={`
                    flex-1 px-4 sm:px-6 py-3 sm:py-4 font-mono uppercase tracking-wider font-pixel
                    border-2 sm:border-4 transition-all duration-150 active:scale-95 flex items-center justify-center gap-2
                    ${isRegistering
                      ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400 cursor-wait'
                      : canRegister
                        ? 'border-protardio-green bg-protardio-green text-black hover:shadow-[0_0_40px_rgba(0,255,0,0.5)]'
                        : 'border-gray-700 bg-gray-900 text-gray-600 cursor-not-allowed text-[10px] sm:text-xs'
                    }
                  `}
                >
                  {isRegistering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      REGISTERING...
                    </>
                  ) : canRegister ? (
                    'REGISTER'
                  ) : (
                    'COMPLETE VERIFICATION'
                  )}
                </button>
                 <button
                  onClick={handleRefreshChecks}
                  disabled={isRefreshing}
                  className={`
                    px-4 py-3 sm:py-4 font-mono text-xs uppercase tracking-wider
                    border-2 transition-all duration-150 active:scale-95
                    ${isRefreshing
                      ? 'border-yellow-600 bg-yellow-900/30 text-yellow-400 cursor-wait'
                      : 'border-protardio-magenta bg-black text-protardio-magenta hover:bg-protardio-magenta hover:text-black'
                    }
                  `}
                  title="Re-check all verifications"
                >
                  {isRefreshing ? '⏳' : <RotateCcw />}
                </button>
              </div>
            </main>
          )}
          
          {/* Success Screen */}
          {screen === 'success' && userData && (
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-8">
              {/* Rotating cube GIF */}
              <div className="mb-4">
                <Image
                  src="/whitelist/success-cube.gif"
                  alt="Success"
                  width={80}
                  height={80}
                  unoptimized
                />
              </div>

              <div className="text-center mb-6 sm:mb-8">
                {/* Stamp effect */}
                <div className="relative inline-block mb-4">
                  <div
                    className="border-4 border-protardio-green px-6 py-4 transform rotate-[-3deg]"
                    style={{
                      boxShadow: '0 0 30px rgba(0, 255, 0, 0.3)',
                    }}
                  >
                    <p
                      className="text-protardio-green text-xs sm:text-sm mb-1"
                      style={{ fontFamily: '"Press Start 2P", monospace' }}
                    >
                      PROTARD REGISTERED
                    </p>
                    <p
                      className="text-protardio-green text-lg sm:text-2xl"
                      style={{
                        fontFamily: '"Press Start 2P", monospace',
                        textShadow: '0 0 20px rgba(0, 255, 0, 0.6)'
                      }}
                    >
                      VISA APPROVED
                    </p>
                  </div>
                  {/* Stamp overlay effect */}
                  <div className="absolute inset-0 border-4 border-protardio-green/30 transform rotate-[2deg]" />
                </div>

                <p className="text-gray-400 font-mono text-xs sm:text-sm mt-4 mb-1">
                  You&apos;re on the allowlist for
                </p>
                <h2 className="text-protardio-magenta text-sm sm:text-lg font-pixel">
                  PHASE 1 - TIER 3
                </h2>
              </div>

              {/* Details */}
              <div className="w-full max-w-sm border-2 sm:border-4 border-protardio-green bg-black/80 p-3 sm:p-4 mb-4 sm:mb-6 mx-4">
                <div className="space-y-2 sm:space-y-3 font-mono text-xs sm:text-sm">
                  <div className="flex justify-between border-b border-protardio-green/20 pb-2">
                    <span className="text-gray-500">PROTARD</span>
                    <span className="text-protardio-green">@{userData.username}</span>
                  </div>
                  <div className="flex justify-between border-b border-protardio-green/20 pb-2">
                    <span className="text-gray-500">FID</span>
                    <span className="text-protardio-green">{userData.fid}</span>
                  </div>
                  <div className="flex justify-between border-b border-protardio-green/20 pb-2">
                    <span className="text-gray-500">WALLET</span>
                    <span className="text-protardio-green text-[10px] sm:text-xs">
                      {userData.walletAddress.slice(0, 8)}...{userData.walletAddress.slice(-6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">SCORE</span>
                    <span className="text-protardio-green">{userData.neynarScore}</span>
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-protardio-green rounded-full animate-pulse" />
                <span className="text-protardio-green font-mono text-xs uppercase tracking-wider">
                  Clearance Granted
                </span>
              </div>

              {/* Mint date */}
              <div className="text-center mb-4 sm:mb-6">
                <p className="text-gray-500 font-mono text-[10px] sm:text-xs mb-1">MINT OPENS</p>
                <p className="text-protardio-yellow text-xs sm:text-sm font-pixel">
                  December 2025
                </p>
              </div>

              {/* Actions */}
              <button
                onClick={handleShare}
                className="px-6 py-3 border-2 border-protardio-magenta text-protardio-magenta font-mono text-xs uppercase hover:bg-protardio-magenta hover:text-black transition-all active:scale-95"
              >
                RECRUIT MORE PROTARDS
              </button>

              <p className="text-gray-700 font-mono text-[10px] mt-8 italic">
                &quot;welcome to the wartime effort, soldier&quot;
              </p>
            </main>
          )}
          
          {/* Already Registered Screen */}
          {screen === 'already-registered' && userData && (
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-8">
              {/* Rotating cube GIF */}
              <div className="mb-4">
                <Image
                  src="/whitelist/success-cube.gif"
                  alt="Success"
                  width={80}
                  height={80}
                  unoptimized
                />
              </div>

              <div className="text-center mb-6 sm:mb-8">
                {/* Stamp effect */}
                <div className="relative inline-block mb-4">
                  <div
                    className="border-4 border-protardio-green px-6 py-4 transform rotate-[-3deg]"
                    style={{
                      boxShadow: '0 0 30px rgba(0, 255, 0, 0.3)',
                    }}
                  >
                    <p
                      className="text-protardio-green text-xs sm:text-sm mb-1"
                      style={{ fontFamily: '"Press Start 2P", monospace' }}
                    >
                      PROTARD REGISTERED
                    </p>
                    <p
                      className="text-protardio-green text-lg sm:text-2xl"
                      style={{
                        fontFamily: '"Press Start 2P", monospace',
                        textShadow: '0 0 20px rgba(0, 255, 0, 0.6)'
                      }}
                    >
                      VISA APPROVED
                    </p>
                  </div>
                  {/* Stamp overlay effect */}
                  <div className="absolute inset-0 border-4 border-protardio-green/30 transform rotate-[2deg]" />
                </div>

                <p className="text-gray-400 font-mono text-xs sm:text-sm mt-4">
                  You&apos;re already on the allowlist
                </p>
              </div>

              <div className="w-full max-w-sm border-2 sm:border-4 border-protardio-green bg-black/80 p-3 sm:p-4 mb-4 sm:mb-6 mx-4">
                <div className="space-y-2 font-mono text-xs sm:text-sm">
                  <div className="flex justify-between border-b border-protardio-green/20 pb-2">
                    <span className="text-gray-500">PROTARD</span>
                    <span className="text-protardio-green">@{userData.username}</span>
                  </div>
                  <div className="flex justify-between border-b border-protardio-green/20 pb-2">
                    <span className="text-gray-500">FID</span>
                    <span className="text-protardio-green">{userData.fid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">WALLET</span>
                    <span className="text-protardio-green text-[10px] sm:text-xs">
                      {userData.walletAddress.slice(0, 8)}...{userData.walletAddress.slice(-6)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 bg-protardio-green rounded-full animate-pulse" />
                <span className="text-protardio-green font-mono text-xs uppercase tracking-wider">
                  Clearance Granted
                </span>
              </div>

              <button
                onClick={handleShare}
                className="px-6 py-3 border-2 border-protardio-magenta text-protardio-magenta font-mono text-xs uppercase hover:bg-protardio-magenta hover:text-black transition-all active:scale-95"
              >
                RECRUIT MORE PROTARDS
              </button>

              <p className="text-gray-700 font-mono text-[10px] mt-8 italic">
                &quot;welcome to the wartime effort, soldier&quot;
              </p>
            </main>
          )}
        </div>
      )}
      
      {/* Allowlist Full Modal */}
      <AllowlistFullModal
        isOpen={showFullModal}
        onClose={() => setShowFullModal(false)}
        count={registrationStatus?.count || 0}
        cap={registrationStatus?.cap || 0}
      />
    </div>
  );
}
