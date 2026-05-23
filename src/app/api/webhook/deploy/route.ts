import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import crypto from 'crypto'

// Secret for GitHub webhook verification - MUST be configured
const DEPLOY_SECRET = process.env.DEPLOY_SECRET

// 🔴 SECURITY: Fail early if secret not configured
if (!DEPLOY_SECRET) {
    console.error('❌ CRITICAL: DEPLOY_SECRET environment variable is not configured!')
    console.error('   This webhook will reject ALL requests until configured.')
}

function verifySignature(payload: string, signature: string | null): boolean {
    // 🔴 SECURITY: Reject if secret not configured
    if (!DEPLOY_SECRET) {
        console.error('❌ SECURITY: Cannot verify signature - DEPLOY_SECRET not configured')
        return false
    }
    if (!signature) return false

    const hmac = crypto.createHmac('sha256', DEPLOY_SECRET)
    const digest = 'sha256=' + hmac.update(payload).digest('hex')

    try {
        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
    } catch {
        return false
    }
}

export async function POST(request: NextRequest) {
    try {
        const payload = await request.text()
        const signature = request.headers.get('x-hub-signature-256')

        // Verify GitHub signature
        if (!verifySignature(payload, signature)) {
            console.log('❌ Invalid webhook signature')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        // Parse the payload
        const data = JSON.parse(payload)

        // Only deploy on push to master/main branch
        const ref = data.ref || ''
        if (!ref.includes('master') && !ref.includes('main')) {
            console.log('⏭️ Skipping deployment - not master/main branch:', ref)
            return NextResponse.json({ message: 'Skipped - not master/main' }, { status: 200 })
        }

        console.log('🚀 Starting automatic deployment...')
        console.log('📝 Commit:', data.head_commit?.message || 'Unknown')

        // Execute the update script in a fully detached process so it
        // survives when pm2 reloads this web app mid-deploy.
        const { openSync } = await import('fs')
        const logFd = openSync('/root/WhatsAI/deploy-auto.log', 'a')
        const child = spawn('/root/WhatsAI/deploy.sh', [], {
            detached: true,
            stdio: ['ignore', logFd, logFd],
        })
        child.unref()

        return NextResponse.json({
            message: 'Deployment started',
            commit: data.head_commit?.message || 'Unknown'
        }, { status: 200 })

    } catch (error) {
        console.error('❌ Webhook error:', error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}

// Allow GET for testing
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'Deploy webhook is ready'
    })
}
