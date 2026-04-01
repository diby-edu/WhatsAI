const {
    RECENT_APPEND_WINDOW_MS,
    extractInboundMessagePayload,
    getMessageTimestampMs,
    shouldProcessUpsertMessage,
} = require('@/lib/whatsapp/upsert-helpers')

describe('upsert-helpers', () => {
    test('processes notify messages without timestamp constraints', () => {
        expect(shouldProcessUpsertMessage('notify', {})).toBe(true)
    })

    test('processes recent append messages', () => {
        const nowMs = Date.now()
        const appendMessage = {
            messageTimestamp: Math.floor((nowMs - 30 * 1000) / 1000),
        }

        expect(shouldProcessUpsertMessage('append', appendMessage, { nowMs })).toBe(true)
    })

    test('ignores stale append messages from old sync history', () => {
        const nowMs = Date.now()
        const staleMessage = {
            messageTimestamp: Math.floor((nowMs - RECENT_APPEND_WINDOW_MS - 5 * 1000) / 1000),
        }

        expect(shouldProcessUpsertMessage('append', staleMessage, { nowMs })).toBe(false)
    })

    test('supports Long-like timestamps from Baileys protobuf objects', () => {
        const nowMs = Date.now()
        const timestampSeconds = Math.floor((nowMs - 5 * 1000) / 1000)
        const message = {
            messageTimestamp: {
                toNumber: () => timestampSeconds,
            },
        }

        expect(getMessageTimestampMs(message)).toBe(timestampSeconds * 1000)
        expect(shouldProcessUpsertMessage('append', message, { nowMs })).toBe(true)
    })

    test('ignores unsupported upsert types', () => {
        expect(shouldProcessUpsertMessage('replace', { messageTimestamp: Math.floor(Date.now() / 1000) })).toBe(false)
    })

    test('extracts text payloads from conversation messages', () => {
        expect(extractInboundMessagePayload({
            message: { conversation: 'bonjour' }
        })).toEqual(expect.objectContaining({
            text: 'bonjour',
            isVoiceMessage: false,
            audioMessage: null,
            imageMessage: null,
        }))
    })

    test('extracts media payloads without discarding images or audio', () => {
        const imageMessage = { caption: 'photo' }
        const audioMessage = { seconds: 3 }

        expect(extractInboundMessagePayload({
            message: { imageMessage }
        })).toEqual(expect.objectContaining({
            text: 'photo',
            isVoiceMessage: false,
            imageMessage,
        }))

        expect(extractInboundMessagePayload({
            message: { audioMessage }
        })).toEqual(expect.objectContaining({
            text: '',
            isVoiceMessage: true,
            audioMessage,
        }))
    })

    test('returns null for unsupported incoming message shapes', () => {
        expect(extractInboundMessagePayload({
            message: { protocolMessage: { type: 1 } }
        })).toBeNull()
    })
})
