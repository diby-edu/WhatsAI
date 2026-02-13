import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

export interface NotificationService {
    initialize: () => Promise<void>;
    getToken: () => string | null;
    isSupported: () => boolean;
}

let pushToken: string | null = null;

/**
 * Check if push notifications are supported (only on native platforms)
 */
export const isPushNotificationsSupported = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Get the current push notification token
 */
export const getPushToken = (): string | null => {
    return pushToken;
};

/**
 * Initialize push notifications
 * Should be called when the app starts (after user is authenticated)
 */
export const initializePushNotifications = async (): Promise<string | null> => {
    if (!isPushNotificationsSupported()) {
        console.log('Push notifications not supported on this platform');
        return null;
    }

    try {
        // Request permission
        const permissionStatus = await PushNotifications.requestPermissions();

        if (permissionStatus.receive !== 'granted') {
            console.log('Push notification permission denied');
            return null;
        }

        // Register with FCM
        await PushNotifications.register();

        // Set up listeners
        setupPushNotificationListeners();

        return pushToken;
    } catch (error) {
        console.error('Error initializing push notifications:', error);
        return null;
    }
};

/**
 * Set up push notification event listeners
 */
const setupPushNotificationListeners = () => {
    // On successful registration
    PushNotifications.addListener('registration', async (token: Token) => {
        console.log('Push registration success, token:', token.value);
        pushToken = token.value;

        // Save token to backend
        await saveTokenToBackend(token.value);
    });

    // On registration error
    PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Push registration error:', error);
    });

    // On push notification received (app in foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('Push notification received:', notification);

        // Show in-app notification or handle as needed
        handleForegroundNotification(notification);
    });

    // On push notification action (user tapped notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('Push notification action performed:', action);

        // Navigate to relevant screen based on notification data
        handleNotificationAction(action);
    });
};

/**
 * Handle notification received while app is in foreground
 */
const handleForegroundNotification = (notification: PushNotificationSchema) => {
    // You can show a custom in-app notification here
    // For now, we'll just log it
    console.log('Foreground notification:', {
        title: notification.title,
        body: notification.body,
        data: notification.data
    });

    // Optionally show a toast or custom UI
    if (typeof window !== 'undefined' && 'Notification' in window) {
        // Show browser notification as fallback
        new Notification(notification.title || 'WazzapAI', {
            body: notification.body,
            icon: '/app-icon.svg'
        });
    }
};

/**
 * Handle when user taps on a notification
 */
const handleNotificationAction = (action: ActionPerformed) => {
    const data = action.notification.data;

    // Navigate based on notification type
    if (data?.type === 'new_message') {
        // Navigate to messages
        window.location.href = '/dashboard/messages';
    } else if (data?.type === 'new_order') {
        // Navigate to orders
        window.location.href = '/dashboard/orders';
    } else if (data?.type === 'low_credits') {
        // Navigate to billing
        window.location.href = '/dashboard/billing';
    } else {
        // Default: go to dashboard
        window.location.href = '/dashboard';
    }
};

/**
 * Save push token to backend for sending notifications later
 */
const saveTokenToBackend = async (token: string): Promise<void> => {
    try {
        const response = await fetch('/api/notifications/register-device', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
        });

        if (!response.ok) {
            throw new Error('Failed to save token');
        }

        console.log('Push token saved to backend');
    } catch (error) {
        console.error('Error saving push token:', error);
    }
};

/**
 * Unregister from push notifications (e.g., on logout)
 */
export const unregisterPushNotifications = async (): Promise<void> => {
    if (!isPushNotificationsSupported()) return;

    try {
        // Remove token from backend
        if (pushToken) {
            await fetch('/api/notifications/unregister-device', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: pushToken }),
            });
        }

        // Remove all listeners
        await PushNotifications.removeAllListeners();
        pushToken = null;

        console.log('Push notifications unregistered');
    } catch (error) {
        console.error('Error unregistering push notifications:', error);
    }
};
