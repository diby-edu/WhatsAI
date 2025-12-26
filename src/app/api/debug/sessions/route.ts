import { NextRequest, NextResponse } from 'next/server'
import { getAllActiveSessions } from '@/lib/whatsapp/baileys'

export async function GET(request: NextRequest) {
    try {
        const sessions = getAllActiveSessions()
        const sessionKeys = Array.from(sessions.keys())

        return NextResponse.json({
            success: true,
            active_sessions_count: sessionKeys.length,
            active_sessions_ids: sessionKeys,
            details: sessionKeys.map(key => ({
                id: key,
                has_socket: !!sessions.get(key),
                phoneNumber: sessions.get(key)?.phoneNumber
            }))
        })
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
