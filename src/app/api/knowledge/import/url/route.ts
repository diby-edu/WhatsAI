import { NextRequest } from 'next/server'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { generateEmbedding } from '@/lib/ai/openai'
import { extractDocxText, extractPdfText } from '@/lib/knowledge/document-import'

export const runtime = 'nodejs'

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:'])
const MAX_REDIRECTS = 5
const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; WazzapBot/1.0; +https://wazzap.ai)',
    'Accept': 'text/html,text/plain,text/markdown,application/json,application/pdf'
}

function isPrivateIP(ip: string): boolean {
    const privateRanges = [
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^0\./,
        /^0\.0\.0\.0$/,
        /^::1$/i,
        /^fc00:/i,
        /^fd00:/i,
        /^fe80:/i,
    ]

    return privateRanges.some((range) => range.test(ip))
}

async function isSafeUrl(parsedUrl: URL): Promise<boolean> {
    const hostname = parsedUrl.hostname

    if (
        hostname === 'localhost' ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.localhost')
    ) {
        return false
    }

    if (isIP(hostname)) {
        return !isPrivateIP(hostname)
    }

    try {
        const resolved = await lookup(hostname, { all: true, verbatim: true })
        if (!resolved.length) return false
        return resolved.every(({ address }) => !isPrivateIP(address))
    } catch {
        return false
    }
}

function isRedirectStatus(status: number): boolean {
    return [301, 302, 303, 307, 308].includes(status)
}

function isPdfResponse(contentType: string, finalUrl: URL, contentDisposition: string | null): boolean {
    const lowerContentType = contentType.toLowerCase()
    const lowerDisposition = (contentDisposition || '').toLowerCase()
    const lowerPath = finalUrl.pathname.toLowerCase()

    return (
        lowerContentType.includes('application/pdf') ||
        lowerPath.endsWith('.pdf') ||
        lowerDisposition.includes('.pdf')
    )
}

function isDocxResponse(contentType: string, finalUrl: URL, contentDisposition: string | null): boolean {
    const lowerContentType = contentType.toLowerCase()
    const lowerDisposition = (contentDisposition || '').toLowerCase()
    const lowerPath = finalUrl.pathname.toLowerCase()

    return (
        lowerContentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
        lowerPath.endsWith('.docx') ||
        lowerDisposition.includes('.docx')
    )
}

async function fetchUrlWithSafeRedirects(initialUrl: URL) {
    let currentUrl = initialUrl

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
        const response = await fetch(currentUrl.toString(), {
            headers: FETCH_HEADERS,
            redirect: 'manual',
            signal: AbortSignal.timeout(15000)
        })

        if (!isRedirectStatus(response.status)) {
            return { response, finalUrl: currentUrl }
        }

        const location = response.headers.get('location')
        if (!location) {
            throw new Error('Redirection invalide: en-tete Location manquant')
        }

        if (redirectCount === MAX_REDIRECTS) {
            throw new Error('Trop de redirections pour cette URL')
        }

        const nextUrl = new URL(location, currentUrl)
        if (!SUPPORTED_PROTOCOLS.has(nextUrl.protocol)) {
            throw new Error('Redirection vers un protocole non autorise')
        }

        if (!await isSafeUrl(nextUrl)) {
            throw new Error('Redirection vers une URL non autorisee')
        }

        currentUrl = nextUrl
    }

    throw new Error('Trop de redirections pour cette URL')
}

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

function extractTextFromHtml(html: string): string {
    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')

    text = text.replace(/<\/?(p|div|h[1-6]|li|tr|br|hr|section|article)[^>]*>/gi, '\n')
    text = text.replace(/<[^>]+>/g, ' ')
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")

    return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

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

        let parsedUrl: URL
        try {
            parsedUrl = new URL(url)
        } catch {
            return errorResponse('URL invalide', 400)
        }

        if (!SUPPORTED_PROTOCOLS.has(parsedUrl.protocol)) {
            return errorResponse('Seules les URLs http/https sont supportees', 400)
        }

        if (!await isSafeUrl(parsedUrl)) {
            return errorResponse('URL non autorisee', 403)
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

        const { response, finalUrl } = await fetchUrlWithSafeRedirects(parsedUrl)

        if (!response.ok) {
            return errorResponse(`Impossible de recuperer l'URL (HTTP ${response.status})`, 422)
        }

        const contentType = response.headers.get('content-type') || ''
        const contentDisposition = response.headers.get('content-disposition')
        let rawText = ''

        if (isPdfResponse(contentType, finalUrl, contentDisposition)) {
            const buffer = Buffer.from(await response.arrayBuffer())
            const extracted = await extractPdfText(buffer)
            rawText = extracted.text || ''
        } else if (isDocxResponse(contentType, finalUrl, contentDisposition)) {
            const buffer = Buffer.from(await response.arrayBuffer())
            const extracted = await extractDocxText(buffer)
            rawText = extracted.text || ''
        } else if (contentType.includes('application/json')) {
            const json = await response.json()
            rawText = JSON.stringify(json, null, 2)
        } else if (contentType.includes('text/html')) {
            const html = await response.text()
            rawText = extractTextFromHtml(html)
        } else if (contentType.startsWith('text/') || contentType.includes('xml')) {
            rawText = await response.text()
        } else {
            return errorResponse(
                `Type de contenu non supporte (${contentType || 'inconnu'}). Les formats supportes via URL sont HTML, texte, JSON, PDF public et DOCX public.`,
                415
            )
        }

        if (!rawText.trim()) {
            return errorResponse("Impossible d'extraire le contenu de cette URL", 422)
        }

        const limitedText = rawText.slice(0, 50000)
        const chunks = chunkText(limitedText)
        const sourceId = crypto.randomUUID()

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

        const firstChunk = (data || []).find((item) => item.chunk_index === 0) || data?.[0]

        return successResponse({
            document: firstChunk,
            chunks_count: chunks.length,
            source_url: url,
            resolved_url: finalUrl.toString()
        }, 201)
    } catch (err: unknown) {
        console.error('[URL Import] Error:', err)
        if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
            return errorResponse("Timeout: l'URL met trop de temps a repondre", 408)
        }
        const message = err instanceof Error ? err.message : 'Error processing URL'
        return errorResponse(message, 500)
    }
}
