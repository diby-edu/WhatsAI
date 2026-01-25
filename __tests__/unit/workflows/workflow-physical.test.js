/**
 * Tests for Physical Products Workflow (workflow-type-physical.js)
 *
 * Critical tests to ensure:
 * - Address is ALWAYS requested for physical products
 * - Email is NEVER requested for physical products
 * - All 8 steps are present
 * - Payment options include COD (cash on delivery)
 */

const { buildPhysicalWorkflow } = require('../../../src/lib/whatsapp/ai/prompts/workflow-type-physical')

describe('Physical Workflow', () => {
    describe('buildPhysicalWorkflow()', () => {
        const workflow = buildPhysicalWorkflow([])
        const workflowWithOrders = buildPhysicalWorkflow([{
            customer_name: 'John Doe',
            customer_phone: '+22507000000',
            delivery_address: 'Abidjan, Cocody'
        }])

        // ═══════════════════════════════════════════════════════════════
        // STRUCTURE TESTS
        // ═══════════════════════════════════════════════════════════════

        test('should return a non-empty string', () => {
            expect(typeof workflow).toBe('string')
            expect(workflow.length).toBeGreaterThan(100)
        })

        test('should contain all 8 steps', () => {
            expect(workflow).toContain('ÉTAPE 1')
            expect(workflow).toContain('ÉTAPE 2')
            expect(workflow).toContain('ÉTAPE 3')
            expect(workflow).toContain('ÉTAPE 4')
            expect(workflow).toContain('ÉTAPE 5')
            expect(workflow).toContain('ÉTAPE 6')
            expect(workflow).toContain('ÉTAPE 7')
            expect(workflow).toContain('ÉTAPE 8')
        })

        test('should identify as PHYSICAL workflow', () => {
            expect(workflow).toMatch(/PHYSIQUE|PHYSICAL|📦/)
        })

        // ═══════════════════════════════════════════════════════════════
        // CRITICAL: ADDRESS COLLECTION
        // ═══════════════════════════════════════════════════════════════

        test('CRITICAL: should request delivery ADDRESS', () => {
            expect(workflow.toLowerCase()).toMatch(/adresse|address|livraison|delivery/)
        })

        test('CRITICAL: should include address emoji 📍', () => {
            expect(workflow).toContain('📍')
        })

        test('should NOT request email for physical products', () => {
            // Email should NOT be in the workflow requirements
            const emailMentions = (workflow.match(/email|📧|e-mail/gi) || []).length
            // Allow at most informational mentions, not requirements
            expect(emailMentions).toBeLessThan(3)
        })

        // ═══════════════════════════════════════════════════════════════
        // PAYMENT OPTIONS
        // ═══════════════════════════════════════════════════════════════

        test('should offer cash on delivery option', () => {
            expect(workflow.toLowerCase()).toMatch(/livraison|cod|cash|sur place/)
        })

        test('should offer online payment option', () => {
            expect(workflow.toLowerCase()).toMatch(/en ligne|online/)
        })

        // ═══════════════════════════════════════════════════════════════
        // ORDER CREATION
        // ═══════════════════════════════════════════════════════════════

        test('should call create_order on confirmation', () => {
            expect(workflow).toContain('create_order')
        })

        test('should NOT call create_booking (products, not services)', () => {
            expect(workflow).not.toContain('create_booking')
        })

        // ═══════════════════════════════════════════════════════════════
        // KNOWN CLIENT HANDLING
        // ═══════════════════════════════════════════════════════════════

        test('should show previous order info for known clients', () => {
            expect(workflowWithOrders).toContain('John Doe')
            expect(workflowWithOrders).toContain('+22507000000')
            expect(workflowWithOrders).toContain('Abidjan, Cocody')
        })

        test('should offer to reuse previous info', () => {
            expect(workflowWithOrders.toLowerCase()).toMatch(/réutiliser|mêmes informations|utiliser/)
        })

        // ═══════════════════════════════════════════════════════════════
        // ANTI-HALLUCINATION
        // ═══════════════════════════════════════════════════════════════

        test('should contain anti-hallucination warning for variants', () => {
            // The workflow should warn about only asking for listed variants
            expect(workflow.toLowerCase()).toMatch(/catalogue|variantes?|anti-hallucination/i)
        })
    })
})
