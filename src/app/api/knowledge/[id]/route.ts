import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { generateEmbedding } from '@/lib/ai/openai'

function chunkText(text: string, maxChars = 800): string[] {
    const trimmed = text.trim()
    if (!trimmed) return []

    // Preserve FAQ blocks when users separate answers with "---"
    const sections = trimmed.split(/\n\s*---\s*\n/)
    const chunks: string[] = []

    for (const section of sections) {
        const value = section.trim()
        if (!value) continue

        if (value.length <= maxChars) {
            chunks.push(value)
            continue
        }

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

    const useful = chunks.filter((chunk) => chunk.trim().length >= 30)
    if (useful.length > 0) return useful

    // Avoid destructive empty rewrites for short documents.
    return [trimmed.slice(0, maxChars)]
}

// GET /api/knowledge/[id] - Fetch all chunks for a source_id
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    const { data, error } = await supabase
        .from('knowledge_base')
        .select('id, chunk_index, content, title')
        .eq('source_id', id)
        .eq('user_id', user.id)
        .order('chunk_index', { ascending: true })

    if (error) {
        return errorResponse('Error fetching segments', 500)
    }

    return successResponse({ segments: data || [] })
}

// PATCH /api/knowledge/[id] - Update title, content, images of a document
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    const body = await request.json()
    const { title, content, image_url, image_label, extra_image_urls } = body

    const { data: existingRows, error: existingError } = await supabase
        .from('knowledge_base')
        .select('id, source_id, user_id, agent_id, content_type, title, image_url, extra_image_urls, chunk_index')
        .eq('source_id', id)
        .eq('user_id', user.id)
        .order('chunk_index', { ascending: true })

    if (existingError) {
        return errorResponse('Erreur lecture document', 500)
    }

    if (!existingRows || existingRows.length === 0) {
        return errorResponse('Document introuvable', 404)
    }

    const firstChunk = existingRows.find((row) => row.chunk_index === 0) || existingRows[0]
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

        const embeddings = await Promise.all(nextChunks.map((chunk) => generateEmbedding(chunk)))
        const sharedType = firstChunk.content_type || 'text'
        const sharedAgentId = firstChunk.agent_id

        const stableCount = Math.min(existingRows.length, nextChunks.length)

        for (let index = 0; index < stableCount; index++) {
            const payload: Record<string, unknown> = {
                title: resolvedTitle,
                content: nextChunks[index],
                embedding: embeddings[index],
                content_type: sharedType,
                chunk_index: index,
            }

            // Images sur tous les chunks pour que le RAG les trouve peu importe le segment
            payload.image_url = resolvedImageUrl
            payload.extra_image_urls = resolvedExtraImages

            const { error: updateError } = await supabase
                .from('knowledge_base')
                .update(payload)
                .eq('id', existingRows[index].id)
                .eq('user_id', user.id)

            if (updateError) return errorResponse('Erreur mise a jour document', 500)
        }

        if (nextChunks.length > existingRows.length) {
            const rowsToInsert = nextChunks.slice(existingRows.length).map((chunk, offset) => {
                const chunkIndex = existingRows.length + offset
                return {
                    user_id: user.id,
                    agent_id: sharedAgentId,
                    source_id: id,
                    content_type: sharedType,
                    title: resolvedTitle,
                    content: chunk,
                    embedding: embeddings[chunkIndex],
                    chunk_index: chunkIndex,
                    image_url: null,
                    extra_image_urls: [],
                }
            })

            const { error: insertError } = await supabase
                .from('knowledge_base')
                .insert(rowsToInsert)

            if (insertError) return errorResponse('Erreur ajout segments', 500)
        } else if (nextChunks.length < existingRows.length) {
            const obsoleteIds = existingRows.slice(nextChunks.length).map((row) => row.id)
            const { error: deleteError } = await supabase
                .from('knowledge_base')
                .delete()
                .in('id', obsoleteIds)
                .eq('user_id', user.id)

            if (deleteError) return errorResponse('Erreur suppression segments obsoletes', 500)
        }

        return successResponse({ success: true, chunks_count: nextChunks.length })
    }

    // Update title on all chunks of this source
    if (title !== undefined) {
        const { error: titleError } = await supabase
            .from('knowledge_base')
            .update({ title })
            .eq('source_id', id)
            .eq('user_id', user.id)

        if (titleError) return errorResponse('Erreur mise a jour titre', 500)
    }

    // Images sur tous les chunks pour que le RAG les trouve peu importe le segment
    const imageUpdates: Record<string, unknown> = {}
    if (image_url !== undefined) imageUpdates.image_url = image_url || null
    if (image_label !== undefined) imageUpdates.image_label = image_label || null
    if (extra_image_urls !== undefined) imageUpdates.extra_image_urls = extra_image_urls

    if (Object.keys(imageUpdates).length > 0) {
        const { error } = await supabase.from('knowledge_base')
            .update(imageUpdates)
            .eq('source_id', id)
            .eq('user_id', user.id)
        if (error) return errorResponse('Erreur mise à jour', 500)
    }

    return successResponse({ success: true })
}

// DELETE /api/knowledge/[id] - Remove a document
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    // Supprimer tous les chunks de cette source (source_id = id)
    // Compatibilité : les vieux documents ont source_id = id (après migration backfill)
    const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('source_id', id)
        .eq('user_id', user.id) // Security check

    if (error) {
        console.error('Error deleting knowledge:', error)
        return errorResponse('Error deleting document', 500)
    }

    return successResponse({ success: true })
}
