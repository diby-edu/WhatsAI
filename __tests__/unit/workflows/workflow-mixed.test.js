/**
 * Tests for Mixed Products Workflow (workflow-mixed.js)
 *
 * CRITICAL tests to ensure:
 * - BOTH email AND address are requested when order contains physical AND digital
 * - Correct adaptation based on cart composition
 * - No data is omitted in mixed orders
 */

const { buildMixedWorkflow } = require('../../../src/lib/whatsapp/ai/prompts/workflow-mixed')

describe('Mixed Workflow', () => {
    describe('buildMixedWorkflow()', () => {
        const workflow = buildMixedWorkflow([])

        // ═══════════════════════════════════════════════════════════════
        // STRUCTURE TESTS
        // ═══════════════════════════════════════════════════════════════

        test('should return a non-empty string', () => {
            expect(typeof workflow).toBe('string')
            expect(workflow.length).toBeGreaterThan(100)
        })

        test('should contain all 5 steps', () => {
            expect(workflow).toContain('ÉTAPE 1')
            expect(workflow).toContain('ÉTAPE 2')
            expect(workflow).toContain('ÉTAPE 3')
            expect(workflow).toContain('ÉTAPE 4')
            expect(workflow).toContain('ÉTAPE 5')
        })

        test('should identify as MIXED workflow', () => {
            expect(workflow).toMatch(/MIXTE|MIXED|📦.*💻|💻.*📦/)
        })

        // ═══════════════════════════════════════════════════════════════
        // CRITICAL: MIXED ORDER DATA COLLECTION
        // ═══════════════════════════════════════════════════════════════

        test('CRITICAL: should mention BOTH address AND email for mixed orders', () => {
            // The workflow MUST instruct to ask for both
            expect(workflow).toContain('📍')
            expect(workflow).toContain('📧')
        })

        test('CRITICAL: should contain rule for mixed order requiring BOTH', () => {
            // Must explicitly state that mixed orders need address + email
            expect(workflow.toLowerCase()).toMatch(/adresse.*email|email.*adresse/i)
        })

        test('CRITICAL: should have explicit mixed order example with both fields', () => {
            // The example for mixed order must show both address and email
            const mixedExample = workflow.toLowerCase()
            expect(mixedExample).toMatch(/t-shirt.*office|office.*t-shirt/i)
            // Check that both address (livraison/📍) and email (📧/envoi) appear in the mixed section
            expect(mixedExample).toMatch(/livraison.*à.*:.*\(t-shirt\)/i)
            expect(mixedExample).toMatch(/envoi.*à.*:.*\(office/i)
        })

        test('CRITICAL: should mark missing email in mixed order as ERREUR GRAVE', () => {
            expect(workflow).toMatch(/ERREUR GRAVE|❌.*email/i)
        })

        // ═══════════════════════════════════════════════════════════════
        // ADAPTIVE RULES
        // ═══════════════════════════════════════════════════════════════

        test('should provide physical-only example (no email)', () => {
            expect(workflow.toLowerCase()).toMatch(/physique.*seul|100%.*physique/i)
            // Physical-only should mention NOT asking for email
            expect(workflow).toMatch(/PAS D'EMAIL|pas d'email/i)
        })

        test('should provide digital-only example (no address)', () => {
            expect(workflow.toLowerCase()).toMatch(/numérique.*seul|100%.*numérique/i)
            // Digital-only should mention NOT asking for address
            expect(workflow).toMatch(/PAS D'ADRESSE|pas d'adresse/i)
        })

        test('should provide concrete examples for all 3 cases', () => {
            // 1. Physical only
            expect(workflow).toMatch(/T-Shirt seul|Physique Seul/i)
            // 2. Digital only
            expect(workflow).toMatch(/Office 365 seul|Numérique Seul/i)
            // 3. Mixed
            expect(workflow).toMatch(/T-Shirt.*Office|Mixte/i)
        })

        // ═══════════════════════════════════════════════════════════════
        // PAYMENT LOGIC
        // ═══════════════════════════════════════════════════════════════

        test('should allow COD for physical portion in mixed orders', () => {
            expect(workflow.toLowerCase()).toMatch(/livraison|cod|cash/)
        })

        test('should require online payment for digital portion', () => {
            expect(workflow.toLowerCase()).toMatch(/numérique.*ligne|digital.*online/i)
        })

        // ═══════════════════════════════════════════════════════════════
        // RECAP FINAL - MUST SHOW BOTH IN MIXED
        // ═══════════════════════════════════════════════════════════════

        test('CRITICAL: recap final should show both address and email for mixed', () => {
            // The ÉTAPE 4 (recap) must show both fields in the mixed example
            const recapSection = workflow.substring(workflow.indexOf('ÉTAPE 4'))
            expect(recapSection).toContain('📍')
            expect(recapSection).toContain('📧')
        })

        test('recap should be ADAPTATIF', () => {
            expect(workflow).toMatch(/ADAPTATIF|adaptatif/)
        })

        // ═══════════════════════════════════════════════════════════════
        // CONFIRMATION MESSAGE - MUST SHOW BOTH IN MIXED
        // ═══════════════════════════════════════════════════════════════

        test('CRITICAL: confirmation message should show both for mixed orders', () => {
            // After ÉTAPE 5, the confirmation message should include both
            const confirmSection = workflow.substring(workflow.indexOf('ÉTAPE 5'))
            expect(confirmSection).toContain('📍')
            expect(confirmSection).toContain('📧')
        })

        // ═══════════════════════════════════════════════════════════════
        // ORDER CREATION
        // ═══════════════════════════════════════════════════════════════

        test('should call create_order on confirmation', () => {
            expect(workflow).toContain('create_order')
        })

        // ═══════════════════════════════════════════════════════════════
        // ANTI-CONFUSION RULES
        // ═══════════════════════════════════════════════════════════════

        test('should state unified flow (not parallel conversations)', () => {
            expect(workflow).toMatch(/UN SEUL FLUX|unifié|pas deux conversations/i)
        })
    })
})
