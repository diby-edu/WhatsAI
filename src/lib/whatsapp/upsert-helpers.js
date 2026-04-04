const RECENT_APPEND_WINDOW_MS = 10 * 60 * 1000
const MESSAGE_WRAPPER_KEYS = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage',
    'deviceSentMessage',
]

function getMessageTimestampMs(message) {
    const rawTimestamp = message?.messageTimestamp
    if (rawTimestamp === null || rawTimestamp === undefined) {
        return null
    }

    if (typeof rawTimestamp === 'object' && typeof rawTimestamp.toNumber === 'function') {
        return rawTimestamp.toNumber() * 1000
    }

    const numericTimestamp = Number(rawTimestamp)
    if (!Number.isFinite(numericTimestamp)) {
        return null
    }

    return numericTimestamp > 1e12 ? numericTimestamp : numericTimestamp * 1000
}

function shouldProcessUpsertMessage(type, message, options = {}) {
    if (type === 'notify') {
        return true
    }

    if (type !== 'append') {
        return false
    }

    const nowMs = options.nowMs ?? Date.now()
    const recentWindowMs = options.recentWindowMs ?? RECENT_APPEND_WINDOW_MS
    const timestampMs = getMessageTimestampMs(message)

    if (!timestampMs) {
        return false
    }

    const ageMs = nowMs - timestampMs
    return ageMs >= -60 * 1000 && ageMs <= recentWindowMs
}

function unwrapMessageContent(messageContent) {
    const wrappers = []
    let current = messageContent || null

    for (let depth = 0; depth < MESSAGE_WRAPPER_KEYS.length && current; depth++) {
        const wrapperKey = MESSAGE_WRAPPER_KEYS.find(key => current?.[key]?.message)
        if (!wrapperKey) break

        wrappers.push(wrapperKey)
        current = current[wrapperKey].message
    }

    return {
        content: current,
        wrappers,
    }
}

function describeInboundMessage(message) {
    const { content, wrappers } = unwrapMessageContent(message?.message)

    return {
        remoteJid: message?.key?.remoteJid || '',
        fromMe: Boolean(message?.key?.fromMe),
        wrappers,
        topLevelKeys: content ? Object.keys(content) : [],
    }
}

function isIgnorableIncomingMessage(message) {
    const { content } = unwrapMessageContent(message?.message)
    return Boolean(content?.protocolMessage)
}

function extractInboundMessagePayload(message) {
    const { content } = unwrapMessageContent(message?.message)
    if (!content) {
        return null
    }

    if (content.conversation) {
        return {
            text: content.conversation,
            isVoiceMessage: false,
            audioMessage: null,
            imageMessage: null,
            caption: null,
        }
    }

    if (content.extendedTextMessage?.text) {
        // Extraire le texte de la réponse citée (quoted reply)
        let quotedText = null
        const ctx = content.extendedTextMessage.contextInfo
        if (ctx?.quotedMessage) {
            const qm = ctx.quotedMessage
            quotedText = qm.conversation
                || qm.extendedTextMessage?.text
                || qm.imageMessage?.caption
                || null
        }
        return {
            text: content.extendedTextMessage.text,
            isVoiceMessage: false,
            audioMessage: null,
            imageMessage: null,
            caption: null,
            quotedText,
        }
    }

    if (content.imageMessage) {
        return {
            text: content.imageMessage.caption || '',
            isVoiceMessage: false,
            audioMessage: null,
            imageMessage: content.imageMessage,
            caption: content.imageMessage.caption || '',
        }
    }

    if (content.audioMessage) {
        return {
            text: '',
            isVoiceMessage: true,
            audioMessage: content.audioMessage,
            imageMessage: null,
            caption: null,
        }
    }

    return null
}

module.exports = {
    describeInboundMessage,
    isIgnorableIncomingMessage,
    MESSAGE_WRAPPER_KEYS,
    RECENT_APPEND_WINDOW_MS,
    extractInboundMessagePayload,
    getMessageTimestampMs,
    shouldProcessUpsertMessage,
    unwrapMessageContent,
}
