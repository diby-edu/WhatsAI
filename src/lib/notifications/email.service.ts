import nodemailer from 'nodemailer'
import { createAdminClient } from '@/lib/api-utils'

// =============================================
// Email Service - Sends transactional emails via SMTP (Hostinger)
// =============================================

async function logEmail(
    userId: string | undefined,
    email: string,
    type: string,
    subject: string,
    status: 'sent' | 'failed',
    failureReason?: string
) {
    try {
        const adminSupabase = createAdminClient()
        await adminSupabase.from('email_logs').insert({
            user_id: userId ?? null,
            email,
            type,
            subject,
            status,
            failure_reason: failureReason ?? null,
            sent_at: status === 'sent' ? new Date().toISOString() : null,
        })
    } catch {
        // Non-blocking — logging failure must never break email delivery
    }
}

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: (process.env.SMTP_PORT || '465') === '465', // true for 465, false for 587
    auth: {
        user: process.env.SMTP_USER || 'support@wazzapai.com',
        pass: process.env.SMTP_PASSWORD || '',
    },
})

const FROM_NAME = process.env.SMTP_FROM_NAME || 'WazzapAI'
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'support@wazzapai.com'

// =============================================
// Email Templates
// =============================================

function baseTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #020617;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); padding: 12px 16px; border-radius: 14px;">
                <span style="color: white; font-size: 24px; font-weight: 700;">💬 WazzapAI</span>
            </div>
        </div>
        <!-- Content -->
        <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 20px; padding: 32px; color: #e2e8f0;">
            ${content}
        </div>
        <!-- Footer -->
        <div style="text-align: center; margin-top: 24px; color: #64748b; font-size: 12px;">
            <p>WazzapAI — Automatisation WhatsApp intelligente</p>
            <p>Cet email a été envoyé automatiquement. Ne pas répondre.</p>
        </div>
    </div>
