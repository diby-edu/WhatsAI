import { notify } from '../notification.service'
import type { NotificationType } from '../notification.service'
import { getAdminSupabase, getMailTransporter, APP_URL } from './shared'

// Onboarding Email Sequence
// =============================================

function obBase(content: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#020617;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);padding:12px 16px;border-radius:14px;">
        <span style="color:white;font-size:24px;font-weight:700;">WazzapAI</span>
      </div>
    </div>
    <div style="background:rgba(15,23,42,0.95);border:1px solid rgba(148,163,184,0.15);border-radius:20px;padding:32px;color:#e2e8f0;">
      ${content}
    </div>
    <div style="text-align:center;margin-top:24px;color:#64748b;font-size:12px;">
      <p>WazzapAI — Automatisation WhatsApp intelligente</p>
      <p>Cet email a été envoyé automatiquement. Ne pas répondre.</p>
    </div>
  </div>
</body>
</html>`
}

function obBtn(label: string, url: string): string {
    return `<div style="margin-top:28px;">
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:white;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;">${label}</a>
    </div>`
}

function obItem(emoji: string, text: string): string {
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid rgba(148,163,184,0.08);">
      <span style="font-size:18px;flex-shrink:0;">${emoji}</span>
      <span style="color:#cbd5e1;font-size:14px;line-height:1.5;">${text}</span>
    </div>`
}

function buildOnboardingEmailA(userName: string): { subject: string; html: string } {
    return {
        subject: 'Votre agent WhatsApp vous attend',
        html: obBase(`
      <p style="font-size:16px;margin:0 0 12px 0;">Bonjour <strong>${userName}</strong>,</p>
      <p style="color:#94a3b8;margin:0 0 20px 0;">Vous avez créé votre compte hier, mais vous n'avez pas encore configuré votre agent.</p>

      <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:12px;padding:20px;margin-bottom:20px;">
        <div style="color:#e2e8f0;font-weight:600;margin-bottom:12px;">Un agent se crée en moins de 5 minutes :</div>
        ${obItem('🎯', 'Choisissez son rôle : support client, vente, e-commerce, restaurant…')}
        ${obItem('✏️', 'Donnez-lui un nom et définissez sa personnalité')}
        ${obItem('📱', 'Connectez votre numéro WhatsApp par QR code')}
      </div>

      <p style="color:#94a3b8;font-size:14px;">Votre essai dure encore <strong style="color:white;">6 jours</strong>. Ne le laissez pas expirer sans avoir testé.</p>
      ${obBtn('Créer mon premier agent', `${APP_URL}/dashboard/agents/new`)}
    `)
    }
}

function buildOnboardingEmailB(userName: string, agentName: string, agentId: string): { subject: string; html: string } {
    return {
        subject: 'Dernière étape — connectez votre WhatsApp',
        html: obBase(`
      <p style="font-size:16px;margin:0 0 12px 0;">Bonjour <strong>${userName}</strong>,</p>
      <p style="color:#94a3b8;margin:0 0 20px 0;">Votre agent <strong style="color:white;">${agentName}</strong> est configuré, mais il n'est pas encore connecté à WhatsApp.</p>

      <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="color:#f87171;font-weight:600;margin:0 0 6px 0;">Sans connexion WhatsApp, votre agent est inactif.</p>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Il ne peut recevoir ni envoyer aucun message.</p>
      </div>

      <p style="color:#94a3b8;font-size:14px;">La connexion prend <strong style="color:white;">30 secondes</strong> : ouvrez WhatsApp sur votre téléphone et scannez le QR code.</p>
      ${obBtn('Connecter WhatsApp maintenant', `${APP_URL}/dashboard/agents/${agentId}?tab=whatsapp`)}
    `)
    }
}

function buildOnboardingEmailC1(userName: string, agentName: string, agentId: string): { subject: string; html: string } {
    return {
        subject: 'Votre agent ne sait rien — alimentez-le',
        html: obBase(`
      <p style="font-size:16px;margin:0 0 12px 0;">Bonjour <strong>${userName}</strong>,</p>
      <p style="color:#94a3b8;margin:0 0 20px 0;">Votre agent <strong style="color:white;">${agentName}</strong> est connecté à WhatsApp, mais sa base de connaissances est vide.</p>

      <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="color:#f87171;font-weight:600;margin:0 0 8px 0;">Si un client lui écrit aujourd'hui, il sera incapable de répondre correctement.</p>
        <p style="color:#94a3b8;font-size:13px;margin:0;">La base de connaissances, c'est le cerveau de votre agent. Sans elle, il ne connaît rien de votre activité.</p>
      </div>

      <div style="margin-bottom:20px;">
        <div style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Ce que vous pouvez y ajouter</div>
        ${obItem('💰', 'Vos tarifs et offres')}
        ${obItem('🕐', 'Vos horaires d\'ouverture')}
        ${obItem('❓', 'Questions fréquentes de vos clients (FAQ)')}
        ${obItem('🛠️', 'Description de vos services')}
        ${obItem('📍', 'Votre localisation et contact')}
      </div>
      ${obBtn('Alimenter la base de connaissances', `${APP_URL}/dashboard/agents/${agentId}/knowledge`)}
    `)
    }
}

