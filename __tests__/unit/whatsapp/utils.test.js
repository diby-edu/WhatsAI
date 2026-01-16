const { normalizePhoneNumber } = require('../../../src/lib/whatsapp/utils/format');

/**
 * Tests updated to match the new STRICT phone validation (v2.2):
 * - Phones MUST start with '+' or '00' (international format required)
 * - Output always includes '+' prefix
 * - Invalid phones return null (not empty string)
 */
describe('Utils: normalizePhoneNumber (v2.2 - Strict Mode)', () => {
    // Valid international formats
    test('should normalize phone with + prefix', () => {
        expect(normalizePhoneNumber('+2250756236984')).toBe('+2250756236984');
    });

    test('should convert 00 prefix to +', () => {
        expect(normalizePhoneNumber('002250756236984')).toBe('+2250756236984');
    });

    test('should handle mixed cleanup with + prefix', () => {
        expect(normalizePhoneNumber('+225 07-56-23-69-84')).toBe('+2250756236984');
    });

    // UPDATED v2.3: Known country codes (225, 33, etc.) are now auto-prefixed with +
    test('should auto-add + for known country code (225 = Ivory Coast)', () => {
        expect(normalizePhoneNumber('2250756236984')).toBe('+2250756236984');
    });

    test('should auto-add + for known country code with formatting', () => {
        expect(normalizePhoneNumber('(225) 07-56-23 69 84')).toBe('+2250756236984');
    });

    // Unknown country codes without + should still be rejected
    // Unknown country codes without + should use fallback +225
    test('should apply fallback +225 for unknown format', () => {
        // 999123456789 -> +225999123456789
        expect(normalizePhoneNumber('999123456789')).toBe('+225999123456789');
    });


    // Edge cases
    test('should return null for null/empty input', () => {
        expect(normalizePhoneNumber(null)).toBe(null);
        expect(normalizePhoneNumber('')).toBe(null);
        expect(normalizePhoneNumber(undefined)).toBe(null);
    });

    test('should reject phone that is too short', () => {
        expect(normalizePhoneNumber('+123')).toBe(null);
    });

    test('should reject phone that is too long', () => {
        expect(normalizePhoneNumber('+12345678901234567890')).toBe(null);
    });
});
