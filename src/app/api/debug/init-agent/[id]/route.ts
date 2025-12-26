import { NextRequest, NextResponse } from 'next/server'
import { initWhatsAppSession, hasStoredSession, getAllActiveSessions } from '@/lib/whatsapp/baileys'
import { initializeMessageHandler } from '@/lib/whatsapp/message-handler'
import { createAdminClient } from '@/lib/api-utils'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: agentId } = await params
    const supabase = createAdminClient()

    try {
        // First, ensure message handler is initialized
        initializeMessageHandler()

        // Check if agent exists and is connected
        const { data: agent, error } = await supabase
            .from('agents')
            .select('id, name, whatsapp_connected, is_active')
            .eq('id', agentId)
            .single()

        if (error || !agent) {
            return NextResponse.json({
                success: false,
                error: 'Agent not found',
                agentId
            }, { status: 404 })
        }

        // Check if session files exist
        const hasSession = hasStoredSession(agentId)

        // Check if already active in memory
        const activeSessions = getAllActiveSessions()
        const isActive = activeSessions.has(agentId)

        if (isActive) {
            const session = activeSessions.get(agentId)
            return NextResponse.json({
                success: true,
                message: 'Session already active',
                agent: agent.name,
                status: session?.status,
                phoneNumber: session?.phoneNumber
            })
        }

        // Initialize the session
        console.log(`Manually initializing session for agent ${agent.name} (${agentId})...`)
        const result = await initWhatsAppSession(agentId)

        return NextResponse.json({
            success: true,
            message: hasSession ? 'Session restored from disk' : 'New session started',
            agent: agent.name,
            hasStoredSession: hasSession,
            status: result.status,
            qrCode: result.qrCode ? 'QR code ready (check agent page)' : undefined
        })

    } catch (error: any) {
        console.error('Error initializing agent session:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
