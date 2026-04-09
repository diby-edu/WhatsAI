/**
 * ═══════════════════════════════════════════════════════════════
 * CONVERSATION SERVICE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Responsabilité : Gestion du cycle de vie des conversations
 * 
 * Fonctions :
 * - getOrCreate() : Récupère ou crée une conversation
 * - pause() : Met le bot en pause
 * - escalate() : Escalade vers humain
 * - getHistory() : Charge l'historique
 * - updateMetadata() : Met à jour les métadonnées
 */

console.log(`[FILE_VERSION] conversation.service.js v1.0.1 - ${new Date().toISOString()}`)
const { AppError } = require('./errors')
const { notifyAdmins } = require('../../notifications/admin-notify')
const { normalizeWhatsAppContact } = require('../ai/tools/tool-helpers')

function buildTransactionalMetadataReset(metadata = {}, options = {}) {
    const {
        sessionAnchorAt = null,
        closedAt = null,
        cycleReason = null,
    } = options

    return {
        ...(metadata || {}),
        cart: null,
        checkout: null,
        booking: null,
        restaurant: null,
        session_anchor_at: sessionAnchorAt,
        last_cycle_closed_at: closedAt ?? metadata?.last_cycle_closed_at ?? null,
        last_cycle_reason: cycleReason ?? metadata?.last_cycle_reason ?? null,
    }
}

class ConversationService {
    /**
     * Récupère une conversation existante ou en crée une nouvelle
     * 
     * @param {Object} supabase - Client Supabase
     * @param {string} agentId - ID de l'agent
     * @param {string} contactPhone - Numéro du contact
     * @param {Object} metadata - Métadonnées (wa_name, etc.)
     * @returns {Promise<Conversation>} Instance de conversation
     */
    static async getOrCreate(supabase, agentId, userId, contactPhone, metadata = {}) {
        try {
            const rawContact = String(contactPhone || '').trim()
            const normalizedContactPhone = normalizeWhatsAppContact(rawContact)
            const rawContactJid = rawContact.includes('@') ? rawContact : null

            const lookupStrategies = [
                rawContactJid ? { field: 'contact_jid', value: rawContactJid } : null,
                { field: 'contact_phone', value: rawContact },
                normalizedContactPhone ? { field: 'contact_phone', value: normalizedContactPhone } : null,
            ].filter(Boolean)

            let existing = null

            for (const strategy of lookupStrategies) {
                const { data, error } = await supabase
                    .from('conversations')
                    .select('*')
                    .eq('agent_id', agentId)
                    .eq(strategy.field, strategy.value)
                    .maybeSingle()

                if (error) {
                    throw error
                }

                if (data) {
                    existing = data
                    break
                }
            }

            if (existing) {
                const identityUpdates = {}
                const mergedMetadata = {
                    ...(existing.metadata || {}),
                    ...(metadata || {}),
                }

                if (rawContactJid && existing.contact_jid !== rawContactJid) {
                    identityUpdates.contact_jid = rawContactJid
                }

                if (normalizedContactPhone && existing.contact_phone !== normalizedContactPhone) {
                    const existingPhoneLooksLegacyJid = typeof existing.contact_phone === 'string' && existing.contact_phone.includes('@')
                    const existingPhoneMissing = !existing.contact_phone
                    if (existingPhoneMissing || existingPhoneLooksLegacyJid || existing.contact_phone === rawContact) {
                        identityUpdates.contact_phone = normalizedContactPhone
                    }
                }

                if (JSON.stringify(existing.metadata || {}) !== JSON.stringify(mergedMetadata)) {
                    identityUpdates.metadata = mergedMetadata
                }

                if (Object.keys(identityUpdates).length > 0) {
                    const { data: updated, error: updateError } = await supabase
                        .from('conversations')
                        .update(identityUpdates)
                        .eq('id', existing.id)
                        .select()
                        .single()

                    if (updateError) {
                        throw updateError
                    }

                    existing = updated || { ...existing, ...identityUpdates }
                }

                console.log(`📂 Conversation found: ${existing.id}`)
                return new Conversation(existing, supabase)
            }

            // 2. Créer nouvelle conversation
            console.log(`📂 Creating new conversation for ${rawContact}`)
            const { data: newConv, error } = await supabase
                .from('conversations')
                .insert({
                    agent_id: agentId,
                    user_id: userId,
                    contact_phone: normalizedContactPhone || rawContact,
                    contact_jid: rawContactJid,
                    status: 'active',
                    metadata: metadata
                })
                .select()
                .single()

            if (error || !newConv) {
                throw new AppError('Failed to create conversation', {
                    code: 'CONVERSATION_CREATE_FAILED',
                    cause: error
                })
            }

            console.log(`✅ Conversation created: ${newConv.id}`)

            // Notify admins of new conversation (fire-and-forget)
            try {
                const { data: agentData } = await supabase
                    .from('agents')
                    .select('name')
                    .eq('id', agentId)
                    .single()
                notifyAdmins('new_conversation', {
                    agentName: agentData?.name || agentId,
                    agentId,
                    contactPhone: normalizedContactPhone || rawContact,
                    contactName: metadata?.wa_name || normalizedContactPhone || rawContact,
                }).catch(() => {})
            } catch (e) { /* non-blocking */ }

            return new Conversation(newConv, supabase)

        } catch (error) {
            if (error instanceof AppError) throw error
            throw new AppError('Conversation retrieval failed', {
                code: 'CONVERSATION_GET_FAILED',
                cause: error
            })
        }
    }

