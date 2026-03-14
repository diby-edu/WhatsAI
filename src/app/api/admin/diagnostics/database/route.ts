import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export async function GET() {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const start = Date.now()
        const { error } = await adminSupabase.from('profiles').select('id').limit(1)
        const latency = Date.now() - start

        if (error) {
            return errorResponse(error.message, 500)
        }

        return successResponse({
            latency,
            message: 'Connexion etablie',
        })
    } catch (err: any) {
        return errorResponse(err.message || 'Connexion echouee', 500)
    }
}
