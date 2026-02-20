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

    if (profile?.role !== 'admin') {
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
                .update({ credits: 0 })
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
                .update({ credits: Number(credits) })
                .eq('id', id)
            if (error) throw error
            await logAdminAction(user.id, 'set_credits', id, 'profile', { credits })
            return successResponse({ message: `Crédits mis à ${credits}` })
        }

        if (action === 'change_role') {
            const { role } = updateData
            if (!['user', 'admin'].includes(role)) return errorResponse('Rôle invalide', 400)
            const { error } = await adminSupabase
                .from('profiles')
                .update({ role })
                .eq('id', id)
            if (error) throw error
            await logAdminAction(user.id, 'change_role', id, 'profile', { role })
            return successResponse({ message: `Rôle changé en ${role}` })
        }

        // Generic profile update
        const allowedFields = ['full_name', 'phone', 'subscription_plan', 'is_active']
        const cleanUpdate: Record<string, any> = {}
        for (const key of allowedFields) {
            if (updateData[key] !== undefined) {
                cleanUpdate[key] = updateData[key]
            }
        }

        if (Object.keys(cleanUpdate).length === 0) {
            return errorResponse('Aucun champ à mettre à jour', 400)
        }

        const { error } = await adminSupabase
            .from('profiles')
            .update(cleanUpdate)
            .eq('id', id)

        if (error) throw error

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

    if (profile?.role !== 'admin') {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const { id } = await params

        // Don't allow deleting yourself
        if (id === user.id) {
            return errorResponse('Impossible de supprimer votre propre compte', 400)
        }

        // Soft delete — just deactivate
        const { error } = await adminSupabase
            .from('profiles')
            .update({ is_active: false, role: 'user' })
            .eq('id', id)

        if (error) throw error

        await logAdminAction(user.id, 'delete_user', id, 'profile')

        return successResponse({ message: 'Utilisateur supprimé' })
    } catch (err) {
        console.error('Delete user error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
