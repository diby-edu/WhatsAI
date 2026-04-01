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
    const selectResult = jest.fn(async () => ({
        data: preloadRows,
        error: preloadError,
    }))

    const upsertThrowOnError = jest.fn(async () => {
        return null
    })

    const deleteThrowOnError = jest.fn(async () => {
        return null
    })

    const query = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
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
