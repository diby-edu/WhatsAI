/**
 * Notification proxy for the standalone WhatsApp bot (Node.js pur)
 * 
 * Since the bot runs outside Next.js, it can't import .ts files directly.
 * This lightweight JS module sends push notifications via Firebase Admin SDK
 * AND email notifications via Nodemailer for critical types.
 */

const { createClient } = require('@supabase/supabase-js')

const LOW_CREDITS_THRESHOLD = 20

// =============================================
// Supabase Admin Client (singleton)
// =============================================

let _supabase = null
function getSupabase() {
    if (!_supabase) {
        _supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )
    }
    return _supabase
}

// =============================================
// Firebase Admin (lazy init, singleton)
// =============================================

let _firebaseAdmin = null
let _firebaseInitialized = false

function getFirebaseAdmin() {
    if (_firebaseInitialized) return _firebaseAdmin
    _firebaseInitialized = true

    try {
        const admin = require('firebase-admin')
        if (!admin.apps.length) {
            const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
            if (!serviceAccountKey) {
                console.warn('🔔 Firebase: FIREBASE_SERVICE_ACCOUNT_KEY not set, push disabled')
                return null
            }
            const serviceAccount = JSON.parse(serviceAccountKey)
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            })
        }
        _firebaseAdmin = admin
        return admin
    } catch (err) {
        console.error('🔔 Firebase init error:', err.message)
        return null
    }
}

// =============================================
// Nodemailer (lazy init, singleton)
// =============================================

let _transporter = null
let _transporterInitialized = false

function getTransporter() {
    if (_transporterInitialized) return _transporter
    _transporterInitialized = true

    try {
        const smtpHost = process.env.SMTP_HOST
        const smtpUser = process.env.SMTP_USER
        const smtpPass = process.env.SMTP_PASSWORD
        if (!smtpHost || !smtpUser || !smtpPass) {
            console.warn('🔔 Email: SMTP_HOST/USER/PASSWORD not set, emails disabled')
            return null
        }
        const nodemailer = require('nodemailer')
        const port = parseInt(process.env.SMTP_PORT || '465')
        _transporter = nodemailer.createTransport({
            host: smtpHost,
            port,
            secure: port === 465,
            auth: { user: smtpUser, pass: smtpPass }
        })
        return _transporter
    } catch (err) {
        console.error('🔔 Nodemailer init error:', err.message)
        return null
    }
}

// =============================================
// Push Content
// =============================================

function getPushContent(type, data) {
    switch (type) {
        case 'low_credits':
            return {
                title: '⚠️ Crédits faibles',
                body: `Il vous reste ${data.balance} crédits. Rechargez pour éviter l'interruption.`
            }
        case 'credits_depleted':
            return {
                title: '🚨 Crédits épuisés',
                body: 'Votre agent IA est en pause. Rechargez vos crédits.'
            }
        case 'new_order':
            return {
                title: '🛒 Nouvelle commande !',
                body: `Commande ${data.orderNumber || ''} de ${data.customerName || 'un client'} — ${data.totalAmount || 0} FCFA`
            }
        case 'order_cancelled':
            return {
                title: '❌ Commande annulée',
                body: `La commande ${data.orderNumber || ''} a été annulée.`
            }
        case 'new_conversation':
            return {
                title: '💬 Nouvelle conversation',
                body: `${data.contactName || data.contactPhone || 'Un contact'} vous a écrit sur WhatsApp.`
            }
        case 'escalation':
            return {
                title: '🚨 Escalade demandée',
                body: `${data.contactName || data.contactPhone || 'Un client'} demande un humain.`
            }
        case 'agent_status_change':
            return {
                title: data.agentStatus === 'connected' ? '✅ Agent connecté' : '❌ Agent déconnecté',
                body: `L'agent "${data.agentName}" est maintenant ${data.agentStatus === 'connected' ? 'en ligne' : 'hors ligne'}.`
            }
        case 'payment_received':
            return {
                title: '💰 Paiement reçu !',
                body: `${data.customerName || 'Un client'} a payé ${data.paymentAmount?.toLocaleString('fr-FR') || 0} FCFA — Commande #${data.orderNumber?.substring(0, 8) || ''}`
            }
        case 'new_booking':
            return {
                title: '📅 Nouvelle réservation !',
                body: `${data.customerName || 'Un client'} a réservé ${data.serviceName || 'un service'} le ${data.bookingDate || ''}${data.bookingTime ? ' à ' + data.bookingTime : ''}`
            }
        case 'stock_out':
            return {
                title: '📦 Stock épuisé',
                body: `Le produit "${data.productName}" est en rupture de stock.`
            }
        default:
            return { title: '🔔 Notification', body: 'Vous avez une notification.' }
    }
}

