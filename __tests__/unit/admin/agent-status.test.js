const {
    getAgentOperationalStatus,
    hasAgentConnectedBefore,
} = require('../../../src/lib/admin/agent-status')

describe('agent status mapping', () => {
    test('returns qr_ready for a new agent that never connected', () => {
        expect(getAgentOperationalStatus({
            is_active: true,
            whatsapp_connected: false,
            whatsapp_status: 'disconnected',
            whatsapp_phone: null,
            whatsapp_ever_connected: false,
        })).toBe('qr_ready')
    })

    test('returns reconnect_required once the agent has connected before', () => {
        expect(getAgentOperationalStatus({
            is_active: true,
            whatsapp_connected: false,
            whatsapp_status: 'disconnected',
            whatsapp_phone: null,
            whatsapp_ever_connected: true,
        })).toBe('reconnect_required')
    })

    test('keeps legacy disconnected agents with a stored phone in reconnect_required', () => {
        expect(hasAgentConnectedBefore({
            whatsapp_connected: false,
            whatsapp_phone: '2250700000000',
            whatsapp_ever_connected: null,
        })).toBe(true)
    })

    test('returns paused before any WhatsApp status when the agent is inactive', () => {
        expect(getAgentOperationalStatus({
            is_active: false,
            whatsapp_connected: true,
            whatsapp_ever_connected: true,
        })).toBe('paused')
    })
})
