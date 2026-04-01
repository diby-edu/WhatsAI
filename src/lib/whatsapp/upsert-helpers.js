const RECENT_APPEND_WINDOW_MS = 10 * 60 * 1000

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

function extractInboundMessagePayload(message) {
    if (message?.message?.conversation) {
        return {
            text: message.message.conversation,
            isVoiceMessage: false,
            audioMessage: null,
            imageMessage: null,
            caption: null,
        }
    }

    if (message?.message?.extendedTextMessage?.text) {
        return {
            text: message.message.extendedTextMessage.text,
            isVoiceMessage: false,
            audioMessage: null,
            imageMessage: null,
            caption: null,
        }
    }

    if (message?.message?.imageMessage) {
        return {
            text: message.message.imageMessage.caption || '',
            isVoiceMessage: false,
            audioMessage: null,
            imageMessage: message.message.imageMessage,
            caption: message.message.imageMessage.caption || '',
        }
    }

    if (message?.message?.audioMessage) {
        return {
            text: '',
            isVoiceMessage: true,
            audioMessage: message.message.audioMessage,
            imageMessage: null,
            caption: null,
        }
    }

    return null
}

module.exports = {
    RECENT_APPEND_WINDOW_MS,
    extractInboundMessagePayload,
    getMessageTimestampMs,
    shouldProcessUpsertMessage,
}
