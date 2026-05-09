import { getAdminSupabase } from '@/lib/supabase/admin'

const REFERRAL_BONUS_CREDITS = 10

/**
 * Crée un enregistrement referral en statut 'pending' lors de l'inscription.
 * Le bonus ne sera crédité qu'après le premier paiement validé.
 */
export async function createPendingReferral(referredUserId: string, refCode: string): Promise<void> {
    const supabase = getAdminSupabase()

    // Trouver le parrain via son code
    const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', refCode.toUpperCase().trim())
        .single()

    if (!referrer) return // Code invalide — silencieux

    // Anti auto-parrainage
    if (referrer.id === referredUserId) return

    // Vérifier que l'utilisateur n'a pas déjà un parrain
    const { data: existing } = await supabase
        .from('referrals')
        .select('id')
        .eq('referred_id', referredUserId)
        .single()

    if (existing) return // Déjà parrainé

    // Enregistrer le parrain dans le profil
    await supabase
        .from('profiles')
        .update({ referred_by: referrer.id })
        .eq('id', referredUserId)

    // Créer le referral en attente
    await supabase.from('referrals').insert({
        referrer_id: referrer.id,
        referred_id: referredUserId,
        status: 'pending',
        bonus_given: false,
    })
}

/**
 * Déclenché après chaque paiement validé.
 * Si l'utilisateur a un referral pending non encore crédité → créditer les deux parties.
 */
export async function applyReferralBonus(userId: string): Promise<void> {
    const supabase = getAdminSupabase()

    const { data: referral } = await supabase
        .from('referrals')
        .select('id, referrer_id')
        .eq('referred_id', userId)
        .eq('status', 'pending')
        .eq('bonus_given', false)
        .single()

    if (!referral) return // Pas de referral pending

    // Créditer les deux parties
    await supabase.rpc('add_credits', { p_user_id: userId, p_amount: REFERRAL_BONUS_CREDITS })
    await supabase.rpc('add_credits', { p_user_id: referral.referrer_id, p_amount: REFERRAL_BONUS_CREDITS })

    // Marquer comme confirmé
    await supabase
        .from('referrals')
        .update({ status: 'confirmed', bonus_given: true })
        .eq('id', referral.id)

    console.log(`[REFERRAL] Bonus appliqué : referred=${userId} referrer=${referral.referrer_id} (+${REFERRAL_BONUS_CREDITS} crédits chacun)`)
}
