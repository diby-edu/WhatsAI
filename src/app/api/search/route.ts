import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const type = searchParams.get('type') // conversations, products, orders, all
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query || query.length < 2) {
        return errorResponse('Query too short', 400)
    }

    try {
        // Use global_search RPC function
        const { data, error } = await supabase.rpc('global_search', {
            search_query: query,
            user_id_param: user!.id,
            limit_param: limit
        })

        if (error) {
            console.error('Search error:', error)
            return errorResponse(error.message, 500)
        }

        // Filter by type if requested
        const results = type && type !== 'all'
            ? (data || []).filter((r: any) => r.result_type === type)
            : data || []

        return successResponse({
            results,
            query,
            total: results.length
        })
    } catch (err) {
        console.error('Search exception:', err)
        return errorResponse('Erreur de recherche', 500)
    }
}
