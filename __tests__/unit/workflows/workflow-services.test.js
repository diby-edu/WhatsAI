/**
 * Tests for Service Workflows (STAY, TABLE, SLOT, RENTAL)
 *
 * Critical tests to ensure:
 * - NO delivery address is requested (services are on-site)
 * - create_booking is called (NOT create_order)
 * - Proper data collection for each service type
 */

const { prompt_STAY } = require('../../../src/lib/whatsapp/ai/prompts/workflow-service-stay')
const { prompt_TABLE } = require('../../../src/lib/whatsapp/ai/prompts/workflow-service-table')
const { prompt_SLOT } = require('../../../src/lib/whatsapp/ai/prompts/workflow-service-slot')
const { prompt_RENTAL } = require('../../../src/lib/whatsapp/ai/prompts/workflow-service-rental')

// ═══════════════════════════════════════════════════════════════
// SHARED SERVICE WORKFLOW TESTS
// ═══════════════════════════════════════════════════════════════

const testCommonServiceRules = (workflowName, workflow) => {
    describe(`${workflowName} - Common Rules`, () => {

        test('should return a non-empty string', () => {
            expect(typeof workflow).toBe('string')
            expect(workflow.length).toBeGreaterThan(100)
        })

        // CRITICAL: NO DELIVERY ADDRESS
        test('CRITICAL: should explicitly forbid delivery address', () => {
            expect(workflow).toMatch(/🚫.*adresse|NE JAMAIS.*adresse|INTERDIT.*adresse|PAS.*demander.*adresse/i)
        })

        test('CRITICAL: should NOT mention delivery (livraison)', () => {
            expect(workflow).toMatch(/🚫.*livraison|NE JAMAIS.*livraison|INTERDIT.*livraison/i)
        })

        // CRITICAL: create_booking NOT create_order
        test('CRITICAL: should call create_booking (not create_order)', () => {
            expect(workflow).toContain('create_booking')
            // Should NOT contain create_order as the action
            expect(workflow).not.toMatch(/→.*create_order/i)
        })

        // Required fields
        test('should request customer name', () => {
            expect(workflow.toLowerCase()).toMatch(/nom|name/)
        })

        test('should request phone number with country code', () => {
            expect(workflow.toLowerCase()).toMatch(/téléphone|phone|indicatif|\+225/)
        })

        test('should request date/time', () => {
            expect(workflow).toMatch(/📅|date|heure|time/)
        })

        // Payment
        test('should offer payment options (online or on-site)', () => {
            expect(workflow.toLowerCase()).toMatch(/en ligne|sur place|paiement|payment/)
        })

        // Confirmation
        test('should have confirmation step', () => {
            expect(workflow.toLowerCase()).toMatch(/confirmez|confirm/)
        })

        // Recap
        test('should have a recap section', () => {
            expect(workflow.toLowerCase()).toMatch(/récapitulatif|recap/)
        })
    })
}

// ═══════════════════════════════════════════════════════════════
// STAY WORKFLOW (Hotel, Residence)
// ═══════════════════════════════════════════════════════════════

describe('STAY Workflow (Hotel/Residence)', () => {
    testCommonServiceRules('STAY', prompt_STAY)

    test('should identify as STAY/HÉBERGEMENT workflow', () => {
        expect(prompt_STAY).toMatch(/STAY|HÉBERGEMENT|🏨/)
    })

    test('should contain 8 steps', () => {
        expect(prompt_STAY).toContain('ÉTAPE 1')
        expect(prompt_STAY).toContain('ÉTAPE 8')
    })

    test('should request check-in and check-out dates', () => {
        expect(prompt_STAY.toLowerCase()).toMatch(/arrivée.*départ|check.*in.*out|du.*au/i)
    })

    test('should request number of travelers', () => {
        expect(prompt_STAY.toLowerCase()).toMatch(/voyageurs|personnes|adultes|enfants|👥/)
    })

    test('should allow special requests (baby bed, sea view, etc.)', () => {
        expect(prompt_STAY.toLowerCase()).toMatch(/demandes.*particulières|lit bébé|vue mer|spéciales/i)
    })

    test('should calculate number of nights in recap', () => {
        expect(prompt_STAY).toMatch(/nuits|nights/i)
    })
})

