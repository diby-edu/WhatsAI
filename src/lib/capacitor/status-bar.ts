import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export async function initStatusBar() {
    if (!Capacitor.isNativePlatform()) {
        return // Only run on native platforms
    }

    try {
        // Set status bar to dark background with white icons (same as mobile browser)
        await StatusBar.setBackgroundColor({ color: '#0f172a' })
        await StatusBar.setStyle({ style: Style.Light }) // Light = WHITE icons on dark bg
        await StatusBar.setOverlaysWebView({ overlay: false })

        console.log('StatusBar initialized successfully')
    } catch (error) {
        console.error('Failed to initialize StatusBar:', error)
    }
}

