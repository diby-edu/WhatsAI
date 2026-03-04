/**
 * ═══════════════════════════════════════════════════════════════
 * MESSAGE HANDLER (REFACTORÉ v2.0)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Responsabilité : ORCHESTRATION UNIQUEMENT
 * 
 * Cette version refactorée délègue toute la logique métier aux services.
 * Le handler coordonne simplement le flux sans exécuter de logique complexe.
 * 
 * Taille : ~150 lignes (vs 742 lignes avant)
 * Services utilisés : 6
 * Testabilité : 80%+
 */

const { ConversationService } = require('../services/conversation.service')
const { CreditsService } = require('../services/credits.service')
const { MediaService } = require('../services/media.service')
const { MessagingService } = require('../services/messaging.service')
const { AIService } = require('../services/ai.service')
const { AnalyticsService } = require('../services/analytics.service')
const { ErrorHandler } = require('../services/errors')
const { analyzeSentiment } = require('../ai/sentiment')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING - Protection contre les abus
// ═══════════════════════════════════════════════════════════════
const rateLimitMap = new Map()
const RATE_LIMIT = {
    maxMessages: 10,      // Max 10 messages
    windowMs: 60000,      // Par minute
    cleanupInterval: 300000  // Nettoyage toutes les 5 minutes
}

// Nettoyage périodique pour éviter fuite mémoire
setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitMap.entries()) {
        if (now - record.windowStart > RATE_LIMIT.windowMs * 2) {
            rateLimitMap.delete(key)
        }
    }
}, RATE_LIMIT.cleanupInterval)

/**
 * Vérifie si un contact est rate-limited
 * @param {string} contactId - ID du contact WhatsApp
 * @returns {boolean} - true si limité
 */
function isRateLimited(contactId) {
    const now = Date.now()
    const record = rateLimitMap.get(contactId) || { count: 0, windowStart: now }

    if (now - record.windowStart > RATE_LIMIT.windowMs) {
        // Nouvelle fenêtre
        record.count = 1
        record.windowStart = now
    } else {
        record.count++
    }

    rateLimitMap.set(contactId, record)

    // 🔒 SECURITÉ DOS MEMOIRE : Max 5000 entrées - supprimer les plus anciennes
    if (rateLimitMap.size > 5000) {
        const entries = Array.from(rateLimitMap.entries())
        entries.sort((a, b) => a[1].windowStart - b[1].windowStart)
        // Remove oldest 1000 entries
        entries.slice(0, 1000).forEach(([key]) => rateLimitMap.delete(key))
    }

    if (record.count > RATE_LIMIT.maxMessages) {
        console.log(`⚠️ Rate limited: ${contactId} (${record.count} msgs in window)`)
        return true
    }
    return false
}

/**
 * Point d'entrée principal pour traiter un message entrant
 * 
 * @param {Object} context - Contexte global (openai, supabase, etc.)
 * @param {string} agentId - ID de l'agent
 * @param {Object} message - Message WhatsApp
 * @param {boolean} isVoiceMessage - Si message vocal
 */
