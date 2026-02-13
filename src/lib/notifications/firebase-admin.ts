import admin from 'firebase-admin';

// Initialize Firebase Admin SDK (singleton)
if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccount) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(serviceAccount)),
            });
            console.log('Firebase Admin initialized');
        } catch (error) {
            console.error('Error initializing Firebase Admin:', error);
        }
    } else {
        console.warn('FIREBASE_SERVICE_ACCOUNT_KEY not configured - push notifications disabled');
    }
}

export interface PushNotificationPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
    imageUrl?: string;
}

/**
 * Send push notification to a single device
 */
export const sendPushNotification = async (
    token: string,
    payload: PushNotificationPayload
): Promise<boolean> => {
    if (!admin.apps.length) {
        console.warn('Firebase not initialized - cannot send notification');
        return false;
    }

    try {
        const message: admin.messaging.Message = {
            token,
            notification: {
                title: payload.title,
                body: payload.body,
                imageUrl: payload.imageUrl,
            },
            data: payload.data,
            android: {
                priority: 'high',
                notification: {
                    icon: 'ic_launcher',
                    color: '#10b981',
                    channelId: 'wazzapai_notifications',
                    sound: 'default',
                },
            },
        };

        await admin.messaging().send(message);
        console.log('Push notification sent successfully');
        return true;
    } catch (error: any) {
        console.error('Error sending push notification:', error);

        // Handle invalid token
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
            // Token is invalid, should be removed from database
            return false;
        }

        return false;
    }
};

/**
 * Send push notification to multiple devices
 */
export const sendPushNotificationToMultiple = async (
    tokens: string[],
    payload: PushNotificationPayload
): Promise<{ success: number; failure: number; invalidTokens: string[] }> => {
    if (!admin.apps.length) {
        console.warn('Firebase not initialized - cannot send notifications');
        return { success: 0, failure: tokens.length, invalidTokens: [] };
    }

    const invalidTokens: string[] = [];
    let success = 0;
    let failure = 0;

    // Firebase recommends sending to max 500 tokens at once
    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);

        const message: admin.messaging.MulticastMessage = {
            tokens: batch,
            notification: {
                title: payload.title,
                body: payload.body,
                imageUrl: payload.imageUrl,
            },
            data: payload.data,
            android: {
                priority: 'high',
                notification: {
                    icon: 'ic_launcher',
                    color: '#10b981',
                    channelId: 'wazzapai_notifications',
                    sound: 'default',
                },
            },
        };

        try {
            const response = await admin.messaging().sendEachForMulticast(message);
            success += response.successCount;
            failure += response.failureCount;

            // Collect invalid tokens
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    if (error?.code === 'messaging/invalid-registration-token' ||
                        error?.code === 'messaging/registration-token-not-registered') {
                        invalidTokens.push(batch[idx]);
                    }
                }
            });
        } catch (error) {
            console.error('Error sending batch notification:', error);
            failure += batch.length;
        }
    }

    return { success, failure, invalidTokens };
};

/**
 * Send notification to a user by user ID
 */
export const sendNotificationToUser = async (
    supabase: any,
    userId: string,
    payload: PushNotificationPayload
): Promise<boolean> => {
    // Get all device tokens for user
    const { data: tokens, error } = await supabase
        .from('device_tokens')
        .select('token')
        .eq('user_id', userId);

    if (error || !tokens || tokens.length === 0) {
        console.log('No device tokens found for user:', userId);
        return false;
    }

    const tokenList = tokens.map((t: any) => t.token);
    const result = await sendPushNotificationToMultiple(tokenList, payload);

    // Clean up invalid tokens
    if (result.invalidTokens.length > 0) {
        await supabase
            .from('device_tokens')
            .delete()
            .in('token', result.invalidTokens);
    }

    return result.success > 0;
};
