'use client'

import { useEffect, useState } from 'react'
import {
    bindNativeDeviceTokenToCurrentUser,
    isNativeAppPlatform,
    NATIVE_FCM_TOKEN_EVENT,
} from '@/lib/notifications/device-token-client'

export function useNativeDeviceTokenSync(): boolean {
    const [isNativeApp] = useState(() => isNativeAppPlatform())

    useEffect(() => {
        if (!isNativeApp) return

        const syncToken = () => {
            void bindNativeDeviceTokenToCurrentUser().catch((error) => {
                console.error('Failed to sync native device token:', error)
            })
        }

        syncToken()
        window.addEventListener(NATIVE_FCM_TOKEN_EVENT, syncToken)

        return () => {
            window.removeEventListener(NATIVE_FCM_TOKEN_EVENT, syncToken)
        }
    }, [isNativeApp])

    return isNativeApp
}
