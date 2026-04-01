const {
    RECENT_APPEND_WINDOW_MS,
    describeInboundMessage,
    extractInboundMessagePayload,
    getMessageTimestampMs,
    isIgnorableIncomingMessage,
    shouldProcessUpsertMessage,
    unwrapMessageContent,
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

    test('unwraps common WhatsApp message wrappers', () => {
        const message = {
            message: {
                ephemeralMessage: {
                    message: {
                        viewOnceMessageV2: {
                            message: {
                                extendedTextMessage: {
                                    text: 'bonjour reprise',
                                },
                            },
                        },
                    },
                },
            },
        }

        expect(unwrapMessageContent(message.message)).toEqual({
            content: {
                extendedTextMessage: {
                    text: 'bonjour reprise',
                },
            },
            wrappers: ['ephemeralMessage', 'viewOnceMessageV2'],
        })

        expect(extractInboundMessagePayload(message)).toEqual(expect.objectContaining({
            text: 'bonjour reprise',
            isVoiceMessage: false,
        }))
    })

    test('describes inbound message shape for targeted logging', () => {
        expect(describeInboundMessage({
            key: {
                fromMe: false,
                remoteJid: '22547094746@s.whatsapp.net',
            },
            message: {
                deviceSentMessage: {
                    message: {
                        conversation: 'bonjour reprise',
                    },
                },
            },
        })).toEqual({
            fromMe: false,
            remoteJid: '22547094746@s.whatsapp.net',
            wrappers: ['deviceSentMessage'],
            topLevelKeys: ['conversation'],
        })
    })

    test('returns null for unsupported incoming message shapes', () => {
        expect(extractInboundMessagePayload({
            message: { protocolMessage: { type: 1 } }
        })).toBeNull()
    })

    test('marks protocol messages as ignorable system traffic', () => {
        expect(isIgnorableIncomingMessage({
            message: { protocolMessage: { type: 1 } }
        })).toBe(true)

        expect(isIgnorableIncomingMessage({
            message: { extendedTextMessage: { text: 'bonjour' } }
        })).toBe(false)
    })
})