function buildOnboardingEmailC2(userName: string, agentName: string, agentId: string): { subject: string; html: string } {
    return {
        subject: 'Votre agent est connecté — ajoutez vos produits',
        html: obBase(`
      <p style="font-size:16px;margin:0 0 12px 0;">Bonjour <strong>${userName}</strong>,</p>
      <p style="color:#94a3b8;margin:0 0 20px 0;">Votre agent <strong style="color:white;">${agentName}</strong> est connecté à WhatsApp, mais votre catalogue est vide.</p>

      <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="color:#f87171;font-weight:600;margin:0 0 6px 0;">Sans produits, votre agent ne peut rien présenter ni vendre.</p>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Il ne peut pas répondre aux questions sur vos offres, ni prendre de commandes.</p>
      </div>

      <div style="margin-bottom:20px;">
        <div style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Ajoutez dès maintenant</div>
        ${obItem('🛍️', 'Vos produits ou plats avec prix et description')}
        ${obItem('🖼️', 'Des photos (votre agent peut les envoyer aux clients)')}
        ${obItem('📦', 'Vos options de livraison et de paiement')}
      </div>
      ${obBtn('Ajouter mes produits au catalogue', `${APP_URL}/dashboard/agents/${agentId}/products`)}
    `)
    }
}

function buildOnboardingEmailD(userName: string, agentName: string): { subject: string; html: string } {
    return {
        subject: 'Votre agent est prêt — il attend ses premiers clients',
        html: obBase(`
      <p style="font-size:16px;margin:0 0 12px 0;">Bonjour <strong>${userName}</strong>,</p>
      <p style="color:#94a3b8;margin:0 0 20px 0;">Votre agent <strong style="color:white;">${agentName}</strong> est entièrement configuré et prêt à répondre.</p>

      <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="color:#10b981;font-weight:600;margin:0 0 6px 0;">Il ne lui manque plus qu'un client à qui répondre.</p>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Partagez votre numéro WhatsApp et votre agent prend le relai automatiquement, 24h/24.</p>
      </div>

      <div style="margin-bottom:20px;">
        <div style="color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Comment partager votre numéro</div>
        ${obItem('📲', 'Ajoutez-le à la bio de vos réseaux sociaux (Instagram, Facebook…)')}
        ${obItem('🌐', 'Intégrez un bouton WhatsApp sur votre site web')}
        ${obItem('🗣️', 'Communiquez-le directement à vos clients existants')}
        ${obItem('🖨️', 'Imprimez-le sur vos flyers, menus, cartes de visite')}
      </div>
      ${obBtn('Accéder à mon dashboard', `${APP_URL}/dashboard`)}
    `)
    }
}

/**
 * Behavioral onboarding email sequence for active free-trial users.
 * Detects where each user is blocked and sends one targeted email.
 * Each email type is sent at most once per user (tracked via notification_log).
 * Runs daily at 9:00 AM UTC.
 */
