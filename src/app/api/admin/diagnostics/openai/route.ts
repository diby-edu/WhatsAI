import OpenAI from 'openai'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export async function GET() {
    const { response } = await requireAdminAccess()
    if (response) return response

    try {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return errorResponse('OPENAI_API_KEY non configuree', 500)
        }

        const openai = new OpenAI({ apiKey })
        const responseModels = await openai.models.list()

        return successResponse({
            success: true,
            models: responseModels.data?.length || 0,
            message: 'Cle API valide',
        })
    } catch (err: any) {
        let errorMessage = 'Erreur de connexion a OpenAI'
        if (err.message?.includes('401')) errorMessage = 'Cle API invalide ou expiree'
        else if (err.message?.includes('429')) errorMessage = 'Quota API depasse'
        else if (err.message?.includes('500')) errorMessage = 'Erreur serveur OpenAI'
        else if (err.message) errorMessage = err.message
        return errorResponse(errorMessage, 500)
    }
}
