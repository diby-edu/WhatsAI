'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    initializePushNotifications,
    unregisterPushNotifications,
    isPushNotificationsSupported,
    getPushToken
} from '@/lib/notifications/push-notifications';

interface UsePushNotificationsReturn {
    isSupported: boolean;
    isInitialized: boolean;
    token: string | null;
    error: string | null;
    initialize: () => Promise<void>;
    unregister: () => Promise<void>;
}

/**
 * Hook to manage push notifications in the app
 * Should be used in a component that renders after user authentication
 */
export const usePushNotifications = (autoInitialize: boolean = true): UsePushNotificationsReturn => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isSupported = isPushNotificationsSupported();

    const initialize = useCallback(async () => {
        if (!isSupported) {
            setError('Push notifications not supported on this platform');
            return;
        }

        if (isInitialized) {
            return;
        }

        try {
            const result = await initializePushNotifications();
            setToken(result);
            setIsInitialized(true);
            setError(null);
        } catch (err) {
            console.error('Failed to initialize push notifications:', err);
            setError('Failed to initialize push notifications');
        }
    }, [isSupported, isInitialized]);

    const unregister = useCallback(async () => {
        try {
            await unregisterPushNotifications();
            setToken(null);
            setIsInitialized(false);
        } catch (err) {
            console.error('Failed to unregister push notifications:', err);
        }
    }, []);

    // Auto-initialize on mount if enabled
    useEffect(() => {
        if (autoInitialize && isSupported && !isInitialized) {
            // Small delay to ensure app is fully loaded
            const timer = setTimeout(() => {
                initialize();
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [autoInitialize, isSupported, isInitialized, initialize]);

    // Update token state when it changes
    useEffect(() => {
        if (isInitialized) {
            const currentToken = getPushToken();
            if (currentToken !== token) {
                setToken(currentToken);
            }
        }
    }, [isInitialized, token]);

    return {
        isSupported,
        isInitialized,
        token,
        error,
        initialize,
        unregister,
    };
};

export default usePushNotifications;
