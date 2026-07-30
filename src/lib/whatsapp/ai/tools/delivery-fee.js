// Résolution serveur des frais de livraison — jamais calculée par l'IA.
// Le montant facturé vient toujours d'ici, jamais d'un chiffre annoncé en conversation.

function normalizeLabel(value) {
    return String(value || '').trim().toLowerCase()
}

function findZoneMatch(list, needle) {
    const normalizedNeedle = normalizeLabel(needle)
    if (!normalizedNeedle || !Array.isArray(list)) return null

    let best = null
    for (const entry of list) {
        const entryName = normalizeLabel(entry?.name)
        if (!entryName) continue
        if (entryName === normalizedNeedle) return entry
        if (!best && (entryName.includes(normalizedNeedle) || normalizedNeedle.includes(entryName))) {
            best = entry
        }
    }
    return best
}

function listCommuneNames(zones) {
    return (zones?.communes || [])
        .map(c => c?.name)
        .filter(Boolean)
        .join(', ')
}

function listZoneNames(list) {
    return (list || [])
        .map(entry => entry?.name)
        .filter(Boolean)
        .join(', ')
}

// hasPhysicalProduct : true si la commande contient au moins un produit physique
// (les frais de livraison ne concernent jamais le pur numérique)
function resolveDeliveryFee(agent, hasPhysicalProduct, args = {}) {
    if (!hasPhysicalProduct) {
        return { fee: 0, note: null, error: null }
    }

    const mode = agent?.delivery_fee_mode || 'none'

    if (mode !== 'zones' && mode !== 'free') {
        return { fee: 0, note: null, error: null }
    }

    if (mode === 'free') {
        return { fee: 0, note: 'Livraison gratuite', error: null }
    }

    // mode === 'zones'
    const zones = agent?.delivery_zones || {}
    const zoneType = args.delivery_zone_type

    if (!zoneType) {
        return {
            fee: 0,
            note: null,
            error: 'ZONE DE LIVRAISON MANQUANTE. Demande au client sa commune (si Abidjan), ou precise si c\'est hors Abidjan ou a l\'international, avant de creer la commande.',
            hint: 'Utilise delivery_zone_type ("abidjan_commune", "hors_abidjan" ou "international") + delivery_commune si applicable.'
        }
    }

    if (zoneType === 'hors_abidjan') {
        const cities = zones.hors_abidjan
        if (!Array.isArray(cities) || cities.length === 0) {
            return { fee: 0, note: 'Frais de livraison hors Abidjan a confirmer avec notre equipe.', error: null }
        }

        const cityInput = String(args.delivery_city || '').trim()
        if (!cityInput) {
            return {
                fee: 0,
                note: null,
                error: 'VILLE MANQUANTE. Demande au client dans quelle ville il souhaite etre livre avant de creer la commande.',
                hint: `Villes disponibles : ${listZoneNames(cities)}`
            }
        }

        const matchedCity = findZoneMatch(cities, cityInput)
        if (!matchedCity) {
            return {
                fee: 0,
                note: null,
                error: `VILLE NON RECONNUE ("${cityInput}"). Ne devine jamais un tarif. Demande au client de preciser sa ville parmi la liste disponible.`,
                hint: `Villes disponibles : ${listZoneNames(cities)}`
            }
        }

        return { fee: typeof matchedCity.fee === 'number' ? matchedCity.fee : 0, note: `Livraison (${matchedCity.name})`, error: null }
    }

    if (zoneType === 'international') {
        const countries = zones.international
        if (!Array.isArray(countries) || countries.length === 0) {
            return { fee: 0, note: 'Livraison internationale : contactez-nous pour un devis.', error: null }
        }

        const countryInput = String(args.delivery_country || '').trim()
        if (!countryInput) {
            return {
                fee: 0,
                note: null,
                error: 'PAYS MANQUANT. Demande au client dans quel pays il souhaite etre livre avant de creer la commande.',
                hint: `Pays disponibles : ${listZoneNames(countries)}`
            }
        }

        const matchedCountry = findZoneMatch(countries, countryInput)
        if (!matchedCountry) {
            return {
                fee: 0,
                note: null,
                error: `PAYS NON RECONNU ("${countryInput}"). Ne devine jamais un tarif. Demande au client de preciser son pays parmi la liste disponible.`,
                hint: `Pays disponibles : ${listZoneNames(countries)}`
            }
        }

        return { fee: typeof matchedCountry.fee === 'number' ? matchedCountry.fee : 0, note: `Livraison (${matchedCountry.name})`, error: null }
    }

    // zoneType === 'abidjan_commune'
    const communeInput = String(args.delivery_commune || '').trim()
    if (!communeInput) {
        return {
            fee: 0,
            note: null,
            error: 'COMMUNE MANQUANTE. Demande dans quelle commune d\'Abidjan le client souhaite etre livre avant de creer la commande.',
            hint: `Communes disponibles : ${listCommuneNames(zones) || 'aucune configuree'}`
        }
    }

    const matchedCommune = findZoneMatch(zones.communes, communeInput)
    if (!matchedCommune) {
        return {
            fee: 0,
            note: null,
            error: `COMMUNE NON RECONNUE ("${communeInput}"). Ne devine jamais un tarif. Demande au client de preciser sa commune parmi la liste disponible.`,
            hint: `Communes disponibles : ${listCommuneNames(zones) || 'aucune configuree'}`
        }
    }

    const quartierInput = String(args.delivery_quartier || '').trim()
    let fee = typeof matchedCommune.fee === 'number' ? matchedCommune.fee : 0
    let label = matchedCommune.name

    if (quartierInput && Array.isArray(matchedCommune.quartiers) && matchedCommune.quartiers.length > 0) {
        const matchedQuartier = findZoneMatch(matchedCommune.quartiers, quartierInput)
        if (matchedQuartier && typeof matchedQuartier.fee === 'number') {
            fee = matchedQuartier.fee
            label = `${matchedCommune.name} - ${matchedQuartier.name}`
        }
    }

    return { fee, note: `Livraison (${label})`, error: null }
}

module.exports = { resolveDeliveryFee }
