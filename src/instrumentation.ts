export async function register() {
    // Only run on server side (Node.js runtime)
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        try {
            console.log('🔌 Initializing WhatsApp Message Handler...')
            const { initializeMessageHandler } = await import('@/lib/whatsapp/message-handler')
            initializeMessageHandler()

            // Auto-restore WhatsApp sessions after a delay
            console.log('⏳ Scheduling WhatsApp session auto-restore in 10 seconds...')
            setTimeout(async () => {
                try {
                    console.log('🔄 Auto-restoring WhatsApp sessions...')
                    const { restoreAllSessions } = await import('@/lib/whatsapp/session-restore')
                    await restoreAllSessions()
                } catch (error) {
                    console.error('❌ Auto-restore failed:', error)
                }
            }, 10000) // 10 seconds delay to let the server fully start
        } catch (error) {
            console.error('❌ Failed to initialize WhatsApp handler:', error)
        }
    }
}
