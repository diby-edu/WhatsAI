const {
    collectReconnectableAgentIds,
    shouldRequestWhatsAppReconnect,
} = require('@/lib/whatsapp/reactivation')

describe('whatsapp reactivation helpers', () => {
    test('requests reconnect for previously inactive connected agents', () => {
        expect(shouldRequestWhatsAppReconnect({
            id: 'agent-1',
            is_active: false,
            whatsapp_connected: true,
            whatsapp_status: 'connected',
        })).toBe(true)
    })

    test('does not request reconnect for inactive agents without a live session', () => {
        expect(shouldRequestWhatsAppReconnect({
            id: 'agent-2',
            is_active: false,
            whatsapp_connected: false,
            whatsapp_status: 'disconnected',
        })).toBe(false)
    })

    test('does not request reconnect for already active agents', () => {
        expect(shouldRequestWhatsAppReconnect({
            id: 'agent-3',
            is_active: true,
            whatsapp_connected: true,
            whatsapp_status: 'connected',
        })).toBe(false)
    })

    test('collects only reconnectable agent ids', () => {
        expect(collectReconnectableAgentIds([
            {
                id: 'agent-1',
                is_active: false,
                whatsapp_connected: true,
                whatsapp_status: 'connected',
            },
            {
                id: 'agent-2',
                is_active: false,
                whatsapp_connected: false,
                whatsapp_status: 'disconnected',
            },
            {
                id: 'agent-3',
                is_active: true,
                whatsapp_connected: true,
                whatsapp_status: 'connected',
            },
        ])).toEqual(['agent-1'])
    })
})
