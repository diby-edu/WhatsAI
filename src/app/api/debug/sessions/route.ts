import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser, isAdminRole } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    try {
        const supabase = await createApiClient()
        const { user, error: authError } = await getAuthUser(supabase)

        if (authError || !user) {
            return NextResponse.json({
                success: false,
                error: 'Unauthorized',
            }, { status: 401 })
        }

        const adminSupabase = createAdminClient()
        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!isAdminRole(profile?.role)) {
            return NextResponse.json({
                success: false,
                error: 'Forbidden',
            }, { status: 403 })
        }

        // Audit F-07 : en production, la table `whatsapp_sessions` est le magasin
        // de credentials Baileys (session_id, key_id, data) — elle ne contient PAS
        // le statut des sessions. L'ancienne requête (agent_id, status, ...) plantait
        // donc en 500. Le vrai statut WhatsApp vit sur la table `agents`.
        const { data: agents, error } = await adminSupabase
            .from('agents')
            .select('id, name, whatsapp_phone, whatsapp_status, whatsapp_connected, whatsapp_ever_connected, updated_at')
            .order('updated_at', { ascending: false })

        if (error) {
            throw error
        }

        const rows = agents || []

        return NextResponse.json({
            success: true,
            active_sessions_count: rows.filter((a) => a.whatsapp_connected === true).length,
            active_sessions_ids: rows.filter((a) => a.whatsapp_connected === true).map((a) => a.id),
            details: rows.map((a) => ({
                id: a.id,
                name: a.name,
                has_socket: a.whatsapp_connected === true,
                phoneNumber: a.whatsapp_phone,
                status: a.whatsapp_status,
                connected: a.whatsapp_connected === true,
                everConnected: a.whatsapp_ever_connected === true,
                updatedAt: a.updated_at,
            })),
        })
    } catch (error: any) {
        // Audit F-07 : ne pas renvoyer le message d'erreur brut (fuite de schéma DB,
        // ex. "column whatsapp_sessions.agent_id does not exist"). Détail loggué côté
        // serveur uniquement. NB : ce 500 signale aussi une divergence schéma prod/
        // migrations à réaligner (la colonne agent_id existe dans les migrations).
        console.error('[debug/sessions] error:', error?.message || error)
        return NextResponse.json({
            success: false,
            error: 'Erreur serveur',
        }, { status: 500 })
    }
}
