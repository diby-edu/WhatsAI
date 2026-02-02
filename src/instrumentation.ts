export async function register() {
    // WhatsApp is now handled by the standalone whatsapp-service.js
    // This file no longer initializes WhatsApp to avoid conflicts

    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('📱 WhatsApp is handled by standalone service (wazzapai-bot)')
        console.log('✅ Next.js app ready')
    }
}
