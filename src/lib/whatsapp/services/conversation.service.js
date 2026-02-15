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

const { AppError } = require('./errors')

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
            // 1. Chercher conversation existante
            const { data: existing } = await supabase
                .from('conversations')
                .select('*')
                .eq('agent_id', agentId)
                .eq('contact_phone', contactPhone)
                .single()

            if (existing) {
                console.log(`📂 Conversation found: ${existing.id}`)
                return new Conversation(existing, supabase)
            }

            // 2. Créer nouvelle conversation
            console.log(`📂 Creating new conversation for ${contactPhone}`)
            const { data: newConv, error } = await supabase
                .from('conversations')
                .insert({
                    agent_id: agentId,
                    user_id: userId,
                    contact_phone: contactPhone,
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

            // 🔔 NOTIFICATION: Nouvelle conversation
            try {
                const { notify } = require('../../notifications/notification.service')
                notify(userId, 'new_conversation', {
                    contactPhone,
                    contactName: metadata?.wa_name || contactPhone
                })
            } catch (notifError) {
                console.error('🔔 Notification error (non-blocking):', notifError)
            }

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
    static async escalate(supabase, conversationId, reason) {
        try {
            // Get conversation details for notification
            const { data: conv } = await supabase
                .from('conversations')
                .select('user_id, contact_phone, metadata')
                .eq('id', conversationId)
                .single()

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

            // 🔔 NOTIFICATION: Escalade
            if (conv?.user_id) {
                try {
                    const { notify } = require('../../notifications/notification.service')
                    notify(conv.user_id, 'escalation', {
                        contactPhone: conv.contact_phone,
                        contactName: conv.metadata?.wa_name || conv.contact_phone
                    })
                } catch (notifError) {
                    console.error('🔔 Notification error (non-blocking):', notifError)
                }
            }
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
    static async getHistory(supabase, conversationId, limit = 50) {
        try {
            // IMPORTANT: Charger les messages les plus RÉCENTS d'abord
            // puis les inverser pour avoir l'ordre chronologique
            const { data, error } = await supabase
                .from('messages')
                .select('role, content, created_at')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false }) // Plus récents d'abord
                .limit(limit)

            if (error) throw error

            // Inverser pour avoir l'ordre chronologique (ancien → récent)
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
    static async updateMetadata(supabase, conversationId, updates) {
        try {
            // Récupérer métadonnées actuelles
            const { data: current } = await supabase
                .from('conversations')
                .select('metadata')
                .eq('id', conversationId)
                .single()

            // Merger avec nouvelles
            const merged = { ...current?.metadata, ...updates }

            const { error } = await supabase
                .from('conversations')
                .update({ metadata: merged })
                .eq('id', conversationId)

            if (error) throw error
        } catch (error) {
            console.error('Failed to update conversation metadata:', error)
            // Non bloquant
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
        await ConversationService.escalate(this.supabase, this.id, reason)
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
    async getHistory(limit = 20) {
        return await ConversationService.getHistory(this.supabase, this.id, limit)
    }

    /**
     * Vérifie si la conversation est active
     * @returns {boolean}
     */
    isActive() {
        return !this.isPaused() && !this.isEscalated()
    }
}

module.exports = { ConversationService, Conversation }
