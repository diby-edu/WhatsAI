const { cancelExpiredBookingDeposits } = require('@/lib/whatsapp/cron/jobs')

function createBookingSelectChain(result) {
    const chain = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        lt: jest.fn(async () => result)
    }

    return chain
}

function createBookingUpdateChain(result) {
    const chain = {
        update: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        select: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => result)
    }

    return chain
}

function createOutboundInsertChain(insertMock) {
    return {
        insert: insertMock
    }
}

describe('cancelExpiredBookingDeposits', () => {
    test('expires pending restaurant deposits and queues a customer message', async () => {
        const insertMock = jest.fn(async () => ({ error: null }))
        const booking = {
            id: 'booking-1',
            agent_id: 'agent-1',
            customer_phone: '+2250102030405',
            customer_name: 'Awa',
            service_name: 'Table terrasse',
            start_time: '2026-03-31T20:00:00.000Z'
        }

        const bookingsChains = [
            createBookingSelectChain({ data: [booking] }),
            createBookingUpdateChain({ data: { id: 'booking-1' }, error: null })
        ]

        const supabase = {
            from: jest.fn((table) => {
                if (table === 'bookings') {
                    return bookingsChains.shift()
                }

                if (table === 'outbound_messages') {
                    return createOutboundInsertChain(insertMock)
                }

                throw new Error(`Unexpected table: ${table}`)
            })
        }

        await cancelExpiredBookingDeposits(supabase)

        expect(insertMock).toHaveBeenCalledTimes(1)
        expect(insertMock.mock.calls[0][0]).toMatchObject({
            agent_id: 'agent-1',
            recipient_phone: '+2250102030405',
            status: 'pending'
        })
        expect(insertMock.mock.calls[0][0].message_content).toContain('Reservation en attente expiree')
    })

    test('does not queue a message when the booking was already updated concurrently', async () => {
        const insertMock = jest.fn(async () => ({ error: null }))
        const booking = {
            id: 'booking-2',
            agent_id: 'agent-2',
            customer_phone: '+2250708091011',
            customer_name: 'Koffi',
            service_name: 'Dinner',
            start_time: null
        }

        const bookingsChains = [
            createBookingSelectChain({ data: [booking] }),
            createBookingUpdateChain({ data: null, error: null })
        ]

        const supabase = {
            from: jest.fn((table) => {
                if (table === 'bookings') {
                    return bookingsChains.shift()
                }

                if (table === 'outbound_messages') {
                    return createOutboundInsertChain(insertMock)
                }

                throw new Error(`Unexpected table: ${table}`)
            })
        }

        await cancelExpiredBookingDeposits(supabase)

        expect(insertMock).not.toHaveBeenCalled()
    })
})
