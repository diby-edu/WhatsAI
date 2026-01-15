const { normalizePhoneNumber } = require('../../../src/lib/whatsapp/utils/format');

describe('Utils: normalizePhoneNumber (v2.2 - FIXED)', () => {
    describe('✅ VALID CASES (avec indicatif pays)', () => {
        test('should preserve + and keep valid international number', () => {
            expect(normalizePhoneNumber('+2250756236984')).toBe('+2250756236984');
        });

        test('should convert 00 prefix to +', () => {
            expect(normalizePhoneNumber('002250756236984')).toBe('+2250756236984');
        });

        test('should remove spaces, dashes, and parentheses', () => {
            expect(normalizePhoneNumber('+225 07-56-23 69 84')).toBe('+2250756236984');
            expect(normalizePhoneNumber('(+225) 07 56 23 69 84')).toBe('+2250756236984');
        });

        test('should handle French number', () => {
            expect(normalizePhoneNumber('+33 7 12 34 56 78')).toBe('+33712345678');
        });

        test('should handle mixed cleanup', () => {
            expect(normalizePhoneNumber('+225 (07)-56-23-69-84')).toBe('+2250756236984');
        });
    });

    describe('❌ INVALID CASES (sans indicatif pays)', () => {
        test('should REJECT local number starting with 0', () => {
            expect(normalizePhoneNumber('0756236984')).toBe(null);
        });

        test('should REJECT number without + or 00', () => {
            expect(normalizePhoneNumber('2250756236984')).toBe(null);
        });

        test('should REJECT empty or null', () => {
            expect(normalizePhoneNumber(null)).toBe(null);
            expect(normalizePhoneNumber('')).toBe(null);
            expect(normalizePhoneNumber('   ')).toBe(null);
        });

        test('should REJECT number with too few digits', () => {
            expect(normalizePhoneNumber('+225123')).toBe(null);
        });

        test('should REJECT number with too many digits', () => {
            expect(normalizePhoneNumber('+2251234567890123456')).toBe(null);
        });

        test('should REJECT number with letters', () => {
            expect(normalizePhoneNumber('+225ABC7894561')).toBe(null);
        });
    });
});
