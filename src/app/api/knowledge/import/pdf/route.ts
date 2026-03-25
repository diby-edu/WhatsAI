import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { generateEmbedding } from '@/lib/ai/openai'

// Réutilise la même logique de chunking que /api/knowledge
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

// POST /api/knowledge/import/pdf
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

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            return errorResponse('Only PDF files are supported', 400)
        }

        // Vérifier ownership
        const { data: agentCheck } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agentId)
            .eq('user_id', user.id)
            .single()

        if (!agentCheck) {
            return errorResponse('Agent not found or unauthorized', 403)
        }

        // Extraire le texte du PDF
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse')
        const pdfData = await pdfParse(buffer)
        const rawText: string = pdfData.text || ''

        if (!rawText.trim()) {
            return errorResponse('Impossible d\'extraire le texte de ce PDF (PDF scanné ou protégé)', 422)
        }

        // Nettoyer le texte extrait (supprimer les lignes vides multiples)
        const cleanText = rawText.replace(/\n{3,}/g, '\n\n').trim()

        // Chunking
        const chunks = chunkText(cleanText)
        const sourceId = crypto.randomUUID()

        // Générer embeddings et insérer
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

        const firstChunk = (data || []).find(d => d.chunk_index === 0) || data?.[0]

        return successResponse({
            document: firstChunk,
            chunks_count: chunks.length,
            pages: pdfData.numpages || null
        }, 201)
    } catch (err: any) {
        console.error('[PDF Import] Error:', err)
        return errorResponse(err.message || 'Error processing PDF', 500)
    }
}
