import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse, logAdminAction } from '@/lib/api-utils'

// PATCH /api/admin/users/[id] — Update user profile, plan, status, credits
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const { id } = await params
        const body = await request.json()
        const { action, ...updateData } = body

        // Handle specific actions
        if (action === 'ban') {
            const { error } = await adminSupabase
                .from('profiles')
                .update({ is_active: false })
                .eq('id', id)
            if (error) throw error
            await logAdminAction(user.id, 'ban_user', id, 'profile')
            return successResponse({ message: 'Utilisateur suspendu' })
        }

        if (action === 'unban') {
            const { error } = await adminSupabase
                .from('profiles')
                .update({ is_active: true })
                .eq('id', id)
            if (error) throw error
            await logAdminAction(user.id, 'unban_user', id, 'profile')
            return successResponse({ message: 'Utilisateur réactivé' })
        }

        if (action === 'reset_credits') {
            const { error } = await adminSupabase
                .from('profiles')
                .update({ credits_balance: 0 })
                .eq('id', id)
            if (error) throw error
            await logAdminAction(user.id, 'reset_credits', id, 'profile')
            return successResponse({ message: 'Crédits réinitialisés' })
        }

        if (action === 'set_credits') {
            const { credits } = updateData
            if (credits === undefined) return errorResponse('Credits requis', 400)
            const { error } = await adminSupabase
                .from('profiles')
                .update({ credits_balance: Number(credits) })
                .eq('id', id)
            if (error) throw error
            await logAdminAction(user.id, 'set_credits', id, 'profile', { credits })
            return successResponse({ message: `Crédits définis à ${credits}` })
        }

        if (action === 'add_credits') {
            const { amount } = updateData
            if (!amount || Number(amount) <= 0) return errorResponse('Montant invalide', 400)
            const { data: current } = await adminSupabase
                .from('profiles').select('credits_balance').eq('id', id).single()
            const newBalance = (current?.credits_balance || 0) + Number(amount)
            const { error } = await adminSupabase
                .from('profiles')
                .update({ credits_balance: newBalance })
                .eq('id', id)
            if (error) throw error
            // Créer un enregistrement de paiement pour que ça apparaisse dans l'historique
            await adminSupabase.from('payments').insert({
                user_id: id,
                amount_fcfa: 0,
                status: 'completed',
                payment_provider: 'admin',
                payment_type: 'credits',
                payment_method_source: 'manual',
                description: `Crédits ajoutés manuellement (+${amount})`,
                credits_purchased: Number(amount),
                completed_at: new Date().toISOString()
            })
            await logAdminAction(user.id, 'add_credits', id, 'profile', { amount, newBalance })
            return successResponse({ message: `+${amount} crédits ajoutés (nouveau solde : ${newBalance})` })
        }

        if (action === 'subtract_credits') {
            const { amount } = updateData
            if (!amount || Number(amount) <= 0) return errorResponse('Montant invalide', 400)
            const { data: current } = await adminSupabase
                .from('profiles').select('credits_balance').eq('id', id).single()
            const newBalance = Math.max(0, (current?.credits_balance || 0) - Number(amount))
            const { error } = await adminSupabase
                .from('profiles')
                .update({ credits_balance: newBalance })
                .eq('id', id)
            if (error) throw error
            await logAdminAction(user.id, 'subtract_credits', id, 'profile', { amount, newBalance })
            return successResponse({ message: `-${amount} crédits retirés (nouveau solde : ${newBalance})` })
        }

        if (action === 'change_role') {
            const { role } = updateData
            if (!['user', 'admin', 'superadmin'].includes(role)) return errorResponse('Rôle invalide', 400)
            const { error } = await adminSupabase
                .from('profiles')
                .update({ role })
                .eq('id', id)
            if (error) throw error
            await logAdminAction(user.id, 'change_role', id, 'profile', { role })
            return successResponse({ message: `Rôle changé en ${role}` })
        }

        // Generic profile update
        const allowedFields = ['full_name', 'phone', 'plan', 'is_active']
        const cleanUpdate: Record<string, any> = {}
        for (const key of allowedFields) {
            if (updateData[key] !== undefined) {
                cleanUpdate[key] = updateData[key]
            }
        }
        // Handle legacy subscription_plan field (map to plan)
        if (updateData.subscription_plan !== undefined && !cleanUpdate.plan) {
            cleanUpdate.plan = updateData.subscription_plan.toLowerCase()
        }

        if (Object.keys(cleanUpdate).length === 0) {
            return errorResponse('Aucun champ à mettre à jour', 400)
        }

        const { error } = await adminSupabase
            .from('profiles')
            .update(cleanUpdate)
            .eq('id', id)

        if (error) throw error

        // If plan changed, add the new plan's credits to the user's balance
        if (cleanUpdate.plan) {
            try {
                const { data: planData } = await adminSupabase
                    .from('subscription_plans')
                    .select('credits_included')
                    .eq('id', cleanUpdate.plan)
                    .single()

                if (planData && planData.credits_included > 0) {
                    const { data: currentProfile } = await adminSupabase
                        .from('profiles').select('credits_balance').eq('id', id).single()
                    const newBalance = (currentProfile?.credits_balance || 0) + planData.credits_included
                    await adminSupabase.from('profiles')
                        .update({ credits_balance: newBalance })
                        .eq('id', id)
                }
            } catch { /* non-bloquant */ }
        }

        await logAdminAction(user.id, 'update_user_profile', id, 'profile', cleanUpdate)

        return successResponse({ message: 'Profil mis à jour' })
    } catch (err) {
        console.error('Update user error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// DELETE /api/admin/users/[id] — Delete user
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const { id } = await params

        // Don't allow deleting yourself
        if (id === user.id) {
            return errorResponse('Impossible de supprimer votre propre compte', 400)
        }

        const { data: targetProfile, error: targetError } = await adminSupabase
            .from('profiles')
            .select('id, email, role')
            .eq('id', id)
            .single()

        if (targetError || !targetProfile) {
            return errorResponse('Utilisateur introuvable', 404)
        }

        const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(id)

        if (deleteAuthError) {
            throw deleteAuthError
        }

        await logAdminAction(user.id, 'delete_user', id, 'profile', {
            email: targetProfile.email || null,
            deleted_via: 'auth.admin.deleteUser',
        })

        return successResponse({
            message: 'Utilisateur et donnees liees supprimes',
            deleted_user_id: id,
        })
    } catch (err) {
        console.error('Delete user error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
