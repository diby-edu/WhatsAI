import { NextRequest } from 'next/server'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { withAdminAuth, createAdminClient, errorResponse, successResponse } from '@/lib/api-utils'
import { generateEmbedding } from '@/lib/ai/openai'
import { extractDocxText, extractPdfText } from '@/lib/knowledge/document-import'

export const runtime = 'nodejs'

type RouteCtx = { params: Promise<{ agentId: string }> }

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:'])
const MAX_REDIRECTS = 5
const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; WazzapBot/1.0; +https://wazzap.ai)',
    'Accept': 'text/html,text/plain,text/markdown,application/json,application/pdf'
}

function isPrivateIP(ip: string): boolean {
    return [/^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^169\.254\./, /^0\./, /^0\.0\.0\.0$/, /^::1$/i, /^fc00:/i, /^fd00:/i, /^fe80:/i].some(r => r.test(ip))
}

async function isSafeUrl(parsedUrl: URL): Promise<boolean> {
    const { hostname } = parsedUrl
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname === '0.0.0.0') return false
    if (isIP(hostname)) return !isPrivateIP(hostname)
    try {
        const addresses = await lookup(hostname, { all: true })
        return addresses.every(a => !isPrivateIP(a.address))
    } catch {
        return false
    }
}

function isRedirectStatus(s: number) { return [301, 302, 303, 307, 308].includes(s) }
function isPdfResponse(ct: string, url: URL, cd: string | null) {
    return ct.toLowerCase().includes('application/pdf') || url.pathname.toLowerCase().endsWith('.pdf') || (cd || '').toLowerCase().includes('.pdf')
}
function isDocxResponse(ct: string, url: URL, cd: string | null) {
    return ct.toLowerCase().includes('openxmlformats') || url.pathname.toLowerCase().endsWith('.docx') || (cd || '').toLowerCase().includes('.docx')
}

async function fetchUrlWithSafeRedirects(initialUrl: URL) {
    let currentUrl = initialUrl
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
        const response = await fetch(currentUrl.toString(), { headers: FETCH_HEADERS, redirect: 'manual', signal: AbortSignal.timeout(15000) })
        if (!isRedirectStatus(response.status)) return { response, finalUrl: currentUrl }
        const location = response.headers.get('location')
        if (!location) throw new Error('Redirection invalide')
        if (i === MAX_REDIRECTS) throw new Error('Trop de redirections')
        const nextUrl = new URL(location, currentUrl)
        if (!SUPPORTED_PROTOCOLS.has(nextUrl.protocol)) throw new Error('Protocole non autorisé')
        if (!await isSafeUrl(nextUrl)) throw new Error('URL non autorisée')
        currentUrl = nextUrl
    }
    throw new Error('Trop de redirections')
}

function chunkText(text: string, maxChars = 800): string[] {
    const trimmed = text.trim()
    if (trimmed.length <= maxChars) return [trimmed]
    const chunks: string[] = []
    const paragraphs = trimmed.split(/\n{2,}/)
    let current = ''
    for (const para of paragraphs) {
        if ((current + '\n\n' + para).length > maxChars && current.length > 0) {
            chunks.push(current.trim()); current = para
        } else { current = current ? `${current}\n\n${para}` : para }
    }
    if (current.trim()) chunks.push(current.trim())
    return chunks.filter(c => c.length > 0)
}

function isUsefulChunk(chunk: string): boolean {
    const t = chunk.trim()
    if (t.length < 40) return false
    if (/^-{0,3}\s*\d+\s*(of|\/|sur)\s*\d+\s*-{0,3}$/i.test(t)) return false
    if (/^page\s*\d+$/i.test(t)) return false
    if (/^[\d\s\-–—/|.]+$/.test(t)) return false
    return true
}

function extractTextFromHtml(html: string): string {
    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '').replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '').replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<aside[\s\S]*?<\/aside>/gi, '').replace(/<form[\s\S]*?<\/form>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '').replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/\s+(class|id|style|data-[a-z-]+|aria-[a-z-]+)="[^"]*"/gi, '')
    const mainMatch = text.match(/<main[\s\S]*?<\/main>/i)
    const articleMatch = text.match(/<article[\s\S]*?<\/article>/i)
    if (mainMatch) text = mainMatch[0]
    else if (articleMatch) text = articleMatch[0]
    text = text.replace(/<h[1-6][^>]*>/gi, '\n\n').replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<\/?(p|div|li|tr|br|hr|section|article|blockquote)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&[a-z]+;/gi, ' ')
    return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

// POST /api/admin/knowledge/agent/[agentId]/import/url
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
        const body = await request.json()
        const { url, title } = body

        if (!url || !title) return errorResponse('URL et titre requis', 400)

        let parsedUrl: URL
        try { parsedUrl = new URL(url) } catch { return errorResponse('URL invalide', 400) }

        if (!SUPPORTED_PROTOCOLS.has(parsedUrl.protocol)) return errorResponse('Seules les URLs http/https sont supportées', 400)
        if (!await isSafeUrl(parsedUrl)) return errorResponse('URL non autorisée', 403)

        const { response, finalUrl } = await fetchUrlWithSafeRedirects(parsedUrl)
        if (!response.ok) return errorResponse(`Impossible de récupérer l'URL (HTTP ${response.status})`, 422)

        const contentType = response.headers.get('content-type') || ''
        const contentDisposition = response.headers.get('content-disposition')
        let rawText = ''

        if (isPdfResponse(contentType, finalUrl, contentDisposition)) {
            const buffer = Buffer.from(await response.arrayBuffer())
            rawText = (await extractPdfText(buffer)).text || ''
        } else if (isDocxResponse(contentType, finalUrl, contentDisposition)) {
            const buffer = Buffer.from(await response.arrayBuffer())
            rawText = (await extractDocxText(buffer)).text || ''
        } else if (contentType.includes('application/json')) {
            rawText = JSON.stringify(await response.json(), null, 2)
        } else if (contentType.includes('text/html')) {
            rawText = extractTextFromHtml(await response.text())
        } else if (contentType.startsWith('text/') || contentType.includes('xml')) {
            rawText = await response.text()
        } else {
            return errorResponse(`Type de contenu non supporté (${contentType || 'inconnu'})`, 415)
        }

        if (!rawText.trim()) return errorResponse("Impossible d'extraire le contenu de cette URL", 422)

        const chunks = chunkText(rawText.slice(0, 50000)).filter(isUsefulChunk)
        const sourceId = crypto.randomUUID()

        const insertRows = await Promise.all(
            chunks.map(async (chunkContent, index) => {
                const embedding = await generateEmbedding(chunkContent)
                return {
                    user_id: agent.user_id,
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

        const { data, error } = await admin
            .from('knowledge_base')
            .insert(insertRows)
            .select('id, title, source_id, chunk_index, created_at')

        if (error) throw error

        const firstChunk = (data || []).find(d => d.chunk_index === 0) || data?.[0]
        return successResponse({
            document: firstChunk,
            chunks_count: chunks.length,
            source_url: url,
            resolved_url: finalUrl.toString()
        }, 201)
    } catch (err) {
        console.error('[Admin URL Import]', err)
        return errorResponse('Erreur traitement URL', 500)
    }
})
