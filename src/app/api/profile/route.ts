import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
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
                    updates['phone_verified'] = false // reset à chaque changement de numéro
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

        return successResponse({ profile })
    } catch {
        return errorResponse('Données invalides', 400)
    }
}

