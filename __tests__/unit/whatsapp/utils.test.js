const { normalizePhoneNumber } = require('../../../src/lib/whatsapp/utils/format');

describe('Utils: normalizePhoneNumber', () => {
    test('should return the same value if already normalized', () => {
        expect(normalizePhoneNumber('2250756236984')).toBe('2250756236984');
    });

    test('should remove leading +', () => {
        expect(normalizePhoneNumber('+2250756236984')).toBe('2250756236984');
    });

    test('should remove leading 00', () => {
        expect(normalizePhoneNumber('002250756236984')).toBe('2250756236984');
    });

    test('should remove spaces, dashes, and parentheses', () => {
        expect(normalizePhoneNumber('(225) 07-56-23 69 84')).toBe('2250756236984');
    });

    test('should handle mixed cleanup', () => {
        expect(normalizePhoneNumber('+225 07-56-23-69-84')).toBe('2250756236984');
    });

    test('should return null or input if invalid/empty (logic check)', () => {
        expect(normalizePhoneNumber(null)).toBe(null);
        expect(normalizePhoneNumber('')).toBe('');
    });
});
