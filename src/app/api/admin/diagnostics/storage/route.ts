import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export async function GET() {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const { data: buckets, error } = await adminSupabase.storage.listBuckets()
        if (error) {
            return errorResponse(error.message, 500)
        }

        return successResponse({
            buckets: buckets?.length || 0,
            bucketNames: buckets?.map((bucket) => bucket.name) || [],
        })
    } catch (err: any) {
        return errorResponse(err.message || 'Erreur de connexion au storage', 500)
    }
}
