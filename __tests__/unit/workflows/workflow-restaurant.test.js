const { prompt_RESTAURANT } = require('../../../src/lib/whatsapp/ai/prompts/workflow-service-restaurant')

describe('RESTAURANT Workflow', () => {
    test('should return a non-empty string', () => {
        expect(typeof prompt_RESTAURANT).toBe('string')
        expect(prompt_RESTAURANT.length).toBeGreaterThan(100)
    })

    test('should use create_restaurant_checkout only', () => {
        expect(prompt_RESTAURANT).toContain('create_restaurant_checkout')
        expect(prompt_RESTAURANT).toMatch(/N appelle JAMAIS create_order/i)
        expect(prompt_RESTAURANT).toMatch(/N appelle JAMAIS create_booking/i)
    })

    test('should describe all four restaurant modes', () => {
        expect(prompt_RESTAURANT).toMatch(/dine_in/i)
        expect(prompt_RESTAURANT).toMatch(/booking_only/i)
        expect(prompt_RESTAURANT).toMatch(/takeaway/i)
        expect(prompt_RESTAURANT).toMatch(/delivery/i)
    })

    test('should require items for takeaway and delivery', () => {
        expect(prompt_RESTAURANT).toMatch(/takeaway[\s\S]*articles sont obligatoires/i)
        expect(prompt_RESTAURANT).toMatch(/delivery[\s\S]*articles sont obligatoires/i)
    })

    test('should require date, time and party size for dine_in and booking_only', () => {
        expect(prompt_RESTAURANT).toMatch(/dine_in[\s\S]*date \+ heure/i)
        expect(prompt_RESTAURANT).toMatch(/booking_only[\s\S]*date \+ heure/i)
        expect(prompt_RESTAURANT).toMatch(/party_size obligatoires/i)
    })

    test('should require delivery address for delivery', () => {
        expect(prompt_RESTAURANT).toMatch(/delivery = adresse obligatoire/i)
    })

    test('should instruct the assistant to relay payment_link exactly', () => {
        expect(prompt_RESTAURANT).toMatch(/Si le tool retourne payment_link, transmets-le exactement tel quel/i)
    })
})
