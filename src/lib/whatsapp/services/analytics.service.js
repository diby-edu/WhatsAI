/**
 * ═══════════════════════════════════════════════════════════════
 * ANALYTICS SERVICE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Responsabilité : Mise à jour stats agents et analyse leads
 */

class AnalyticsService {
    /**
     * Enregistre une interaction
     */
    static async trackInteraction(supabase, agentId, messageCount = 2) {
        try {
            // Utilisation d'une transaction Supabase ou simple update
            return await supabase
                .from('agents')
                .update({
                    total_messages: supabase.rpc('increment', { row_id: agentId, x: messageCount }), // Assuming an increment function exists or using direct update
                    last_message_at: new Date().toISOString()
                })
                .eq('id', agentId)
        } catch (error) {
            console.error('Failed to track interaction:', error)
        }
    }

    /**
     * Version simplifiée pour l'instant (direct update)
     */
    static async track(supabase, agentId, currentTotal = 0) {
        return await supabase
            .from('agents')
            .update({
                total_messages: currentTotal + 2,
                last_message_at: new Date().toISOString()
            })
            .eq('id', agentId)
    }

    static async analyzeLeadQuality(openai, conversationHistory) {
        try {
            // Analyse tous les 5 messages pour économiser les tokens
            if (conversationHistory.length % 5 !== 0) return null

            console.log('📊 Analyzing lead quality...')

            const historyText = conversationHistory
                .map(m => `${m.role === 'user' ? 'Client' : 'Assistant'}: ${m.content}`)
                .join('\n')

            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Analyse cette conversation WhatsApp et évalue la qualité du lead. 
                        Retourne UNIKEMENT un JSON avec : 
                        {
                            "status": "cold" | "warm" | "hot",
                            "score": 1-10,
                            "reasoning": "une phrase courte en français expliquant pourquoi"
                        }
                        
                        Critères :
                        - Cold: Curieux, pose des questions vagues, pas d'intention d'achat.
                        - Warm: Pose des questions sur les prix, les détails, demande des images.
                        - Hot: Prêt à commander, demande comment payer ou donne son adresse.`
                    },
                    {
                        role: 'user',
                        content: `Historique :\n${historyText}`
                    }
                ],
                response_format: { type: 'json_object' },
                temperature: 0
            })

            const result = JSON.parse(response.choices[0].message.content)
            console.log(`🎯 Lead Analysis: ${result.status} (${result.score}/10)`)

            return result
        } catch (error) {
            console.error('Lead analysis failed:', error)
            return null
        }
    }
}

module.exports = { AnalyticsService }
