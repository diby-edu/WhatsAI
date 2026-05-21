import { NextRequest } from 'next/server'
import { withAdminAuth, createAdminClient, errorResponse, successResponse } from '@/lib/api-utils'
import { generateEmbedding } from '@/lib/ai/openai'
import { extractDocxText, extractDocText, extractPdfText } from '@/lib/knowledge/document-import'

export const runtime = 'nodejs'

type RouteCtx = { params: Promise<{ agentId: string }> }

function chunkText(text: string, maxChars = 800): string[] {
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
            current = current ? `${current}\n\n${para}` : para
        }
    }
    if (current.trim()) chunks.push(current.trim())

    const result: string[] = []
    for (const chunk of chunks) {
        if (chunk.length <= maxChars) { result.push(chunk); continue }
        const sentences = chunk.split(/(?<=[.!?])\s+/)
        let sub = ''
        for (const sentence of sentences) {
            if ((sub + ' ' + sentence).length > maxChars && sub.length > 0) {
                result.push(sub.trim())
                sub = sentence
            } else {
                sub = sub ? `${sub} ${sentence}` : sentence
            }
        }
        if (sub.trim()) result.push(sub.trim())
    }
    return result.filter(c => c.length > 0)
}

function isUsefulChunk(chunk: string): boolean {
    const t = chunk.trim()
    if (t.length < 40) return false
    if (/^-{0,3}\s*\d+\s*(of|\/|sur)\s*\d+\s*-{0,3}$/i.test(t)) return false
    if (/^page\s*\d+$/i.test(t)) return false
    if (/^[\d\s\-–—/|.]+$/.test(t)) return false
    return true
}

// POST /api/admin/knowledge/agent/[agentId]/import/pdf
export const POST = withAdminAuth(async (request: NextRequest, _ctx, routeCtx) => {
    const { agentId } = await (routeCtx as RouteCtx).params
    const admin = createAdminClient()

    const { data: agent } = await admin
        .from('agents')
        .select('id, user_id')
        .eq('id', agentId)
        .single()

    if (!agent) return errorResponse('Agent introuvable', 404)

    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const title = formData.get('title') as string | null

        if (!file || !title) return errorResponse('Fichier et titre requis', 400)

        const fileName = file.name.toLowerCase()
        const isPdf = fileName.endsWith('.pdf')
        const isDocx = fileName.endsWith('.docx')
        const isDoc = fileName.endsWith('.doc')

        if (!isPdf && !isDocx && !isDoc) {
            return errorResponse('Formats supportés : PDF, DOCX', 400)
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const extracted = isPdf
            ? await extractPdfText(buffer)
            : isDoc
                ? await extractDocText(buffer)
                : await extractDocxText(buffer)

        if (!extracted.text.trim()) {
            return errorResponse("Impossible d'extraire le texte de ce document", 422)
        }

        const chunks = chunkText(extracted.text).filter(isUsefulChunk)
        const sourceId = crypto.randomUUID()

        const insertRows = await Promise.all(
            chunks.map(async (chunkContent, index) => {
                const embedding = await generateEmbedding(chunkContent)
                return {
                    user_id: agent.user_id,
                    agent_id: agentId,
                    title,
                    content: chunkContent,
                    content_type: 'document' as const,
                    source_id: sourceId,
                    chunk_index: index,
                    embedding
                }
            })
        )

        const { data, error } = await admin
            .from('knowledge_base')
            .insert(insertRows)
            .select('id, title, source_id, chunk_index, created_at')

        if (error) throw error

        const firstChunk = (data || []).find(d => d.chunk_index === 0) || data?.[0]
        return successResponse({
            document: firstChunk,
            chunks_count: chunks.length,
            pages: extracted.pages,
            format: extracted.format
        }, 201)
    } catch (err) {
        console.error('[Admin PDF Import]', err)
        return errorResponse('Erreur traitement document', 500)
    }
})
