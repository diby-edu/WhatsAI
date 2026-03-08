'use client'

import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken } from 'firebase/messaging'

const STORAGE_KEY = 'web_push_token'
const ASKED_KEY = 'web_push_asked'

function getFirebaseConfig() {
    return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    }
}

function isConfigured(): boolean {
    const c = getFirebaseConfig()
    return !!(c.apiKey && c.projectId && c.messagingSenderId && c.appId)
}

export async function initWebPush(): Promise<string | null> {
    if (typeof window === 'undefined') return null
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return null
    if (!isConfigured()) return null // env vars not set yet

    // If already denied, don't ask again
    if (Notification.permission === 'denied') return null

    // If we already have a token stored and permission granted, reuse it
    if (Notification.permission === 'granted') {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) return stored
    }

    // Only ask once per session if not yet granted
    if (Notification.permission === 'default' && sessionStorage.getItem(ASKED_KEY)) return null
    sessionStorage.setItem(ASKED_KEY, '1')

    try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return null

        // Initialize Firebase app (singleton)
        const app = getApps().length > 0 ? getApps()[0] : initializeApp(getFirebaseConfig())
        const messaging = getMessaging(app)

        // Register service worker
        const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
        await navigator.serviceWorker.ready

        // Get FCM token
        const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: reg,
        })

        if (!token) return null

        localStorage.setItem(STORAGE_KEY, token)
        return token
    } catch (err) {
        console.error('[WebPush] init error:', err)
        return null
    }
}

export function getStoredWebPushToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(STORAGE_KEY)
}

export function clearWebPushToken(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(STORAGE_KEY)
}
