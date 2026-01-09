'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import sdk from '@farcaster/miniapp-sdk';
import { useFarcaster } from '../contexts/FarcasterContext';

interface SetPfpButtonProps {
  imageUrl: string;
  className?: string;
}

type UpdateStatus =
  | 'idle'
  | 'getting-nonce'
  | 'signing-in'
  | 'checking-signers'
  | 'creating-signer'
  | 'registering-key'
  | 'awaiting-approval'
  | 'updating-pfp'
  | 'success'
  | 'error';

interface SignerData {
  signer_uuid: string;
  public_key: string;
  status: string;
  fid?: number;
  signer_approval_url?: string;
}

export function SetPfpButton({ imageUrl, className = '' }: SetPfpButtonProps) {
  const { user } = useFarcaster();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Step 1: Get nonce from server
  const getNonce = async (): Promise<string> => {
    const response = await fetch('/api/auth/nonce');
    if (!response.ok) throw new Error('Failed to get nonce');
    const data = await response.json();
    return data.nonce;
  };

  // Step 2: Sign in with Farcaster SDK
  const signInWithFarcaster = async (nonce: string): Promise<{ message: string; signature: string }> => {
    const result = await sdk.actions.signIn({ nonce });
    if (!result?.message || !result?.signature) {
      throw new Error('Sign in cancelled or failed');
    }
    return { message: result.message, signature: result.signature };
  };

  // Step 3: Check for existing approved signers
  const fetchSigners = async (message: string, signature: string): Promise<{ signers: SignerData[]; user: any }> => {
    const response = await fetch(
      `/api/auth/session-signers?message=${encodeURIComponent(message)}&signature=${signature}`
    );
    if (!response.ok) throw new Error('Failed to fetch signers');
    return await response.json();
  };

  // Step 4: Create a new signer
  const createSigner = async (): Promise<SignerData> => {
    const response = await fetch('/api/auth/signer', { method: 'POST' });
    if (!response.ok) throw new Error('Failed to create signer');
    return await response.json();
  };

  // Step 5: Register signed key
  const registerSignedKey = async (signerUuid: string, publicKey: string): Promise<SignerData> => {
    const response = await fetch('/api/auth/signer/signed_key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signerUuid,
        publicKey,
        // No redirectUrl - let Warpcast handle returning to the miniapp
      }),
    });
    if (!response.ok) throw new Error('Failed to register signed key');
    return await response.json();
  };

  // Step 6: Poll for signer approval
  const pollForApproval = (signerUuid: string): Promise<SignerData> => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max

      pollingIntervalRef.current = setInterval(async () => {
        try {
          attempts++;
          if (attempts > maxAttempts) {
            clearInterval(pollingIntervalRef.current!);
            reject(new Error('Approval timeout'));
            return;
          }

          const response = await fetch(`/api/auth/signer?signerUuid=${signerUuid}`);
          if (!response.ok) throw new Error('Failed to check signer status');

          const signerData: SignerData = await response.json();
          console.log('🔄 Polling signer status:', signerData.status);

          if (signerData.status === 'approved') {
            clearInterval(pollingIntervalRef.current!);
            resolve(signerData);
          }
        } catch (err) {
          clearInterval(pollingIntervalRef.current!);
          reject(err);
        }
      }, 2000);
    });
  };

  // Update PFP with signer_uuid
  const updatePfp = async (signerUuid: string, pfpUrl: string) => {
    console.log('📷 Updating PFP with signer:', signerUuid);

    const updateResponse = await fetch('/api/neynar/update-pfp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        pfp_url: pfpUrl,
      }),
    });

    if (!updateResponse.ok) {
      const errData = await updateResponse.json();
      throw new Error(errData.error || 'Failed to update PFP');
    }

    console.log('✅ PFP updated successfully!');
  };

  // Main flow
  const handleSetPfp = useCallback(async () => {
    if (!user?.fid) {
      setError('Please sign in first');
      return;
    }

    setError(null);

    try {
      // Step 1: Get nonce
      setStatus('getting-nonce');
      console.log('🔑 Getting nonce...');
      const nonce = await getNonce();

      // Step 2: Sign in with Farcaster
      setStatus('signing-in');
      console.log('✍️ Signing in with Farcaster...');
      const { message, signature } = await signInWithFarcaster(nonce);

      // Step 3: Check for existing signers
      setStatus('checking-signers');
      console.log('🔍 Checking for existing signers...');
      const { signers } = await fetchSigners(message, signature);

      // Find an approved signer
      const approvedSigner = signers?.find((s: SignerData) => s.status === 'approved');

      let signerUuid: string;

      if (approvedSigner) {
        // Use existing approved signer
        console.log('✅ Found approved signer:', approvedSigner.signer_uuid);
        signerUuid = approvedSigner.signer_uuid;
      } else {
        // Need to create a new signer
        setStatus('creating-signer');
        console.log('🔧 Creating new signer...');
        const newSigner = await createSigner();

        // Register the signed key
        setStatus('registering-key');
        console.log('📝 Registering signed key...');
        const registeredSigner = await registerSignedKey(newSigner.signer_uuid, newSigner.public_key);
        console.log('📋 Registered signer response:', registeredSigner);

        // If not yet approved, open approval URL and poll
        if (registeredSigner.status !== 'approved') {
          setStatus('awaiting-approval');
          console.log('⏳ Waiting for approval...');

          // Open the approval URL in Warpcast
          if (registeredSigner.signer_approval_url) {
            console.log('🔗 Opening approval URL:', registeredSigner.signer_approval_url);
            // Convert to Farcaster deep link format for mobile
            const approvalUrl = registeredSigner.signer_approval_url;
            try {
              await sdk.actions.openUrl(approvalUrl);
            } catch (e) {
              console.log('Could not open via SDK, trying window.open');
              window.open(approvalUrl, '_blank');
            }
          }

          const approvedSignerResult = await pollForApproval(newSigner.signer_uuid);
          signerUuid = approvedSignerResult.signer_uuid;
        } else {
          signerUuid = registeredSigner.signer_uuid;
        }
      }

      // Step 7: Update PFP
      setStatus('updating-pfp');
      await updatePfp(signerUuid, imageUrl);

      setStatus('success');

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 3000);

    } catch (err) {
      console.error('❌ Error in set PFP flow:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [user, imageUrl]);

  const getButtonText = () => {
    switch (status) {
      case 'getting-nonce':
        return 'Preparing...';
      case 'signing-in':
        return 'Sign in Farcaster...';
      case 'checking-signers':
        return 'Checking signers...';
      case 'creating-signer':
        return 'Creating signer...';
      case 'registering-key':
        return 'Registering key...';
      case 'awaiting-approval':
        return 'Approve in Warpcast...';
      case 'updating-pfp':
        return 'Updating PFP...';
      case 'success':
        return 'PFP Updated!';
      case 'error':
        return 'Try Again';
      default:
        return 'Set as PFP';
    }
  };

  const isLoading = status !== 'idle' && status !== 'success' && status !== 'error';

  return (
    <>
      <button
        onClick={handleSetPfp}
        disabled={isLoading}
        className={`
          font-victor font-bold italic text-[18px]
          bg-white text-black rounded-[60px]
          px-6 py-3
          shadow-lg
          hover:bg-gray-100 hover:scale-105
          active:scale-95
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
          flex items-center
          ${status === 'success' ? 'bg-green-500 text-white hover:bg-green-500' : ''}
          ${status === 'error' ? 'bg-red-500 text-white hover:bg-red-600' : ''}
          ${className}
        `}
      >
        {isLoading && (
          <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
        )}
        {getButtonText()}
      </button>

      {error && status === 'error' && (
        <p className="text-red-400 text-sm font-victor mt-1">{error}</p>
      )}
    </>
  );
}

export default SetPfpButton;
