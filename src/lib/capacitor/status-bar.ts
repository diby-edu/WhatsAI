export async function initStatusBar() {
    // Only run in browser environment
    if (typeof window === 'undefined') return

    try {
        // Dynamic imports - these packages only exist in the APK, not on the server
        const { Capacitor } = await import('@capacitor/core')

        if (!Capacitor.isNativePlatform()) {
            return // Only run on native platforms (APK)
        }

        const { StatusBar, Style } = await import('@capacitor/status-bar')

        // Set status bar to dark background with white icons (same as mobile browser)
        await StatusBar.setBackgroundColor({ color: '#0f172a' })
        await StatusBar.setStyle({ style: Style.Light }) // Light = WHITE icons on dark bg
        await StatusBar.setOverlaysWebView({ overlay: false })

        console.log('StatusBar initialized successfully')
    } catch (error) {
        // Silently fail on web/server - Capacitor packages not available
        console.log('StatusBar not available (web environment)')
    }
}

