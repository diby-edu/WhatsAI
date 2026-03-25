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

    // Retourner uniquement le chunk 0 de chaque source (un enregistrement par document source)
    const { data, error } = await supabase
        .from('knowledge_base')
        .select('id, title, created_at, source_id, chunk_index')
        .eq('agent_id', agentId)
        .eq('user_id', user.id)
        .eq('chunk_index', 0)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching knowledge:', error)
        return errorResponse(error.message, 500)
    }

    if (!data || data.length === 0) {
        return successResponse({ documents: [] })
    }

    // Compter les chunks par source pour afficher dans l'UI
    const sourceIds = data.map(d => d.source_id || d.id)
    const { data: chunkCounts } = await supabase
        .from('knowledge_base')
        .select('source_id')
        .in('source_id', sourceIds)
        .eq('agent_id', agentId)

    const countBySource: Record<string, number> = {}
    for (const row of (chunkCounts || [])) {
        if (row.source_id) {
            countBySource[row.source_id] = (countBySource[row.source_id] || 0) + 1
        }
    }

    const documents = data.map(doc => ({
        ...doc,
        chunks_count: countBySource[doc.source_id || doc.id] || 1
    }))

    return successResponse({ documents })
}

// Découpe un texte en chunks de ~500 tokens (approx. 2000 caractères)
// Coupe sur les sauts de paragraphe, sinon sur les phrases
function chunkText(text: string, maxChars = 2000): string[] {
    const trimmed = text.trim()
    if (trimmed.length <= maxChars) return [trimmed]

    const chunks: string[] = []
    const paragraphs = trimmed.split(/\n{2,}/)
    let current = ''

    for (const para of paragraphs) {
        if ((current + '\n\n' + para).length > maxChars && current.length > 0) {
            chunks.push(current.trim())
            current = para
        } else {
            current = current ? current + '\n\n' + para : para
        }
    }
    if (current.trim()) chunks.push(current.trim())

    // Si un paragraphe dépasse maxChars, découper sur les phrases
    const result: string[] = []
    for (const chunk of chunks) {
        if (chunk.length <= maxChars) {
            result.push(chunk)
        } else {
            const sentences = chunk.split(/(?<=[.!?])\s+/)
            let sub = ''
            for (const sentence of sentences) {
                if ((sub + ' ' + sentence).length > maxChars && sub.length > 0) {
                    result.push(sub.trim())
                    sub = sentence
                } else {
                    sub = sub ? sub + ' ' + sentence : sentence
                }
            }
            if (sub.trim()) result.push(sub.trim())
        }
    }

    return result.filter(c => c.length > 0)
}

// POST /api/knowledge - Add new document (with chunking)
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

        // Vérifier que l'agent appartient bien à l'utilisateur connecté
        const { data: agentCheck } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agentId)
            .eq('user_id', user.id)
            .single()

        if (!agentCheck) {
            return errorResponse('Agent not found or unauthorized', 403)
        }

        // Générer un source_id unique partagé par tous les chunks
        const sourceId = crypto.randomUUID()

        // Découper en chunks
        const chunks = chunkText(content)

        // Générer les embeddings et insérer en parallèle
        const insertRows = await Promise.all(
            chunks.map(async (chunkContent, index) => {
                const embedding = await generateEmbedding(chunkContent)
                return {
                    user_id: user.id,
                    agent_id: agentId,
                    title,
                    content: chunkContent,
                    content_type: 'text' as const,
                    source_id: sourceId,
                    chunk_index: index,
                    embedding
                }
            })
        )

        const { data, error } = await supabase
            .from('knowledge_base')
            .insert(insertRows)
            .select('id, title, source_id, chunk_index, created_at')

        if (error) throw error

        // Retourner le premier chunk (chunk_index = 0) comme représentant du document source
        const firstChunk = (data || []).find(d => d.chunk_index === 0) || data?.[0]

        return successResponse({
            document: firstChunk,
            chunks_count: chunks.length
        }, 201)
    } catch (error) {
        console.error('Error adding knowledge:', error)
        return errorResponse('Error processing document', 500)
    }
}