</body>
</html>`
}

function lowCreditsTemplate(userName: string, balance: number): string {
    return baseTemplate(`
        <h2 style="color: #fbbf24; margin: 0 0 16px 0; font-size: 22px;">⚠️ Crédits faibles</h2>
        <p style="margin: 0 0 12px 0; font-size: 16px;">Bonjour <strong>${userName}</strong>,</p>
        <p style="margin: 0 0 20px 0; color: #94a3b8;">Votre solde de crédits est bas. Rechargez pour éviter l'interruption de votre agent IA.</p>
        <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 36px; font-weight: 700; color: #fbbf24;">${balance}</div>
            <div style="color: #94a3b8; font-size: 14px;">crédits restants</div>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'}/dashboard/billing" 
           style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
            Recharger mes crédits
        </a>
    `)
}

function creditsDepletedTemplate(userName: string): string {
    return baseTemplate(`
        <h2 style="color: #ef4444; margin: 0 0 16px 0; font-size: 22px;">🚨 Crédits épuisés</h2>
        <p style="margin: 0 0 12px 0; font-size: 16px;">Bonjour <strong>${userName}</strong>,</p>
        <p style="margin: 0 0 20px 0; color: #94a3b8;">Votre solde de crédits a atteint <strong>zéro</strong>. Votre agent IA ne peut plus répondre aux messages WhatsApp.</p>
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 36px; font-weight: 700; color: #ef4444;">0</div>
            <div style="color: #94a3b8; font-size: 14px;">crédits restants</div>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'}/dashboard/billing" 
           style="display: inline-block; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
            Recharger maintenant
        </a>
    `)
}

function subscriptionExpiringTemplate(userName: string, planName: string, daysLeft: number, expiryDate: string): string {
    return baseTemplate(`
        <h2 style="color: #f97316; margin: 0 0 16px 0; font-size: 22px;">📅 Abonnement expire bientôt</h2>
        <p style="margin: 0 0 12px 0; font-size: 16px;">Bonjour <strong>${userName}</strong>,</p>
        <p style="margin: 0 0 20px 0; color: #94a3b8;">Votre abonnement <strong>${planName}</strong> expire dans <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong>.</p>
        <div style="background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 18px; font-weight: 600; color: #f97316;">Expiration le ${expiryDate}</div>
            <div style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Renouvelez pour ne pas perdre votre agent</div>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'}/dashboard/billing" 
           style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
            Renouveler mon abonnement
        </a>
    `)
}

function androidAppLaunchTemplate(userName: string): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.wazzapai.app'
    return baseTemplate(`
        <h2 style="color: #10b981; margin: 0 0 16px 0; font-size: 22px;">WazzapAI est sur Android !</h2>
        <p style="margin: 0 0 8px 0; font-size: 16px;">Bonjour <strong>${userName}</strong>,</p>
        <p style="margin: 0 0 24px 0; color: #94a3b8;">Bonne nouvelle : <strong>WazzapAI est maintenant disponible sur Google Play.</strong></p>

        <div style="background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 14px; padding: 20px; margin-bottom: 28px;">
            <p style="margin: 0 0 12px 0; color: #cbd5e1; font-size: 14px; font-weight: 600;">L'application vous permet de :</p>
            <table style="border-collapse: collapse; width: 100%;">
                <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">
                    <span style="color: #10b981; margin-right: 8px;">✓</span> Recevoir des alertes instantanées dès qu'un client vous écrit
                </td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">
                    <span style="color: #10b981; margin-right: 8px;">✓</span> Gérer vos agents WhatsApp depuis votre téléphone
                </td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">
                    <span style="color: #10b981; margin-right: 8px;">✓</span> Consulter vos conversations et statistiques en temps réel
                </td></tr>
                <tr><td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">
                    <span style="color: #10b981; margin-right: 8px;">✓</span> Rester connecté sans ouvrir votre navigateur
                </td></tr>
            </table>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
            <a href="${playStoreUrl}" target="_blank">
                <img
                    src="https://play.google.com/intl/en_us/badges/static/images/badges/fr_badge_web_generic.png"
                    alt="Disponible sur Google Play"
                    width="200"
                    style="border-radius: 8px;"
                />
            </a>
        </div>

        <p style="margin: 0 0 4px 0; color: #64748b; font-size: 13px; text-align: center;">
            L'application est gratuite et se connecte directement à votre compte existant —<br>aucune configuration supplémentaire requise.
        </p>

        <div style="border-top: 1px solid rgba(148,163,184,0.1); margin-top: 24px; padding-top: 16px; text-align: center;">
            <a href="${appUrl}/dashboard" style="color: #64748b; font-size: 12px;">
                Accéder au dashboard web
            </a>
        </div>
    `)
}

// =============================================
// Send Functions
// =============================================

export async function sendLowCreditsEmail(toEmail: string, userName: string, balance: number, userId?: string): Promise<boolean> {
    const subject = `⚠️ Crédits faibles — ${balance} crédits restants`
    try {
        await transporter.sendMail({
            from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
            to: toEmail,
            subject,
            html: lowCreditsTemplate(userName, balance),
        })
        console.log(`📧 Low credits email sent to ${toEmail}`)
        void logEmail(userId, toEmail, 'low_credits', subject, 'sent')
        return true
    } catch (error) {
        console.error('Failed to send low credits email:', error)
        void logEmail(userId, toEmail, 'low_credits', subject, 'failed', String(error))
        return false
    }
}

export async function sendCreditsDepletedEmail(toEmail: string, userName: string, userId?: string): Promise<boolean> {
    const subject = '🚨 Crédits épuisés — Votre agent est en pause'
    try {
        await transporter.sendMail({
            from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
            to: toEmail,
            subject,
            html: creditsDepletedTemplate(userName),
        })
        console.log(`📧 Credits depleted email sent to ${toEmail}`)
        void logEmail(userId, toEmail, 'credits_depleted', subject, 'sent')
        return true
    } catch (error) {
        console.error('Failed to send credits depleted email:', error)
        void logEmail(userId, toEmail, 'credits_depleted', subject, 'failed', String(error))
        return false
    }
}

export async function sendAndroidAppLaunchEmail(toEmail: string, userName: string, userId?: string): Promise<boolean> {
    const subject = '📱 WazzapAI est maintenant disponible sur Android !'
    try {
        await transporter.sendMail({
            from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
            to: toEmail,
            subject,
            html: androidAppLaunchTemplate(userName),
        })
        console.log(`📧 Android app launch email sent to ${toEmail}`)
        void logEmail(userId, toEmail, 'android_app_launch', subject, 'sent')
        return true
    } catch (error) {
        console.error('Failed to send android app launch email:', error)
        void logEmail(userId, toEmail, 'android_app_launch', subject, 'failed', String(error))
        return false
    }
}

export async function sendSubscriptionExpiringEmail(
    toEmail: string,
    userName: string,
    planName: string,
    daysLeft: number,
    expiryDate: string,
    userId?: string
): Promise<boolean> {
    const subject = `📅 Votre abonnement ${planName} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`
    try {
        await transporter.sendMail({
            from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
            to: toEmail,
            subject,
            html: subscriptionExpiringTemplate(userName, planName, daysLeft, expiryDate),
        })
        console.log(`📧 Subscription expiring email sent to ${toEmail}`)
        void logEmail(userId, toEmail, 'subscription_expiring', subject, 'sent')
        return true
    } catch (error) {
        console.error('Failed to send subscription expiring email:', error)
        void logEmail(userId, toEmail, 'subscription_expiring', subject, 'failed', String(error))
        return false
    }
}
