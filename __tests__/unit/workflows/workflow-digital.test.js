/**
 * Tests for Digital Products Workflow (workflow-type-digital.js)
 *
 * Critical tests to ensure:
 * - Email is ALWAYS requested for digital products
 * - Address is NEVER requested for digital products
 * - Payment is ALWAYS online (no COD option)
 */

const { buildDigitalWorkflow } = require('../../../src/lib/whatsapp/ai/prompts/workflow-type-digital')

describe('Digital Workflow', () => {
    describe('buildDigitalWorkflow()', () => {
        const workflow = buildDigitalWorkflow([])
        const workflowWithOrders = buildDigitalWorkflow([{
            customer_name: 'Jane Doe',
            customer_phone: '+22507111111'
        }])

        // ═══════════════════════════════════════════════════════════════
        // STRUCTURE TESTS
        // ═══════════════════════════════════════════════════════════════

        test('should return a non-empty string', () => {
            expect(typeof workflow).toBe('string')
            expect(workflow.length).toBeGreaterThan(100)
        })

        test('should contain all 7 steps', () => {
            expect(workflow).toContain('ÉTAPE 1')
            expect(workflow).toContain('ÉTAPE 2')
            expect(workflow).toContain('ÉTAPE 3')
            expect(workflow).toContain('ÉTAPE 4')
            expect(workflow).toContain('ÉTAPE 5')
            expect(workflow).toContain('ÉTAPE 6')
            expect(workflow).toContain('ÉTAPE 7')
        })

        test('should identify as DIGITAL/NUMÉRIQUE workflow', () => {
            expect(workflow).toMatch(/NUMÉRIQUE|DIGITAL|💻/)
        })

        // ═══════════════════════════════════════════════════════════════
        // CRITICAL: EMAIL COLLECTION
        // ═══════════════════════════════════════════════════════════════

        test('CRITICAL: should request EMAIL', () => {
            expect(workflow.toLowerCase()).toMatch(/email|📧|e-mail/)
        })

        test('CRITICAL: should mark email as OBLIGATOIRE', () => {
            expect(workflow.toLowerCase()).toMatch(/email.*obligatoire|obligatoire.*email|📧.*obligatoire/i)
        })

        test('CRITICAL: should include email emoji 📧', () => {
            expect(workflow).toContain('📧')
        })

        // ═══════════════════════════════════════════════════════════════
        // CRITICAL: NO ADDRESS
        // ═══════════════════════════════════════════════════════════════

        test('CRITICAL: should NOT request physical address', () => {
            // Should explicitly say NO address
            expect(workflow.toLowerCase()).toMatch(/pas.*adresse|🚫.*adresse|ne.*demande.*pas.*adresse/i)
        })

        test('should contain warning about no delivery address', () => {
            expect(workflow.toLowerCase()).toMatch(/pas.*livraison|virtuel|numérique/)
        })

        // ═══════════════════════════════════════════════════════════════
        // PAYMENT - ONLINE ONLY
        // ═══════════════════════════════════════════════════════════════

        test('CRITICAL: payment should be online only', () => {
            expect(workflow.toLowerCase()).toMatch(/en ligne.*obligatoire|online|paiement.*ligne/)
        })

        test('should NOT offer cash on delivery option', () => {
            // Digital workflow should explicitly state payment is automatic/online
            // It should NOT ask "livraison ou en ligne?" as an option
            expect(workflow.toLowerCase()).toMatch(/🚫.*ne pose pas.*question|automatique|toujours.*online/i)
        })

        test('should specify payment_method as online', () => {
            expect(workflow).toMatch(/payment_method.*online|'online'/)
        })

        // ═══════════════════════════════════════════════════════════════
        // ORDER CREATION
        // ═══════════════════════════════════════════════════════════════

        test('should call create_order on confirmation', () => {
            expect(workflow).toContain('create_order')
        })

        test('should pass email to create_order', () => {
            expect(workflow).toMatch(/create_order.*email|email.*create_order/i)
        })

        // ═══════════════════════════════════════════════════════════════
        // KNOWN CLIENT HANDLING
        // ═══════════════════════════════════════════════════════════════

        test('should still ask for email even for known clients', () => {
            // Even known clients need to provide email for digital products
            expect(workflowWithOrders.toLowerCase()).toMatch(/email|📧/)
        })
    })
})
