import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET /api/profile - Get current user profile
export async function GET(request: NextRequest) {
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
        const allowedFields = ['full_name', 'phone', 'company', 'timezone', 'language', 'avatar_url']

        const updates: Record<string, any> = {}
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field]
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
    } catch (err) {
        return errorResponse('Données invalides', 400)
    }
}