async function handleMessage(context, agentId, message, isVoiceMessage = false) {
    const { openai, supabase, activeSessions, CinetPay } = context

    // ═══════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════
    // RATE LIMITING - Protection contre les abus
    // ═══════════════════════════════════════════════════════════

    // 🔒 FIX CRASH : Validation input
    if (!message || !message.from) {
        console.error('❌ Malformed message received (no sender)', message)
        return
    }

    if (isRateLimited(message.from)) {
        // Informer le client du rate limit
        const session = activeSessions.get(agentId)
        if (session) {
            const { MessagingService } = require('../services/messaging.service')
            await MessagingService.sendText(
                session,
                message.from,
                "⏳ Vous envoyez trop de messages. Merci de patienter quelques instants avant de réessayer."
            ).catch(() => { }) // Ignorer les erreurs d'envoi
        }
        return
    }

    try {

        // ═══════════════════════════════════════════════════════════
        // PHASE 1 : VÉRIFICATIONS INITIALES
        // ═══════════════════════════════════════════════════════════

        // 1.1 Récupérer l'agent
        const { data: agent } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .single()

        if (!agent) {
            console.error(`Agent not found: ${agentId}`)
            return
        }

        if (!agent.is_active) {
            console.log(`⏸️ Agent inactive (${agentId}), skipping auto-response`)
            return
        }

        // 1.2 Vérifier les crédits
        const hasCredits = await CreditsService.check(supabase, agent.user_id)
        if (!hasCredits) {
            console.log(`⚠️ Insufficient credits for user ${agent.user_id}`)
            // Informer le client que le service est indisponible
            const session = activeSessions.get(agentId)
            if (session) {
                await MessagingService.sendText(
                    session,
                    message.from,
                    "🔧 Notre service est temporairement indisponible. Veuillez réessayer plus tard."
                ).catch(() => { })
            }
            return
        }

        // 1.2b Récupérer la devise du compte (pour l'affichage des prix dans l'IA)
        const { data: userProfile } = await supabase
            .from('profiles')
            .select('currency')
            .eq('id', agent.user_id)
            .single()
        const agentCurrency = userProfile?.currency || 'XOF'

        // 1.3 Récupérer ou créer la conversation
        const conversation = await ConversationService.getOrCreate(
            supabase,
            agentId,
            agent.user_id,
            message.from,
            { wa_name: message.pushName }
        )

        // 1.4 Vérifier si conversation active
        if (!conversation.isActive()) {
            console.log('Conversation paused or escalated, skipping')
            return
        }

        // ═══════════════════════════════════════════════════════════
        // PHASE 2 : TRAITEMENT DU MESSAGE ENTRANT
        // ═══════════════════════════════════════════════════════════

        // 2.1 Sauvegarder le message utilisateur
        await supabase.from('messages').insert({
            conversation_id: conversation.id,
            agent_id: agentId,
            role: 'user',
            content: message.text || (isVoiceMessage ? '[Voice Message]' : '[Image]'),
            whatsapp_message_id: message.key.id,
            status: 'received',
            metadata: {
                is_voice: isVoiceMessage,
                has_media: !!message.imageMessage
            }
        })

        // 2.2 Traiter message vocal (transcription)
        if (isVoiceMessage && message.audioMessage) {
            console.log('🎤 Transcribing voice message...')
            const buffer = await downloadMediaMessage(
                {
                    key: message.key,
                    message: { audioMessage: message.audioMessage }
                },
                'buffer',
                { logger: console }
            )

            const transcription = await MediaService.transcribeAudio(openai, buffer)
            message.text = transcription
            console.log(`📝 Transcription: ${transcription}`)
        }

        // 2.3 Traiter image
        if (message.imageMessage) {
            console.log('📸 Processing image...')
            const imageBase64 = await MediaService.processImage(message, downloadMediaMessage)
            message.imageBase64 = imageBase64
            message.text = message.text || message.caption || "Que penses-tu de cette image ?"
        }

        // ═══════════════════════════════════════════════════════════
        // PHASE 3 : CHARGEMENT DU CONTEXTE
        // ═══════════════════════════════════════════════════════════

        // 3.1 Historique de conversation
        const conversationHistory = await conversation.getHistory(50)

        // 3.2 Produits de l'agent (Isolation stricte par agent_id)
        const { data: products } = await supabase
            .from('products')
            .select('*')
            .eq('agent_id', agentId)
            .eq('is_available', true)
            .limit(20)

        // 3.3 Commandes récentes du client
        const { data: orders } = await supabase
            .from('orders')
            .select(`
                id, status, total_fcfa, created_at,
                customer_phone, delivery_address,
                items:order_items(product_name, quantity)
            `)
            .eq('user_id', agent.user_id)
            .eq('customer_phone', message.from)
            .order('created_at', { ascending: false })
            .limit(20) // Augmenté pour couvrir l'historique de 15 jours

        // ═══════════════════════════════════════════════════════════
        // PHASE 4 : ANALYSE SENTIMENT & ESCALADE
        // ═══════════════════════════════════════════════════════════

        const sentimentAnalysis = await analyzeSentiment(openai, message.text)
        console.log(`❤️ Sentiment: ${sentimentAnalysis.sentiment}`)

        if (conversation.shouldEscalate(sentimentAnalysis)) {
            console.log('🚨 Escalating angry customer...')

            await conversation.escalate('Client en colère détecté')

            // Message de transfert
            let handoverMessage = "Je comprends votre frustration et je m'en excuse sincèrement. 🙏\n\n"
            handoverMessage += "Je transfère immédiatement votre dossier à un conseiller humain qui va vous contacter très rapidement."

            if (agent.escalation_phone) {
                handoverMessage += `\n\n📞 Vous pouvez aussi appeler directement : ${agent.escalation_phone}`
            }

            await MessagingService.sendText(
                activeSessions.get(agentId),
                message.from,
                handoverMessage
            )

            return // Stop AI
        }

        // ═══════════════════════════════════════════════════════════
        // PHASE 5 : GÉNÉRATION RÉPONSE IA
        // ═══════════════════════════════════════════════════════════

        console.log('🧠 Generating AI response...')

        const aiResponse = await AIService.generate({
            agent,
            message,
            context: {
                history: conversationHistory,
                products: products || [],
                orders: orders || [],
                currency: agentCurrency,
                supabase,
                activeSessions,
                CinetPay
            },
            openai
        })

        // ═══════════════════════════════════════════════════════════
        // PHASE 6 : ENVOI RÉPONSE
        // ═══════════════════════════════════════════════════════════

        const session = activeSessions.get(agentId)
        let voiceSent = false

        // 6.0 Envoyer les images demandées (send_image tool)
        if (aiResponse.imageActions && aiResponse.imageActions.length > 0) {
            for (const imgAction of aiResponse.imageActions) {
                try {
                    await MessagingService.sendImage(
                        session,
                        message.from,
                        imgAction.image_url,
                        imgAction.caption
                    )
                    console.log(`📸 Image sent: ${imgAction.product_name}`)
                } catch (imgError) {
                    console.error('Image send failed:', imgError.message)
                }
            }
        }

        // 6.1 Synthèse vocale (si activée)
        if (agent.voice_enabled && aiResponse.content.length <= 500) {
            try {
                await MessagingService.sendVoice(
                    openai,
                    session,
                    message.from,
                    aiResponse.content
                )
                voiceSent = true
                console.log('🔊 Voice message sent')
            } catch (voiceError) {
                console.warn('Voice failed, falling back to text:', voiceError.message)
            }
        }

        // 6.2 Fallback texte (Nettoyé des liens d'images si images envoyées)
        if (!voiceSent) {
            let finalContent = aiResponse.content

            // Si on a envoyé des images via l'outil, on supprime les liens texte inutiles
            if (aiResponse.imageActions && aiResponse.imageActions.length > 0) {
                // Supprimer les patterns comme ![text](url) ou [text](url) qui contiennent des extensions d'image
                finalContent = finalContent.replace(/!\[.*?\]\(.*?\)/g, '') // Supprimer tout markdown image
                finalContent = finalContent.replace(/\[.*?\]\(.*?https?:\/\/.*\.(?:jpg|jpeg|png|webp).*\)/gi, '') // Supprimer liens vers images
                finalContent = finalContent.trim()
            }

            await MessagingService.sendText(
                session,
                message.from,
                finalContent
            )
            console.log('💬 Text message sent (cleaned)')
        }


        // 6.3 Sauvegarder la réponse
        await supabase.from('messages').insert({
            conversation_id: conversation.id,
            agent_id: agentId,
            role: 'assistant',
            content: aiResponse.content,
            tokens_used: aiResponse.tokensUsed,
            status: 'sent'
        })

        // ═══════════════════════════════════════════════════════════
        // PHASE 7 : MISE À JOUR STATS & CRÉDITS
        // ═══════════════════════════════════════════════════════════

        // 7.1 Déduction crédits (ATOMIQUE)
        const creditsToDeduct = CreditsService.calculateCost(voiceSent)
        await CreditsService.deduct(supabase, agent.user_id, creditsToDeduct)

        // 7.2 Stats agent
        await AnalyticsService.trackInteraction(supabase, agentId, 2)

        // 7.3 Analyse qualité lead (tous les 5 messages)
        if ((conversationHistory.length + 1) % 5 === 0) {
            const leadAnalysis = await AnalyticsService.analyzeLeadQuality(
                openai,
                conversationHistory
            )

            if (leadAnalysis) {
                await supabase.from('conversations').update({
                    lead_status: leadAnalysis.status,
                    lead_score: leadAnalysis.score,
                    lead_notes: leadAnalysis.reasoning
                }).eq('id', conversation.id)
            }
        }

        console.log(`✅ Message handled successfully for conversation ${conversation.id}`)

    } catch (error) {
        // ═══════════════════════════════════════════════════════════
        // GESTION D'ERREUR CENTRALISÉE
        // ═══════════════════════════════════════════════════════════

        await ErrorHandler.handle(error, {
            agentId,
            message,
            activeSessions
        })
    }
}

module.exports = { handleMessage }
