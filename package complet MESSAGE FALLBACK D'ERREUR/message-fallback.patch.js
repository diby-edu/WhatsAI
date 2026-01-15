/**
 * ═══════════════════════════════════════════════════════════════
 * QUICK WIN #2 : FALLBACK MESSAGE D'ERREUR
 * ═══════════════════════════════════════════════════════════════
 * 
 * Ce patch ajoute un message d'erreur gracieux au bloc catch de handleMessage.
 * 
 * IMPORTANT : À AJOUTER À LA FIN DU BLOC CATCH EXISTANT
 * 
 * LOCALISATION : src/lib/whatsapp/handlers/message.js
 * LIGNE APPROXIMATIVE : ~420 (dernier catch de la fonction)
 */

// ═══════════════════════════════════════════════════════════════
// ❌ ANCIEN CODE (À REMPLACER)
// ═══════════════════════════════════════════════════════════════

/*
    } catch (error) {
        console.error('Error handling message:', error)
    }
*/

// ═══════════════════════════════════════════════════════════════
// ✅ NOUVEAU CODE (AVEC FALLBACK)
// ═══════════════════════════════════════════════════════════════

    } catch (error) {
        console.error('❌ CRITICAL ERROR handling message:', error)
        
        // ⭐ FALLBACK MESSAGE (Quick Win #2)
        // Garantit que le client reçoit TOUJOURS une réponse
        try {
            const session = activeSessions.get(agentId)
            
            if (session && session.socket && message.from) {
                // Message humble et court (comme demandé)
                const fallbackMessage = "Désolé, je réfléchis trop. Un petit instant... 🤔"
                
                console.log('🛟 Sending fallback message to client...')
                
                await session.socket.sendMessage(message.from, {
                    text: fallbackMessage
                }, {
                    linkPreview: false
                })
                
                console.log('✅ Fallback message sent successfully')
                
                // Optional: Log to DB for monitoring (ne pas bloquer si échec)
                if (supabase && conversation?.id) {
                    await supabase.from('messages').insert({
                        conversation_id: conversation.id,
                        agent_id: agentId,
                        role: 'assistant',
                        content: fallbackMessage,
                        status: 'sent',
                        metadata: {
                            is_fallback: true,
                            error_type: error.name,
                            error_message: error.message
                        }
                    }).catch(dbErr => {
                        // Silence DB errors in fallback (ne pas créer de cascade)
                        console.warn('⚠️ Failed to log fallback message to DB:', dbErr.message)
                    })
                }
            } else {
                console.warn('⚠️ Cannot send fallback: session or socket unavailable')
            }
        } catch (fallbackError) {
            // 🚨 CRITIQUE : NE JAMAIS LANCER D'ERREUR ICI
            // Sinon on crée une boucle infinie
            console.error('❌ FALLBACK FAILED (silent failure):', fallbackError)
            // On log mais on ne fait RIEN d'autre (pas de retry, pas de throw)
        }
    }
}

module.exports = { handleMessage }

// ═══════════════════════════════════════════════════════════════
// 📋 NOTES D'IMPLÉMENTATION
// ═══════════════════════════════════════════════════════════════

/**
 * SÉCURITÉS INTÉGRÉES :
 * 
 * 1. TRY/CATCH DOUBLE :
 *    - Catch principal : erreurs de logique métier
 *    - Catch fallback : erreurs d'envoi du message d'erreur
 * 
 * 2. PRÉVENTION BOUCLE INFINIE :
 *    - Si l'envoi du fallback échoue → LOG SILENCIEUX uniquement
 *    - AUCUN retry, AUCUN throw
 * 
 * 3. VALIDATION SESSION :
 *    - Vérifie que session.socket existe avant d'envoyer
 *    - Évite les crashs si WhatsApp déconnecté
 * 
 * 4. DB NON BLOQUANTE :
 *    - L'insertion DB est en "best effort"
 *    - Si échec → warning silencieux, pas d'erreur
 * 
 * 5. METADATA POUR MONITORING :
 *    - is_fallback: true → facile à tracker
 *    - error_type + error_message → debugging
 * 
 * MESSAGE DESIGN :
 * - Court (< 60 caractères)
 * - Humble (pas de "erreur système")
 * - Emoji optionnel (🤔 humain)
 * - Ton conversationnel
 */
