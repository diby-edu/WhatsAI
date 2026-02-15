export async function register() {
    // WhatsApp is now handled by the standalone whatsapp-service.js
    // This file no longer initializes WhatsApp to avoid conflicts

    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('📱 WhatsApp is handled by standalone service (wazzapai-bot)')

        // Initialize cron jobs (subscription expiry check, etc.)
        try {
            const { initCronJobs } = await import('@/lib/notifications/cron.service')
            initCronJobs()
        } catch (error) {
            console.error('⏰ Failed to initialize cron jobs:', error)
        }

        console.log('✅ Next.js app ready')
    }
}
