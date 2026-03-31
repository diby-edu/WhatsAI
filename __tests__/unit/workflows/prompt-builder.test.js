/**
 * Tests for Prompt Builder Orchestrator (prompt-builder.js)
 *
 * Critical tests to ensure:
 * - Correct engine selection based on product types
 * - Proper assembly of all sections
 * - Service engine mapping works correctly
 */

const { buildAdaptiveSystemPrompt } = require('../../../src/lib/whatsapp/ai/prompt-builder')

describe('Prompt Builder', () => {
    // Mock agent data
    const mockAgent = {
        name: 'Test Shop',
        language: 'français',
        use_emojis: true,
        business_address: 'Abidjan, Cocody',
        business_hours: { lundi: '9h-18h' }
    }

    const mockOrders = []
    const mockDocs = []
    const currency = 'FCFA'
    const gpsLink = 'https://maps.google.com/test'
    const formattedHours = 'Lundi: 9h-18h'

    // ═══════════════════════════════════════════════════════════════
    // BASIC STRUCTURE TESTS
    // ═══════════════════════════════════════════════════════════════

    describe('Basic Structure', () => {
        test('should return a non-empty string', () => {
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, [], mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(typeof prompt).toBe('string')
            expect(prompt.length).toBeGreaterThan(100)
        })

        test('should include agent identity', () => {
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, [], mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toContain('Test Shop')
            expect(prompt.toLowerCase()).toContain('français')
        })

        test('should include business info', () => {
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, [], mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toContain('Abidjan, Cocody')
        })

        test('should include greeting rules', () => {
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, [], mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt.toLowerCase()).toMatch(/salut|bonjour|bienvenue/i)
        })
    })

    // ═══════════════════════════════════════════════════════════════
    // ENGINE DISPATCH - PRODUCTS
    // ═══════════════════════════════════════════════════════════════

    describe('Engine Dispatch - Products', () => {
        test('should use PHYSICAL workflow for physical products', () => {
            const products = [
                { id: '1', name: 'T-Shirt', price_fcfa: 15000, product_type: 'physical' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/PHYSIQUE|PHYSICAL|📦/)
        })

        test('should use DIGITAL workflow for digital products', () => {
            const products = [
                { id: '1', name: 'Office 365', price_fcfa: 25000, product_type: 'digital' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/NUMÉRIQUE|DIGITAL|💻/)
        })

        test('should use MIXED workflow for mixed products', () => {
            const products = [
                { id: '1', name: 'T-Shirt', price_fcfa: 15000, product_type: 'physical' },
                { id: '2', name: 'Office 365', price_fcfa: 25000, product_type: 'digital' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/MIXTE|MIXED/i)
        })
    })

    // ═══════════════════════════════════════════════════════════════
    // ENGINE DISPATCH - SERVICES
    // ═══════════════════════════════════════════════════════════════

    describe('Engine Dispatch - Services', () => {
        test('should use STAY engine for hotel services', () => {
            const products = [
                { id: '1', name: 'Chambre Standard', price_fcfa: 50000, product_type: 'service', service_subtype: 'hotel' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/STAY|HÉBERGEMENT|🏨/)
        })

        test('should use STAY engine for residence services', () => {
            const products = [
                { id: '1', name: 'Appartement', price_fcfa: 75000, product_type: 'service', service_subtype: 'residence' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/STAY|HÉBERGEMENT/)
        })

        test('should use RESTAURANT engine for restaurant services', () => {
            const products = [
                { id: '1', name: 'Table VIP', price_fcfa: 30000, product_type: 'service', service_subtype: 'restaurant' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/RESTAURANT|create_restaurant_checkout|booking_only|takeaway|delivery/i)
        })

        test('should forbid reopening the restaurant welcome menu for a concrete first request', () => {
            const products = [
                { id: '1', name: 'Plat 01', price_fcfa: 6500, product_type: 'service', service_subtype: 'restaurant' },
                { id: '2', name: 'Dessert 01', price_fcfa: 2200, product_type: 'service', service_subtype: 'restaurant' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent,
                products,
                mockOrders,
                mockDocs,
                currency,
                gpsLink,
                formattedHours,
                false,
                'Je veux reserver une table demain a 21h pour 3 personnes avec 2 Plat 01 et 1 Dessert 01'
            )
            expect(prompt).toMatch(/NE RÉAFFICHE PAS le menu principal/i)
            expect(prompt).toMatch(/demande précise/i)
        })

        test('should use TABLE engine for event services', () => {
            const products = [
                { id: '1', name: 'Concert Ticket', price_fcfa: 10000, product_type: 'service', service_subtype: 'event' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/TABLE|ÉVÉNEMENT/)
        })

        test('should use SLOT engine for coiffeur services', () => {
            const products = [
                { id: '1', name: 'Coupe Homme', price_fcfa: 5000, product_type: 'service', service_subtype: 'coiffeur' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/SLOT|RENDEZ-VOUS|RDV/)
        })

        test('should use SLOT engine for medecin services', () => {
            const products = [
                { id: '1', name: 'Consultation', price_fcfa: 20000, product_type: 'service', service_subtype: 'medecin' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/SLOT|RENDEZ-VOUS/)
        })

        test('should use INSCRIPTION engine for formation services', () => {
            const products = [
                { id: '1', name: 'Formation Excel', price_fcfa: 100000, product_type: 'service', service_subtype: 'formation' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/INSCRIPTION|FORMATION\/ATELIER|📚/)
        })

        test('should use SLOT engine for coaching services', () => {
            const products = [
                { id: '1', name: 'Coaching Session', price_fcfa: 50000, product_type: 'service', service_subtype: 'coaching' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/SLOT/)
        })

        test('should use RENTAL engine for rental services', () => {
            const products = [
                { id: '1', name: 'Toyota RAV4', price_fcfa: 50000, product_type: 'service', service_subtype: 'rental' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/RENTAL|LOCATION|🚗/)
        })

        test('should default to SLOT engine for unknown service subtypes', () => {
            const products = [
                { id: '1', name: 'Unknown Service', price_fcfa: 10000, product_type: 'service', service_subtype: 'other' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt).toMatch(/SLOT/)
        })
    })

    // ═══════════════════════════════════════════════════════════════
    // SERVICE-ONLY AGENT DETECTION
    // ═══════════════════════════════════════════════════════════════

    describe('Service-Only Agent Detection', () => {
        test('should detect 100% service agent', () => {
            const products = [
                { id: '1', name: 'Chambre', price_fcfa: 50000, product_type: 'service', service_subtype: 'hotel' },
                { id: '2', name: 'Suite', price_fcfa: 100000, product_type: 'service', service_subtype: 'hotel' }
            ]
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            // Should use service workflow, not generic
            expect(prompt).toMatch(/STAY|HÉBERGEMENT/)
            expect(prompt.toLowerCase()).toMatch(/réservation|réserver/)
        })
    })

    // ═══════════════════════════════════════════════════════════════
    // INTENT DETECTION FROM USER MESSAGE
    // ═══════════════════════════════════════════════════════════════

    describe('Intent Detection from User Message', () => {
        test('should detect service intent when product name is in message', () => {
            const products = [
                { id: '1', name: 'T-Shirt', price_fcfa: 15000, product_type: 'physical' },
                { id: '2', name: 'Chambre Standard', price_fcfa: 50000, product_type: 'service', service_subtype: 'hotel' }
            ]
            const userMessage = 'Je voudrais réserver la Chambre Standard'
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, products, mockOrders, mockDocs, currency, gpsLink, formattedHours, false, userMessage
            )
            // Should switch to STAY engine because "Chambre Standard" is mentioned
            expect(prompt).toMatch(/STAY|HÉBERGEMENT/)
        })
    })

    // ═══════════════════════════════════════════════════════════════
    // POST-ORDER CONTEXT (ZOMBIE KILLER)
    // ═══════════════════════════════════════════════════════════════

    describe('Post-Order Context', () => {
        test('should include reset context when justOrdered is true', () => {
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, [], mockOrders, mockDocs, currency, gpsLink, formattedHours, true
            )
            // Should contain "zombie killer" or "commande terminée" context
            expect(prompt.toLowerCase()).toMatch(/zombie killer|commande terminée|clôturée/)
        })
    })

    // ═══════════════════════════════════════════════════════════════
    // SECTIONS ASSEMBLY
    // ═══════════════════════════════════════════════════════════════

    describe('Sections Assembly', () => {
        test('should include anti-loop rules', () => {
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, [], mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt.toLowerCase()).toMatch(/boucle|loop|répét/i)
        })

        test('should include tools definition', () => {
            const prompt = buildAdaptiveSystemPrompt(
                mockAgent, [], mockOrders, mockDocs, currency, gpsLink, formattedHours
            )
            expect(prompt.toLowerCase()).toMatch(/tool|create_order|create_booking/i)
        })
    })
})
