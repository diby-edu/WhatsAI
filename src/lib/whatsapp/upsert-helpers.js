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

module.exports = {
    RECENT_APPEND_WINDOW_MS,
    getMessageTimestampMs,
    shouldProcessUpsertMessage,
}
