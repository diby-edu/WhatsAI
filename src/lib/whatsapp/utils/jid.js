function normalizePhoneForJid(phoneNumber) {
    return typeof phoneNumber === 'string' ? phoneNumber.replace(/\D/g, '') : ''
}

function buildFallbackJid(rawRecipient) {
    if (typeof rawRecipient === 'string' && rawRecipient.includes('@')) {
        return rawRecipient
    }

    const normalizedPhone = normalizePhoneForJid(rawRecipient)
    if (!normalizedPhone) return ''

    const isLid = normalizedPhone.length > 15 || !/^\d{10,13}$/.test(normalizedPhone)
    return normalizedPhone + (isLid ? '@lid' : '@s.whatsapp.net')
}

async function resolveCanonicalJid(socket, rawRecipient, preferredJid) {
    if (preferredJid?.includes('@')) {
        return {
            jid: preferredJid,
            source: 'preferred',
            exists: true,
            normalizedPhone: normalizePhoneForJid(rawRecipient || preferredJid),
        }
    }

    if (typeof rawRecipient === 'string' && rawRecipient.includes('@')) {
        return {
            jid: rawRecipient,
            source: 'raw',
            exists: true,
            normalizedPhone: normalizePhoneForJid(rawRecipient),
        }
    }

    const normalizedPhone = normalizePhoneForJid(rawRecipient)
    if (!normalizedPhone) {
        throw new Error('Invalid recipient phone')
    }

    if (socket?.onWhatsApp) {
        try {
            const lookupResults = await socket.onWhatsApp(normalizedPhone)
            const lookupMatch = Array.isArray(lookupResults)
                ? lookupResults.find((entry) => entry?.exists && entry?.jid)
                : null

            if (lookupMatch?.jid) {
                return {
                    jid: lookupMatch.jid,
                    source: 'wa_lookup',
                    exists: true,
                    normalizedPhone,
                }
            }

            if (Array.isArray(lookupResults) && lookupResults.length > 0) {
                throw new Error(`Recipient ${normalizedPhone} is not registered on WhatsApp`)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new Error(`Failed to resolve WhatsApp recipient: ${message}`)
        }
    }

    const fallbackJid = buildFallbackJid(normalizedPhone)
    return {
        jid: fallbackJid,
        source: 'fallback',
        exists: true,
        normalizedPhone,
    }
}

module.exports = {
    buildFallbackJid,
    normalizePhoneForJid,
    resolveCanonicalJid,
}
