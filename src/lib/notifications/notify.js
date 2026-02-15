/**
 * Notification proxy for the standalone WhatsApp bot (Node.js pur)
 * 
 * Since the bot runs outside Next.js, it can't import .ts files directly.
 * This lightweight JS module sends push notifications via Firebase Admin SDK
 * and calls the same Supabase tables for preferences/device tokens.
 * 
 * Email notifications are NOT sent from here (they require Nodemailer which
 * is only configured in the Next.js process). Only push notifications are sent.
 */

const { createClient } = require('@supabase/supabase-js')

const LOW_CREDITS_THRESHOLD = 20

// =============================================
// Supabase Admin Client
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
// Firebase Admin (lazy init)
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
        case 'stock_out':
            return {
                title: '📦 Stock épuisé',
                body: `Le produit "${data.productName}" est en rupture de stock.`
            }
        default:
            return { title: '🔔 Notification', body: 'Vous avez une notification.' }
    }
}

// Mapping type → preference column
const PREF_MAP = {
    low_credits: 'push_low_credits',
    credits_depleted: 'push_credits_depleted',
    subscription_expiring: 'push_subscription_expiring',
    new_order: 'push_new_order',
    order_cancelled: 'push_order_cancelled',
    new_conversation: 'push_new_conversation',
    escalation: 'push_escalation',
    agent_status_change: 'push_agent_status_change',
    stock_out: 'push_stock_out'
}

// =============================================
// Main Notify Function
// =============================================

async function notify(userId, type, data = {}) {
    try {
        const supabase = getSupabase()

        // 1. Check user preferences
        const prefColumn = PREF_MAP[type]
        if (prefColumn) {
            const { data: prefs } = await supabase
                .from('notification_preferences')
                .select(prefColumn)
                .eq('user_id', userId)
                .single()

            if (prefs && prefs[prefColumn] === false) {
                console.log(`🔔 Push [${type}] disabled for user ${userId}`)
                return
            }
        }

        // 2. Get device tokens
        const { data: tokens } = await supabase
            .from('device_tokens')
            .select('token')
            .eq('user_id', userId)

        if (!tokens || tokens.length === 0) {
            console.log(`🔔 No device tokens for user ${userId}`)
            return
        }

        // 3. Send via Firebase
        const admin = getFirebaseAdmin()
        if (!admin) return

        const content = getPushContent(type, data)
        const tokenList = tokens.map(t => t.token)

        for (const token of tokenList) {
            try {
                await admin.messaging().send({
                    token,
                    notification: {
                        title: content.title,
                        body: content.body
                    },
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
                // Remove invalid tokens
                if (sendErr.code === 'messaging/invalid-registration-token' ||
                    sendErr.code === 'messaging/registration-token-not-registered') {
                    await supabase.from('device_tokens').delete().eq('token', token)
                }
            }
        }

        console.log(`🔔 Push [${type}] sent to user ${userId} (${tokenList.length} devices)`)

    } catch (error) {
        console.error(`🔔 Notification error [${type}] for user ${userId}:`, error.message)
    }
}

module.exports = { notify, LOW_CREDITS_THRESHOLD }
