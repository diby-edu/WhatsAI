/**
 * Tests for Lead-Only Workflow (workflow-lead-only.js)
 *
 * Critical tests to ensure:
 * - No spontaneous client detail is ever lost, even when "notes" isn't a configured field
 * - create_order / online payment are never suggested in this mode
 * - Configured fields are reflected in the collection step
 */

const { buildLeadOnlyWorkflow } = require('../../../src/lib/whatsapp/ai/prompts/workflow-lead-only')

describe('Lead-Only Workflow', () => {
    describe('buildLeadOnlyWorkflow()', () => {
        const workflowMinimal = buildLeadOnlyWorkflow({ lead_collect_fields: ['name', 'phone'] })

        test('should return a non-empty string', () => {
            expect(typeof workflowMinimal).toBe('string')
            expect(workflowMinimal.length).toBeGreaterThan(100)
        })

        test('should contain all 5 steps', () => {
            expect(workflowMinimal).toContain('ÉTAPE 1')
            expect(workflowMinimal).toContain('ÉTAPE 2')
            expect(workflowMinimal).toContain('ÉTAPE 3')
            expect(workflowMinimal).toContain('ÉTAPE 4')
            expect(workflowMinimal).toContain('ÉTAPE 5')
        })

        test('should never call create_order or offer online payment', () => {
            expect(workflowMinimal).toMatch(/Ne JAMAIS appeler create_order/i)
            expect(workflowMinimal).toMatch(/Ne JAMAIS proposer un paiement en ligne/i)
        })

        test('should always instruct capturing spontaneous client details via lead_notes, even when "notes" is not configured', () => {
            // lead_collect_fields deliberately excludes 'notes' -> the AI must not be told to actively ask for it
            expect(workflowMinimal).not.toMatch(/informations complémentaires/i)
            // ...but the lead_notes safety net must still be present regardless
            expect(workflowMinimal).toMatch(/lead_notes/i)
            expect(workflowMinimal).toMatch(/FILET DE SÉCURITÉ/i)
            expect(workflowMinimal).toMatch(/ne perds JAMAIS une information/i)
        })

        test('should reflect configured standard fields in the collection step', () => {
            const workflow = buildLeadOnlyWorkflow({ lead_collect_fields: ['name', 'phone', 'email'] })
            expect(workflow).toMatch(/prénom\/nom/i)
            expect(workflow).toMatch(/numéro de téléphone/i)
            expect(workflow).toMatch(/email/i)
        })

        test('should force delivery address and skip pickup mention when is_online_only is true', () => {
            const workflow = buildLeadOnlyWorkflow({ lead_collect_fields: ['name', 'phone'], is_online_only: true })
            expect(workflow).toMatch(/ADRESSE DE LIVRAISON/i)
            expect(workflow).not.toMatch(/Vous passez en boutique ou vous souhaitez être livré/i)
        })

        test('should offer pickup vs delivery choice when is_online_only is false', () => {
            const workflow = buildLeadOnlyWorkflow({ lead_collect_fields: ['name', 'phone'], is_online_only: false })
            expect(workflow).toMatch(/Vous passez en boutique ou vous souhaitez être livré/i)
        })
    })
})
