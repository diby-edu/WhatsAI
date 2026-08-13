const mockNotify = jest.fn(async () => null)

jest.mock('../../../src/lib/notifications/notify', () => ({
    notify: (...args) => mockNotify(...args),
}))

const { handleCaptureLead } = require('../../../src/lib/whatsapp/ai/tools/tool-capture-lead')

function createSupabase({ metadata = {}, existingLeadId = null, existingLeadCreatedAt = null } = {}) {
    let insertedRow = null
    let updatedRow = null

    // Le lead existant n'est retenu que s'il appartient au cycle courant. `gte` reproduit le
    // filtre `created_at >= session_anchor_at` posé par capture_lead : sans lui, une seconde
    // demande passée après le récap final écraserait la première (voir les tests de cycle).
    const matchesCycle = (anchor) =>
        !anchor || !existingLeadCreatedAt || new Date(existingLeadCreatedAt) >= new Date(anchor)

    const leadLookupResult = (anchor) => ({
        data: existingLeadId && matchesCycle(anchor) ? { id: existingLeadId } : null,
        error: null,
    })

    const supabase = {
        from: jest.fn((table) => {
            if (table === 'agents') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            single: jest.fn(async () => ({
                                data: { user_id: 'user-1', name: 'Agent Test' },
                                error: null,
                            })),
                        })),
                    })),
                }
            }
            if (table === 'conversations') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            single: jest.fn(async () => ({ data: { metadata }, error: null })),
                        })),
                    })),
                }
            }
            if (table === 'leads') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            maybeSingle: jest.fn(async () => leadLookupResult(null)),
                            gte: jest.fn((_col, anchor) => ({
                                maybeSingle: jest.fn(async () => leadLookupResult(anchor)),
                            })),
                        })),
                    })),
                    insert: jest.fn(async (row) => {
                        insertedRow = row
                        return { error: null }
                    }),
                    update: jest.fn((row) => {
                        updatedRow = row
                        return { eq: jest.fn(async () => ({ error: null })) }
                    }),
                }
            }
            throw new Error(`Unexpected table: ${table}`)
        }),
    }

    return { supabase, getInsertedRow: () => insertedRow, getUpdatedRow: () => updatedRow }
}

describe('tool-capture-lead', () => {
    beforeEach(() => {
        mockNotify.mockClear()
    })

    test("fusionne lead_instruction_answer dans lead_notes quand l'IA ne l'a pas mis (régression réelle)", async () => {
        const { supabase, getInsertedRow } = createSupabase({
            metadata: { lead_instruction_answer: 'après demain avant 10h' },
        })

        await handleCaptureLead(
            { lead_name: 'Kiné Fatou', lead_phone: '0856990879', interest: '15 sac bleu, 5 goube rouge/bleu' },
            'agent-1', '+2250000000', 'conv-1', supabase
        )

        expect(getInsertedRow().lead_notes).toBe('après demain avant 10h')
    })

    test("ne duplique pas l'instruction si l'IA l'a déjà incluse dans lead_notes", async () => {
        const { supabase, getInsertedRow } = createSupabase({
            metadata: { lead_instruction_answer: 'après demain avant 10h' },
        })

        await handleCaptureLead(
            { lead_notes: 'Livraison après demain avant 10h' },
            'agent-1', '+2250000000', 'conv-1', supabase
        )

        expect(getInsertedRow().lead_notes).toBe('Livraison après demain avant 10h')
    })

    test("concatène avec un point-virgule si l'IA a rempli lead_notes avec autre chose", async () => {
        const { supabase, getInsertedRow } = createSupabase({
            metadata: { lead_instruction_answer: 'après demain avant 10h' },
        })

        await handleCaptureLead(
            { lead_notes: 'Allergique aux emballages plastique' },
            'agent-1', '+2250000000', 'conv-1', supabase
        )

        expect(getInsertedRow().lead_notes).toBe('Allergique aux emballages plastique; après demain avant 10h')
    })

    test('laisse lead_notes inchangé (y compris null) sans instruction en metadata', async () => {
        const { supabase, getInsertedRow } = createSupabase({ metadata: {} })

        await handleCaptureLead({ lead_notes: null }, 'agent-1', '+2250000000', 'conv-1', supabase)

        expect(getInsertedRow().lead_notes).toBeNull()
    })

    test('total/frais/articles proviennent toujours de lead_cart, pas des args', async () => {
        const { supabase, getInsertedRow } = createSupabase({
            metadata: {
                lead_cart: { total: 206500, deliveryFee: 2000, items: [{ product_name: 'sac enfant', quantity: 15 }] },
                last_location_link: 'https://maps.example/xyz',
            },
        })

        await handleCaptureLead({}, 'agent-1', '+2250000000', 'conv-1', supabase)

        const row = getInsertedRow()
        expect(row.estimated_total).toBe(206500)
        expect(row.delivery_fee).toBe(2000)
        expect(row.location_link).toBe('https://maps.example/xyz')
    })

    test("régression réelle : préfère le total/frais réellement montrés au client (lead_last_seen_totals) quand lead_cart est périmé", async () => {
        const { supabase, getInsertedRow } = createSupabase({
            metadata: {
                // lead_cart périmé : dernier appel preview_cart AVANT l'ajout de la livraison
                lead_cart: { total: 204500, deliveryFee: null, items: [{ product_name: 'sac enfant', quantity: 15 }] },
                // mais le dernier récap envoyé au client montrait bien la livraison ajoutée
                lead_last_seen_totals: { total: 206500, deliveryFee: 2000 },
            },
        })

        await handleCaptureLead({}, 'agent-1', '+2250000000', 'conv-1', supabase)

        const row = getInsertedRow()
        expect(row.estimated_total).toBe(206500)
        expect(row.delivery_fee).toBe(2000)
        // items reste sourcé de lead_cart (seule source structurée disponible)
        expect(row.items).toEqual([{ product_name: 'sac enfant', quantity: 15 }])
    })

    test("régression trouvée en revue de code : un récap qui ne répète pas la ligne livraison ne doit jamais effacer un frais de livraison déjà connu", async () => {
        const { supabase, getInsertedRow } = createSupabase({
            metadata: {
                lead_cart: { total: 206500, deliveryFee: 2000, items: [] },
                // Un message ultérieur ne montrant que le TOTAL (ex: confirmation courte),
                // sans répéter "Frais de livraison" — ne doit PAS être interprété comme
                // "plus de livraison", juste comme une ligne non répétée.
                lead_last_seen_totals: { total: 206500, deliveryFee: null },
            },
        })

        await handleCaptureLead({}, 'agent-1', '+2250000000', 'conv-1', supabase)

        const row = getInsertedRow()
        expect(row.estimated_total).toBe(206500)
        expect(row.delivery_fee).toBe(2000)
    })

    test('retombe sur lead_cart quand aucun récap avec TOTAL n\'a encore été vu', async () => {
        const { supabase, getInsertedRow } = createSupabase({
            metadata: {
                lead_cart: { total: 75000, deliveryFee: null, items: [] },
                lead_last_seen_totals: null,
            },
        })

        await handleCaptureLead({}, 'agent-1', '+2250000000', 'conv-1', supabase)

        expect(getInsertedRow().estimated_total).toBe(75000)
    })

    test('met à jour (pas insère) un lead existant pour la même conversation', async () => {
        const { supabase, getUpdatedRow } = createSupabase({
            metadata: { lead_instruction_answer: 'livrer avant 10h' },
            existingLeadId: 'lead-existing-1',
        })

        await handleCaptureLead({ lead_name: 'Koffi' }, 'agent-1', '+2250000000', 'conv-1', supabase)

        expect(getUpdatedRow().lead_notes).toBe('livrer avant 10h')
        expect(mockNotify).not.toHaveBeenCalled()
    })
})

