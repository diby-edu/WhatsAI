import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

// GET - Get feature flags
export async function GET(request: NextRequest) {
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const { data: features, error } = await adminSupabase
            .from('feature_flags')
            .select('*')
            .order('key')

        if (error) {
            // If table doesn't exist, return defaults
            if (error.code === '42P01') {
                return successResponse({
                    features: [
                        { key: 'voice_responses', enabled: true },
                        { key: 'vision_enabled', enabled: true },
                        { key: 'ai_tools_booking', enabled: true },
                        { key: 'ai_tools_orders', enabled: true },
                        { key: 'maintenance_mode', enabled: false },
                        { key: 'registrations_open', enabled: true },
                        { key: 'payments_enabled', enabled: true }
                    ],
                    message: 'Using defaults - table not created'
                })
            }
            throw error
        }

        return successResponse({ features })
    } catch (err) {
        console.error('Admin features error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// POST - Save feature flags
export async function POST(request: NextRequest) {
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const body = await request.json()
        const { features } = body

        if (!features || !Array.isArray(features)) {
            return errorResponse('Features array is required', 400)
        }

        // Upsert each feature
        for (const feature of features) {
            const { error } = await adminSupabase
                .from('feature_flags')
                .upsert({
                    key: feature.key,
                    enabled: feature.enabled,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' })

            if (error && error.code !== '42P01') {
                console.error('Error saving feature:', feature.key, error)
            }
        }

        return successResponse({ message: 'Features saved successfully' })
    } catch (err) {
        console.error('Error saving features:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
