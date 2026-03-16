'use client'

import { createClient } from '@/lib/supabase/client'

export const NATIVE_FCM_TOKEN_EVENT = 'native-fcm-token-available'

export function isNativeAppPlatform(): boolean {
    if (typeof window === 'undefined') return false

    const capacitorWindow = window as Window & {
        Capacitor?: { isNativePlatform?: () => boolean }
    }

    return capacitorWindow.Capacitor?.isNativePlatform?.() === true
}

export function getStoredDeviceToken(): string | null {
    if (typeof window === 'undefined') return null

    const token = localStorage.getItem('fcm_token')?.trim()
    return token || null
}

export async function bindNativeDeviceTokenToCurrentUser(): Promise<void> {
    if (!isNativeAppPlatform()) return

    const token = getStoredDeviceToken()
    if (!token) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const response = await fetch('/api/notifications/register-device-native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: 'android' }),
    })

    if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'Failed to bind native device token')
    }
}

export async function unregisterCurrentDeviceToken(): Promise<void> {
    const token = getStoredDeviceToken()
    if (!token) return

    const response = await fetch('/api/notifications/unregister-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    })

    if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'Failed to unregister device token')
    }
}
