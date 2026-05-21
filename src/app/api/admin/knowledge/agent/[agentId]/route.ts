import { NextRequest } from 'next/server'
import { withAdminAuth, createAdminClient, successResponse, errorResponse } from '@/lib/api-utils'
import { generateEmbedding } from '@/lib/ai/openai'

type RouteCtx = { params: Promise<{ agentId: string }> }

function chunkText(text: string, maxChars = 800): string[] {
    const trimmed = text.trim()
    if (!trimmed) return []

    const sections = trimmed.split(/\n\s*---\s*\n/)
    const chunks: string[] = []

    for (const section of sections) {
        const value = section.trim()
        if (!value) continue
        if (value.length <= maxChars) { chunks.push(value); continue }

        const paragraphs = value.split(/\n{2,}/)
        let current = ''
        for (const paragraph of paragraphs) {
            if ((current + '\n\n' + paragraph).length > maxChars && current.length > 0) {
                chunks.push(current.trim())
                current = paragraph
            } else {
                current = current ? `${current}\n\n${paragraph}` : paragraph
            }
        }
        if (current.trim()) chunks.push(current.trim())
    }

    const useful = chunks.filter(c => c.trim().length >= 30)
    return useful.length > 0 ? useful : [trimmed.slice(0, maxChars)]
}

// GET /api/admin/knowledge/agent/[agentId] — Liste les documents d'un agent
export const GET = withAdminAuth(async (_request: NextRequest, _ctx, routeCtx) => {
    const { agentId } = await (routeCtx as RouteCtx).params
    const admin = createAdminClient()

    // Vérifier que l'agent existe
    const { data: agent } = await admin
        .from('agents')
        .select('id, name, user_id')
        .eq('id', agentId)
        .single()

    if (!agent) return errorResponse('Agent introuvable', 404)

    // Documents (chunk_index = 0 = un doc = une entrée)
    const { data, error } = await admin
        .from('knowledge_base')
        .select('id, title, created_at, source_id, chunk_index, image_url, image_label, extra_image_urls, user_id')
        .eq('agent_id', agentId)
        .eq('chunk_index', 0)
        .order('created_at', { ascending: false })

    if (error) return errorResponse('Erreur chargement documents', 500)

    // Compter les chunks par source
    const sourceIds = (data || []).map(d => d.source_id || d.id)
    let countBySource: Record<string, number> = {}

    if (sourceIds.length > 0) {
        const { data: chunkCounts } = await admin
            .from('knowledge_base')
            .select('source_id')
            .in('source_id', sourceIds)
            .eq('agent_id', agentId)

        for (const row of chunkCounts || []) {
            if (row.source_id) {
                countBySource[row.source_id] = (countBySource[row.source_id] || 0) + 1
            }
        }
    }

    const documents = (data || []).map(doc => ({
        ...doc,
        chunks_count: countBySource[doc.source_id || doc.id] || 1
    }))

    return successResponse({ agent, documents })
})

// POST /api/admin/knowledge/agent/[agentId] — Ajouter un document à l'agent
export const POST = withAdminAuth(async (request: NextRequest, _ctx, routeCtx) => {
    const { agentId } = await (routeCtx as RouteCtx).params
    const admin = createAdminClient()

    // Vérifier que l'agent existe et récupérer son user_id
    const { data: agent } = await admin
        .from('agents')
        .select('id, user_id')
        .eq('id', agentId)
        .single()

    if (!agent) return errorResponse('Agent introuvable', 404)

    const body = await request.json()
    const { title, content, image_url, extra_image_urls } = body

    if (!title || !content) return errorResponse('Titre et contenu requis', 400)

    const isWebp = (url: string) => url?.toLowerCase().includes('.webp')
    if (image_url && isWebp(image_url)) {
        return errorResponse('Format WebP non supporté. Utilisez JPG ou PNG.', 400)
    }

    const sourceId = crypto.randomUUID()
    const chunks = chunkText(content)

    const insertRows = await Promise.all(
        chunks.map(async (chunkContent, index) => {
            const embedding = await generateEmbedding(chunkContent)
            return {
                user_id: agent.user_id,
                agent_id: agentId,
                title,
                content: chunkContent,
                content_type: 'text' as const,
                source_id: sourceId,
                chunk_index: index,
                embedding,
                ...(index === 0 && image_url?.trim() ? { image_url: image_url.trim() } : {}),
                ...(index === 0 && Array.isArray(extra_image_urls) && extra_image_urls.length > 0
                    ? { extra_image_urls } : {})
            }
        })
    )

    const { data, error } = await admin
        .from('knowledge_base')
        .insert(insertRows)
        .select('id, title, source_id, chunk_index, created_at')

    if (error) return errorResponse('Erreur ajout document', 500)

    const firstChunk = (data || []).find(d => d.chunk_index === 0) || data?.[0]
    return successResponse({ document: firstChunk, chunks_count: chunks.length }, 201)
})
