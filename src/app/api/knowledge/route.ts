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
    // Tentative avec extra_image_urls (disponible après migration), fallback sans si colonne absente
    let data: any[] | null = null
    let fetchError: any = null

    const { data: dataFull, error: errorFull } = await supabase
        .from('knowledge_base')
        .select('id, title, created_at, source_id, chunk_index, image_url, image_label, extra_image_urls')
        .eq('agent_id', agentId)
        .eq('user_id', user.id)
        .eq('chunk_index', 0)
        .order('created_at', { ascending: false })

    if (errorFull) {
        // Fallback : colonne extra_image_urls peut-être absente (migration non appliquée)
        const { data: dataBasic, error: errorBasic } = await supabase
            .from('knowledge_base')
            .select('id, title, created_at, source_id, chunk_index, image_url')
            .eq('agent_id', agentId)
            .eq('user_id', user.id)
            .eq('chunk_index', 0)
            .order('created_at', { ascending: false })
        data = dataBasic
        fetchError = errorBasic
    } else {
        data = dataFull
    }

    if (fetchError) {
        console.error('Error fetching knowledge:', fetchError)
        return errorResponse(fetchError.message, 500)
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
function chunkText(text: string, maxChars = 800): string[] {
    const trimmed = text.trim()

    // Découper d'abord sur les séparateurs FAQ (---)
    // Chaque bloc Q/R devient un segment indépendant
    const sections = trimmed.split(/\n\s*---\s*\n/)

    const result: string[] = []

    for (const section of sections) {
        const s = section.trim()
        if (!s) continue

        if (s.length <= maxChars) {
            result.push(s)
            continue
        }

        // Section trop grande → découper sur paragraphes
        const paragraphs = s.split(/\n{2,}/)
        let current = ''

        for (const para of paragraphs) {
            if ((current + '\n\n' + para).length > maxChars && current.length > 0) {
                result.push(current.trim())
                current = para
            } else {
                current = current ? current + '\n\n' + para : para
            }
        }
        if (current.trim()) result.push(current.trim())
    }

    // Filtrer les segments bruit (marqueurs de page, contenu vide, < 30 chars)
    return result.filter(c => c.trim().length >= 30)
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
        const { agentId, title, content, image_url, extra_image_urls } = body

        if (!agentId || !title || !content) {
            return errorResponse('Missing required fields', 400)
        }

        // Refuser les images WebP (non supportées par Baileys)
        const isWebp = (url: string) => url?.toLowerCase().includes('.webp')
        if (image_url && isWebp(image_url)) {
            return errorResponse('Format WebP non supporté. Utilisez JPG ou PNG.', 400)
        }
        const extractUrl = (item: string | { url: string }) => typeof item === 'string' ? item : item?.url
        if (Array.isArray(extra_image_urls) && extra_image_urls.some(item => isWebp(extractUrl(item)))) {
            return errorResponse('Format WebP non supporté pour une ou plusieurs images. Utilisez JPG ou PNG.', 400)
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
                    embedding,
                    // image_url et extra_image_urls uniquement sur le premier chunk
                    ...(index === 0 && image_url?.trim() ? { image_url: image_url.trim() } : {}),
                    ...(index === 0 && Array.isArray(extra_image_urls) && extra_image_urls.length > 0 ? { extra_image_urls } : {})
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
