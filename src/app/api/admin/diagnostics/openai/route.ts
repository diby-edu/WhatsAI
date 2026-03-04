import { createApiClient, getAuthUser } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET() {
    const supabaseSecClient = await createApiClient()
    const { user: secUser, error: secAuthError } = await getAuthUser(supabaseSecClient)
    if (secAuthError || secUser?.role !== 'admin') {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    try {
        const apiKey = process.env.OPENAI_API_KEY

        if (!apiKey) {
            return NextResponse.json({
                success: false,
                error: 'OPENAI_API_KEY non configurée'
            })
        }

        if (apiKey.length < 20) {
            return NextResponse.json({
                success: false,
                error: 'Clé API invalide (trop courte)'
            })
        }

        const openai = new OpenAI({ apiKey })

        // Quick test - list models (minimal API call)
        const response = await openai.models.list()

        return NextResponse.json({
            success: true,
            models: response.data?.length || 0,
            message: 'Clé API valide'
        })
    } catch (err: any) {
        // Parse OpenAI error messages
        let errorMessage = 'Erreur de connexion à OpenAI'

        if (err.message?.includes('401')) {
            errorMessage = 'Clé API invalide ou expirée'
        } else if (err.message?.includes('429')) {
            errorMessage = 'Quota API dépassé'
        } else if (err.message?.includes('500')) {
            errorMessage = 'Erreur serveur OpenAI'
        } else if (err.message) {
            errorMessage = err.message
        }

        return NextResponse.json({
            success: false,
            error: errorMessage
        })
    }
}
