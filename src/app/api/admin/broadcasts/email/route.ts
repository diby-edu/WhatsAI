import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'

// Load SMTP config: DB settings first, fallback to env vars
async function getSmtpConfig(adminSupabase: any) {
    try {
        const { data } = await adminSupabase
            .from('app_settings')
            .select('key, value')
            .in('key', ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'smtpSecure'])

        const s: Record<string, any> = {}
        for (const row of data || []) s[row.key] = row.value

        const host = s.smtpHost || process.env.SMTP_HOST || 'smtp.hostinger.com'
        const port = parseInt(s.smtpPort || process.env.SMTP_PORT || '465')
        const user = s.smtpUser || process.env.SMTP_USER || 'support@wazzapai.com'
        const pass = s.smtpPassword || process.env.SMTP_PASSWORD || ''
        const secure = s.smtpSecure !== undefined ? s.smtpSecure === true || s.smtpSecure === 'true' : port === 465

        return { host, port, user, pass, secure }
    } catch {
        return {
            host: process.env.SMTP_HOST || 'smtp.hostinger.com',
            port: parseInt(process.env.SMTP_PORT || '465'),
            user: process.env.SMTP_USER || 'support@wazzapai.com',
            pass: process.env.SMTP_PASSWORD || '',
            secure: true
        }
    }
}

function emailCampaignTemplate(userName: string, content: string): string {
    // Convert newlines to <br> for basic formatting
    const htmlContent = content.replace(/\n/g, '<br>')
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#020617;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);padding:12px 16px;border-radius:14px;">
        <span style="color:white;font-size:24px;font-weight:700;">💬 WazzapAI</span>
      </div>
    </div>
    <div style="background:rgba(15,23,42,0.95);border:1px solid rgba(148,163,184,0.15);border-radius:20px;padding:32px;color:#e2e8f0;">
      <p style="margin:0 0 12px 0;font-size:16px;">Bonjour <strong>${userName}</strong>,</p>
      <div style="color:#94a3b8;font-size:15px;line-height:1.6;">${htmlContent}</div>
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(148,163,184,0.1);">
        <a href="${APP_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">
          Accéder à mon espace
        </a>
      </div>
    </div>
    <div style="text-align:center;margin-top:24px;color:#64748b;font-size:12px;">
      <p>WazzapAI — Automatisation WhatsApp intelligente</p>
      <p>Vous recevez cet email car vous êtes inscrit sur ${APP_URL}</p>
    </div>
  </div>
</body>
</html>`
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function adminCheck(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return { error: errorResponse('Non autorisé', 401), user: null, adminSupabase: null }
    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') return { error: errorResponse('Accès refusé', 403), user: null, adminSupabase: null }
    return { error: null, user, adminSupabase }
}

// GET — preview count by segment
export async function GET(request: NextRequest) {
    const { error, adminSupabase } = await adminCheck(request)
    if (error || !adminSupabase) return error!

    const { searchParams } = new URL(request.url)
    const targetPlan = searchParams.get('targetPlan') || 'all'

    let query = adminSupabase.from('profiles').select('*', { count: 'exact', head: true })
    if (targetPlan !== 'all') query = query.eq('plan', targetPlan)

    const { count } = await query
    return successResponse({ count: count || 0 })
}

// POST — send email campaign
export async function POST(request: NextRequest) {
    const { error, adminSupabase } = await adminCheck(request)
    if (error || !adminSupabase) return error!

    try {
        const { subject, message, targetPlan } = await request.json()

        if (!subject?.trim() || !message?.trim()) {
            return errorResponse('Sujet et message requis', 400)
        }

        // Fetch recipients
        let query = adminSupabase.from('profiles').select('email, full_name')
        if (targetPlan && targetPlan !== 'all') query = query.eq('plan', targetPlan)
        const { data: profiles, error: fetchError } = await query.not('email', 'is', null)

        if (fetchError) throw fetchError

        const recipients = profiles || []
        if (recipients.length === 0) return errorResponse('Aucun destinataire trouvé', 400)

        // Build transporter from DB settings (or env fallback)
        const smtp = await getSmtpConfig(adminSupabase)
        if (!smtp.pass) return errorResponse('Mot de passe SMTP non configuré — allez dans Paramètres → Emails', 400)

        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure,
            auth: { user: smtp.user, pass: smtp.pass }
        })
        const FROM_EMAIL = smtp.user
        const FROM_NAME = process.env.SMTP_FROM_NAME || 'WazzapAI'

        let sent = 0
        let failed = 0

        // Send in batches of 5 with 400ms delay (Hostinger rate limit safe)
        for (let i = 0; i < recipients.length; i += 5) {
            const batch = recipients.slice(i, i + 5)
            await Promise.allSettled(
                batch.map(async (p: any) => {
                    const userName = p.full_name || p.email.split('@')[0] || 'Utilisateur'
                    const html = emailCampaignTemplate(userName, message.trim())
                    try {
                        await transporter.sendMail({
                            from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
                            to: p.email,
                            subject: subject.trim(),
                            html,
                        })
                        sent++
                    } catch (e) {
                        console.error(`Failed to send to ${p.email}:`, e)
                        failed++
                    }
                })
            )
            if (i + 5 < recipients.length) await delay(400)
        }

        // Log to broadcasts table
        try {
            await adminSupabase.from('broadcasts').insert({
                agent_id: null,
                message: `[EMAIL] ${subject.trim()}`,
                recipients_count: sent,
                status: 'sent',
                created_at: new Date().toISOString()
            })
        } catch { /* log failure is non-blocking */ }

        return successResponse({ sent, failed, total: recipients.length })
    } catch (err) {
        console.error('Email broadcast error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