async function sendOnboardingSequenceEmails(): Promise<void> {
    console.log('[CRON] Starting onboarding sequence emails...')

    try {
        const supabase = getAdminSupabase()
        const now = new Date()
        const nowIso = now.toISOString()
        const dayAgo = new Date(now.getTime() - 24 * 3600000).toISOString()

        // Active free trial users: registered > 24h ago, trial not expired
        const { data: trialUsers, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, created_at, test_account_cleanup_deadline')
            .eq('plan', 'free')
            .not('test_account_cleanup_deadline', 'is', null)
            .gt('test_account_cleanup_deadline', nowIso)
            .lt('created_at', dayAgo)

        if (error) {
            console.error('[CRON] Error fetching trial users:', error)
            return
        }

        if (!trialUsers || trialUsers.length === 0) {
            console.log('[CRON] No active trial users for onboarding emails.')
            return
        }

        console.log(`[CRON] Processing ${trialUsers.length} trial user(s) for onboarding emails`)

        const transporter = getMailTransporter()
        const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || ''
        const fromName = process.env.SMTP_FROM_NAME || 'WazzapAI'

        for (const user of trialUsers) {
            try {
                if (!user.email) continue

                const userName = (user.full_name || '').trim() || 'cher utilisateur'

                // Get user's non-archived agents
                const { data: agents } = await supabase
                    .from('agents')
                    .select('id, name, mission, knowledge_count, whatsapp_ever_connected')
                    .eq('user_id', user.id)
                    .is('archived_at', null)

                const agentList = agents || []

                let emailType: string | null = null
                let emailPayload: { subject: string; html: string } | null = null
                let notifAgent: { id: string; name: string } | null = null

                if (agentList.length === 0) {
                    // A: no agent created yet
                    emailType = 'onboarding_A'
                    emailPayload = buildOnboardingEmailA(userName)
                } else {
                    const connectedAgents = agentList.filter((a: any) => a.whatsapp_ever_connected)

                    if (connectedAgents.length === 0) {
                        // B: agent exists but WhatsApp never connected
                        const first = agentList[0] as any
                        emailType = 'onboarding_B'
                        emailPayload = buildOnboardingEmailB(userName, first.name || 'votre agent', first.id)
                        notifAgent = { id: first.id, name: first.name || 'votre agent' }
                    } else {
                        // Check content readiness
                        let contentAgent: any = null
                        let isSupport = false

                        // C1: support agent with empty KB
                        for (const agent of connectedAgents as any[]) {
                            if (agent.mission === 'support_client' && (agent.knowledge_count || 0) === 0) {
                                contentAgent = agent
                                isSupport = true
                                break
                            }
                        }

                        // C2: non-support agent with no products
                        if (!contentAgent) {
                            const nonSupport = (connectedAgents as any[]).filter((a: any) => a.mission !== 'support_client')
                            for (const agent of nonSupport) {
                                const { count } = await supabase
                                    .from('products')
                                    .select('id', { count: 'exact', head: true })
                                    .eq('agent_id', agent.id)
                                if ((count || 0) === 0) {
                                    contentAgent = agent
                                    isSupport = false
                                    break
                                }
                            }
                        }

                        if (contentAgent) {
                            notifAgent = { id: contentAgent.id, name: contentAgent.name || 'votre agent' }
                            if (isSupport) {
                                emailType = 'onboarding_C1'
                                emailPayload = buildOnboardingEmailC1(userName, contentAgent.name || 'votre agent', contentAgent.id)
                            } else {
                                emailType = 'onboarding_C2'
                                emailPayload = buildOnboardingEmailC2(userName, contentAgent.name || 'votre agent', contentAgent.id)
                            }
                        } else {
                            // D: everything configured, no conversations yet
                            const agentIds = (connectedAgents as any[]).map((a: any) => a.id)
                            const { count: convCount } = await supabase
                                .from('conversations')
                                .select('id', { count: 'exact', head: true })
                                .in('agent_id', agentIds)

                            if ((convCount || 0) === 0) {
                                const first = connectedAgents[0] as any
                                emailType = 'onboarding_D'
                                emailPayload = buildOnboardingEmailD(userName, first.name || 'votre agent')
                                notifAgent = { id: first.id, name: first.name || 'votre agent' }
                            }
                        }
                    }
                }

                if (!emailType || !emailPayload) {
                    continue
                }

                // Anti-duplicate: each type sent at most once per user
                const { data: alreadySent } = await supabase
                    .from('notification_log')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('type', emailType)
                    .maybeSingle()

                if (alreadySent) {
                    continue
                }

                await transporter.sendMail({
                    from: `"${fromName}" <${fromEmail}>`,
                    to: user.email,
                    subject: emailPayload.subject,
                    html: emailPayload.html,
                })

                await supabase.from('notification_log').insert({
                    user_id: user.id,
                    type: emailType,
                    data: { email: user.email }
                })

                // Send push notification in parallel (best-effort)
                const PUSH_TYPE_MAP: Record<string, NotificationType> = {
                    onboarding_A:  'onboarding_no_agent',
                    onboarding_B:  'onboarding_no_whatsapp',
                    onboarding_C1: 'onboarding_empty_kb',
                    onboarding_C2: 'onboarding_no_products',
                    onboarding_D:  'onboarding_no_traffic',
                }
                const pushType = PUSH_TYPE_MAP[emailType]
                if (pushType) {
                    notify(user.id, pushType, {
                        agentName: notifAgent?.name,
                        agentId:   notifAgent?.id,
                    }).catch(() => {/* best-effort */})
                }

                console.log(`[CRON] Onboarding ${emailType} sent to ${user.email}`)

                await new Promise(r => setTimeout(r, 300))

            } catch (userErr) {
                console.error(`[CRON] Error sending onboarding email to user ${user.id}:`, userErr)
            }
        }

        console.log('[CRON] Onboarding sequence emails completed.')
    } catch (error) {
        console.error('[CRON] Fatal error in onboarding sequence:', error)
    }
}

export {
    sendOnboardingSequenceEmails,
}
