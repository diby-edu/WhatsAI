/**
 * Normalize phone number for WhatsApp
 * Removes +, 00, spaces, dashes
 * @param {string} phone 
 * @returns {string} normalized phone
 */
function normalizePhoneNumber(phone) {
    if (!phone) return phone

    let normalized = phone.toString().trim()

    // Remove common prefixes and non-digits
    normalized = normalized.replace(/^\+/, '')     // Remove leading +
    normalized = normalized.replace(/^00/, '')     // Remove leading 00 (international prefix)
    normalized = normalized.replace(/[\s\-\(\)]/g, '') // Remove spaces, dashes, parentheses

    // If starts with 0 and has 9-10 digits (local number), it needs country code
    // This will be caught by the AI instructions, but we log for debugging
    if (/^0\d{8,10}$/.test(normalized)) {
        console.log('⚠️ Phone number appears to be local (no country code):', normalized)
    }

    return normalized
}

module.exports = { normalizePhoneNumber }
