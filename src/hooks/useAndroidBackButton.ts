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
                    // EXACT root pages only (with locale support)
                    const exactRootPages = [
                        '/login', '/register', '/dashboard', '/admin',
                        '/fr/login', '/fr/register', '/fr/dashboard', '/fr/admin',
                        '/en/login', '/en/register', '/en/dashboard', '/en/admin'
                    ]

                    // Check EXACT match only
                    const isExactRootPage = exactRootPages.includes(pathname)

                    if (isExactRootPage) {
                        // On root dashboard/admin, minimize app
                        if (pathname.endsWith('/dashboard') || pathname.endsWith('/admin')) {
                            App.minimizeApp()
                        } else {
                            // On login/register, exit app
                            App.exitApp()
                        }
                    } else if (canGoBack) {
                        // Can go back in browser history
                        router.back()
                    } else {
                        // Go to dashboard as fallback (with locale)
                        const locale = pathname.startsWith('/en') ? 'en' : 'fr'
                        router.push(`/${locale}/dashboard`)
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
