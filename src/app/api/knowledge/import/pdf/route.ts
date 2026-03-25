import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { generateEmbedding } from '@/lib/ai/openai'
import { extractDocxText, extractDocText, extractPdfText } from '@/lib/knowledge/document-import'

export const runtime = 'nodejs'

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
            current = current ? `${current}\n\n${para}` : para
        }
    }

    if (current.trim()) {
        chunks.push(current.trim())
    }

    const result: string[] = []
    for (const chunk of chunks) {
        if (chunk.length <= maxChars) {
            result.push(chunk)
            continue
        }

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

        if (sub.trim()) {
            result.push(sub.trim())
        }
    }

    return result.filter((chunk) => chunk.length > 0)
}

export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const agentId = formData.get('agentId') as string | null
        const title = formData.get('title') as string | null

        if (!file || !agentId || !title) {
            return errorResponse('Missing required fields (file, agentId, title)', 400)
        }

        const fileName = file.name.toLowerCase()
        const isPdf = fileName.endsWith('.pdf')
        const isDocx = fileName.endsWith('.docx')
        const isLegacyDoc = fileName.endsWith('.doc')

        if (!isPdf && !isDocx && !isLegacyDoc) {
            return errorResponse('Formats supportes: PDF et DOCX', 400)
        }


        const { data: agentCheck } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agentId)
            .eq('user_id', user.id)
            .single()

        if (!agentCheck) {
            return errorResponse('Agent not found or unauthorized', 403)
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const extracted = isPdf
            ? await extractPdfText(buffer)
            : isLegacyDoc
                ? await extractDocText(buffer)
                : await extractDocxText(buffer)

        if (!extracted.text.trim()) {
            return errorResponse("Impossible d'extraire le texte de ce document", 422)
        }

        const chunks = chunkText(extracted.text)
        const sourceId = crypto.randomUUID()

        const insertRows = await Promise.all(
            chunks.map(async (chunkContent, index) => {
                const embedding = await generateEmbedding(chunkContent)
                return {
                    user_id: user.id,
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

        const { data, error } = await supabase
            .from('knowledge_base')
            .insert(insertRows)
            .select('id, title, source_id, chunk_index, created_at')

        if (error) throw error

        const firstChunk = (data || []).find((item) => item.chunk_index === 0) || data?.[0]

        return successResponse({
            document: firstChunk,
            chunks_count: chunks.length,
            pages: extracted.pages,
            format: extracted.format
        }, 201)
    } catch (err: unknown) {
        console.error('[Document Import] Error:', err)
        const message = err instanceof Error ? err.message : 'Error processing document'
        return errorResponse(message, 500)
    }
}
