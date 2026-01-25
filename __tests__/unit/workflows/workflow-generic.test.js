/**
 * Tests for Generic Workflow Orchestrator (workflow-generic.js)
 *
 * Critical tests to ensure:
 * - Correct dispatch to Physical/Digital/Mixed workflows
 * - Proper product type detection
 */

const { buildGenericWorkflow } = require('../../../src/lib/whatsapp/ai/prompts/workflow-generic')

describe('Generic Workflow Orchestrator', () => {
    describe('buildGenericWorkflow()', () => {

        // ═══════════════════════════════════════════════════════════════
        // DISPATCH TESTS - PHYSICAL ONLY
        // ═══════════════════════════════════════════════════════════════

        test('should dispatch to PHYSICAL workflow when all products are physical', () => {
            const products = [
                { name: 'T-Shirt', product_type: 'physical' },
                { name: 'Bougies', product_type: 'physical' }
            ]
            const workflow = buildGenericWorkflow([], products)

            expect(workflow).toMatch(/PHYSIQUE|PHYSICAL|📦/)
            expect(workflow).not.toMatch(/NUMÉRIQUE.*SEUL|DIGITAL.*ONLY/i)
        })

        test('should treat "good" as physical type', () => {
            const products = [
                { name: 'Product', product_type: 'good' }
            ]
            const workflow = buildGenericWorkflow([], products)

            expect(workflow).toMatch(/PHYSIQUE|📦/)
        })

        test('should treat undefined product_type as physical (default)', () => {
            const products = [
                { name: 'Product' } // No product_type
            ]
            const workflow = buildGenericWorkflow([], products)

            expect(workflow).toMatch(/PHYSIQUE|📦/)
        })

        test('should treat "product" type as physical', () => {
            const products = [
                { name: 'Product', product_type: 'product' }
            ]
            const workflow = buildGenericWorkflow([], products)

            expect(workflow).toMatch(/PHYSIQUE|📦/)
        })

        // ═══════════════════════════════════════════════════════════════
        // DISPATCH TESTS - DIGITAL ONLY
        // ═══════════════════════════════════════════════════════════════

        test('should dispatch to DIGITAL workflow when all products are digital', () => {
            const products = [
                { name: 'Office 365', product_type: 'digital' },
                { name: 'Ebook', product_type: 'digital' }
            ]
            const workflow = buildGenericWorkflow([], products)

            expect(workflow).toMatch(/NUMÉRIQUE|DIGITAL|💻/)
            // Should contain digital-specific rules
            expect(workflow.toLowerCase()).toMatch(/email|📧/)
            expect(workflow.toLowerCase()).toMatch(/pas.*adresse|🚫.*adresse/i)
        })

        test('should treat "virtual" as digital type', () => {
            const products = [
                { name: 'License', product_type: 'virtual' }
            ]
            const workflow = buildGenericWorkflow([], products)

            expect(workflow).toMatch(/NUMÉRIQUE|DIGITAL|💻/)
        })

        // ═══════════════════════════════════════════════════════════════
        // DISPATCH TESTS - MIXED
        // ═══════════════════════════════════════════════════════════════

        test('CRITICAL: should dispatch to MIXED workflow when both physical and digital', () => {
            const products = [
                { name: 'T-Shirt', product_type: 'physical' },
                { name: 'Office 365', product_type: 'digital' }
            ]
            const workflow = buildGenericWorkflow([], products)

            expect(workflow).toMatch(/MIXTE|MIXED/i)
            // Mixed workflow must mention both
            expect(workflow).toContain('📦')
            expect(workflow).toContain('💻')
        })

        test('should handle mixed with "good" and "virtual" types', () => {
            const products = [
                { name: 'Product', product_type: 'good' },
                { name: 'License', product_type: 'virtual' }
            ]
            const workflow = buildGenericWorkflow([], products)

            expect(workflow).toMatch(/MIXTE|MIXED/i)
        })

        test('should handle mixed with undefined (physical) and digital', () => {
            const products = [
                { name: 'Product' }, // undefined = physical
                { name: 'License', product_type: 'digital' }
            ]
            const workflow = buildGenericWorkflow([], products)

            expect(workflow).toMatch(/MIXTE|MIXED/i)
        })

        // ═══════════════════════════════════════════════════════════════
        // EDGE CASES
        // ═══════════════════════════════════════════════════════════════

        test('should fallback to PHYSICAL when no products', () => {
            const workflow = buildGenericWorkflow([], [])

            expect(workflow).toMatch(/PHYSIQUE|📦/)
        })

        test('should fallback to PHYSICAL when products is null', () => {
            const workflow = buildGenericWorkflow([], null)

            expect(workflow).toMatch(/PHYSIQUE|📦/)
        })

        test('should fallback to PHYSICAL when products is undefined', () => {
            const workflow = buildGenericWorkflow([])

            expect(workflow).toMatch(/PHYSIQUE|📦/)
        })

        // ═══════════════════════════════════════════════════════════════
        // SERVICE PRODUCTS SHOULD BE IGNORED
        // ═══════════════════════════════════════════════════════════════

        test('should NOT treat services as physical or digital (handled by engines)', () => {
            // Services are handled by STAY/TABLE/SLOT/RENTAL engines, not generic
            const products = [
                { name: 'Hotel Room', product_type: 'service', service_subtype: 'hotel' }
            ]
            const workflow = buildGenericWorkflow([], products)

            // When only services, fallback to physical (services handled elsewhere)
            expect(workflow).toMatch(/PHYSIQUE|📦/)
        })

        test('should treat mixed physical + service as physical only', () => {
            const products = [
                { name: 'T-Shirt', product_type: 'physical' },
                { name: 'Massage', product_type: 'service', service_subtype: 'slot' }
            ]
            const workflow = buildGenericWorkflow([], products)

            // Services are filtered out, so this is just physical
            expect(workflow).toMatch(/PHYSIQUE|📦/)
            expect(workflow).not.toMatch(/MIXTE/i)
        })
    })
})
