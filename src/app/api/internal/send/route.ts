import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { queueOutboundWhatsAppMessage } from '@/lib/whatsapp/outbound'

// Internal API to send WhatsApp messages (used by webhook)
// Protected by secret key check
export async function POST(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseKey) {
            console.error('Missing Supabase credentials')
            return NextResponse.json({ error: 'Configuration Error' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        const body = await request.json()
        const { agentId, to, message, secretKey } = body

        const expectedSecret = process.env.INTERNAL_API_SECRET
        if (!expectedSecret || secretKey !== expectedSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!agentId || !to || !message) {
            return NextResponse.json({ error: 'agentId, to, and message are required' }, { status: 400 })
        }

        const result = await queueOutboundWhatsAppMessage(supabase, {
            agentId,
            to,
            message,
        })

        if (!result.queued && result.reason === 'table_missing') {
            return NextResponse.json({
                success: true,
                note: 'Message not queued - table missing',
                agentId,
                to,
            })
        }

        console.log('Message queued for sending:', { agentId, to: to.substring(0, 10) + '...' })
        return NextResponse.json({ success: true, queued: true })
    } catch (err: any) {
        console.error('Internal send error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
