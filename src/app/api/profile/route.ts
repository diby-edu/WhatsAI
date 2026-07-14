import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { normalizeStoredPhone } from '@/lib/profile-phone'

// GET /api/profile - Get current user profile
export async function GET() {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single()

    if (error) {
        return errorResponse('Profil non trouvé', 404)
    }

    return successResponse({ profile })
}

// PATCH /api/profile - Update current user profile
export async function PATCH(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    try {
        const body = await request.json()

        // Only allow specific fields to be updated
        const allowedFields = ['full_name', 'phone', 'company', 'timezone', 'language', 'avatar_url', 'currency', 'app_banner_dismissed']

        const updates: Record<string, unknown> = {}
        let phoneChanged = false
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                if (field === 'phone') {
                    if (typeof body.phone !== 'string' || body.phone.trim().length === 0) {
                        return errorResponse('Le numero de telephone est obligatoire.', 400)
                    }

                    const normalizedPhone = normalizeStoredPhone(body.phone)
                    if (!normalizedPhone) {
                        return errorResponse('Le numero de telephone doit etre au format international valide.', 400)
                    }

                    updates[field] = normalizedPhone
                    phoneChanged = true
                } else {
                    updates[field] = body[field]
                }
            }
        }

        const { data: profile, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user!.id)
            .select()
            .single()

        if (error) {
            return errorResponse('Mise à jour échouée', 500)
        }

        // LM-7 : phone_verified est protégé par un trigger service_role-only —
        // le reset au changement de numéro doit passer par le client admin,
        // sinon le trigger l'ignore silencieusement et l'ancien numéro reste
        // considéré comme vérifié.
        if (phoneChanged) {
            const adminSupabase = createAdminClient()
            const { error: resetError } = await adminSupabase
                .from('profiles')
                .update({ phone_verified: false })
                .eq('id', user!.id)

            if (resetError) {
                console.error('[profile] Failed to reset phone_verified after phone change:', resetError)
            } else {
                profile.phone_verified = false
            }
        }

        return successResponse({ profile })
    } catch {
        return errorResponse('Données invalides', 400)
    }
}

