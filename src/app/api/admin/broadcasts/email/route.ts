import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { getEmailRecipientsForBroadcastSegment } from '@/lib/admin/broadcast-segments'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'
const BCC_BATCH_SIZE = 40
const GENERIC_GREETING_NAME = 'cher partenaire'

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

// GET — preview count by segment
export async function GET(request: NextRequest) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    const { searchParams } = new URL(request.url)
    const targetSegment = searchParams.get('targetSegment') || searchParams.get('targetPlan') || 'all'

    const recipients = await getEmailRecipientsForBroadcastSegment(adminSupabase, targetSegment)
    return successResponse({ count: recipients.length })
}

// POST — send email campaign
export async function POST(request: NextRequest) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const { subject, message, targetSegment, targetPlan, targetEmails } = await request.json()

        if (!subject?.trim() || !message?.trim()) {
            return errorResponse('Sujet et message requis', 400)
        }

        // Fetch recipients — individual list or plan segment
        let recipients: { email: string; full_name: string | null }[] = []
        if (Array.isArray(targetEmails) && targetEmails.length > 0) {
            const { data: profiles, error: fetchError } = await adminSupabase
                .from('profiles')
                .select('email, full_name')
                .in('email', targetEmails)
                .not('email', 'is', null)
            if (fetchError) throw fetchError
            recipients = profiles || []
        } else {
            const profiles = await getEmailRecipientsForBroadcastSegment(
                adminSupabase,
                targetSegment || targetPlan || 'all'
            )
            recipients = profiles.map((profile) => ({
                email: profile.email as string,
                full_name: profile.full_name,
            }))
        }

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

        const uniqueEmails = Array.from(new Set(
            recipients
                .map((recipient) => String(recipient?.email || '').trim().toLowerCase())
                .filter(Boolean)
        ))

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const validEmails = uniqueEmails.filter((email) => emailRegex.test(email))
        const invalidCount = uniqueEmails.length - validEmails.length

        let sent = 0
        let failed = invalidCount
        const html = emailCampaignTemplate(GENERIC_GREETING_NAME, message.trim())

        // Send in grouped BCC batches to avoid one inbox copy per recipient.
        for (let i = 0; i < validEmails.length; i += BCC_BATCH_SIZE) {
            const bccBatch = validEmails.slice(i, i + BCC_BATCH_SIZE)
            try {
                await transporter.sendMail({
                    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
                    to: FROM_EMAIL,
                    replyTo: FROM_EMAIL,
                    bcc: bccBatch.join(','),
                    subject: subject.trim(),
                    html,
                })
                sent += bccBatch.length
            } catch (e) {
                console.error(`Failed BCC batch ${i / BCC_BATCH_SIZE + 1}:`, e)
                failed += bccBatch.length
            }

            if (i + BCC_BATCH_SIZE < validEmails.length) await delay(400)
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

        return successResponse({ sent, failed, total: uniqueEmails.length })
    } catch (err) {
        console.error('Email broadcast error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
