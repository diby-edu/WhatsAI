const { resolveDeliveryFee } = require('../../../src/lib/whatsapp/ai/tools/delivery-fee')

describe('resolveDeliveryFee', () => {
    test('no physical product in the order -> no fee, regardless of agent config', () => {
        const agent = { delivery_fee_mode: 'zones', delivery_zones: { communes: [{ name: 'Cocody', fee: 1000 }] } }
        const result = resolveDeliveryFee(agent, false, { delivery_zone_type: 'abidjan_commune', delivery_commune: 'Cocody' })
        expect(result).toEqual({ fee: 0, note: null, error: null })
    })

    test('delivery_fee_mode "none" (default) -> no fee, backward compatible', () => {
        const agent = { delivery_fee_mode: 'none' }
        const result = resolveDeliveryFee(agent, true, {})
        expect(result).toEqual({ fee: 0, note: null, error: null })
    })

    test('missing delivery_fee_mode on agent -> treated as "none"', () => {
        const agent = {}
        const result = resolveDeliveryFee(agent, true, {})
        expect(result).toEqual({ fee: 0, note: null, error: null })
    })

    test('mode "free" -> zero fee with an informational note', () => {
        const agent = { delivery_fee_mode: 'free' }
        const result = resolveDeliveryFee(agent, true, {})
        expect(result.fee).toBe(0)
        expect(result.note).toBe('Livraison gratuite')
        expect(result.error).toBeNull()
    })

    test('mode "zones" without delivery_zone_type -> validation error, no fee guessed', () => {
        const agent = { delivery_fee_mode: 'zones', delivery_zones: { communes: [{ name: 'Cocody', fee: 1000 }] } }
        const result = resolveDeliveryFee(agent, true, {})
        expect(result.fee).toBe(0)
        expect(result.error).toMatch(/ZONE DE LIVRAISON MANQUANTE/)
    })

    test('abidjan_commune exact match -> commune fee applied', () => {
        const agent = { delivery_fee_mode: 'zones', delivery_zones: { communes: [{ name: 'Cocody', fee: 1000 }, { name: 'Yopougon', fee: 1200 }] } }
        const result = resolveDeliveryFee(agent, true, { delivery_zone_type: 'abidjan_commune', delivery_commune: 'Cocody' })
        expect(result.fee).toBe(1000)
        expect(result.error).toBeNull()
    })

    test('abidjan_commune case-insensitive match', () => {
        const agent = { delivery_fee_mode: 'zones', delivery_zones: { communes: [{ name: 'Cocody', fee: 1000 }] } }
        const result = resolveDeliveryFee(agent, true, { delivery_zone_type: 'abidjan_commune', delivery_commune: 'cocody' })
        expect(result.fee).toBe(1000)
    })

    test('abidjan_commune unknown commune -> validation error, never a guessed fee', () => {
        const agent = { delivery_fee_mode: 'zones', delivery_zones: { communes: [{ name: 'Cocody', fee: 1000 }] } }
        const result = resolveDeliveryFee(agent, true, { delivery_zone_type: 'abidjan_commune', delivery_commune: 'Carrefour CGK' })
        expect(result.fee).toBe(0)
        expect(result.error).toMatch(/COMMUNE NON RECONNUE/)
        expect(result.hint).toMatch(/Cocody/)
    })

    test('quartier override wins over commune default fee (Cocody/Angré)', () => {
        const agent = {
            delivery_fee_mode: 'zones',
            delivery_zones: {
                communes: [{ name: 'Cocody', fee: 1000, quartiers: [{ name: 'Angré', fee: 1300 }] }]
            }
        }
        const result = resolveDeliveryFee(agent, true, {
            delivery_zone_type: 'abidjan_commune',
            delivery_commune: 'Cocody',
            delivery_quartier: 'Angré'
        })
        expect(result.fee).toBe(1300)
        expect(result.note).toBe('Livraison (Cocody - Angré)')
    })

    test('quartier not found within commune -> falls back to commune fee (no error)', () => {
        const agent = {
            delivery_fee_mode: 'zones',
            delivery_zones: {
                communes: [{ name: 'Cocody', fee: 1000, quartiers: [{ name: 'Angré', fee: 1300 }] }]
            }
        }
        const result = resolveDeliveryFee(agent, true, {
            delivery_zone_type: 'abidjan_commune',
            delivery_commune: 'Cocody',
            delivery_quartier: 'Riviera'
        })
        expect(result.fee).toBe(1000)
        expect(result.error).toBeNull()
    })

    test('hors_abidjan with no cities configured -> zero fee, generic note (never blocks the order)', () => {
        const agent = { delivery_fee_mode: 'zones', delivery_zones: { hors_abidjan: [] } }
        const result = resolveDeliveryFee(agent, true, { delivery_zone_type: 'hors_abidjan' })
        expect(result.fee).toBe(0)
        expect(result.error).toBeNull()
        expect(result.note).toMatch(/confirmer/)
    })

    test('hors_abidjan with cities configured but no delivery_city -> validation error, no fee guessed', () => {
        const agent = { delivery_fee_mode: 'zones', delivery_zones: { hors_abidjan: [{ name: 'Bouaké', fee: 2500 }] } }
        const result = resolveDeliveryFee(agent, true, { delivery_zone_type: 'hors_abidjan' })
        expect(result.fee).toBe(0)
        expect(result.error).toMatch(/VILLE MANQUANTE/)
    })

    test('hors_abidjan exact city match -> city fee applied', () => {
        const agent = { delivery_fee_mode: 'zones', delivery_zones: { hors_abidjan: [{ name: 'Bouaké', fee: 2500 }, { name: 'Yamoussoukro', fee: 3000 }] } }
        const result = resolveDeliveryFee(agent, true, { delivery_zone_type: 'hors_abidjan', delivery_city: 'Bouaké' })
        expect(result.fee).toBe(2500)
        expect(result.error).toBeNull()
    })

    test('hors_abidjan unknown city -> validation error, never a guessed fee', () => {
        const agent = { delivery_fee_mode: 'zones', delivery_zones: { hors_abidjan: [{ name: 'Bouaké', fee: 2500 }] } }
        const result = resolveDeliveryFee(agent, true, { delivery_zone_type: 'hors_abidjan', delivery_city: 'San Pedro' })
        expect(result.fee).toBe(0)
        expect(result.error).toMatch(/VILLE NON RECONNUE/)
        expect(result.hint).toMatch(/Bouaké/)
    })

    test('international with no countries configured -> zero fee, default quote note', () => {
        const agent = { delivery_fee_mode: 'zones', delivery_zones: {} }
        const result = resolveDeliveryFee(agent, true, { delivery_zone_type: 'international' })
        expect(result.fee).toBe(0)
        expect(result.note).toMatch(/devis/)
    })

    test('international exact country match -> country fee applied', () => {
        const agent = { delivery_fee_mode: 'zones', delivery_zones: { international: [{ name: 'France', fee: 15000 }] } }
        const result = resolveDeliveryFee(agent, true, { delivery_zone_type: 'international', delivery_country: 'France' })
        expect(result.fee).toBe(15000)
        expect(result.error).toBeNull()
    })

    test('international unknown country -> validation error, never a guessed fee', () => {
        const agent = { delivery_fee_mode: 'zones', delivery_zones: { international: [{ name: 'France', fee: 15000 }] } }
        const result = resolveDeliveryFee(agent, true, { delivery_zone_type: 'international', delivery_country: 'Belgique' })
        expect(result.fee).toBe(0)
        expect(result.error).toMatch(/PAYS NON RECONNU/)
        expect(result.hint).toMatch(/France/)
    })
})
