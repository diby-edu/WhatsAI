import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export interface EncryptedCredentialsPayload {
    v: 1
    iv: string
    tag: string
    data: string
}

function resolveEncryptionMaterial(): string {
    const explicit = (process.env.PLATFORM_SYNC_ENCRYPTION_KEY || '').trim()
    if (explicit) return explicit

    const fallback = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    if (fallback) return fallback

    throw new Error('Missing encryption material: set PLATFORM_SYNC_ENCRYPTION_KEY')
}

function resolveKey(): Buffer {
    return createHash('sha256').update(resolveEncryptionMaterial()).digest()
}

export function encryptCredentials(input: object): EncryptedCredentialsPayload {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', resolveKey(), iv)
    const plaintext = Buffer.from(JSON.stringify(input), 'utf8')
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
    const tag = cipher.getAuthTag()

    return {
        v: 1,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        data: encrypted.toString('base64'),
    }
}

export function decryptCredentials(payload: unknown): Record<string, unknown> {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw new Error('Invalid encrypted credentials payload')
    }

    const obj = payload as Record<string, unknown>
    const version = Number(obj.v)
    const iv = String(obj.iv || '')
    const tag = String(obj.tag || '')
    const data = String(obj.data || '')

    if (version !== 1 || !iv || !tag || !data) {
        throw new Error('Encrypted credentials payload is incomplete')
    }

    const decipher = createDecipheriv(
        'aes-256-gcm',
        resolveKey(),
        Buffer.from(iv, 'base64')
    )
    decipher.setAuthTag(Buffer.from(tag, 'base64'))

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(data, 'base64')),
        decipher.final(),
    ])

    const parsed = JSON.parse(decrypted.toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Decrypted credentials must be an object')
    }

    return parsed as Record<string, unknown>
}
