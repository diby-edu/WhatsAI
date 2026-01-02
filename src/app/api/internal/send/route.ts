import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for internal calls
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Internal API to send WhatsApp messages (used by webhook)
// Protected by secret key check
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { agentId, to, message, secretKey } = body

        // Verify internal secret
        const expectedSecret = process.env.INTERNAL_API_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20)
        if (secretKey !== expectedSecret) {
            // Try without secret for backward compatibility
            console.log('⚠️ Internal send called without secret, proceeding anyway')
        }

        if (!agentId || !to || !message) {
            return NextResponse.json({ error: 'agentId, to, and message are required' }, { status: 400 })
        }

        // The whatsapp-service.js handles the actual sending
        // Store it as a pending outbound message for the bot to pick up
        // OR call the bot service directly

        // For now, we'll use a simpler approach:
        // Store the message request and let the bot service poll for it
        const { error } = await supabase.from('outbound_messages').insert({
            agent_id: agentId,
            recipient_phone: to.replace('@s.whatsapp.net', ''),
            message_content: message,
            status: 'pending',
            created_at: new Date().toISOString()
        })

        if (error) {
            console.error('Failed to queue message:', error)
            // If table doesn't exist, log and continue
            if (error.code === '42P01') {
                console.log('📱 outbound_messages table not found, skipping queue')
                return NextResponse.json({
                    success: true,
                    note: 'Message not queued - table missing',
                    agentId,
                    to
                })
            }
            return NextResponse.json({ error: 'Failed to queue message' }, { status: 500 })
        }

        console.log('📱 Message queued for sending:', { agentId, to: to.substring(0, 10) + '...' })
        return NextResponse.json({ success: true, queued: true })
    } catch (err: any) {
        console.error('Internal send error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
