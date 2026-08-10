/**
 * ═══════════════════════════════════════════════════════════════
 * LEAD STATE SERVICE (mode lead_only)
 * ═══════════════════════════════════════════════════════════════
 *
 * Mémoire fiable des articles mentionnés par le client, persistée dans
 * conversation.metadata.lead_state — indépendante du flux de commande
 * complet (cart-state/checkout-state/booking-state/restaurant-state) :
 * aucun import depuis ces modules, aucun risque de régression dessus.
 *
 * Contrairement à cart-state, ce module ne génère AUCUNE réponse
 * (pas de directReply, pas de shouldBypassAI) — il extrait un état,
 * qu'on injecte ensuite en texte dans le prompt. L'IA reste seule
 * responsable de la formulation ; ce module est seulement sa mémoire.
 */

const { calculateItemPrice } = require('../ai/tools/pricing-logic')

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim()
}

function getMeaningfulTerms(text) {
    return normalizeText(text).split(/\s+/).filter(w => w.length > 2)
}

// Distance de Levenshtein — tolère les fautes de frappe ("goude" ↔ "goube").
// Même algorithme que ai/tools/tool-images.js#levenshtein, copie locale
// volontaire (pas d'import) pour garder ce module sans dépendance externe.
function levenshtein(a, b) {
    const m = a.length, n = b.length
    const dp = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    )
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
        }
    }
    return dp[m][n]
}

// Correspondance floue produit : exact > substring > préfixe partagé (pluriels)
// > Levenshtein (fautes de frappe, ex: "goude"/"goube"). Implémentation
// indépendante de cart-state/stage.js#findBestProduct (même esprit, pas d'import).
function findBestProduct(products, text) {
    const normalized = normalizeText(text)
    if (!normalized) return null

    const queryTerms = getMeaningfulTerms(normalized)
    let bestProduct = null
    let bestScore = 0
    let bestScoreCount = 0

    for (const product of products) {
        const productName = normalizeText(product.name)
        if (!productName) continue

        let score = 0
        if (normalized === productName) score = 120
        else if (normalized.includes(productName) || productName.includes(normalized)) score = 70
        else {
            const productTerms = getMeaningfulTerms(productName)
            const directMatches = queryTerms.filter(term => productName.includes(term))
            score = directMatches.length * 15

            const strongMatches = queryTerms.filter(term =>
                productTerms.some(pt => pt === term || pt.startsWith(term) || term.startsWith(pt))
            )
            if (strongMatches.length > 0) score = Math.max(score, strongMatches.length * 20)

            // Tolérance faute de frappe, basée sur le plus long des deux mots (une
            // insertion/suppression allonge le mot, un seuil sur le plus court serait
            // trop strict — ex: "gourde"(6) vs "goube"(5), distance 2, doit passer).
            const fuzzyMatches = queryTerms.filter(term =>
                productTerms.some(pt => {
                    const maxLen = Math.max(term.length, pt.length)
                    const maxDist = maxLen <= 5 ? 1 : maxLen <= 9 ? 2 : 3
                    return levenshtein(term, pt) <= maxDist
                })
            )
            if (fuzzyMatches.length > 0) score = Math.max(score, fuzzyMatches.length * 18)
        }

        if (score > bestScore) {
            bestScore = score
            bestProduct = product
            bestScoreCount = 1
        } else if (score > 0 && score === bestScore) {
            bestScoreCount += 1
        }
    }

    if (bestScore >= 30) return bestProduct
    if (bestScore >= 18 && bestScoreCount === 1) return bestProduct
    return null
}

// Découpe un message en segments indépendants (lignes + virgules + " et ").
function splitSegments(text) {
    return String(text || '')
        .split(/\n|,|\bet\b/i)
        .map(s => s.trim())
        .filter(Boolean)
}

// Quantité = premier nombre isolé du segment, où qu'il soit ("15 sac",
// "je veux 15 sac", "sac x15") — pas seulement en tête. Le reste du texte
// (nombre retiré) sert à la correspondance produit.
function parseSegment(segment) {
    const match = segment.match(/\b(\d{1,4})\b/)
    if (!match) return { quantity: null, rest: segment.trim() }
    const quantity = parseInt(match[1], 10)
    const rest = (segment.slice(0, match.index) + ' ' + segment.slice(match.index + match[0].length)).trim()
    return { quantity, rest: rest || segment.trim() }
}

function cloneState(state = {}) {
    return {
        items: Array.isArray(state.items) ? state.items.map(it => ({ ...it })) : [],
        unmatched_mentions: Array.isArray(state.unmatched_mentions) ? [...state.unmatched_mentions] : [],
        fulfillment_mode: state.fulfillment_mode || null,
        updated_at: state.updated_at || null,
    }
}

