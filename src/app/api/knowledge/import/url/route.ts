import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { generateEmbedding } from '@/lib/ai/openai'

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

// Extrait le texte brut depuis du HTML en supprimant les balises
function extractTextFromHtml(html: string): string {
    // Supprimer scripts, styles, head, nav, footer
    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
    // Remplacer les balises de bloc par des sauts de ligne
    text = text
        .replace(/<\/?(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n')
    // Supprimer toutes les balises restantes
    text = text.replace(/<[^>]+>/g, ' ')
    // Décoder les entités HTML basiques
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    // Nettoyer les espaces multiples
    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    return text
}

// POST /api/knowledge/import/url
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        const body = await request.json()
        const { agentId, url, title } = body

        if (!agentId || !url || !title) {
            return errorResponse('Missing required fields (agentId, url, title)', 400)
        }

        // Valider l'URL
        let parsedUrl: URL
        try {
            parsedUrl = new URL(url)
        } catch {
            return errorResponse('URL invalide', 400)
        }

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return errorResponse('Seules les URLs http/https sont supportées', 400)
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

        // Fetcher le contenu
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WazzapBot/1.0; +https://wazzap.ai)',
                'Accept': 'text/html,text/plain,application/json'
            },
            signal: AbortSignal.timeout(15000) // 15s timeout
        })

        if (!response.ok) {
            return errorResponse(`Impossible de récupérer l'URL (HTTP ${response.status})`, 422)
        }

        const contentType = response.headers.get('content-type') || ''
        let rawText = ''

        if (contentType.includes('application/json')) {
            const json = await response.json()
            rawText = JSON.stringify(json, null, 2)
        } else if (contentType.includes('text/html')) {
            const html = await response.text()
            rawText = extractTextFromHtml(html)
        } else {
            // text/plain ou autre
            rawText = await response.text()
        }

        if (!rawText.trim()) {
            return errorResponse('Impossible d\'extraire le contenu de cette URL', 422)
        }

        // Limiter à 50 000 caractères (protection anti-abus)
        const limitedText = rawText.slice(0, 50000)

        // Chunking
        const chunks = chunkText(limitedText)
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
                    content_type: 'url' as const,
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
            source_url: url
        }, 201)
    } catch (err: any) {
        console.error('[URL Import] Error:', err)
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            return errorResponse('Timeout : l\'URL met trop de temps à répondre', 408)
        }
        return errorResponse(err.message || 'Error processing URL', 500)
    }
}