    /**
     * Met le bot en pause pour une conversation
     * 
     * @param {Object} supabase - Client Supabase
     * @param {string} conversationId - ID de la conversation
     * @param {string} reason - Raison de la pause (optionnel)
     */
    static async pause(supabase, conversationId, reason = null) {
        try {
            const { error } = await supabase
                .from('conversations')
                .update({
                    bot_paused: true,
                    paused_at: new Date().toISOString(),
                    pause_reason: reason
                })
                .eq('id', conversationId)

            if (error) throw error

            console.log(`⏸️ Conversation ${conversationId} paused`)
        } catch (error) {
            throw new AppError('Failed to pause conversation', {
                code: 'CONVERSATION_PAUSE_FAILED',
                cause: error
            })
        }
    }

    /**
     * Escalade la conversation vers un humain
     * 
     * @param {Object} supabase - Client Supabase
     * @param {string} conversationId - ID de la conversation
     * @param {string} reason - Raison de l'escalade
     */
    static async escalate(supabase, conversationId, reason, contactPhone = null) {
        try {
            const { error } = await supabase
                .from('conversations')
                .update({
                    status: 'escalated',
                    bot_paused: true,
                    escalation_reason: reason,
                    escalated_at: new Date().toISOString()
                })
                .eq('id', conversationId)

            if (error) throw error

            console.log(`🚨 Conversation ${conversationId} escalated: ${reason}`)

            // Notify admins of escalation (fire-and-forget)
            notifyAdmins('escalation', {
                contactPhone: contactPhone || conversationId,
                errorMessage: reason,
            }).catch(() => {})
        } catch (error) {
            throw new AppError('Failed to escalate conversation', {
                code: 'CONVERSATION_ESCALATE_FAILED',
                cause: error
            })
        }
    }

