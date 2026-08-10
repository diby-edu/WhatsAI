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

// Retire la ponctuation de bord ("noire." -> "noire") sans toucher au texte interne.
function stripEdgePunctuation(word) {
    return word.replace(/^[.,!?;:()"'«»]+|[.,!?;:()"'«»]+$/g, '')
}

// Mots courants d'une phrase de commande FR qui ne sont ni un produit ni une
// variante — sans ce filtre, "Je veux 15 sac" isole "veux" comme reliquat après
// avoir retiré "sac" du segment, et le fait passer à tort pour une couleur/valeur
// invalide (⛔ dans le résumé envoyé à l'IA).
const STOPWORDS = new Set([
    'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
    'veux', 'voudrais', 'aimerais', 'aime', 'aimer', 'prends', 'prendre', 'prendrais',
    'commande', 'commander', 'voudrai', 'souhaite', 'souhaiterais', 'desire', 'desirerais',
    'svp', 'stp', 'plait', 'merci', 'bonjour', 'bonsoir', 'salut',
    'pour', 'avec', 'sans', 'dans', 'chez', 'sur', 'sous', 'vers', 'par',
    'des', 'les', 'une', 'un', 'du', 'de', 'la', 'le', 'et', 'ou', 'aussi',
    'plus', 'moins', 'ca', 'cela', 'ceci', 'que', 'qui', 'quoi',
])

// Pluriel français basique ("gourdes" -> "gourde") — appliqué avant comparaison
// pour que le pluriel d'un nom déjà typo (ex: catalogue "goube") reste détectable :
// sans ça, "gourdes" (distance 3 de "goube") dépasse le seuil Levenshtein alors
// que son singulier "gourde" (distance 2) passe.
function singularize(word) {
    return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word
}

// Un mot "appartient" au nom du produit s'il matche un de ses termes en préfixe
// (pluriels simples) ou par tolérance aux fautes de frappe une fois singularisé
// (pluriel + typo combinés, ex: "gourdes" -> "goube"). Utilisé à la fois pour le
// score de findBestProduct et pour isoler ce qui reste après le nom du produit.
function termMatchesProductTerm(term, pt) {
    if (pt === term || pt.startsWith(term) || term.startsWith(pt)) return true
    const st = singularize(term)
    const maxLen = Math.max(st.length, pt.length)
    const maxDist = maxLen <= 5 ? 1 : maxLen <= 9 ? 2 : 3
    return levenshtein(st, pt) <= maxDist
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
            // Comparé après singularisation ("gourdes" -> "gourde") pour que le pluriel
            // d'un nom déjà typo reste détectable (sinon distance 3, hors seuil).
            const fuzzyMatches = queryTerms.filter(term =>
                productTerms.some(pt => {
                    const st = singularize(term)
                    const maxLen = Math.max(st.length, pt.length)
                    const maxDist = maxLen <= 5 ? 1 : maxLen <= 9 ? 2 : 3
                    return levenshtein(st, pt) <= maxDist
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

// Retire les mots correspondant au nom du produit d'un segment, pour isoler ce qui
// reste — généralement une tentative de variante. Ex: "gourdes noire" + produit
// "goube enfant" (matché via "gourdes") → reste "noire".
//
// Priorité au texte APRÈS le dernier mot du nom du produit (ordre naturel FR :
// "gourdes noire", "sac vert") — ça évite qu'un préambule avant le produit
// ("Salut je suis monsieur koffi je veux gourdes noire") pollue l'extraction en
// gardant "koffi"/"monsieur" comme si c'était une tentative de variante. Repli sur
// le filtre classique (tout le segment) si l'ordre est inversé ("vert sac").
function extractLeftoverAfterProductName(rest, product) {
    const productTerms = getMeaningfulTerms(product.name)
    const words = rest.split(/\s+/).filter(Boolean).map(stripEdgePunctuation).filter(Boolean)

    const isProductWord = (w) => {
        const norm = normalizeText(w)
        if (norm.length <= 2) return false
        return productTerms.some(pt => termMatchesProductTerm(norm, pt))
    }
    const isNoiseWord = (w) => {
        const norm = normalizeText(w)
        return norm.length <= 2 || STOPWORDS.has(norm)
    }
    const keepWord = (w) => !isNoiseWord(w) && !isProductWord(w)

    let lastProductIdx = -1
    words.forEach((w, i) => { if (isProductWord(w)) lastProductIdx = i })

    if (lastProductIdx >= 0) {
        const afterLeftover = words.slice(lastProductIdx + 1).filter(keepWord)
        if (afterLeftover.length > 0) return afterLeftover.join(' ').trim()
    }

    return words.filter(keepWord).join(' ').trim()
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

// Empile une nouvelle tentative de variante invalide sans écraser les précédentes
// (ex: le client tente "noire" puis "verte" pour le même article dans un seul
// message — les deux doivent être rejetées, pas seulement la dernière).
function addInvalidVariantAttempt(item, attempt) {
    if (!attempt) return
    if (!Array.isArray(item.invalid_variant_attempts)) item.invalid_variant_attempts = []
    const norm = normalizeText(attempt)
    if (!item.invalid_variant_attempts.some(a => normalizeText(a) === norm)) {
        item.invalid_variant_attempts.push(attempt)
    }
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
    // Clés présentes AVANT ce message (tours précédents) — sert à distinguer "le client
    // corrige un choix fait à un tour précédent" (doit résoudre le même item) de "le
    // client énumère plusieurs couleurs pour le même produit dans un seul message" (ce
    // sont des lignes distinctes, ne doit jamais les fusionner entre elles).
    const keysFromPreviousTurns = new Set(existingByKey.keys())
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
                    const pendingItem = pendingItems[0]
                    if (!pendingResult.error && pendingResult.variantOptionName) {
                        const oldKey = itemKey(pendingItem.product_name, pendingItem.variant)
                        existingByKey.delete(oldKey)
                        pendingItem.variant = pendingResult.variantOptionName
                        pendingItem.invalid_variant_attempts = []
                        if (quantity !== null) pendingItem.quantity = quantity
                        existingByKey.set(itemKey(pendingItem.product_name, pendingItem.variant), pendingItem)
                        continue
                    }
                    // Réponse courte, un seul article en attente, mais ne matche AUCUNE
                    // variante réelle de ce produit — probablement une couleur invalide
                    // donnée en réponse directe (ex: le sac demandé n'existe pas en "vert").
                    const restWordCount = rest.split(/\s+/).filter(Boolean).length
                    if (pendingProduct.variants?.length > 0 && restWordCount > 0 && restWordCount <= 3) {
                        addInvalidVariantAttempt(pendingItem, stripEdgePunctuation(rest.trim()))
                        if (quantity !== null) pendingItem.quantity = quantity
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

        // Si aucune variante valide n'a été trouvée mais qu'il reste du texte après avoir
        // retiré le nom du produit, ET que le produit a de vraies variantes, ce texte est
        // probablement une couleur/valeur invalide donnée par le client (ex: "gourdes
        // noire" — noir n'existe pas pour les gourdes) — à distinguer d'une variante
        // simplement jamais donnée, pour que l'IA puisse la rejeter clairement.
        // Plafonné à 3 mots : un vrai nom de couleur/valeur tient en 1-3 mots. Un long
        // reliquat (ex: préambule "salut je suis monsieur koffi..." mal isolé) n'est
        // pas fiable comme tentative de variante — mieux vaut "manquante" que d'injecter
        // du texte non pertinent dans le prompt envoyé à l'IA.
        let invalidVariantAttempt = null
        if (!variant && product.variants?.length > 0) {
            const leftover = extractLeftoverAfterProductName(rest, product)
            const leftoverWordCount = leftover ? leftover.split(/\s+/).filter(Boolean).length : 0
            if (leftover && leftoverWordCount <= 3) invalidVariantAttempt = leftover
        }

        const key = itemKey(product.name, variant)
        let existing = existingByKey.get(key)

        // Si une variante VALIDE vient d'être donnée mais qu'un article du même
        // produit était déjà en attente (variante null, éventuellement avec des
        // tentatives invalides déjà enregistrées), on le résout dans le même item
        // au lieu d'en créer un second en doublon (clé différente : "produit::" vs
        // "produit::bleu").
        if (!existing && variant) {
            const pendingKey = itemKey(product.name, null)
            const pendingItem = existingByKey.get(pendingKey)
            if (pendingItem && keysFromPreviousTurns.has(pendingKey)) {
                existingByKey.delete(pendingKey)
                existing = pendingItem
                existingByKey.set(key, existing)
            }
        }

        if (existing) {
            if (quantity !== null) existing.quantity = quantity
            if (variant) {
                existing.variant = variant
                existing.invalid_variant_attempts = []
            } else if (invalidVariantAttempt) {
                addInvalidVariantAttempt(existing, invalidVariantAttempt)
            }
        } else {
            const newItem = {
                product_id: product.id,
                product_name: product.name,
                variant,
                quantity: quantity,
                invalid_variant_attempts: invalidVariantAttempt ? [invalidVariantAttempt] : [],
            }
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
        let variantPart
        if (item.variant) {
            variantPart = `variante ${item.variant}`
        } else if (item.invalid_variant_attempts?.length > 0) {
            const attempts = item.invalid_variant_attempts.map(a => `"${a}"`).join(', ')
            variantPart = `⛔ le client a demandé ${attempts} — CES VALEURS N'EXISTENT PAS pour cet article, ne les accepte jamais, dis-le clairement au client et redemande une variante réelle`
        } else {
            variantPart = 'variante manquante si applicable'
        }
        lines.push(`- ${item.product_name} (${variantPart}) : ${qtyPart}`)
    }
    for (const mention of state.unmatched_mentions) {
        lines.push(`- "${mention}" : article non reconnu dans le catalogue`)
    }

    return lines.join('\n')
}

// toLocaleString('fr-FR') sépare les milliers par une espace insécable (U+00A0) ou fine
// (U+202F) selon la version d'ICU — \s seul ne les couvre pas forcément, d'où la classe
// explicite construite via échappements Unicode (jamais de caractère spécial littéral).
const THOUSANDS_SEPARATOR_CLASS = '[\\s\\u00A0\\u202F]'
const FCFA_NUMBER_PATTERN = `([\\d](?:${THOUSANDS_SEPARATOR_CLASS}|\\d)*)\\s*FCFA`

/**
 * Lit le TOTAL (et les frais de livraison) directement dans le texte envoyé au
 * client, au format exact produit par preview_cart (tool-cart-preview.js) :
 * "*TOTAL : X FCFA*" et "*Frais de livraison : Y FCFA*". Sert de filet de
 * sécurité pour capture_lead : si l'IA ajoute la livraison "à la main" sans
 * rappeler preview_cart (déjà observé en prod), metadata.lead_cart reste
 * périmé — mais le texte réellement montré au client, lui, reste la source
 * de vérité de ce qu'il a vu/accepté.
 */
function extractRecapTotals(text) {
    if (!text) return null
    const totalMatch = text.match(new RegExp(`TOTAL\\s*:\\s*${FCFA_NUMBER_PATTERN}`, 'i'))
    if (!totalMatch) return null
    const stripSeparators = new RegExp(THOUSANDS_SEPARATOR_CLASS, 'g')
    const total = parseInt(totalMatch[1].replace(stripSeparators, ''), 10)
    if (Number.isNaN(total)) return null

    const feeMatch = text.match(new RegExp(`Frais de livraison\\s*:\\s*${FCFA_NUMBER_PATTERN}`, 'i'))
    const parsedFee = feeMatch ? parseInt(feeMatch[1].replace(stripSeparators, ''), 10) : null

    return { total, deliveryFee: Number.isNaN(parsedFee) ? null : parsedFee }
}

module.exports = {
    getLeadState,
    setLeadState,
    updateLeadStateFromUserMessage,
    buildLeadStateSummary,
    findBestProduct,
    extractRecapTotals,
}
