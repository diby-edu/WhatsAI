jest.mock('@whiskeysockets/baileys', () => ({
    initAuthCreds: jest.fn(() => ({ registered: false })),
    BufferJSON: {
        replacer: (_key, value) => value,
        reviver: (_key, value) => value,
    },
    proto: {
        Message: {
            AppStateSyncKeyData: {
                fromObject: jest.fn(value => value),
            },
        },
    },
}))

const useSupabaseAuthState = require('@/lib/whatsapp/supabase-auth')

function createSupabaseMock({ preloadRows = [], preloadError = null } = {}) {
    let currentRange = null
    let currentOrder = null

    const selectResult = jest.fn(async () => {
        if (preloadError) {
            return {
                data: null,
                error: preloadError,
            }
        }

        let data = [...preloadRows]
        if (currentOrder?.column === 'key_id') {
            data.sort((a, b) => a.key_id.localeCompare(b.key_id))
            if (currentOrder.ascending === false) {
                data.reverse()
            }
        }
        if (currentRange) {
            data = data.slice(currentRange.from, currentRange.to + 1)
        }

        return {
            data,
            error: null,
        }
    })

    const upsertThrowOnError = jest.fn(async () => {
        return null
    })

    const deleteThrowOnError = jest.fn(async () => {
        return null
    })

    const query = {
        select: jest.fn(() => {
            currentRange = null
            currentOrder = null
            return query
        }),
        eq: jest.fn(() => query),
        order: jest.fn((column, options = {}) => {
            currentOrder = { column, ascending: options.ascending !== false }
            return query
        }),
        range: jest.fn((from, to) => {
            currentRange = { from, to }
            return query
        }),
        upsert: jest.fn(() => ({ throwOnError: upsertThrowOnError })),
        delete: jest.fn(() => query),
        throwOnError: deleteThrowOnError,
        then: (resolve, reject) => selectResult().then(resolve, reject),
    }

    const supabase = {
        from: jest.fn(() => query),
    }

    return {
        supabase,
        query,
        selectResult,
        upsertThrowOnError,
        deleteThrowOnError,
    }
}

describe('supabase-auth', () => {
    test('preloads auth rows once and serves reads from memory cache', async () => {
        const { supabase, query } = createSupabaseMock({
            preloadRows: [
                {
                    key_id: 'creds',
                    data: JSON.stringify({ registered: true }),
                },
                {
                    key_id: 'session-contact-1',
                    data: JSON.stringify({ foo: 'bar' }),
                },
            ],
        })

        const auth = await useSupabaseAuthState(supabase, 'agent-1')
        const first = await auth.state.keys.get('session', ['contact-1'])
        const second = await auth.state.keys.get('session', ['contact-1'])

        expect(first['contact-1']).toEqual({ foo: 'bar' })
        expect(second['contact-1']).toEqual({ foo: 'bar' })
        expect(query.select).toHaveBeenCalledTimes(1)
    })

    test('preloads auth rows across multiple pages when session exceeds default page size', async () => {
        const preloadRows = [
            {
                key_id: 'creds',
                data: JSON.stringify({ registered: true }),
            },
            ...Array.from({ length: 1204 }, (_, index) => ({
                key_id: `session-contact-${index + 1}`,
                data: JSON.stringify({ contactIndex: index + 1 }),
            })),
        ]
        const { supabase, query } = createSupabaseMock({ preloadRows })

        const auth = await useSupabaseAuthState(supabase, 'agent-paged')
        const pagedValue = await auth.state.keys.get('session', ['contact-1204'])

        expect(pagedValue['contact-1204']).toEqual({ contactIndex: 1204 })
        expect(query.select).toHaveBeenCalledTimes(2)
        expect(query.range).toHaveBeenNthCalledWith(1, 0, 999)
        expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999)
    })

    test('fails fast when auth preload cannot be loaded', async () => {
        const { supabase } = createSupabaseMock({
            preloadError: new Error('connect timeout'),
        })

        await expect(useSupabaseAuthState(supabase, 'agent-2')).rejects.toThrow('connect timeout')
    })

    test('updates in-memory cache on set and remove', async () => {
        const { supabase, query, upsertThrowOnError, deleteThrowOnError } = createSupabaseMock({
            preloadRows: [],
        })

        const auth = await useSupabaseAuthState(supabase, 'agent-3')
        await auth.state.keys.set({
            session: {
                'contact-2': { hello: 'world' },
            },
        })

        expect(upsertThrowOnError).toHaveBeenCalledTimes(1)
        expect((await auth.state.keys.get('session', ['contact-2']))['contact-2']).toEqual({ hello: 'world' })

        await auth.state.keys.set({
            session: {
                'contact-2': null,
            },
        })

        expect(deleteThrowOnError).toHaveBeenCalledTimes(1)
        expect((await auth.state.keys.get('session', ['contact-2']))['contact-2']).toBeUndefined()
        expect(query.select).toHaveBeenCalledTimes(1)
    })
})
