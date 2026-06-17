import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Accès refusé', 403)
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const search = searchParams.get('search') || ''
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = adminSupabase
        .from('leads')
        .select(`
            id, agent_id, user_id, customer_phone,
            lead_name, lead_phone, lead_email, interest,
            lead_location, lead_company, created_at,
            agents(name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (search) {
        query = query.or(
            `lead_name.ilike.%${search}%,lead_email.ilike.%${search}%,lead_phone.ilike.%${search}%,interest.ilike.%${search}%,lead_company.ilike.%${search}%`
        )
    }

    const { data, count, error } = await query

    if (error) return errorResponse(error.message, 500)

    // Récupérer les emails via profiles (FK sur id, pas sur auth.users)
    const userIds = [...new Set((data || []).map((l: any) => l.user_id).filter(Boolean))]
    let emailMap: Record<string, string> = {}
    if (userIds.length > 0) {
        const { data: profilesData } = await adminSupabase
            .from('profiles')
            .select('id, email')
            .in('id', userIds)
        for (const p of profilesData || []) {
            emailMap[p.id] = p.email
        }
    }

    const leads = (data || []).map((l: any) => ({
        ...l,
        agent_name: l.agents?.name || null,
        owner_email: emailMap[l.user_id] || null,
    }))

    return successResponse({ leads, total: count || 0, page, page_size: PAGE_SIZE })
}