/**
 * Identité du lead : une par CYCLE, pas une par conversation.
 *
 * Le marchand a demandé qu'après le récap final, une nouvelle demande du même client devienne
 * un lead SÉPARÉ. Avec l'ancienne règle (un lead par conversation), la seconde demande
 * écrasait purement et simplement la première : « 5 goube enfant Rouge / 47 000 » devenait
 * « 3 sac enfant Noir / 23 000 », sans trace ni alerte, et le marchand rappelait le client au
 * sujet de la mauvaise commande.
 *
 * La clôture repose `session_anchor_at` (message.js), qui borne donc le cycle courant.
 */
describe('tool-capture-lead — un lead par cycle', () => {
    beforeEach(() => { mockNotify.mockClear() })

    test('un lead du cycle courant est mis à jour, pas dupliqué', async () => {
        const { supabase, getInsertedRow, getUpdatedRow } = createSupabase({
            metadata: { session_anchor_at: '2026-08-13T10:00:00.000Z' },
            existingLeadId: 'lead-1',
            existingLeadCreatedAt: '2026-08-13T10:05:00.000Z', // après l'ancre → même cycle
        })

        await handleCaptureLead(
            { lead_name: 'Simone Ehivet', lead_phone: '5478986431' },
            'agent-1', '+2250000000', 'conv-1', supabase
        )

        expect(getUpdatedRow()).not.toBeNull()
        expect(getInsertedRow()).toBeNull()
    })

    test('un lead d\'un cycle précédent n\'est jamais écrasé : nouveau lead créé', async () => {
        const { supabase, getInsertedRow, getUpdatedRow } = createSupabase({
            metadata: { session_anchor_at: '2026-08-13T10:00:00.000Z' },
            existingLeadId: 'lead-1',
            existingLeadCreatedAt: '2026-08-13T09:30:00.000Z', // avant l'ancre → cycle clos
        })

        await handleCaptureLead(
            { lead_name: 'Simone Ehivet', lead_phone: '5478986431', interest: '3 sac enfant Noir' },
            'agent-1', '+2250000000', 'conv-1', supabase
        )

        expect(getUpdatedRow()).toBeNull()
        expect(getInsertedRow()).not.toBeNull()
        expect(getInsertedRow().interest).toBe('3 sac enfant Noir')
        // Un nouveau lead notifie le marchand ; une simple mise à jour, non.
        expect(mockNotify).toHaveBeenCalledTimes(1)
    })

    // Conversations antérieures à cette mécanique : aucune ancre, comportement d'origine.
    test('sans ancre de cycle, le comportement historique est conservé', async () => {
        const { supabase, getInsertedRow, getUpdatedRow } = createSupabase({
            existingLeadId: 'lead-1',
            existingLeadCreatedAt: '2026-01-01T00:00:00.000Z',
        })

        await handleCaptureLead(
            { lead_name: 'Simone Ehivet', lead_phone: '5478986431' },
            'agent-1', '+2250000000', 'conv-1', supabase
        )

        expect(getUpdatedRow()).not.toBeNull()
        expect(getInsertedRow()).toBeNull()
    })
})
