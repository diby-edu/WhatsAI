import { successResponse } from '@/lib/api-utils'
import OpenAI from 'openai'

export async function GET() {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return successResponse({ success: false, error: 'OPENAI_API_KEY non configurée' })
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        // Simple test call
        const response = await openai.models.list()

        return successResponse({
            success: true,
            models: response.data?.length || 0
        })
    } catch (err: any) {
        return successResponse({
            success: false,
            error: err.message || 'Erreur de connexion à OpenAI'
        })
    }
}
