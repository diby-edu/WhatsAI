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

export async function POST(_request: NextRequest) {
    // Webhook désactivé — déploiements gérés manuellement via deploy.sh
    console.log('⏭️ Webhook reçu mais désactivé (déploiement manuel)')
    return NextResponse.json({ message: 'Webhook disabled - manual deployments only' }, { status: 200 })
}

// Allow GET for testing
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'Deploy webhook is ready'
    })
}