    /**
     * Charge l'historique d'une conversation
     * 
     * @param {Object} supabase - Client Supabase
     * @param {string} conversationId - ID de la conversation
     * @param {number} limit - Nombre de messages max (défaut: 20)
     * @returns {Promise<Array>} Messages de la conversation
     */
    static async getHistory(supabase, conversationId, limit = 20, options = {}) {
        try {
            let query = supabase
                .from('messages')
                .select('role, content, created_at')
                .eq('conversation_id', conversationId)
            if (options?.since) {
                query = query.gte('created_at', options.since)
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(limit)

            if (error) throw error

            return (data || []).reverse()
        } catch (error) {
            console.error('Failed to load conversation history:', error)
            return [] // Dégradation gracieuse
        }
    }

    /**
     * Met à jour les métadonnées d'une conversation
     * 
     * @param {Object} supabase - Client Supabase
     * @param {string} conversationId - ID de la conversation
     * @param {Object} updates - Nouvelles métadonnées
     */
    static async updateMetadata(supabase, conversationId, mergedMetadata) {
        try {
            // Reçoit l'objet déjà fusionné depuis l'instance (merge fait en mémoire,
            // pas de SELECT → élimine la race condition RMW sur la DB)
            const { error } = await supabase
                .from('conversations')
                .update({ metadata: mergedMetadata })
                .eq('id', conversationId)

            if (error) throw error
        } catch (error) {
            console.error('Failed to update conversation metadata:', error)
            // Non bloquant
        }
    }

    static async closeCompletedCycle(supabase, conversationId, reason = 'completed_order') {
        try {
            const { data: conversation, error: fetchError } = await supabase
                .from('conversations')
                .select('*')
                .eq('id', conversationId)
                .single()

            if (fetchError || !conversation) {
                if (fetchError) throw fetchError
                return null
            }

            const now = new Date().toISOString()
            const nextMetadata = buildTransactionalMetadataReset(conversation.metadata, {
                sessionAnchorAt: null,
                closedAt: now,
                cycleReason: reason,
            })

            const { data: updated, error: updateError } = await supabase
                .from('conversations')
                .update({
                    status: 'closed',
                    bot_paused: false,
                    metadata: nextMetadata,
                })
                .eq('id', conversationId)
                .select()
                .single()

            if (updateError) throw updateError

            return updated || {
                ...conversation,
                status: 'closed',
                bot_paused: false,
                metadata: nextMetadata,
            }
        } catch (error) {
            console.error('Failed to close completed conversation cycle:', error)
            return null
        }
    }

    static async reopenClosedCycle(supabase, conversationId) {
        try {
            const { data: conversation, error: fetchError } = await supabase
                .from('conversations')
                .select('*')
                .eq('id', conversationId)
                .single()

            if (fetchError || !conversation) {
                if (fetchError) throw fetchError
                return null
            }

            const now = new Date().toISOString()
            const nextMetadata = buildTransactionalMetadataReset(conversation.metadata, {
                sessionAnchorAt: now,
            })

            const { data: updated, error: updateError } = await supabase
                .from('conversations')
                .update({
                    status: 'active',
                    bot_paused: false,
                    metadata: nextMetadata,
                })
                .eq('id', conversationId)
                .select()
                .single()

            if (updateError) throw updateError

            return updated || {
                ...conversation,
                status: 'active',
                bot_paused: false,
                metadata: nextMetadata,
            }
        } catch (error) {
            console.error('Failed to reopen closed conversation cycle:', error)
            return null
        }
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * CONVERSATION MODEL (Domain Object)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Représente une conversation avec ses méthodes métier
 */
class Conversation {
    constructor(data, supabase) {
        Object.assign(this, data)
        this.supabase = supabase
    }

    /**
     * Vérifie si le bot est en pause
     * @returns {boolean}
     */
    isPaused() {
        return this.bot_paused === true
    }

    /**
     * Vérifie si la conversation est escaladée
     * @returns {boolean}
     */
    isEscalated() {
        return this.status === 'escalated'
    }

    /**
     * Vérifie si la conversation doit être escaladée
     * basé sur l'analyse de sentiment
     * 
     * @param {Object} sentimentAnalysis - Résultat de l'analyse
     * @returns {boolean}
     */
    shouldEscalate(sentimentAnalysis) {
        if (!sentimentAnalysis) return false

        // Escalade immédiate si client en colère
        if (sentimentAnalysis.sentiment === 'angry') {
            return true
        }

        // Escalade si négatif + urgent
        if (sentimentAnalysis.sentiment === 'negative' && sentimentAnalysis.is_urgent) {
            return true
        }

        return false
    }

    /**
     * Escalade cette conversation
     * @param {string} reason - Raison de l'escalade
     */
    async escalate(reason) {
        await ConversationService.escalate(this.supabase, this.id, reason, this.contact_phone)
        this.status = 'escalated'
        this.bot_paused = true
    }

    /**
     * Met cette conversation en pause
     * @param {string} reason - Raison de la pause
     */
    async pause(reason = null) {
        await ConversationService.pause(this.supabase, this.id, reason)
        this.bot_paused = true
    }

    /**
     * Charge l'historique de cette conversation
     * @param {number} limit - Nombre de messages
     * @returns {Promise<Array>}
     */
    async getHistory(limit = 20, options = {}) {
        return await ConversationService.getHistory(this.supabase, this.id, limit, options)
    }

    async updateMetadata(updates) {
        // Merge en mémoire d'abord (source de vérité pour les appels séquentiels
        // dans un même handleMessage), puis écriture directe sans re-fetch DB
        this.metadata = { ...(this.metadata || {}), ...(updates || {}) }
        await ConversationService.updateMetadata(this.supabase, this.id, this.metadata)
    }

    /**
     * Vérifie si la conversation est active
     * @returns {boolean}
     */
    isActive() {
        // 'spam' : jamais de réponse bot
        // 'escalated' : humain a pris la main
        // 'bot_paused' : humain a mis en pause
        // 'active' et 'closed' : bot répond (closed = re-engagement client)
        return this.status !== 'spam' && !this.isPaused() && !this.isEscalated()
    }
}

module.exports = { ConversationService, Conversation }
