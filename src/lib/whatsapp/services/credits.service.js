/**
 * ═══════════════════════════════════════════════════════════════
 * CREDITS SERVICE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Responsabilité : Gestion atomique des crédits utilisateur
 * 
 * CRITIQUE : Utilise une fonction PostgreSQL pour garantir l'atomicité
 * et éviter les race conditions lors de déductions simultanées.
 * 
 * Fonctions :
 * - check() : Vérifie la disponibilité des crédits
 * - deduct() : Déduit des crédits (ATOMIQUE)
 * - calculateCost() : Calcule le coût d'un message
 * - getBalance() : Récupère le solde actuel
 */

const { AppError } = require('../utils/errors')

class InsufficientCreditsError extends AppError {
    constructor(message, context) {
        super(message, { code: 'INSUFFICIENT_CREDITS', ...context })
    }
}

class CreditsService {
    /**
     * Vérifie si l'utilisateur a des crédits disponibles
     * 
     * @param {Object} supabase - Client Supabase
     * @param {string} userId - ID de l'utilisateur
     * @returns {Promise<boolean>} True si crédits disponibles
     */
    static async check(supabase, userId) {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('credits_balance')
                .eq('id', userId)
                .single()
            
            if (!profile) {
                console.error(`⚠️ Profile not found: ${userId}`)
                return false
            }
            
            const hasCredits = profile.credits_balance > 0
            
            if (!hasCredits) {
                console.warn(`💰 Insufficient credits for user ${userId}`)
            }
            
            return hasCredits
        } catch (error) {
            console.error('Credits check failed:', error)
            return false // Fail-safe : considérer comme insuffisant
        }
    }
    
    /**
     * Récupère le solde actuel
     * 
     * @param {Object} supabase - Client Supabase
     * @param {string} userId - ID de l'utilisateur
     * @returns {Promise<number|null>} Solde ou null si erreur
     */
    static async getBalance(supabase, userId) {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('credits_balance, credits_used_this_month')
                .eq('id', userId)
                .single()
            
            if (!profile) return null
            
            return {
                balance: profile.credits_balance,
                usedThisMonth: profile.credits_used_this_month || 0
            }
        } catch (error) {
            console.error('Failed to get balance:', error)
            return null
        }
    }
    
    /**
     * Déduit des crédits de manière ATOMIQUE
     * 
     * ⚠️ IMPORTANT : Utilise une fonction PostgreSQL (RPC) pour garantir
     * qu'il n'y ait pas de race condition lors de déductions simultanées.
     * 
     * @param {Object} supabase - Client Supabase
     * @param {string} userId - ID de l'utilisateur
     * @param {number} amount - Nombre de crédits à déduire
     * @returns {Promise<number>} Nouveau solde
     * @throws {InsufficientCreditsError} Si crédits insuffisants
     */
    static async deduct(supabase, userId, amount) {
        try {
            // ═══════════════════════════════════════════════════════════
            // ⭐ DÉDUCTION ATOMIQUE VIA RPC (Fonction PostgreSQL)
            // ═══════════════════════════════════════════════════════════
            // 
            // Cette fonction SQL fait :
            // 1. Lock la ligne (FOR UPDATE) pour éviter race condition
            // 2. Vérifie que solde >= amount
            // 3. Déduit atomiquement
            // 4. Retourne le nouveau solde
            // 
            // Voir migration SQL : /supabase/migrations/deduct_credits_function.sql
            
            const { data, error } = await supabase.rpc('deduct_credits', {
                p_user_id: userId,
                p_amount: amount
            })
            
            // Gestion des erreurs spécifiques
            if (error) {
                // P0001 = Code d'erreur PostgreSQL pour "Insufficient credits"
                if (error.code === 'P0001') {
                    throw new InsufficientCreditsError(
                        'Crédits insuffisants pour cette opération',
                        { userId, requested: amount }
                    )
                }
                
                throw new AppError('Credit deduction failed', {
                    code: 'CREDIT_DEDUCT_FAILED',
                    cause: error
                })
            }
            
            const newBalance = data[0]?.new_balance || 0
            console.log(`💰 Credits deducted: ${amount} (new balance: ${newBalance})`)
            
            return newBalance
            
        } catch (error) {
            if (error instanceof InsufficientCreditsError || error instanceof AppError) {
                throw error
            }
            
            throw new AppError('Credit deduction failed', {
                code: 'CREDIT_DEDUCT_FAILED',
                cause: error
            })
        }
    }
    
    /**
     * Déduit des crédits (FALLBACK non-atomique)
     * 
     * ⚠️ Cette méthode est un fallback si la fonction RPC n'existe pas encore.
     * Elle n'est PAS atomique et peut causer des race conditions.
     * À utiliser UNIQUEMENT en développement ou migration progressive.
     * 
     * @param {Object} supabase - Client Supabase
     * @param {string} userId - ID de l'utilisateur
     * @param {number} amount - Nombre de crédits à déduire
     * @deprecated Utiliser deduct() qui est atomique
     */
    static async deductFallback(supabase, userId, amount) {
        console.warn('⚠️ Using non-atomic credit deduction (FALLBACK)')
        
        try {
            // 1. Récupérer solde actuel
            const { data: profile } = await supabase
                .from('profiles')
                .select('credits_balance, credits_used_this_month')
                .eq('id', userId)
                .single()
            
            if (!profile) {
                throw new AppError('Profile not found', { code: 'PROFILE_NOT_FOUND' })
            }
            
            // 2. Vérifier suffisance
            if (profile.credits_balance < amount) {
                throw new InsufficientCreditsError('Crédits insuffisants', {
                    userId,
                    balance: profile.credits_balance,
                    requested: amount
                })
            }
            
            // 3. Déduire (NON ATOMIQUE - Race condition possible)
            const { error } = await supabase
                .from('profiles')
                .update({
                    credits_balance: profile.credits_balance - amount,
                    credits_used_this_month: (profile.credits_used_this_month || 0) + amount
                })
                .eq('id', userId)
            
            if (error) throw error
            
            return profile.credits_balance - amount
            
        } catch (error) {
            if (error instanceof InsufficientCreditsError || error instanceof AppError) {
                throw error
            }
            
            throw new AppError('Credit deduction failed', {
                code: 'CREDIT_DEDUCT_FAILED',
                cause: error
            })
        }
    }
    
    /**
     * Calcule le coût d'un message
     * 
     * @param {boolean} isVoiceEnabled - Si synthèse vocale activée
     * @returns {number} Nombre de crédits nécessaires
     */
    static calculateCost(isVoiceEnabled = false) {
        // Coût de base : 1 crédit par message
        const baseCost = 1
        
        // Synthèse vocale : +4 crédits
        const voiceCost = isVoiceEnabled ? 4 : 0
        
        return baseCost + voiceCost
    }
    
    /**
     * Ajoute des crédits (pour paiements)
     * 
     * @param {Object} supabase - Client Supabase
     * @param {string} userId - ID de l'utilisateur
     * @param {number} amount - Nombre de crédits à ajouter
     * @returns {Promise<number>} Nouveau solde
     */
    static async add(supabase, userId, amount) {
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('credits_balance')
                .eq('id', userId)
                .single()
            
            if (!profile) {
                throw new AppError('Profile not found', { code: 'PROFILE_NOT_FOUND' })
            }
            
            const newBalance = profile.credits_balance + amount
            
            const { error } = await supabase
                .from('profiles')
                .update({ credits_balance: newBalance })
                .eq('id', userId)
            
            if (error) throw error
            
            console.log(`💰 Credits added: ${amount} (new balance: ${newBalance})`)
            return newBalance
            
        } catch (error) {
            if (error instanceof AppError) throw error
            
            throw new AppError('Credit addition failed', {
                code: 'CREDIT_ADD_FAILED',
                cause: error
            })
        }
    }
}

module.exports = { CreditsService, InsufficientCreditsError }
