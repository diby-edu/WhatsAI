type InternalBotSendParams = {
    agentId: string
    to: string
    message: string
}

type InternalBotSendResult = {
    success: boolean
    messageId?: string
    error?: string
    code?: string
    statusCode?: number
}

const DEFAULT_BOT_URL = 'http://127.0.0.1:3001'
const DEFAULT_SEND_TIMEOUT_MS = 8000

export function getInternalBotBaseUrl(): string {
    return process.env.WHATSAPP_BOT_URL || DEFAULT_BOT_URL
}

export function getInternalBotToken(): string | null {
    const token = process.env.WHATSAPP_INTERNAL_API_TOKEN?.trim()
    return token ? token : null
}

export async function sendMessageViaInternalBot(params: InternalBotSendParams): Promise<InternalBotSendResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEFAULT_SEND_TIMEOUT_MS)
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }

    const token = getInternalBotToken()
    if (token) {
        headers['X-Internal-Token'] = token
    }

    try {
        const response = await fetch(`${getInternalBotBaseUrl()}/send`, {
            method: 'POST',
            headers,
            body: JSON.stringify(params),
            signal: controller.signal,
        })

        const payload = await response.json().catch(() => null)

        if (!response.ok) {
            return {
                success: false,
                error: payload?.error || `Internal bot HTTP ${response.status}`,
                code: payload?.code,
                statusCode: response.status,
            }
        }

        return {
            success: payload?.success === true,
            messageId: payload?.messageId,
            error: payload?.error,
            code: payload?.code,
            statusCode: response.status,
        }
    } catch (error) {
        const isAbort = error instanceof Error && error.name === 'AbortError'
        return {
            success: false,
            error: isAbort ? 'Internal bot request timed out' : (error instanceof Error ? error.message : 'Internal bot unavailable'),
            code: isAbort ? 'BOT_TIMEOUT' : 'BOT_UNAVAILABLE',
        }
    } finally {
        clearTimeout(timeout)
    }
}
