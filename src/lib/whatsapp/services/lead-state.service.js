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
 *
 * Identité d'un article = produit + STATUT de la variante ('valid' /
 * 'invalid' / 'missing') + valeur associée. Volontairement PAS juste
 * "produit + variante" : "15 gourdes" (couleur pas encore donnée) et
 * "10 gourdes noires" (couleur donnée mais invalide) ont toutes les deux
 * variant=null dans l'ancien modèle → même clé → la 2e écrasait la 1re
 * (bug réel constaté sur données de production, quantité 15 remplacée
 * par 10). Avec le statut dans la clé, ces deux mentions restent deux
 * articles distincts, chacun avec sa vraie quantité.
 */

const { calculateItemPrice } = require('../ai/tools/pricing-logic')
// Même vérité que calculateItemPrice (pricing-logic.js l'utilise déjà en interne pour
// décider si un produit a de vraies variantes sélectionnables) — un simple
// `variants?.length > 0` dirait "oui" pour un produit digital ou un groupe de
// variantes sans options réelles, alors que calculateItemPrice le traite comme sans
// variante ; sans cette cohérence, on flaguerait une "variante invalide" pour un
// produit qui n'en a jamais eu.
const { productHasRealVariants } = require('../ai/tools/tool-helpers')

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
    // Devise — sans ça, "2 sacs à 5000 FCFA" isole "FCFA" comme reliquat après avoir
    // retiré le produit, et le fait passer à tort pour une couleur/valeur invalide.
    'fcfa', 'cfa', 'franc', 'francs', 'euro', 'euros', 'dollar', 'dollars',
    // Logistique — "En boutique" (réponse à "boutique ou livraison ?") ne doit jamais
    // être pris pour une tentative de couleur invalide (bug réel constaté : un article
    // fantôme avait fini avec requested_variant="boutique").
    'boutique', 'livraison', 'livre', 'livree', 'livrer', 'domicile', 'retrait', 'recuperation',
])

