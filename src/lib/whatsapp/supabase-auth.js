const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys')

const AUTH_RETRY_DELAYS_MS = [0, 250, 750]
const SESSION_PRELOAD_PAGE_SIZE = 1000

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function withRetry(operationName, fn) {
    let lastError = null

    for (let attempt = 0; attempt < AUTH_RETRY_DELAYS_MS.length; attempt++) {
        if (AUTH_RETRY_DELAYS_MS[attempt] > 0) {
            await sleep(AUTH_RETRY_DELAYS_MS[attempt])
        }

        try {
            return await fn()
        } catch (error) {
            lastError = error
            const retriesLeft = AUTH_RETRY_DELAYS_MS.length - attempt - 1
            console.warn(`[SupabaseAuth] ${operationName} failed (attempt ${attempt + 1}/${AUTH_RETRY_DELAYS_MS.length}, retries left=${retriesLeft}):`, error.message || error)
        }
    }

    throw lastError
}

/**
 * Custom Auth Adapter for Baileys using Supabase (CommonJS)
 * Stores sessions in 'whatsapp_sessions' table
 * 
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase 
 * @param {string} sessionId 
 */
module.exports = async function useSupabaseAuthState(supabase, sessionId) {
    const sessionCache = new Map()
    let cacheLoaded = false

    const loadSessionCache = async ({ force = false } = {}) => {
        if (cacheLoaded && !force) {
            return
        }

        const rows = []
        let page = 0

        while (true) {
            const from = page * SESSION_PRELOAD_PAGE_SIZE
            const to = from + SESSION_PRELOAD_PAGE_SIZE - 1

            const pageRows = await withRetry(`preload session ${sessionId} page ${page + 1}`, async () => {
                const { data, error } = await supabase
                    .from('whatsapp_sessions')
                    .select('key_id, data')
                    .eq('session_id', sessionId)
                    .order('key_id', { ascending: true })
                    .range(from, to)

                if (error) throw error
                return data || []
            })

            rows.push(...pageRows)

            if (pageRows.length < SESSION_PRELOAD_PAGE_SIZE) {
                break
            }

            page += 1
        }

        sessionCache.clear()
        for (const row of rows) {
            try {
                sessionCache.set(row.key_id, JSON.parse(row.data, BufferJSON.reviver))
            } catch (error) {
                console.error(`[SupabaseAuth] Failed to parse cached key ${row.key_id}:`, error)
            }
        }

        cacheLoaded = true
        const pageCount = Math.max(1, page + 1)
        console.log(`[SupabaseAuth] Preloaded ${rows.length} auth row(s) for session ${sessionId} across ${pageCount} page(s)`)
    }

    // Helper to write data to DB
    const writeData = async (data, key) => {
        sessionCache.set(key, data)
        try {
            await withRetry(`save key ${key}`, async () => {
                await supabase
                    .from('whatsapp_sessions')
                    .upsert({
                        session_id: sessionId,
                        key_id: key,
                        data: JSON.stringify(data, BufferJSON.replacer),
                        updated_at: new Date().toISOString()
                    })
                    .throwOnError()
            })
        } catch (error) {
            console.error(`[SupabaseAuth] Failed to save key ${key}:`, error)
        }
    }

    // Helper to read data from DB
    const readData = async (key) => {
        try {
            await loadSessionCache()
            return sessionCache.has(key) ? sessionCache.get(key) : null
        } catch (error) {
            console.error(`[SupabaseAuth] Failed to read key ${key}:`, error)
            throw error
        }
    }

    // Helper to delete data from DB
    const removeData = async (key) => {
        sessionCache.delete(key)
        try {
            await withRetry(`remove key ${key}`, async () => {
                await supabase
                    .from('whatsapp_sessions')
                    .delete()
                    .eq('session_id', sessionId)
                    .eq('key_id', key)
                    .throwOnError()
            })
        } catch (error) {
            console.error(`[SupabaseAuth] Failed to remove key ${key}:`, error)
        }
    }

    // 1. Load Credentials (creds.json)
    await loadSessionCache()
    const creds = sessionCache.get('creds') || initAuthCreds()

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {}
                    await Promise.all(
                        ids.map(async (id) => {
                            const value = await readData(`${type}-${id}`)
                            if (type === 'app-state-sync-key' && value) {
                                data[id] = proto.Message.AppStateSyncKeyData.fromObject(value)
                            } else if (value) {
                                data[id] = value
                            }
                        })
                    )
                    return data
                },
                set: async (data) => {
                    const tasks = []
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id]
                            const key = `${category}-${id}`
                            tasks.push({ value, key })
                        }
                    }

                    // ⭐ OPTIMISATION VPS : Exécution par lots pour éviter les timeouts undici/réseau
                    // Baileys peut générer des centaines de clés à la fois (sync initial).
                    // On limite à 5 requêtes parallèles pour ne pas saturer le pool undici.
                    const BATCH_SIZE = 5
                    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
                        const batch = tasks.slice(i, i + BATCH_SIZE)
                        await Promise.all(
                            batch.map(task =>
                                task.value ? writeData(task.value, task.key) : removeData(task.key)
                            )
                        )
                    }
                },
            },
        },
        saveCreds: async () => {
            await writeData(creds, 'creds')
        },
    }
}
