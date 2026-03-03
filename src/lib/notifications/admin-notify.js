/**
 * Admin Notification Service — JavaScript version for WhatsApp bot (Node.js)
 *
 * Sends push notifications to all admin/superadmin users
 * based on their admin_notification_preferences.
 *
 * This is the JS equivalent of admin-notify.ts, usable outside Next.js.
 */

const { createClient } = require('@supabase/supabase-js')

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

// Firebase Admin (lazy init)
let _firebaseAdmin = null
let _firebaseInitialized = false

function getFirebaseAdmin() {
    if (_firebaseInitialized) return _firebaseAdmin
    _firebaseInitialized = true
    try {
        const admin = require('firebase-admin')
        if (!admin.apps.length) {
            const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
            if (!key) return null
            admin.initializeApp({ credential: admin.credential.cert(JSON.parse(key)) })
        }
        _firebaseAdmin = admin
        return admin
    } catch (err) {
        console.error('🔔 Firebase init error:', err.message)
        return null
    }
}

function getPushContent(type, data) {
    switch (type) {
        case 'new_user':
            return {
                title: '👤 Nouvel utilisateur',
                body: `${data.userEmail || 'Un utilisateur'} vient de s\'inscrire.`
            }
        case 'plan_upgrade':
            return {
                title: '⬆️ Plan mis à niveau',
                body: `${data.userName || data.userEmail || 'Un utilisateur'} → plan ${data.planName || ''}.`
            }
        case 'plan_downgrade':
            return {
                title: '⬇️ Plan rétrogradé',
                body: `${data.userName || data.userEmail || 'Utilisateur'} : ${data.previousPlan || ''} → ${data.planName || 'Free'}.`
            }
        case 'payment_received':
            return {
                title: '💰 Paiement reçu',
                body: `${data.userEmail || 'Utilisateur'} — ${(data.paymentAmount || 0).toLocaleString('fr-FR')} FCFA.`
            }
        case 'payment_failed':
            return {
                title: '❌ Paiement échoué',
                body: `Paiement de ${(data.paymentAmount || 0).toLocaleString('fr-FR')} FCFA échoué — ${data.userEmail || 'utilisateur'}.`
            }
        case 'subscription_cancelled':
            return {
                title: '🚫 Abonnement annulé',
                body: `Abonnement de ${data.userName || data.userEmail || 'un utilisateur'} annulé.`
            }
        case 'agent_created':
            return {
                title: '🤖 Nouvel agent créé',
                body: `Agent "${data.agentName || ''}" créé par ${data.userEmail || 'un utilisateur'}.`
            }
        case 'agent_connected':
            return {
                title: '✅ Agent connecté WhatsApp',
                body: `L'agent "${data.agentName || ''}" est maintenant connecté.`
            }
        case 'agent_disconnected':
            return {
                title: '🔌 Agent déconnecté WhatsApp',
                body: `L'agent "${data.agentName || ''}" s'est déconnecté de WhatsApp.`
            }
        case 'agent_quota_exceeded':
            return {
                title: '⚠️ Quota agents dépassé',
                body: `${data.userEmail || 'Un utilisateur'} a atteint sa limite d'agents.`
            }
        case 'openai_error':
            return {
                title: '🚨 Erreur API OpenAI',
                body: `Erreur OpenAI : ${data.errorMessage || 'Erreur inconnue'}.`
            }
        case 'whatsapp_down':
            return {
                title: '⚠️ Service WhatsApp indisponible',
                body: 'Le service WhatsApp bot est hors ligne.'
            }
        case 'high_error_rate':
            return {
                title: '📊 Taux d\'erreur élevé',
                body: `Taux d'erreur anormal détecté. ${data.errorMessage || ''}`.trim()
            }
        case 'new_conversation':
            return {
                title: '💬 Nouvelle conversation',
                body: `${data.contactName || data.contactPhone || 'Un contact'} → agent ${data.agentName || ''}.`
            }
        case 'new_order':
            return {
                title: '🛒 Nouvelle commande (admin)',
                body: `${(data.totalAmount || 0).toLocaleString('fr-FR')} FCFA — ${data.contactName || data.contactPhone || 'client'}.`
            }
        case 'escalation':
            return {
                title: '🚨 Escalade conversation',
                body: `${data.contactName || data.contactPhone || 'Un client'} demande un humain.`
            }
        default:
            return { title: '🔔 Notification admin', body: 'Action requise.' }
    }
}

/**
 * Send push notification to all admin/superadmin users,
 * respecting their admin_notification_preferences.
 *
 * @param {string} type - Notification type (e.g. 'new_user', 'payment_received')
 * @param {object} data - Contextual data for the notification content
 */
async function notifyAdmins(type, data = {}) {
    try {
        const supabase = getSupabase()
        const admin = getFirebaseAdmin()
        if (!admin) return // Push disabled without Firebase

        // 1. Get all admin users
        const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .in('role', ['admin', 'superadmin'])

        if (!admins || admins.length === 0) return

        const pushCol = `push_${type}`

        // 2. For each admin, check preferences and send push
        for (const adminUser of admins) {
            try {
                const { data: prefs } = await supabase
                    .from('admin_notification_preferences')
                    .select(pushCol)
                    .eq('admin_id', adminUser.id)
                    .maybeSingle()

                // Default ON if no preferences saved
                const pushEnabled = prefs ? prefs[pushCol] !== false : true
                if (!pushEnabled) continue

                // Get device tokens for this admin
                const { data: tokens } = await supabase
                    .from('device_tokens')
                    .select('token')
                    .eq('user_id', adminUser.id)

                if (!tokens || tokens.length === 0) continue

                const content = getPushContent(type, data)
                const invalidTokens = []

                for (const t of tokens) {
                    try {
                        await admin.messaging().send({
                            token: t.token,
                            notification: { title: content.title, body: content.body },
                            data: { type, route: '/admin' },
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

                if (invalidTokens.length > 0) {
                    await supabase.from('device_tokens').delete().in('token', invalidTokens)
                }
            } catch (adminErr) {
                console.error(`notifyAdmins error for admin ${adminUser.id}:`, adminErr.message)
            }
        }

        console.log(`🔔 Admin push [${type}] dispatched to ${admins.length} admin(s)`)
    } catch (error) {
        // CRITICAL: Never break business logic
        console.error(`notifyAdmins [${type}] error:`, error.message)
    }
}

module.exports = { notifyAdmins }
