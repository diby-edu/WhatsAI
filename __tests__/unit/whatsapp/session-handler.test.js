/** @jest-environment node */

const connectionHandlers = []

let currentSocket = null
const makeWASocketMock = jest.fn(() => {
    connectionHandlers.length = 0

    currentSocket = {
        ev: {
            on: jest.fn((event, handler) => {
                if (event === 'connection.update') {
                    connectionHandlers.push(handler)
                }
            }),
        },
        ws: {
            on: jest.fn(),
        },
        end: jest.fn(),
        sendPresenceUpdate: jest.fn(),
        user: null,
    }

    return currentSocket
})

jest.mock('@whiskeysockets/baileys', () => ({
    __esModule: true,
    default: makeWASocketMock,
    DisconnectReason: {
        loggedOut: 401,
        restartRequired: 515,
    },
    fetchLatestBaileysVersion: jest.fn(async () => ({ version: [2, 3000, 1027934701] })),
    makeCacheableSignalKeyStore: jest.fn(() => ({})),
    Browsers: {
        ubuntu: jest.fn(() => ['Ubuntu', 'Chrome', '1.0.0']),
    },
}))

jest.mock('@/lib/whatsapp/supabase-auth', () => jest.fn(async () => ({
    state: {
        creds: {},
        keys: {
            get: jest.fn(async () => ({})),
            set: jest.fn(async () => {}),
        },
    },
    saveCreds: jest.fn(async () => {}),
})))

jest.mock('@/lib/whatsapp/handlers/message', () => ({
    handleMessage: jest.fn(async () => {}),
}))

jest.mock('qrcode', () => ({
    toDataURL: jest.fn(async () => 'data:image/png;base64,qr'),
}))

jest.mock('pino', () => jest.fn(() => ({ level: 'warn' })))

const { initSession } = require('@/lib/whatsapp/handlers/session')
const { DisconnectReason } = require('@whiskeysockets/baileys')

function createSupabaseMock() {
    const agentUpdates = []
    const whatsappSessionDeletes = []

    const updateEqMock = jest.fn(async () => ({ error: null }))
    const deleteEqMock = jest.fn((field, value) => {
        whatsappSessionDeletes.push({ field, value })
        return Promise.resolve({ error: null })
    })

    const supabase = {
        from: jest.fn((table) => {
            if (table === 'agents') {
                return {
                    update: jest.fn((payload) => {
                        agentUpdates.push(payload)
                        return { eq: updateEqMock }
                    }),
                }
            }

            if (table === 'whatsapp_sessions') {
                return {
                    delete: jest.fn(() => ({ eq: deleteEqMock })),
                }
            }

            throw new Error(`Unexpected table access in test: ${table}`)
        }),
    }

    return {
        supabase,
        agentUpdates,
        whatsappSessionDeletes,
    }
}

async function emitConnectionUpdate(update) {
    for (const handler of connectionHandlers) {
        await handler(update)
    }
}