// Pluriel français basique ("gourdes" -> "gourde") — appliqué avant comparaison
// pour que le pluriel d'un nom déjà typo (ex: catalogue "goube") reste détectable :
// sans ça, "gourdes" (distance 3 de "goube") dépasse le seuil Levenshtein alors
// que son singulier "gourde" (distance 2) passe.
function singularize(word) {
    return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word
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

// Tolérance faute de frappe, seuil basé sur le plus long des deux mots (une
// insertion/suppression allonge le mot, un seuil sur le plus court serait trop
// strict — ex: "gourde"(6) vs "goube"(5), distance 2, doit passer).
function fuzzyDistanceOk(a, b) {
    const maxLen = Math.max(a.length, b.length)
    const maxDist = maxLen <= 5 ? 1 : maxLen <= 9 ? 2 : 3
    return levenshtein(a, b) <= maxDist
}

// Un mot "appartient" au nom du produit s'il matche un de ses termes en préfixe
// (pluriels simples) ou par tolérance aux fautes de frappe — comparé à la fois en
// forme BRUTE et SINGULARISÉE (jamais l'une à la place de l'autre : singulariser
// AIDE à détecter un pluriel de nom déjà typo, ex: "gourdes"->"gourde" pour matcher
// "goube", mais un terme raccourci resserre parfois le seuil de tolérance — sans
// garder aussi la forme brute, singulariser peut faire ÉCHOUER une correspondance
// qui passait déjà avant, régression réelle trouvée en revue de code). Utilisé à la
// fois pour le score de findBestProduct et pour isoler ce qui reste après le produit.
function termMatchesProductTerm(term, pt) {
    if (pt === term || pt.startsWith(term) || term.startsWith(pt)) return true
    return fuzzyDistanceOk(term, pt) || fuzzyDistanceOk(singularize(term), pt)
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

            // Tolérance faute de frappe (brute + singularisée) — même règle que
            // termMatchesProductTerm, appelée ici plutôt que redupliquée pour que les
            // deux ne puissent jamais diverger.
            const fuzzyMatches = queryTerms.filter(term =>
                productTerms.some(pt => termMatchesProductTerm(term, pt))
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

// Un mot purement numérique ("5000") n'est jamais un nom de variante/couleur — sans
// ce filtre, un prix résiduel dans le texte (ex: "à 5000 FCFA") survivrait au
// nettoyage et serait pris à tort pour une tentative de variante invalide.
const isPurelyNumeric = (w) => /^\d+$/.test(w)

const isNoiseWord = (w) => {
    const norm = normalizeText(w)
    return norm.length <= 2 || STOPWORDS.has(norm) || isPurelyNumeric(norm)
}

// Nettoie un texte "réponse client" pour ne garder que ce qui pourrait être une
// vraie tentative de variante — retire ponctuation de bord et mots courants FR
// ("svp", "je", "veux"...). Utilisé aussi bien pour la réponse nue à une question
// pendante ("svp vert" -> "vert") que par extractLeftoverAfterProductName (mêmes
// règles, jamais deux logiques de nettoyage différentes pour le même concept).
function cleanCandidateVariantText(text) {
    return text.split(/\s+/).filter(Boolean).map(stripEdgePunctuation).filter(Boolean)
        .filter(w => !isNoiseWord(w))
        .join(' ').trim()
}

// Retire les mots correspondant au nom du produit d'un segment, pour isoler ce qui
// reste APRÈS lui — généralement une tentative de variante. Ex: "gourdes noire" +
// produit "goube enfant" (matché via "gourdes") → reste "noire".
//
// Se limite au texte APRÈS le dernier mot du nom du produit (ordre naturel FR :
// "gourdes noire", "sac vert") — ne tente PAS de repli sur "tout ce qui reste" si
// rien ne suit ALORS QUE le nom du produit est bien présent dans ce texte : un
// préambule avant le produit ("Salut je suis monsieur koffi je veux gourdes",
// aucune couleur donnée) ne doit jamais être pris pour une tentative de variante —
// mieux vaut "variante manquante" que "le client a demandé 'suis monsieur koffi'"
// (faux positif réel constaté en vérification approfondie).
//
// Si en revanche le nom du produit n'apparaît PAS DU TOUT dans ce texte (cas de
// l'énumération compacte "Gourde 5 rouge 13 vert" : le 2e morceau "13 vert" hérite
// du produit d'un morceau précédent via anchorProduct, sans jamais nommer "gourde"
// lui-même), il n'y a pas de "avant/après le produit" à distinguer — tout le texte
// nettoyé EST la tentative de variante.
function extractLeftoverAfterProductName(rest, product) {
    const productTerms = getMeaningfulTerms(product.name)
    const words = rest.split(/\s+/).filter(Boolean).map(stripEdgePunctuation).filter(Boolean)

    const isProductWord = (w) => {
        const norm = normalizeText(w)
        if (norm.length <= 2) return false
        return productTerms.some(pt => termMatchesProductTerm(norm, pt))
    }

    let lastProductIdx = -1
    words.forEach((w, i) => { if (isProductWord(w)) lastProductIdx = i })
    if (lastProductIdx < 0) return cleanCandidateVariantText(words.join(' '))

    const afterWords = words.slice(lastProductIdx + 1).filter(w => !isProductWord(w))
    return cleanCandidateVariantText(afterWords.join(' '))
}

// Négation FR ("je n'ai pas choisi de gourde", "sans gourde", "aucune gourde") : un
// segment qui REJETTE un produit ne doit jamais être interprété comme une commande.
// Sans ce garde-fou, la correspondance floue détecte quand même "gourde" dans "Je
// n'ai pas choisi de gourde" et crée un article fantôme pour ce produit — bug réel
// constaté en rejouant une conversation de production (le client corrigeait une
// erreur de l'IA, pas en passant commande). Exige "pas" ET un marqueur "ne"/"n'"
// ensemble (pas juste "pas" seul, qui apparaît aussi dans "pas cher" — un
// qualificatif de prix, pas une négation d'intention).
function isNegationSegment(text) {
    const norm = normalizeText(text)
    const hasNeMarker = /n['’]|(?:^|\s)ne(?:\s|$)/.test(norm)
    const hasPas = /\bpas\b/.test(norm)
    return (hasNeMarker && hasPas) || /\bsans\b/.test(norm) || /\baucune?\b/.test(norm)
}

// Retrait/modification ("enlève 5 sacs", "retire 2 gourdes", "annule les sacs") : le
// moteur n'a aucun moyen fiable de savoir DE QUELLE ligne décrémenter — c'est un
// jugement conversationnel, pas un fait objectif, donc explicitement laissé à l'IA
// (contrainte du projet : jamais de décision prise à sa place). Créer quand même un
// article "+5, couleur inconnue" comme si c'était un AJOUT serait pire que ne rien
// tracker du tout — bug réel constaté (un faux article était créé, contredisant ce
// que le client venait de demander).
function isModificationSegment(text) {
    return /\b(enlev|retir|annul|supprim|reduis|diminue)/i.test(normalizeText(text))
}

// Retire les mots courants UNIQUEMENT en début de texte (s'arrête au premier mot qui
// n'en est pas un) — ex: "je veux aussi 5 chapex rouges" (après retrait du nombre)
// -> "chapex rouges". Volontairement différent de cleanCandidateVariantText (qui
// filtre PARTOUT dans le texte) : filtrer partout ferait perdre en route un vrai nom
// de produit inconnu à cause d'un mot commun ailleurs dans la phrase, alors que ne
// retirer QUE le préambule initial est sûr — une phrase normale sans rapport avec un
// produit ("je peux payer jusqu'à FCFA maximum") ne commence pas par un mot filtrable
// suivi directement d'un nom d'article, donc reste longue et correctement écartée.
function stripLeadingFiller(text) {
    const words = text.split(/\s+/).filter(Boolean)
    let start = 0
    while (start < words.length && isNoiseWord(words[start])) start++
    return words.slice(start).map(stripEdgePunctuation).filter(Boolean).join(' ')
}

// Découpe un message en segments indépendants (lignes + virgules + points + " et ").
// Le point est un séparateur volontaire : "10 gourde noire. Je suis mon Coulibaly"
// sans lui reste un seul segment, où "Je suis mon Coulibaly" (présentation du
// client juste après la couleur) fait déborder le plafond de mots de
// extractLeftoverAfterProductName et efface silencieusement "noire" comme
// tentative invalide (bug réel constaté en rejouant une conversation de production).
function splitSegments(text) {
    return String(text || '')
        .split(/\n|,|\.|\bet\b/i)
        .map(s => s.trim())
        .filter(Boolean)
}

// Un nombre immédiatement suivi d'un mot de devise ("5000 FCFA") est un PRIX, jamais
// une nouvelle quantité — sans cette exclusion, "2 sacs à 5000 FCFA" se découpe à tort
// en 2 morceaux et le second (quantité=5000, aucun produit nommé) hérite du produit du
// 1er morceau via anchorProduct puis ÉCRASE sa quantité correcte (bug réel constaté en
// vérification approfondie : 2 devient 5000).
const CURRENCY_WORD = /^(fcfa|cfa|francs?|euros?|dollars?)\b/i

// Sous-découpe un segment contenant PLUSIEURS nombres sans séparateur (virgule/" et ")
// entre eux, ex: "Gourde 5 rouge 13 bleu" — le nom du produit n'est donné qu'une fois,
// suivi de deux paires quantité+variante. Sans cette étape, parseSegment ne trouve que
// le PREMIER nombre (5) et le second ("13 bleu") reste noyé dans le texte, silencieusement
// perdu (bug réel observé sur données de production : "13 bleu" jamais capturé). Chaque
// nombre à partir du 2e démarre un nouveau morceau ; le 1er morceau garde le préambule.
function splitByRepeatedQuantities(segment) {
    const positions = [...segment.matchAll(/\b\d{1,4}\b/g)]
        .filter(m => !CURRENCY_WORD.test(segment.slice(m.index + m[0].length).trimStart()))
        .map(m => m.index)
    if (positions.length <= 1) return [segment]

    const chunks = []
    for (let i = 0; i < positions.length; i++) {
        const start = i === 0 ? 0 : positions[i]
        const end = i + 1 < positions.length ? positions[i + 1] : segment.length
        const chunk = segment.slice(start, end).trim()
        if (chunk) chunks.push(chunk)
    }
    return chunks
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

// Copie superficielle suffisante : contrairement à l'ancien modèle (un tableau
// invalid_variant_attempts muté en place), chaque article n'a plus que des champs
// scalaires (variant_status/variant/requested_variant/quantity) — plus aucun risque
// qu'un clone partage une structure mutable avec l'état d'origine.
function cloneState(state = {}) {
    return {
        items: Array.isArray(state.items) ? state.items.map(it => ({ ...it })) : [],
        unmatched_mentions: Array.isArray(state.unmatched_mentions) ? state.unmatched_mentions.map(m => ({ ...m })) : [],
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

// Clé d'identité d'un article : produit + STATUT + valeur associée au statut
// (la couleur si valide, la valeur demandée si invalide, rien si manquante).
// C'est ce triplet — pas juste "produit + variante" — qui décide si deux
// mentions désignent le même article ou deux articles distincts.
function itemKey(productName, status, value) {
    return `${normalizeText(productName)}::${status}::${normalizeText(value || '')}`
}

function keyOf(item) {
    return itemKey(item.product_name, item.variant_status, item.variant_status === 'invalid' ? item.requested_variant : item.variant)
}

function makeItem(product, status, value, quantity) {
    return {
        product_id: product.id,
        product_name: product.name,
        variant_status: status,
        variant: status === 'valid' ? value : null,
        requested_variant: status === 'invalid' ? value : null,
        quantity,
    }
}

function applyStatus(item, status, value, quantity) {
    if (quantity !== null) item.quantity = quantity
    item.variant_status = status
    item.variant = status === 'valid' ? value : null
    item.requested_variant = status === 'invalid' ? value : null
}

/**
 * Extrait les articles mentionnés dans le message client et les fusionne
 * avec l'état déjà connu — n'écrase jamais silencieusement une quantité déjà
 * connue par une quantité différente, ne fait qu'ajouter ou compléter.
 */
function updateLeadStateFromUserMessage(previousState, text, products = []) {
    const state = cloneState(previousState)
    if (!text || products.length === 0) return state
    // Un message de position ("Ma position : <lieu> (<lien>)") contient des coordonnées
    // GPS — des nombres sans rapport avec des quantités d'articles. Garde-fou posé ici
    // (pas seulement chez l'appelant) pour que la fonction reste sûre quel que soit
    // l'appelant, présent ou futur.
    if (/^Ma position\s*:/.test(text)) return state

    const existingByKey = new Map(state.items.map(it => [keyOf(it), it]))
    const segments = splitSegments(text)

    for (const segment of segments) {
        // Produit identifié plus tôt DANS CE MÊME SEGMENT (ex: "Gourde" dans "Gourde 5
        // rouge 13 bleu") — hérité par les morceaux suivants qui ne renomment pas le
        // produit, sans quoi "13 bleu" (2e paire quantité+variante) serait perdu.
        let anchorProduct = null
        const chunks = splitByRepeatedQuantities(segment)

        for (const chunk of chunks) {
            const { quantity, rest } = parseSegment(chunk)
            if (!rest) continue

            // "je n'ai pas choisi de gourde" (rejette un produit) ou "enlève 5 sacs"
            // (modifie une ligne existante) ne sont jamais des commandes à tracker —
            // voir isNegationSegment/isModificationSegment pour les bugs réels évités.
            if (isNegationSegment(rest) || isModificationSegment(rest)) continue

            // "7" seul (réponse à "combien en voulez-vous ?") : parseSegment retombe sur
            // le segment entier ("rest || segment.trim()") quand il ne reste rien après
            // extraction du nombre — donc rest="7", pas "". Sans ce garde-fou, ce chiffre
            // est ensuite traité comme s'il était lui-même un nom de produit inconnu (bug
            // réel constaté : "produit non reconnu : 7"). Un nombre seul ne porte aucune
            // information de produit exploitable ici, on l'ignore.
            if (isPurelyNumeric(rest.trim())) continue

            let product = findBestProduct(products, rest)
            if (!product && anchorProduct) product = anchorProduct

            if (!product) {
                // Le segment ne nomme aucun produit — peut être une réponse "nue" à une
                // question de variante déjà posée (ex: le client répond juste "bleu" sans
                // répéter "sac"). On tente de la rattacher SEULEMENT s'il n'y a qu'un seul
                // article en attente (statut non-valide) — sinon, ambigu, on ne devine pas.
                const pendingItems = state.items.filter(it => it.variant_status !== 'valid' && it.product_id)
                if (pendingItems.length === 1) {
                    const pendingItem = pendingItems[0]
                    const pendingProduct = products.find(p => p.id === pendingItem.product_id)
                    if (pendingProduct) {
                        const pendingResult = calculateItemPrice(pendingProduct, {}, rest, 1)
                        if (!pendingResult.error && pendingResult.variantOptionName) {
                            existingByKey.delete(keyOf(pendingItem))
                            applyStatus(pendingItem, 'valid', pendingResult.variantOptionName, quantity)
                            existingByKey.set(keyOf(pendingItem), pendingItem)
                            continue
                        }
                        // Réponse courte, un seul article en attente, mais ne matche AUCUNE
                        // variante réelle de ce produit — probablement une couleur invalide
                        // donnée en réponse directe (ex: le sac demandé n'existe pas en "vert").
                        // Cette supposition est FAIBLE (aucun rapport confirmé avec le produit,
                        // contrairement à extractLeftoverAfterProductName qui part d'un nom de
                        // produit réellement reconnu) — on ne l'autorise donc QUE si l'article
                        // n'a encore AUCUNE valeur invalide déjà enregistrée. Sans ce garde-fou,
                        // un segment sans rapport plus loin dans le même message (ex: "j'habite
                        // à Abobo", une présentation) peut écraser une couleur invalide déjà
                        // correctement détectée par un texte qui n'a jamais été une couleur —
                        // bug réel constaté en testant sur données de production. Nettoyage
                        // identique à extractLeftoverAfterProductName (mots courants FR retirés),
                        // jamais deux logiques de nettoyage différentes pour le même concept.
                        if (productHasRealVariants(pendingProduct) && pendingItem.variant_status === 'missing') {
                            const cleaned = cleanCandidateVariantText(rest)
                            const cleanedWordCount = cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0
                            if (cleaned && cleanedWordCount <= 3) {
                                existingByKey.delete(keyOf(pendingItem))
                                applyStatus(pendingItem, 'invalid', cleaned, quantity)
                                existingByKey.set(keyOf(pendingItem), pendingItem)
                                continue
                            }
                        }
                    }
                }

                // Sinon : ne garder que les segments qui ressemblaient à une tentative
                // d'article — accompagnés d'une quantité ET courts UNE FOIS le préambule
                // ("je veux aussi") retiré du DÉBUT du texte (ex: "je veux aussi 5 chapex
                // rouges" -> "chapex rouges", 2 mots — sinon les 3 mots de préambule
                // faisaient dépasser le plafond et "chapex rouges" n'était jamais capturé,
                // bug réel constaté). Une phrase normale comme "je peux payer jusqu'à FCFA
                // maximum" reste longue malgré ce nettoyage (elle ne commence pas par un
                // mot filtrable suivi directement d'un nom d'article) et n'est donc jamais
                // prise à tort pour un article non reconnu. La quantité est conservée avec
                // la mention (jamais juste le texte) — et si le même texte revient avec une
                // quantité DIFFÉRENTE, on garde les deux mentions au lieu d'écraser
                // silencieusement l'une par l'autre.
                const filteredRest = stripLeadingFiller(rest)
                const restWordCount = filteredRest.split(/\s+/).filter(Boolean).length
                if (quantity !== null && filteredRest && restWordCount > 0 && restWordCount <= 4) {
                    const normRest = normalizeText(filteredRest)
                    const existingMention = state.unmatched_mentions.find(m => normalizeText(m.text) === normRest)
                    if (!existingMention) {
                        state.unmatched_mentions.push({ text: filteredRest, quantity })
                    } else if (existingMention.quantity !== quantity) {
                        state.unmatched_mentions.push({ text: filteredRest, quantity })
                    }
                }
                continue
            }

            anchorProduct = product

            const pricingResult = calculateItemPrice(product, {}, rest, quantity || 1)
            const variant = pricingResult.variantOptionName || null

            let status, value
            if (variant) {
                status = 'valid'
                value = variant
            } else if (productHasRealVariants(product)) {
                // Si aucune variante valide n'a été trouvée mais qu'il reste du texte après
                // avoir retiré le nom du produit, ce texte est probablement une couleur/valeur
                // invalide donnée par le client (ex: "gourdes noire" — noir n'existe pas pour
                // les gourdes) — à distinguer d'une variante simplement jamais donnée, pour que
                // l'IA puisse la rejeter clairement. Plafonné à 3 mots : un vrai nom de couleur
                // tient en 1-3 mots ; un long reliquat n'est pas fiable comme tentative de
                // variante — mieux vaut "manquante" que d'injecter du texte non pertinent.
                const leftover = extractLeftoverAfterProductName(rest, product)
                const leftoverWordCount = leftover ? leftover.split(/\s+/).filter(Boolean).length : 0
                if (leftover && leftoverWordCount <= 3) {
                    status = 'invalid'
                    value = leftover
                } else {
                    status = 'missing'
                    value = null
                }
            } else {
                status = 'missing'
                value = null
            }

            const key = itemKey(product.name, status, value)
            let existing = existingByKey.get(key)

            // Résolution "article en attente" : uniquement quand ce nouveau statut est
            // 'valid' ET qu'aucun article n'a déjà exactement cette clé. On cherche alors
            // s'il existe EXACTEMENT UN article non-valide (manquant ou invalide) pour ce
            // même produit ailleurs dans l'état — si oui, c'est sans ambiguïté la réponse à
            // cette question ouverte, on la met à jour en place plutôt que d'empiler un
            // doublon. S'il y a 0 ou 2+ candidats, on ne devine pas : nouvel article séparé.
            // Ex: "15 gourdes noire, 4 gourdes verte, 2 gourde rouge" — quand "rouge" arrive,
            // 2 candidats invalides (noire, verte) déjà en attente → ambigu → "rouge" devient
            // un 3e article séparé, comme le client l'a réellement exprimé.
            if (!existing && status === 'valid') {
                const pendingCandidates = state.items.filter(it => it.product_id === product.id && it.variant_status !== 'valid')
                if (pendingCandidates.length === 1) {
                    existing = pendingCandidates[0]
                    existingByKey.delete(keyOf(existing))
                }
            }

            if (existing) {
                const isStatusChange = existing.variant_status !== status
                    || (status === 'invalid' && normalizeText(existing.requested_variant || '') !== normalizeText(value || ''))

                // Garde-fou anti-écrasement : si l'article existant a déjà une quantité RÉELLE
                // et que la nouvelle mention en donne une AUTRE, ET qu'il ne s'agit PAS d'un
                // changement de statut (donc une redite exacte du même statut+valeur), ne pas
                // écraser silencieusement — créer un article séparé (ex: "15 gourdes" puis,
                // dans le même message, "10 gourdes" sans jamais de couleur : deux quantités
                // réelles différentes pour le même statut "manquante", ambigu, garder les deux).
                const hasConflictingQuantity = !isStatusChange
                    && existing.quantity !== null && quantity !== null && existing.quantity !== quantity

                if (hasConflictingQuantity) {
                    const newItem = makeItem(product, status, value, quantity)
                    state.items.push(newItem)
                    existingByKey.set(key, newItem)
                } else {
                    applyStatus(existing, status, value, quantity)
                    existingByKey.set(key, existing)
                }
            } else {
                const newItem = makeItem(product, status, value, quantity)
                state.items.push(newItem)
                existingByKey.set(key, newItem)
            }
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
        if (item.variant_status === 'valid') {
            variantPart = `variante ${item.variant}`
        } else if (item.variant_status === 'invalid') {
            variantPart = `⛔ le client a demandé "${item.requested_variant}" — CETTE VALEUR N'EXISTE PAS pour cet article, ne l'accepte jamais, dis-le clairement au client et redemande une variante réelle`
        } else {
            variantPart = 'variante manquante si applicable'
        }
        lines.push(`- ${item.product_name} (${variantPart}) : ${qtyPart}`)
    }
    for (const mention of state.unmatched_mentions) {
        lines.push(`- "${mention.text}" (quantité ${mention.quantity}) : article non reconnu dans le catalogue`)
    }

    return lines.join('\n')
}

// toLocaleString('fr-FR') sépare les milliers par une espace insécable (U+00A0) ou fine
// (U+202F) selon la version d'ICU — \s seul ne les couvre pas forcément, d'où la classe
// explicite construite via échappements Unicode (jamais de caractère spécial littéral).
const THOUSANDS_SEPARATOR_CLASS = '[\\s\\u00A0\\u202F]'
const FCFA_NUMBER_PATTERN = `([\\d](?:${THOUSANDS_SEPARATOR_CLASS}|\\d)*)\\s*FCFA`

// Retourne le DERNIER match d'un pattern global (pas le premier) : si un message
// contient exceptionnellement deux mentions de "TOTAL" (ex: l'IA cite un montant
// précédent avant de donner le montant corrigé), c'est la dernière — la plus
// récente, donc la plus fiable — qui doit l'emporter, pas la première rencontrée.
function lastMatch(text, pattern) {
    const matches = [...text.matchAll(new RegExp(pattern, 'gi'))]
    return matches.length > 0 ? matches[matches.length - 1] : null
}

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
    const totalMatch = lastMatch(text, `TOTAL\\s*:\\s*${FCFA_NUMBER_PATTERN}`)
    if (!totalMatch) return null
    const stripSeparators = new RegExp(THOUSANDS_SEPARATOR_CLASS, 'g')
    const total = parseInt(totalMatch[1].replace(stripSeparators, ''), 10)
    if (Number.isNaN(total)) return null

    const feeMatch = lastMatch(text, `Frais de livraison\\s*:\\s*${FCFA_NUMBER_PATTERN}`)
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
