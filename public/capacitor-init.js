/**
 * Capacitor Push Notifications Initialization
 * This script should be loaded on wazzapai.com for APK notifications to work
 */

(function() {
    'use strict';

    // Check if running inside Capacitor native app
    const isCapacitorApp = window.Capacitor && window.Capacitor.isNativePlatform();

    if (!isCapacitorApp) {
        console.log('[WazzapAI] Not running in native app, skipping push notifications');
        return;
    }

    console.log('[WazzapAI] Capacitor native app detected, initializing push notifications...');

    // Wait for Capacitor to be fully ready
    document.addEventListener('DOMContentLoaded', async function() {
        try {
            await initPushNotifications();
        } catch (error) {
            console.error('[WazzapAI] Error initializing push notifications:', error);
        }
    });

    async function initPushNotifications() {
        const { PushNotifications } = window.Capacitor.Plugins;

        if (!PushNotifications) {
            console.warn('[WazzapAI] PushNotifications plugin not available');
            return;
        }

        // Request permission
        const permStatus = await PushNotifications.requestPermissions();
        console.log('[WazzapAI] Permission status:', permStatus.receive);

        if (permStatus.receive !== 'granted') {
            console.log('[WazzapAI] Push permission denied by user');
            return;
        }

        // Register with FCM
        await PushNotifications.register();

        // Listen for registration success
        PushNotifications.addListener('registration', async (token) => {
            console.log('[WazzapAI] FCM Token received:', token.value);

            // Save token to backend
            await saveTokenToBackend(token.value);
        });

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (error) => {
            console.error('[WazzapAI] Registration error:', error);
        });

        // Listen for notifications received (foreground)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[WazzapAI] Notification received:', notification);

            // Show in-app toast or handle as needed
            showInAppNotification(notification);
        });

        // Listen for notification tap
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[WazzapAI] Notification tapped:', action);

            // Navigate based on notification data
            handleNotificationTap(action.notification.data);
        });
    }

    async function saveTokenToBackend(token) {
        try {
            const response = await fetch('/api/notifications/register-device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: token,
                    platform: window.Capacitor.getPlatform()
                })
            });

            if (response.ok) {
                console.log('[WazzapAI] Token saved to backend successfully');
            } else {
                console.error('[WazzapAI] Failed to save token:', response.status);
            }
        } catch (error) {
            console.error('[WazzapAI] Error saving token:', error);
        }
    }

    function showInAppNotification(notification) {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 999999;
            font-family: system-ui, sans-serif;
            max-width: 90%;
            animation: slideIn 0.3s ease;
        `;
        toast.innerHTML = `
            <strong>${notification.title || 'WazzapAI'}</strong><br>
            <span style="font-size: 14px; opacity: 0.9;">${notification.body || ''}</span>
        `;

        document.body.appendChild(toast);

        // Remove after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    function handleNotificationTap(data) {
        if (!data) return;

        // Navigate based on notification type
        switch (data.type) {
            case 'new_message':
                window.location.href = '/dashboard/conversations';
                break;
            case 'new_order':
                window.location.href = '/dashboard/orders';
                break;
            case 'low_credits':
                window.location.href = '/dashboard/billing';
                break;
            case 'payment_success':
                window.location.href = '/dashboard/orders';
                break;
            default:
                window.location.href = '/dashboard';
        }
    }

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(-50%) translateY(0); opacity: 1; }
            to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

})();
