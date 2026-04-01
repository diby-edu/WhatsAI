const { buildWhatsAppRiskSnapshot, WHATSAPP_RISK_THRESHOLDS_MINUTES } = require('../../../src/lib/admin/monitoring')

describe('buildWhatsAppRiskSnapshot', () => {
    const now = new Date('2026-04-01T22:00:00.000Z').getTime()

    test('flags reconnect agents stuck in qr_ready after they connected before', () => {
        const report = buildWhatsAppRiskSnapshot([
            {
                id: 'agent-1',
                name: 'Restaurant Chez Kono',
                user_id: 'user-1',
                is_active: true,
                whatsapp_connected: false,
                whatsapp_status: 'qr_ready',
                whatsapp_phone: '22541859625',
                whatsapp_ever_connected: true,
                whatsapp_qr_code: 'data:image/png;base64,abc',
                updated_at: '2026-04-01T21:50:00.000Z',
                last_message_at: '2026-04-01T21:00:00.000Z',
            },
        ], now)

        expect(report.total).toBe(1)
        expect(report.critical).toBe(1)
        expect(report.agents[0]).toEqual(expect.objectContaining({
            id: 'agent-1',
            reason: 'reconnect_qr_ready',
            severity: 'critical',
            minutes_since_update: 10,
            has_qr: true,
        }))
    })

    test('flags connecting agents that stay blocked too long', () => {
        const report = buildWhatsAppRiskSnapshot([
            {
                id: 'agent-2',
                name: 'Agent Bloque',
                user_id: 'user-2',
                is_active: true,
                whatsapp_connected: false,
                whatsapp_status: 'connecting',
                whatsapp_phone: null,
                whatsapp_ever_connected: true,
                whatsapp_qr_code: null,
                updated_at: '2026-04-01T21:52:00.000Z',
                last_message_at: null,
            },
        ], now)

        expect(report.total).toBe(1)
        expect(report.agents[0]).toEqual(expect.objectContaining({
            reason: 'connecting_stalled',
            severity: 'critical',
            minutes_since_update: 8,
        }))
    })

    test('does not flag fresh qr_ready agents below thresholds', () => {
        const report = buildWhatsAppRiskSnapshot([
            {
                id: 'agent-3',
                name: 'Nouveau QR',
                user_id: 'user-3',
                is_active: true,
                whatsapp_connected: false,
                whatsapp_status: 'qr_ready',
                whatsapp_phone: null,
                whatsapp_ever_connected: false,
                whatsapp_qr_code: 'data:image/png;base64,def',
                updated_at: '2026-04-01T21:40:30.000Z',
                last_message_at: null,
            },
        ], now)

        expect(WHATSAPP_RISK_THRESHOLDS_MINUTES.first_pairing_qr_ready).toBeGreaterThan(19)
        expect(report.total).toBe(0)
    })
})
