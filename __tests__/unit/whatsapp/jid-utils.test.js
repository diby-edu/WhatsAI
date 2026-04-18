const { buildFallbackJid, normalizePhoneForJid, resolveCanonicalJid } = require('@/lib/whatsapp/utils/jid')

describe('jid utils', () => {
    test('normalizes phone numbers for lookup', () => {
        expect(normalizePhoneForJid('+225 07 47 09 47 46')).toBe('2250747094746')
    })

    test('returns preferred jid when conversation already knows it', async () => {
        const result = await resolveCanonicalJid(null, '+2250747094746', '2250747094746@s.whatsapp.net')

        expect(result).toEqual({
            jid: '2250747094746@s.whatsapp.net',
            source: 'preferred',
            exists: true,
            normalizedPhone: '2250747094746',
        })
    })

    test('uses canonical jid returned by WhatsApp lookup', async () => {
        const socket = {
            onWhatsApp: jest.fn(async () => [{ jid: '2250747094746@lid', exists: true }]),
        }

        const result = await resolveCanonicalJid(socket, '+2250747094746')

        expect(socket.onWhatsApp).toHaveBeenCalledWith('2250747094746')
        expect(result).toEqual({
            jid: '2250747094746@lid',
            source: 'wa_lookup',
            exists: true,
            normalizedPhone: '2250747094746',
        })
    })

    test('fails fast when WhatsApp lookup says the number does not exist', async () => {
        const socket = {
            onWhatsApp: jest.fn(async () => [{ jid: '2250747094746@s.whatsapp.net', exists: false }]),
        }

        await expect(resolveCanonicalJid(socket, '+2250747094746'))
            .rejects
            .toThrow('Recipient 2250747094746 is not registered on WhatsApp')
    })

    test('falls back to classic jid when lookup is unavailable', async () => {
        const result = await resolveCanonicalJid({}, '+2250747094746')

        expect(result).toEqual({
            jid: '2250747094746@s.whatsapp.net',
            source: 'fallback',
            exists: true,
            normalizedPhone: '2250747094746',
        })
        expect(buildFallbackJid('+2250747094746')).toBe('2250747094746@s.whatsapp.net')
    })
})
