const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys')

/**
 * Custom Auth Adapter for Baileys using Supabase (CommonJS)
 * Stores sessions in 'whatsapp_sessions' table
 * 
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase 
 * @param {string} sessionId 
 */
module.exports = async function useSupabaseAuthState(supabase, sessionId) {

    // Helper to write data to DB
    const writeData = async (data, key) => {
        try {
            await supabase
                .from('whatsapp_sessions')
                .upsert({
                    session_id: sessionId,
                    key_id: key,
                    data: JSON.stringify(data, BufferJSON.replacer),
                    updated_at: new Date().toISOString()
                })
                .throwOnError()
        } catch (error) {
            console.error(`[SupabaseAuth] Failed to save key ${key}:`, error)
        }
    }

    // Helper to read data from DB
    const readData = async (key) => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_sessions')
                .select('data')
                .eq('session_id', sessionId)
                .eq('key_id', key)
                .maybeSingle()

            if (error) throw error
            if (!data) return null

            return JSON.parse(data.data, BufferJSON.reviver)
        } catch (error) {
            console.error(`[SupabaseAuth] Failed to read key ${key}:`, error)
            return null
        }
    }

    // Helper to delete data from DB
    const removeData = async (key) => {
        try {
            await supabase
                .from('whatsapp_sessions')
                .delete()
                .eq('session_id', sessionId)
                .eq('key_id', key)
                .throwOnError()
        } catch (error) {
            console.error(`[SupabaseAuth] Failed to remove key ${key}:`, error)
        }
    }

    // 1. Load Credentials (creds.json)
    const creds = (await readData('creds')) || initAuthCreds()

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
                            if (value) {
                                tasks.push(writeData(value, key))
                            } else {
                                tasks.push(removeData(key))
                            }
                        }
                    }
                    await Promise.all(tasks)
                },
            },
        },
        saveCreds: async () => {
            await writeData(creds, 'creds')
        },
    }
}