describe('WhatsApp session handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        connectionHandlers.length = 0
        currentSocket = null
    })

    test('preserves credentials and restarts immediately when Baileys requests restart after QR scan', async () => {
        const { supabase, agentUpdates, whatsappSessionDeletes } = createSupabaseMock()
        const context = {
            supabase,
            activeSessions: new Map(),
            pendingConnections: new Set(),
            openai: {},
            CinetPay: {},
            markSetupPhaseActivity: jest.fn(),
            clearSetupPhaseActivity: jest.fn(),
            scheduleSessionInit: jest.fn(),
            qrAttemptCounts: new Map(),
        }

        await initSession(context, 'agent-1', 'Agent One', 0)

        await emitConnectionUpdate({ qr: 'abc' })
        await emitConnectionUpdate({ isNewLogin: true })
        await emitConnectionUpdate({
            connection: 'close',
            lastDisconnect: {
                error: {
                    output: {
                        statusCode: DisconnectReason.restartRequired,
                    },
                },
            },
        })

        expect(whatsappSessionDeletes).toEqual([])
        expect(agentUpdates).toContainEqual(expect.objectContaining({
            whatsapp_status: 'qr_ready',
            whatsapp_connected: false,
        }))
        expect(agentUpdates).toContainEqual(expect.objectContaining({
            whatsapp_status: 'connecting',
            whatsapp_qr_code: null,
            whatsapp_disconnected_by: null,
        }))
        expect(agentUpdates).not.toContainEqual(expect.objectContaining({
            whatsapp_status: 'disconnected',
        }))
        expect(context.scheduleSessionInit).toHaveBeenCalledWith(
            context,
            expect.objectContaining({
                id: 'agent-1',
                name: 'Agent One',
                whatsapp_status: 'connecting',
            }),
            0
        )
    })

    test('still resets the pairing flow for non-restart close after QR scan', async () => {
        const { supabase, agentUpdates, whatsappSessionDeletes } = createSupabaseMock()
        const context = {
            supabase,
            activeSessions: new Map(),
            pendingConnections: new Set(),
            openai: {},
            CinetPay: {},
            markSetupPhaseActivity: jest.fn(),
            clearSetupPhaseActivity: jest.fn(),
            scheduleSessionInit: jest.fn(),
            qrAttemptCounts: new Map(),
        }

        await initSession(context, 'agent-2', 'Agent Two', 0)

        await emitConnectionUpdate({ qr: 'abc' })
        await emitConnectionUpdate({ isNewLogin: true })
        await emitConnectionUpdate({
            connection: 'close',
            lastDisconnect: {
                error: {
                    output: {
                        statusCode: 428,
                    },
                },
            },
        })

        expect(whatsappSessionDeletes).toEqual([
            { field: 'session_id', value: 'agent-2' },
        ])
        expect(agentUpdates).toContainEqual(expect.objectContaining({
            whatsapp_status: 'disconnected',
            whatsapp_connected: false,
            whatsapp_disconnected_by: 'system',
        }))
        expect(context.scheduleSessionInit).not.toHaveBeenCalled()
    })

    test('purges stale stored credentials when a reconnecting agent falls back to a QR flow', async () => {
        const { supabase, whatsappSessionDeletes } = createSupabaseMock()
        const context = {
            supabase,
            activeSessions: new Map(),
            pendingConnections: new Set(),
            openai: {},
            CinetPay: {},
            markSetupPhaseActivity: jest.fn(),
            clearSetupPhaseActivity: jest.fn(),
            scheduleSessionInit: jest.fn(),
            qrAttemptCounts: new Map(),
        }

        await initSession(context, 'agent-3', 'Agent Three', 99)

        await emitConnectionUpdate({ qr: 'abc' })

        expect(whatsappSessionDeletes).toEqual([
            { field: 'session_id', value: 'agent-3' },
        ])
    })

    test('does not mark the agent disconnected when the service is shutting down gracefully', async () => {
        const { supabase, agentUpdates, whatsappSessionDeletes } = createSupabaseMock()
        const context = {
            supabase,
            activeSessions: new Map(),
            pendingConnections: new Set(),
            openai: {},
            CinetPay: {},
            markSetupPhaseActivity: jest.fn(),
            clearSetupPhaseActivity: jest.fn(),
            scheduleSessionInit: jest.fn(),
            qrAttemptCounts: new Map(),
            serviceState: { shuttingDown: true },
        }

        await initSession(context, 'agent-4', 'Agent Four', 0)

        await emitConnectionUpdate({
            connection: 'close',
            lastDisconnect: {
                error: {
                    output: {
                        statusCode: 428,
                    },
                },
            },
        })

        expect(agentUpdates).toEqual([])
        expect(whatsappSessionDeletes).toEqual([])
        expect(context.scheduleSessionInit).not.toHaveBeenCalled()
        expect(context.activeSessions.has('agent-4')).toBe(false)
    })
})
