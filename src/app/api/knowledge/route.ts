import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { generateEmbedding } from '@/lib/ai/openai'

// GET /api/knowledge - List knowledge base for an agent
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
        return errorResponse('agentId required', 400)
    }

    const { data, error } = await supabase
        .from('knowledge_base')
        .select('id, title, created_at')
        .eq('agent_id', agentId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching knowledge:', error)
        return errorResponse(error.message, 500)
    }

    return successResponse({ documents: data })
}

// POST /api/knowledge - Add new document
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        const body = await request.json()
        const { agentId, title, content } = body

        if (!agentId || !title || !content) {
            return errorResponse('Missing required fields', 400)
        }

        // Generate embedding
        const embedding = await generateEmbedding(content)

        // Store in DB
        const { data, error } = await supabase
            .from('knowledge_base')
            .insert({
                user_id: user.id,
                agent_id: agentId,
                title,
                content,
                content_type: 'text',
                embedding // Vector column
            })
            .select()
            .single()

        if (error) throw error

        return successResponse({ document: data }, 201)
    } catch (error) {
        console.error('Error adding knowledge:', error)
        return errorResponse('Error processing document', 500)
    }
}