// ═══════════════════════════════════════════════════════════════
// TABLE WORKFLOW (Restaurant, Event)
// ═══════════════════════════════════════════════════════════════

describe('TABLE Workflow (Restaurant/Event)', () => {
    testCommonServiceRules('TABLE', prompt_TABLE)

    test('should identify as TABLE/RESTAURANT workflow', () => {
        expect(prompt_TABLE).toMatch(/TABLE|RESTAURANT|ÉVÉNEMENT|🍽️/)
    })

    test('should contain 8 steps', () => {
        expect(prompt_TABLE).toContain('ÉTAPE 1')
        expect(prompt_TABLE).toContain('ÉTAPE 8')
    })

    test('should request date AND time', () => {
        expect(prompt_TABLE).toMatch(/date.*heure|📅.*⏰/)
    })

    test('should request number of people/covers', () => {
        expect(prompt_TABLE.toLowerCase()).toMatch(/personnes|couverts|🍽️/)
    })

    test('should allow special requests (allergies, baby chair, etc.)', () => {
        expect(prompt_TABLE.toLowerCase()).toMatch(/allergies|chaise bébé|demandes.*particulières/i)
    })
})

// ═══════════════════════════════════════════════════════════════
// SLOT WORKFLOW (Appointments, Hairdresser, Professional)
// ═══════════════════════════════════════════════════════════════

describe('SLOT Workflow (Appointment/Professional)', () => {
    testCommonServiceRules('SLOT', prompt_SLOT)

    test('should identify as SLOT/RDV workflow', () => {
        expect(prompt_SLOT).toMatch(/SLOT|RENDEZ-VOUS|RDV|PRESTATION|✨/)
    })

    test('should contain 7 steps', () => {
        expect(prompt_SLOT).toContain('ÉTAPE 1')
        expect(prompt_SLOT).toContain('ÉTAPE 7')
    })

    test('should request date and time', () => {
        expect(prompt_SLOT).toMatch(/date.*heure|📅.*⏰/)
    })

    test('should allow special requests/preferences', () => {
        expect(prompt_SLOT.toLowerCase()).toMatch(/demandes.*particulières|style|préférence/i)
    })
})

// ═══════════════════════════════════════════════════════════════
// RENTAL WORKFLOW (Vehicle/Equipment Rental)
// ═══════════════════════════════════════════════════════════════

describe('RENTAL Workflow (Vehicle/Equipment)', () => {
    testCommonServiceRules('RENTAL', prompt_RENTAL)

    test('should identify as RENTAL/LOCATION workflow', () => {
        expect(prompt_RENTAL).toMatch(/RENTAL|LOCATION|🚗/)
    })

    test('should contain 8 steps', () => {
        expect(prompt_RENTAL).toContain('ÉTAPE 1')
        expect(prompt_RENTAL).toContain('ÉTAPE 8')
    })

    test('should request start and end dates', () => {
        expect(prompt_RENTAL.toLowerCase()).toMatch(/date.*début.*fin|du.*au/i)
    })

    test('should offer options (GPS, insurance, etc.)', () => {
        expect(prompt_RENTAL.toLowerCase()).toMatch(/gps|siège bébé|assurance|km illimité|options/i)
    })

    test('should ask about driving license for vehicles', () => {
        expect(prompt_RENTAL.toLowerCase()).toMatch(/permis.*conduire|driving.*license/i)
    })

    test('should mention pickup (retrait) not delivery', () => {
        expect(prompt_RENTAL.toLowerCase()).toMatch(/retrait|récupère|sur place/)
    })
})
