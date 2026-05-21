/**
 * Utilitaires partagés pour les routes de l'API publique v1.
 */

export function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    if (phone.startsWith('+')) return `+${digits}`
    if (digits.length >= 10) return `+${digits}`
    return phone
}

export function isValidPhone(phone: string): boolean {
    return /^\+\d{8,15}$/.test(phone)
}

export function asObject(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null
}

export function asString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const next = value.trim()
    return next.length > 0 ? next : undefined
}
