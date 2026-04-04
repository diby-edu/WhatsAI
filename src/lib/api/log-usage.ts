/**
 * Enregistre un appel API dans api_usage_logs (fire & forget).
 */
export function logApiUsage(supabase: any, params: {
    apiKeyId: string
    userId: string
    agentId?: string | null
    endpoint: string
    method: string
    statusCode: number
    requestBody?: any
    responseMs: number
    ipAddress?: string | null
}) {
    const { apiKeyId, userId, agentId, endpoint, method, statusCode, requestBody, responseMs, ipAddress } = params

    // Sanitize : ne jamais logger les valeurs sensibles
    const safeBody = requestBody ? sanitizeBody(requestBody) : null

    supabase.from('api_usage_logs').insert({
        api_key_id: apiKeyId,
        user_id: userId,
        agent_id: agentId || null,
        endpoint,
        method,
        status_code: statusCode,
        request_body: safeBody,
        response_ms: responseMs,
        ip_address: ipAddress || null,
    }).then(() => {}).catch(() => {})
}

function sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body
    const clean = { ...body }
    // Supprimer les champs potentiellement sensibles
    delete clean.api_key
    delete clean.secret
    delete clean.password
    delete clean.token
    return clean
}
