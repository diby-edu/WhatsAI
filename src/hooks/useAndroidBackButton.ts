'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

/**
 * Hook to handle Android hardware back button in Capacitor apps
 * Navigates back or goes to dashboard if at root level
 */
export function useAndroidBackButton() {
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        // Only run on Capacitor (Android/iOS)
        const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()
        if (!isCapacitor) return

        let backButtonHandler: any = null

        const setupBackButton = async () => {
            try {
                const { App } = await import('@capacitor/app')

                backButtonHandler = App.addListener('backButton', ({ canGoBack }) => {
                    // Root pages - ask to exit or go to dashboard
                    const rootPages = ['/login', '/register', '/dashboard', '/admin']
                    const isRootPage = rootPages.some(p => pathname === p || pathname.endsWith(p))

                    if (isRootPage) {
                        // On root dashboard/admin, minimize app
                        if (pathname.includes('/dashboard') || pathname.includes('/admin')) {
                            App.minimizeApp()
                        } else if (pathname.includes('/login') || pathname.includes('/register')) {
                            // On login/register, exit app
                            App.exitApp()
                        }
                    } else if (canGoBack) {
                        // Can go back in browser history
                        router.back()
                    } else {
                        // Go to dashboard as fallback
                        router.push('/dashboard')
                    }
                })
            } catch (error) {
                console.log('Back button handler not available:', error)
            }
        }

        setupBackButton()

        return () => {
            if (backButtonHandler) {
                backButtonHandler.remove()
            }
        }
    }, [router, pathname])
}
