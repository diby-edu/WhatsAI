import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Internal API to send WhatsApp messages (used by webhook)
// Protected by secret key check
export async function POST(request: NextRequest) {
    try {
        // Use service role key for internal calls
        // Initialize lazily to prevent build errors
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseKey) {
            console.error('Missing Supabase credentials')
            return NextResponse.json({ error: 'Configuration Error' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        const body = await request.json()
        const { agentId, to, message, secretKey } = body

        // Verify internal secret - MANDATORY
        const expectedSecret = process.env.INTERNAL_API_SECRET
        if (!expectedSecret || secretKey !== expectedSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
