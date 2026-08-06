/**
 * Tests for Restaurant Lead-Only Workflow (workflow-service-restaurant-lead-only.js)
 */

const { buildLeadOnlyRestaurantWorkflow } = require('../../../src/lib/whatsapp/ai/prompts/workflow-service-restaurant-lead-only')

describe('Restaurant Lead-Only Workflow', () => {
    const workflow = buildLeadOnlyRestaurantWorkflow({ lead_collect_fields: ['name', 'phone'] })

    test('should return a non-empty string', () => {
        expect(typeof workflow).toBe('string')
        expect(workflow.length).toBeGreaterThan(100)
    })

    test('should never call create_restaurant_checkout or create_order', () => {
        expect(workflow).toMatch(/Ne JAMAIS appeler create_restaurant_checkout/i)
        expect(workflow).not.toMatch(/Appelle IMMÉDIATEMENT create_restaurant_checkout/i)
    })

    test('should never offer online payment', () => {
        expect(workflow).toMatch(/Ne JAMAIS proposer un paiement en ligne/i)
    })

    test('should ask for dine-in/takeaway/delivery instead of physical delivery-only wording', () => {
        expect(workflow).toMatch(/sur place, à emporter, ou en livraison/i)
    })

    test('should always instruct capturing spontaneous client details via lead_notes', () => {
        expect(workflow).toMatch(/lead_notes/i)
        expect(workflow).toMatch(/FILET DE SÉCURITÉ/i)
    })

    test('should never ask for country code separately (phone formatting bug fix)', () => {
        expect(workflow).toMatch(/Ne demande JAMAIS l'indicatif pays séparément/i)
    })

    test('should reflect delivery zones when configured', () => {
        const withZones = buildLeadOnlyRestaurantWorkflow({
            lead_collect_fields: ['name', 'phone'],
            delivery_fee_mode: 'zones',
            delivery_zones: { communes: [{ name: 'Cocody', fee: 1500 }] },
        })
        expect(withZones).toMatch(/Cocody/i)
        expect(withZones).toMatch(/1500 FCFA/i)
    })
})
