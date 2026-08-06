/**
 * Géocodage inverse (coordonnées GPS → nom de lieu) via Nominatim (OpenStreetMap).
 * Gratuit, sans clé API. Politique d'usage : max ~1 requête/seconde, User-Agent
 * obligatoire — largement suffisant pour ce volume (un lookup par position partagée).
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'

async function reverseGeocode(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number') return null

    try {
        const url = `${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'WazzapAI/1.0 (https://wazzapai.com)',
                'Accept-Language': 'fr',
            },
        })
        if (!res.ok) return null

        const data = await res.json()
        const addr = data?.address
        if (!addr) return data?.display_name || null

        // Priorité : quartier/commune (le plus utile pour matcher une zone de livraison
        // configurée par le marchand), puis ville, puis pays en filet de sécurité.
        const locality = addr.suburb || addr.city_district || addr.neighbourhood
            || addr.town || addr.municipality || addr.city || null
        const city = addr.city || addr.town || addr.county || null
        const country = addr.country || null

        const parts = [locality, city !== locality ? city : null, country].filter(Boolean)
        return parts.length > 0 ? parts.join(', ') : (data?.display_name || null)
    } catch (err) {
        console.error('reverseGeocode error:', err?.message || err)
        return null
    }
}

module.exports = { reverseGeocode }