function getLeadState(metadata = {}) {
    return cloneState(metadata.lead_state || {})
}

function setLeadState(metadata = {}, leadState) {
    return {
        ...(metadata || {}),
        lead_state: { ...cloneState(leadState), updated_at: new Date().toISOString() },
    }
}

function itemKey(productName, variant) {
    return `${normalizeText(productName)}::${normalizeText(variant || '')}`
}

/**
 * Extrait les articles mentionnés dans le message client et les fusionne
 * avec l'état déjà connu — n'écrase jamais un article déjà identifié,
 * ne fait qu'ajouter ou compléter (quantité manquante renseignée plus tard).
 */
function updateLeadStateFromUserMessage(previousState, text, products = []) {
    const state = cloneState(previousState)
    if (!text || products.length === 0) return state
    // Un message de position ("Ma position : <lieu> (<lien>)") contient des coordonnées
    // GPS — des nombres sans rapport avec des quantités d'articles. Garde-fou posé ici
    // (pas seulement chez l'appelant) pour que la fonction reste sûre quel que soit
    // l'appelant, présent ou futur.
    if (/^Ma position\s*:/.test(text)) return state

    const existingByKey = new Map(state.items.map(it => [itemKey(it.product_name, it.variant), it]))
    const segments = splitSegments(text)

    for (const segment of segments) {
        const { quantity, rest } = parseSegment(segment)
        if (!rest) continue

        const product = findBestProduct(products, rest)
        if (!product) {
            // Le segment ne nomme aucun produit — peut être une réponse "nue" à une
            // question de variante déjà posée (ex: le client répond juste "bleu" sans
            // répéter "sac"). On tente de la rattacher SEULEMENT s'il n'y a qu'un seul
            // article en attente de variante — sinon, ambigu, on ne devine pas.
            const pendingItems = state.items.filter(it => it.variant === null && it.product_id)
            if (pendingItems.length === 1) {
                const pendingProduct = products.find(p => p.id === pendingItems[0].product_id)
                if (pendingProduct) {
                    const pendingResult = calculateItemPrice(pendingProduct, {}, rest, 1)
                    if (!pendingResult.error && pendingResult.variantOptionName) {
                        const pendingItem = pendingItems[0]
                        const oldKey = itemKey(pendingItem.product_name, pendingItem.variant)
                        existingByKey.delete(oldKey)
                        pendingItem.variant = pendingResult.variantOptionName
                        if (quantity !== null) pendingItem.quantity = quantity
                        existingByKey.set(itemKey(pendingItem.product_name, pendingItem.variant), pendingItem)
                        continue
                    }
                }
            }

            // Sinon : ne garder que les segments qui ressemblaient à une tentative
            // d'article — accompagnés d'une quantité ET courts (un vrai nom d'article
            // tient en 1-4 mots ; une phrase normale comme "je peux payer jusqu'à
            // FCFA maximum" ne doit jamais finir en "article non reconnu").
            const restWordCount = rest.split(/\s+/).filter(Boolean).length
            if (quantity !== null && restWordCount > 0 && restWordCount <= 4) {
                const alreadyListed = state.unmatched_mentions.some(m => normalizeText(m) === normalizeText(rest))
                if (!alreadyListed) state.unmatched_mentions.push(rest)
            }
            continue
        }

        const pricingResult = calculateItemPrice(product, {}, rest, quantity || 1)
        const variant = pricingResult.variantOptionName || null
        const key = itemKey(product.name, variant)
        const existing = existingByKey.get(key)

        if (existing) {
            if (quantity !== null) existing.quantity = quantity
        } else {
            const newItem = { product_id: product.id, product_name: product.name, variant, quantity: quantity }
            state.items.push(newItem)
            existingByKey.set(key, newItem)
        }
    }

    return state
}

/**
 * Construit un résumé texte de l'état, à injecter dans le prompt — l'IA n'a
 * plus qu'à s'en servir pour formuler sa question suivante, jamais à
 * reconstruire cet état lui-même depuis l'historique brut.
 */
function buildLeadStateSummary(state) {
    if (!state || (state.items.length === 0 && state.unmatched_mentions.length === 0)) return null

    const lines = []
    for (const item of state.items) {
        const qtyPart = item.quantity === null ? 'quantité MANQUANTE' : `quantité ${item.quantity}`
        const variantPart = item.variant ? `variante ${item.variant}` : 'variante manquante si applicable'
        lines.push(`- ${item.product_name} (${variantPart}) : ${qtyPart}`)
    }
    for (const mention of state.unmatched_mentions) {
        lines.push(`- "${mention}" : article non reconnu dans le catalogue`)
    }

    return lines.join('\n')
}

module.exports = {
    getLeadState,
    setLeadState,
    updateLeadStateFromUserMessage,
    buildLeadStateSummary,
    findBestProduct,
}
