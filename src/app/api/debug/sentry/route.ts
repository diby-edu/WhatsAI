import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import * as Sentry from "@sentry/nextjs"

export async function GET(request: NextRequest) {
    try {
        // 1. Capture a message
        Sentry.captureMessage("Test Diagnostic Message from WhatsAI Admin")

        // 2. Capture an exception
        try {
            throw new Error("Sentry Test Diagnostic Error")
        } catch (e) {
            Sentry.captureException(e)
        }

        return NextResponse.json({
            success: true,
            message: "Test events sent to Sentry (Message + Exception). Check your dashboard.",
            debug_info: {
                dsn_configured: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
                dsn_preview: process.env.NEXT_PUBLIC_SENTRY_DSN ? `${process.env.NEXT_PUBLIC_SENTRY_DSN.substring(0, 5)}...` : 'BLANK',
                node_env: process.env.NODE_ENV
            }
        })
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