// =============================================
// Email Templates
// =============================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'

function baseEmailTemplate(content) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #020617;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); padding: 12px 16px; border-radius: 14px;">
                <span style="color: white; font-size: 24px; font-weight: 700;">💬 WazzapAI</span>
            </div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 20px; padding: 32px; color: #e2e8f0;">
            ${content}
        </div>
        <div style="text-align: center; margin-top: 24px; color: #64748b; font-size: 12px;">
            <p>WazzapAI — Automatisation WhatsApp intelligente</p>
            <p>Cet email a été envoyé automatiquement. Ne pas répondre.</p>
        </div>
    </div>
</body>
</html>`
}

function getEmailContent(type, userName, data) {
    switch (type) {
        case 'low_credits':
            return {
                subject: `⚠️ Crédits faibles — ${data.balance} crédits restants`,
                html: baseEmailTemplate(`
                    <h2 style="color: #fbbf24; margin: 0 0 16px 0; font-size: 22px;">⚠️ Crédits faibles</h2>
                    <p style="margin: 0 0 12px 0; font-size: 16px;">Bonjour <strong>${userName}</strong>,</p>
                    <p style="margin: 0 0 20px 0; color: #94a3b8;">Votre solde de crédits est bas. Rechargez pour éviter l'interruption de votre agent IA.</p>
                    <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                        <div style="font-size: 36px; font-weight: 700; color: #fbbf24;">${data.balance}</div>
                        <div style="color: #94a3b8; font-size: 14px;">crédits restants</div>
                    </div>
                    <a href="${APP_URL}/dashboard/billing" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">Recharger mes crédits</a>
                `)
            }
        case 'credits_depleted':
            return {
                subject: '🚨 Crédits épuisés — Votre agent est en pause',
                html: baseEmailTemplate(`
                    <h2 style="color: #ef4444; margin: 0 0 16px 0; font-size: 22px;">🚨 Crédits épuisés</h2>
                    <p style="margin: 0 0 12px 0; font-size: 16px;">Bonjour <strong>${userName}</strong>,</p>
                    <p style="margin: 0 0 20px 0; color: #94a3b8;">Votre solde de crédits a atteint <strong>zéro</strong>. Votre agent IA ne peut plus répondre aux messages WhatsApp.</p>
                    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                        <div style="font-size: 36px; font-weight: 700; color: #ef4444;">0</div>
                        <div style="color: #94a3b8; font-size: 14px;">crédits restants</div>
                    </div>
                    <a href="${APP_URL}/dashboard/billing" style="display: inline-block; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">Recharger maintenant</a>
                `)
            }
        case 'payment_received':
            return {
                subject: `💰 Paiement reçu — ${data.paymentAmount?.toLocaleString('fr-FR') || 0} FCFA`,
                html: baseEmailTemplate(`
                    <h2 style="color: #10b981; margin: 0 0 16px 0; font-size: 22px;">💰 Paiement reçu !</h2>
                    <p style="margin: 0 0 12px 0; font-size: 16px;">Bonjour <strong>${userName}</strong>,</p>
                    <p style="margin: 0 0 20px 0; color: #94a3b8;">Un client vient de payer une commande.</p>
                    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                        <div style="font-size: 36px; font-weight: 700; color: #10b981;">${data.paymentAmount?.toLocaleString('fr-FR') || 0} FCFA</div>
                        <div style="color: #94a3b8; font-size: 14px;">Commande #${data.orderNumber?.substring(0, 8) || ''} — ${data.customerName || 'Client'}</div>
                    </div>
                    <a href="${APP_URL}/dashboard/orders" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">Voir la commande</a>
                `)
            }
        default:
            return null
    }
}

// Mapping type → preference column
const PREF_MAP = {
    low_credits: { push: 'push_low_credits', email: 'email_low_credits' },
    credits_depleted: { push: 'push_credits_depleted', email: 'email_credits_depleted' },
    subscription_expiring: { push: 'push_subscription_expiring', email: 'email_subscription_expiring' },
    new_order: { push: 'push_new_order' },
    order_cancelled: { push: 'push_order_cancelled' },
    payment_received: { push: 'push_payment_received', email: 'email_payment_received' },
    new_booking: { push: 'push_new_booking' },
    new_conversation: { push: 'push_new_conversation' },
    escalation: { push: 'push_escalation' },
    agent_status_change: { push: 'push_agent_status_change' },
    stock_out: { push: 'push_stock_out' }
}

// Email-eligible types (only these types send emails from bot)
const EMAIL_TYPES = ['low_credits', 'credits_depleted', 'payment_received']

// =============================================
// Main Notify Function
// =============================================

async function notify(userId, type, data = {}) {
    try {
        const supabase = getSupabase()

        // 1. Check user preferences
        const prefMapping = PREF_MAP[type]
        if (!prefMapping) {
            console.warn(`🔔 Unknown notification type: ${type}`)
            return
        }

        let prefs = null
        const selectCols = [prefMapping.push, prefMapping.email].filter(Boolean).join(', ')
        if (selectCols) {
            const { data: p } = await supabase
                .from('notification_preferences')
                .select(selectCols)
                .eq('user_id', userId)
                .single()
            prefs = p
        }

        // Default: all notifications ON if no preferences saved
        const pushEnabled = prefMapping.push ? (prefs?.[prefMapping.push] !== false) : false
        const emailEnabled = prefMapping.email ? (prefs?.[prefMapping.email] !== false) : false

        // 2. Send PUSH if enabled
        if (pushEnabled) {
            const admin = getFirebaseAdmin()
            if (admin) {
                // Get device tokens
                const { data: tokens } = await supabase
                    .from('device_tokens')
                    .select('token')
                    .eq('user_id', userId)

                if (tokens && tokens.length > 0) {
                    const content = getPushContent(type, data)
                    const invalidTokens = []

                    for (const t of tokens) {
                        try {
                            await admin.messaging().send({
                                token: t.token,
                                notification: { title: content.title, body: content.body },
                                data: { type, route: '/dashboard' },
                                android: {
                                    priority: 'high',
                                    notification: {
                                        icon: 'ic_launcher',
                                        color: '#10b981',
                                        channelId: 'wazzapai_notifications',
                                        sound: 'default'
                                    }
                                }
                            })
                        } catch (sendErr) {
                            if (sendErr.code === 'messaging/invalid-registration-token' ||
                                sendErr.code === 'messaging/registration-token-not-registered') {
                                invalidTokens.push(t.token)
                            }
                        }
                    }

                    // Clean up invalid tokens
                    if (invalidTokens.length > 0) {
                        await supabase.from('device_tokens').delete().in('token', invalidTokens)
                    }

                    console.log(`🔔 Push [${type}] → ${tokens.length} device(s) for user ${userId}`)
                }
            }
        }

        // 3. Send EMAIL if enabled and this type supports email
        if (emailEnabled && EMAIL_TYPES.includes(type)) {
            const transporter = getTransporter()
            if (transporter) {
                try {
                    // Get user email from Supabase Auth
                    const { data: userData } = await supabase.auth.admin.getUserById(userId)
                    const userEmail = userData?.user?.email
                    const userName = userData?.user?.user_metadata?.full_name || 'Utilisateur'

                    if (userEmail) {
                        const emailContent = getEmailContent(type, userName, data)
                        if (emailContent) {
                            const fromName = process.env.SMTP_FROM_NAME || 'WazzapAI'
                            const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'support@wazzapai.com'
                            await transporter.sendMail({
                                from: `"${fromName}" <${fromEmail}>`,
                                to: userEmail,
                                subject: emailContent.subject,
                                html: emailContent.html
                            })
                            console.log(`📧 Email [${type}] → ${userEmail}`)
                        }
                    }
                } catch (emailErr) {
                    console.error(`📧 Email error [${type}]:`, emailErr.message)
                }
            }
        }

    } catch (error) {
        console.error(`🔔 Notification error [${type}] for user ${userId}:`, error.message)
    }
}

module.exports = { notify, LOW_CREDITS_THRESHOLD }
