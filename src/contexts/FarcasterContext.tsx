import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import sdk from '@farcaster/miniapp-sdk';

type MiniAppContext = Awaited<typeof sdk.context>;

interface NotificationStatus {
  enabled: boolean;
  token?: string;
  url?: string;
}

interface FarcasterContextType {
  context: MiniAppContext | null;
  user: MiniAppContext['user'] | null;
  isLoading: boolean;
  error: Error | null;
  // Actions
  addMiniApp: () => Promise<unknown>;
  viewProfile: (fid: number) => Promise<void>;
  // Notifications
  notificationStatus: NotificationStatus;
  requestNotifications: () => Promise<boolean>;
}

const FarcasterContext = createContext<FarcasterContextType | undefined>(undefined);

export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>({ enabled: false });

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const farcasterContext = await sdk.context;
        setContext(farcasterContext);

        // Check notification status from context
        // The context.client.notificationDetails contains the notification info if enabled
        if (farcasterContext?.client?.notificationDetails) {
          const details = farcasterContext.client.notificationDetails;
          setNotificationStatus({
            enabled: true,
            token: details.token,
            url: details.url,
          });
          console.log('🔔 Notifications already enabled:', details);
        } else {
          console.log('🔕 Notifications not enabled');
        }
      } catch (err) {
        console.error('Error fetching Farcaster context:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchContext();
  }, []);

  const addMiniApp = async () => {
    try {
      const result = await sdk.actions.addMiniApp();
      
      // After adding, check if notifications were granted
      if (result?.notificationDetails) {
        setNotificationStatus({
          enabled: true,
          token: result.notificationDetails.token,
          url: result.notificationDetails.url,
        });
        console.log('🔔 Notifications enabled after addMiniApp:', result.notificationDetails);
      }
      
      return result;
    } catch (err) {
      console.error('Error adding mini app:', err);
    }
  };

  const viewProfile = useCallback(async (fid: number) => {
    try {
      await sdk.actions.viewProfile({ fid });
    } catch (err) {
      console.error('Error opening profile:', err);
      // Fallback: open in new tab if SDK fails
      window.open(`https://warpcast.com/~/profiles/${fid}`, '_blank');
    }
  }, []);

  /**
   * Request notification permissions from the user.
   * This will prompt the user to add the mini app if not already added.
   * Returns true if notifications were enabled, false otherwise.
   */
  const requestNotifications = useCallback(async (): Promise<boolean> => {
    try {
      // If already enabled, return true
      if (notificationStatus.enabled) {
        console.log('🔔 Notifications already enabled');
        return true;
      }

      // Request via addMiniApp which includes notification permissions
      const result = await sdk.actions.addMiniApp();
      
      if (result?.notificationDetails) {
        setNotificationStatus({
          enabled: true,
          token: result.notificationDetails.token,
          url: result.notificationDetails.url,
        });
        console.log('🔔 Notifications enabled:', result.notificationDetails);
        return true;
      }
      
      console.log('🔕 User did not enable notifications');
      return false;
    } catch (err) {
      console.error('Error requesting notifications:', err);
      return false;
    }
  }, [notificationStatus.enabled]);

  return (
    <FarcasterContext.Provider 
      value={{ 
        context, 
        user: context?.user || null, 
        isLoading, 
        error,
        addMiniApp,
        viewProfile,
        notificationStatus,
        requestNotifications,
      }}
    >
      {children}
    </FarcasterContext.Provider>
  );
}

// Custom hook to use the Farcaster context
export function useFarcaster() {
  const context = useContext(FarcasterContext);
  if (context === undefined) {
    throw new Error('useFarcaster must be used within a FarcasterProvider');
  }
  return context;
}
