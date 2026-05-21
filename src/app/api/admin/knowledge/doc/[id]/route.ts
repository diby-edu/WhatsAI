import { NextRequest } from 'next/server'
import { withAdminAuth, createAdminClient, successResponse, errorResponse } from '@/lib/api-utils'
import { generateEmbedding } from '@/lib/ai/openai'

type RouteCtx = { params: Promise<{ id: string }> }

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

// GET /api/admin/knowledge/doc/[id] — Récupérer tous les chunks d'un document (source_id)
export const GET = withAdminAuth(async (_request: NextRequest, _ctx, routeCtx) => {
    const { id } = await (routeCtx as RouteCtx).params
    const admin = createAdminClient()

    const { data, error } = await admin
        .from('knowledge_base')
        .select('id, chunk_index, content, title, image_url, image_label, extra_image_urls')
        .eq('source_id', id)
        .order('chunk_index', { ascending: true })

    if (error) return errorResponse('Erreur chargement segments', 500)

    return successResponse({ segments: data || [] })
})

// PATCH /api/admin/knowledge/doc/[id] — Modifier titre, contenu, images ou affecter à un autre agent
export const PATCH = withAdminAuth(async (request: NextRequest, _ctx, routeCtx) => {
    const { id } = await (routeCtx as RouteCtx).params
    const admin = createAdminClient()

    const body = await request.json()
    const { title, content, image_url, image_label, extra_image_urls, target_agent_id } = body

    // Récupérer tous les chunks existants
    const { data: existingRows, error: existingError } = await admin
        .from('knowledge_base')
        .select('id, source_id, user_id, agent_id, content_type, title, image_url, extra_image_urls, chunk_index')
        .eq('source_id', id)
        .order('chunk_index', { ascending: true })

    if (existingError) return errorResponse('Erreur lecture document', 500)
    if (!existingRows || existingRows.length === 0) return errorResponse('Document introuvable', 404)

    const firstChunk = existingRows.find(r => r.chunk_index === 0) || existingRows[0]

    // Affecter à un autre agent (réaffectation)
    if (target_agent_id && target_agent_id !== firstChunk.agent_id) {
        const { data: targetAgent } = await admin
            .from('agents')
            .select('id, user_id')
            .eq('id', target_agent_id)
            .single()

        if (!targetAgent) return errorResponse('Agent cible introuvable', 404)

        const { error: reassignError } = await admin
            .from('knowledge_base')
            .update({ agent_id: target_agent_id, user_id: targetAgent.user_id })
            .eq('source_id', id)

        if (reassignError) return errorResponse('Erreur réaffectation', 500)

        return successResponse({ success: true, reassigned: true })
    }

    const resolvedTitle = title !== undefined ? title : firstChunk.title
    const resolvedImageUrl = image_url !== undefined ? (image_url || null) : (firstChunk.image_url || null)
    const resolvedExtraImages = extra_image_urls !== undefined
        ? (Array.isArray(extra_image_urls) ? extra_image_urls : [])
        : (Array.isArray(firstChunk.extra_image_urls) ? firstChunk.extra_image_urls : [])

    if (content !== undefined) {
        const mergedContent = String(content || '').trim()
        if (!mergedContent) return errorResponse('Contenu vide', 400)

        const nextChunks = chunkText(mergedContent)
        if (!nextChunks.length) return errorResponse('Contenu vide', 400)

        const embeddings = await Promise.all(nextChunks.map(c => generateEmbedding(c)))
        const sharedType = firstChunk.content_type || 'text'
        const sharedAgentId = firstChunk.agent_id

        const stableCount = Math.min(existingRows.length, nextChunks.length)

        for (let i = 0; i < stableCount; i++) {
            const { error: updateError } = await admin
                .from('knowledge_base')
                .update({
                    title: resolvedTitle,
                    content: nextChunks[i],
                    embedding: embeddings[i],
                    content_type: sharedType,
                    chunk_index: i,
                    image_url: resolvedImageUrl,
                    extra_image_urls: resolvedExtraImages,
                })
                .eq('id', existingRows[i].id)

            if (updateError) return errorResponse('Erreur mise à jour segment', 500)
        }

        if (nextChunks.length > existingRows.length) {
            const newRows = nextChunks.slice(existingRows.length).map((chunk, offset) => ({
                user_id: firstChunk.user_id,
                agent_id: sharedAgentId,
                source_id: id,
                content_type: sharedType,
                title: resolvedTitle,
                content: chunk,
                embedding: embeddings[existingRows.length + offset],
                chunk_index: existingRows.length + offset,
                image_url: null,
                extra_image_urls: [],
            }))

            const { error: insertError } = await admin.from('knowledge_base').insert(newRows)
            if (insertError) return errorResponse('Erreur ajout segments', 500)
        } else if (nextChunks.length < existingRows.length) {
            const obsoleteIds = existingRows.slice(nextChunks.length).map(r => r.id)
            const { error: deleteError } = await admin
                .from('knowledge_base')
                .delete()
                .in('id', obsoleteIds)

            if (deleteError) return errorResponse('Erreur suppression segments obsolètes', 500)
        }

        return successResponse({ success: true, chunks_count: nextChunks.length })
    }

    // Mise à jour titre uniquement
    if (title !== undefined) {
        const { error: titleError } = await admin
            .from('knowledge_base')
            .update({ title })
            .eq('source_id', id)

        if (titleError) return errorResponse('Erreur mise à jour titre', 500)
    }

    // Mise à jour images
    const imageUpdates: Record<string, unknown> = {}
    if (image_url !== undefined) imageUpdates.image_url = image_url || null
    if (image_label !== undefined) imageUpdates.image_label = image_label || null
    if (extra_image_urls !== undefined) imageUpdates.extra_image_urls = extra_image_urls

    if (Object.keys(imageUpdates).length > 0) {
        const { error } = await admin
            .from('knowledge_base')
            .update(imageUpdates)
            .eq('source_id', id)

        if (error) return errorResponse('Erreur mise à jour images', 500)
    }

    return successResponse({ success: true })
})

// DELETE /api/admin/knowledge/doc/[id] — Supprimer un document (tous ses chunks)
export const DELETE = withAdminAuth(async (_request: NextRequest, _ctx, routeCtx) => {
    const { id } = await (routeCtx as RouteCtx).params
    const admin = createAdminClient()

    const { error } = await admin
        .from('knowledge_base')
        .delete()
        .eq('source_id', id)

    if (error) return errorResponse('Erreur suppression document', 500)

    return successResponse({ success: true })
})
