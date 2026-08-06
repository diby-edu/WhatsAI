/**
 * Tests for Hotel/Stay Lead-Only Workflow (workflow-service-stay-lead-only.js)
 */

const { buildLeadOnlyStayWorkflow } = require('../../../src/lib/whatsapp/ai/prompts/workflow-service-stay-lead-only')

describe('Hotel/Stay Lead-Only Workflow', () => {
    const workflow = buildLeadOnlyStayWorkflow({ lead_collect_fields: ['name', 'phone'] })

    test('should return a non-empty string', () => {
        expect(typeof workflow).toBe('string')
        expect(workflow.length).toBeGreaterThan(100)
    })

    test('should never call create_booking', () => {
        expect(workflow).toMatch(/Ne JAMAIS appeler create_booking/i)
        expect(workflow).not.toMatch(/Appeler create_booking IMMEDIATEMENT/i)
    })

    test('should explicitly forbid delivery/pickup wording (hotel-specific vocabulary)', () => {
        expect(workflow).toMatch(/INTERDIT ABSOLU.*ne jamais mentionner "livraison"/i)
        expect(workflow).toMatch(/dates de séjour|arrivée.*départ/i)
    })

    test('should ask for number of travelers', () => {
        expect(workflow).toMatch(/Combien de personnes/i)
    })

    test('should never offer online payment', () => {
        expect(workflow).toMatch(/Ne JAMAIS proposer un paiement en ligne/i)
    })

    test('should always instruct capturing spontaneous client details via lead_notes', () => {
        expect(workflow).toMatch(/lead_notes/i)
        expect(workflow).toMatch(/FILET DE SÉCURITÉ/i)
    })

    test('should never ask for country code separately (phone formatting bug fix)', () => {
        expect(workflow).toMatch(/Ne demande JAMAIS l'indicatif pays séparément/i)
    })
})
