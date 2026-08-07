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

// Détection d'un lien Google Maps collé en texte libre (copié-collé par le client,
// distinct du partage de position native WhatsApp géré ailleurs via locationMessage).
const MAPS_URL_PATTERN = /https?:\/\/(?:www\.)?(?:maps\.app\.goo\.gl\/\S+|goo\.gl\/maps\/\S+|(?:maps\.)?google\.[a-z.]+\/maps\S*)/i
const SHORT_LINK_PATTERN = /maps\.app\.goo\.gl|goo\.gl\/maps/i

function findGoogleMapsUrl(text) {
    if (!text) return null
    const match = String(text).match(MAPS_URL_PATTERN)
    return match ? match[0] : null
}

function parseCoordinatesFromUrl(url) {
    if (!url) return null

    // Formats courants : /@lat,lng,zoom | ?q=lat,lng | ?ll=lat,lng | !3dlat!4dlng
    const atMatch = url.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
    if (atMatch) return { latitude: parseFloat(atMatch[1]), longitude: parseFloat(atMatch[2]) }

    const qMatch = url.match(/[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
    if (qMatch) return { latitude: parseFloat(qMatch[1]), longitude: parseFloat(qMatch[2]) }

    const llMatch = url.match(/[?&]ll=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
    if (llMatch) return { latitude: parseFloat(llMatch[1]), longitude: parseFloat(llMatch[2]) }

    const dMatch = url.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)
    if (dMatch) return { latitude: parseFloat(dMatch[1]), longitude: parseFloat(dMatch[2]) }

    return null
}

async function resolveGoogleMapsShortLink(url) {
    // Les liens courts (maps.app.goo.gl, goo.gl/maps) ne contiennent pas les coordonnées
    // directement dans l'URL — il faut suivre la redirection pour obtenir l'URL complète.
    try {
        const res = await fetch(url, {
            redirect: 'follow',
            headers: { 'User-Agent': 'WazzapAI/1.0 (https://wazzapai.com)' },
        })
        return res.url || url
    } catch (err) {
        console.error('resolveGoogleMapsShortLink error:', err?.message || err)
        return url
    }
}

// Certains liens courts (partage d'un lieu/POI nommé plutôt qu'une position brute)
// redirigent vers une URL /maps/place/<nom>/... identifiée par un Place ID hexadécimal
// (ex: data=!4m2!3m1!1s0xfc1e...) — aucune coordonnée en clair n'y figure, donc
// parseCoordinatesFromUrl échoue. Le nom du lieu, lui, est déjà présent en texte
// lisible dans le chemin de l'URL : on l'utilise directement comme filet de sécurité,
// sans appel à une API de géocodage payante.
function parsePlaceNameFromUrl(url) {
    if (!url) return null
    const match = url.match(/\/maps\/place\/([^/]+)\//)
    if (!match) return null

    try {
        const decoded = decodeURIComponent(match[1].replace(/\+/g, ' ')).trim()
        return decoded.length > 0 ? decoded : null
    } catch (_err) {
        return null
    }
}

async function extractCoordinatesFromText(text) {
    const url = findGoogleMapsUrl(text)
    if (!url) return null

    const directMatch = parseCoordinatesFromUrl(url)
    if (directMatch) return directMatch

    if (SHORT_LINK_PATTERN.test(url)) {
        const resolvedUrl = await resolveGoogleMapsShortLink(url)
        const resolvedMatch = parseCoordinatesFromUrl(resolvedUrl)
        if (resolvedMatch) return resolvedMatch

        const placeLabel = parsePlaceNameFromUrl(resolvedUrl)
        if (placeLabel) return { placeLabel }
    }

    return null
}

module.exports = { reverseGeocode, findGoogleMapsUrl, extractCoordinatesFromText }
