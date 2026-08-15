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
    // Verbes de parole — le client qui répète ou confirme ("J'ai dis 10", "je précise 10")
    // ne nomme aucun article. Sans ces mots, "J'ai dis" survivait au nettoyage et le
    // moteur enregistrait un article fantôme « J'ai dis » de quantité 10 (bug réel
    // constaté en production le 11/08/2026).
    'ai', 'as', 'avons', 'avez', 'ont', 'dis', 'dit', 'dire', 'disais', 'redis',
    'precise', 'precisais', 'confirme', 'confirmais', 'repete', 'repetais', 'redemande',
    // Verbes/pronoms fréquents d'une phrase ordinaire — sans eux, des fragments comme
    // "c'est bien noté", "suis cocody riviera" ou "moi" devenaient des articles fantômes
    // (constaté sur un corpus de messages difficiles, 11/08/2026).
    'est', 'sont', 'suis', 'etes', 'sommes', 'etait', 'sera', 'bien', 'note', 'notee',
    'moi', 'toi', 'lui', 'eux', 'mon', 'ton', 'son', 'mes', 'tes', 'ses', 'notre', 'votre',
    'autre', 'autres', 'meme', 'memes', 'habite', 'appelle', 'nomme', 'juste', 'seulement',
    // Destinataires — "4 autres pour mon fils" laissait "fils" comme article commandé.
    // Volontairement SANS "enfant", qui fait partie des noms de produits du catalogue.
    'fils', 'fille', 'filles', 'femme', 'mari', 'frere', 'soeur', 'ami', 'amie',
    'maman', 'papa', 'mere', 'pere', 'cousin', 'cousine', 'neveu', 'niece',
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

// Pronom élidé collé au verbe : "j'ai", "n'ai", "qu'il" forment un seul token, donc
// aucun mot de STOPWORDS ne les couvre. Sans ce dépliage, "J'ai dis 10" laisse le
// reliquat "J'ai dis" et le moteur l'enregistre comme un article inconnu.
const ELIDED_PRONOUN_PREFIX = /^(?:[jnmtsldc]|qu)['’]/

const isNoiseWord = (w) => {
    const norm = normalizeText(w)
    const stem = ELIDED_PRONOUN_PREFIX.test(norm) ? norm.replace(ELIDED_PRONOUN_PREFIX, '') : norm
    return norm.length <= 2 || stem.length <= 2 ||
        STOPWORDS.has(norm) || STOPWORDS.has(stem) || isPurelyNumeric(norm)
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
    // "pas de gourde pour moi" : à l'oral le "ne" saute presque toujours. Exiger les deux
    // marqueurs laissait passer la négation la plus courante, et le segment créait une
    // ligne fantôme pour le produit que le client venait justement de refuser.
    const hasSpokenNegation = /\bpas\s+(?:de|d['’])/.test(norm)
    return (hasNeMarker && hasPas) || hasSpokenNegation || /\bsans\b/.test(norm) || /\baucune?\b/.test(norm)
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

// Quantités écrites en toutes lettres. Volontairement NON utilisé par parseSegment :
// "un"/"une" sont d'abord des déterminants, et les traiter comme des quantités en
// amont ferait naître des articles fantômes sur des phrases banales ("une autre
// couleur" -> article inconnu "autre couleur" de quantité 1). On ne s'en sert donc
// qu'APRÈS avoir identifié un produit réel, là où "une gourde bleue" ne peut vouloir
// dire qu'une chose. Bug réel : "4 gourde rouge, une goude bleu" enregistrait la
// gourde bleue avec quantity=null.
const WORD_QUANTITIES = new Map([
    ['un', 1], ['une', 1], ['deux', 2], ['trois', 3], ['quatre', 4], ['cinq', 5],
    ['six', 6], ['sept', 7], ['huit', 8], ['neuf', 9], ['dix', 10],
    ['onze', 11], ['douze', 12], ['treize', 13], ['quatorze', 14], ['quinze', 15],
    ['seize', 16], ['vingt', 20], ['trente', 30], ['cinquante', 50], ['cent', 100],
])

// Le texte est-il EXACTEMENT une valeur de variante de ce produit ? Volontairement
// strict, contrairement à calculateItemPrice qui matche aussi par inclusion : « ardoise
// noir » contient « noir » et serait accepté comme la couleur Noir du sac, ce qui ferait
// disparaître un vrai article inconnu du catalogue (régression constatée en écrivant ce
// correctif). Ici on ne veut reconnaître qu'une réponse nue du type « jaune ».
function matchesVariantOptionExactly(product, text) {
    const norm = normalizeText(text)
    if (!norm) return null
    for (const variant of product?.variants || []) {
        for (const option of variant.options || []) {
            const value = option?.value ?? option?.name ?? option
            // Tolérance au genre et au pluriel ("2 bleues" pour l'option "Bleu"), mais sur
            // le texte ENTIER : "ardoise noir" reste à distance 8 de "noir" et n'est donc
            // jamais confondu avec la couleur, contrairement au matching par inclusion.
            if (fuzzyDistanceOk(singularize(norm), singularize(normalizeText(value)))) return value
        }
    }
    return null
}

// Ce mot apparaît-il dans une des valeurs de variante du produit ? Sert à repérer un
// mot "étranger" dans une réponse censée être une variante nue — comparaison tolérante
// aux fautes et au genre ("noire" ↔ "Noir"), contrairement à matchesVariantOptionExactly
// qui compare la valeur entière.
function productHasVariantWord(product, word) {
    const norm = singularize(normalizeText(stripEdgePunctuation(word)))
    if (!norm) return true
    for (const variant of product?.variants || []) {
        // Le nom du groupe fait partie du vocabulaire légitime d'une réponse de variante :
        // le client répond souvent "couleur bleu" et pas seulement "bleu".
        const vocabulary = [variant.name, ...(variant.options || []).map(o => o?.value ?? o?.name ?? o)]
        for (const entry of vocabulary) {
            for (const entryWord of normalizeText(entry).split(/\s+/).filter(Boolean)) {
                if (fuzzyDistanceOk(norm, singularize(entryWord))) return true
            }
        }
    }
    return false
}

// "une dizaine", "deux douzaines" : le nombre porte sur un COLLECTIF approximatif, pas
// sur les articles. Lire "une" comme la quantité 1 y produit une valeur fausse — pire
// qu'une absence, puisque l'agent ne la demandera plus. On préfère ne rien conclure et
// laisser l'IA demander le nombre exact (règle "n'invente jamais une quantité").
const COLLECTIVE_QUANTITIES = new Set([
    'dizaine', 'dizaines', 'douzaine', 'douzaines', 'quinzaine', 'quinzaines',
    'vingtaine', 'vingtaines', 'trentaine', 'trentaines', 'cinquantaine', 'cinquantaines',
    'centaine', 'centaines', 'millier', 'milliers', 'paire', 'paires', 'poignee', 'poignees',
])

function parseWordQuantity(text) {
    const words = normalizeText(text).split(/\s+/).filter(Boolean).map(stripEdgePunctuation)
    for (let i = 0; i < words.length; i++) {
        const value = WORD_QUANTITIES.get(words[i])
        if (value === undefined) continue
        if (COLLECTIVE_QUANTITIES.has(words[i + 1] || '')) return null
        return value
    }
    return null
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
        // Le client a exprimé un retrait ou une annulation que le moteur n'applique
        // volontairement pas (c'est un jugement conversationnel, laissé à l'IA). L'état
        // cesse alors de refléter la commande réelle, et tout code qui s'en sert comme
        // source de vérité doit s'abstenir — voir buildItemsFromLeadState.
        has_unapplied_change: state.has_unapplied_change === true,
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
// Retrait en boutique ou livraison ? Information capitale, et jusqu'ici jamais captée :
// le champ existait dans l'état mais restait null en permanence. Conséquences observées —
// le mode n'atteignait le lead que si l'IA pensait à l'écrire dans un texte libre, et rien
// ne permettait de vérifier qu'un récap de livraison portait bien des frais.
//
// Détecté sur le texte BRUT, avant tout nettoyage : "boutique", "livraison", "retrait" sont
// des mots courants filtrés plus bas pour la reconnaissance produit (voir STOPWORDS).
// Comparaison sur le texte NORMALISÉ (minuscules, accents retirés) : en JavaScript, `\b`
// ne reconnaît pas les lettres accentuées comme des caractères de mot, si bien que
// /livré\b/ ne matche jamais "livré" suivi d'un espace. Piège rencontré ici même.
const PICKUP_PATTERN = /\b(en boutique|au magasin|sur place|je passe.{0,15}(prendre|chercher|recuperer)|je viens.{0,15}(chercher|prendre|recuperer)|retrait)\b/
const DELIVERY_PATTERN = /(\blivr\w*|\ba domicile\b)/

function detectFulfillmentMode(text) {
    const value = normalizeText(text)
    const pickup = PICKUP_PATTERN.test(value)
    const delivery = DELIVERY_PATTERN.test(value)
    // Les deux dans la même phrase = la question posée par l'agent recopiée, ou une
    // hésitation. On ne tranche pas : c'est un choix du client, jamais une déduction.
    if (pickup === delivery) return null
    return pickup ? 'pickup' : 'delivery'
}

/**
 * À quelle ligne se rapporte une réponse nue du client ?
 *
 * Le moteur ne voyait jusqu'ici que les messages du CLIENT. Quand plusieurs lignes du même
 * produit attendaient une couleur, il refusait d'appliquer un « Bleu » isolé — à raison, il
 * ne pouvait pas savoir laquelle était visée. Sauf que l'agent, lui, avait posé la question
 * ligne par ligne : « Et pour les 6 sacs enfants, quelle couleur ? ».
 *
 * Conséquence réelle (conversation du 12/08/2026) : les deux lignes sont restées en couleur
 * invalide, donc aucun article complet, donc preview_cart jamais appelé, donc ni prix ni
 * total ni mise en forme, et un lead enregistré vide. Une seule cause, trois symptômes.
 *
 * On lit donc la question de l'agent — uniquement ses phrases INTERROGATIVES, car
 * « Pour les 8 sacs vous avez choisi Bleu. Et pour les 6, quelle couleur ? » parle des deux
 * lignes mais n'en interroge qu'une. Et on n'agit que si UNE SEULE ligne correspond : sinon
 * l'ambiguïté est réelle et on continue de s'abstenir.
 */
function narrowPendingByAssistantQuestion(assistantMessage, pendingItems) {
    if (!assistantMessage || !Array.isArray(pendingItems) || pendingItems.length < 2) return null

    const questions = String(assistantMessage)
        .split(/(?<=[.!?])\s+|\n+/)
        .filter(sentence => sentence.includes('?'))
    if (questions.length === 0) return null

    const quantities = new Set()
    for (const question of questions) {
        for (const match of question.matchAll(/\b(\d{1,4})\b/g)) {
            // Un nombre suivi d'une devise est un PRIX, jamais une quantité de ligne.
            if (CURRENCY_WORD.test(question.slice(match.index + match[0].length).trimStart())) continue
            quantities.add(parseInt(match[1], 10))
        }
    }
    if (quantities.size !== 1) return null

    const target = pendingItems.filter(item => item.quantity === [...quantities][0])
    return target.length === 1 ? target[0] : null
}

/**
 * L'agent a-t-il ACTÉ une couleur pour une ligne précise au tour d'avant ?
 *
 * Complément de narrowPendingByAssistantQuestion : la question dit quelle ligne est
 * interrogée, l'affirmation dit quelle ligne est résolue. Sans lire les deux, l'état reste
 * à moitié faux — « Pour les 8 sacs enfants, vous avez choisi la couleur Bleu » resterait
 * une ligne « rose invalide » pour toujours, et le résumé continuerait d'affirmer à l'IA
 * que cette couleur n'existe pas.
 *
 * On n'enregistre pas une décision du backend : on enregistre ce que l'agent a annoncé au
 * client, qui l'a lu sans le contredire. Conditions strictes — phrase NON interrogative,
 * une quantité, une couleur qui existe réellement au catalogue, et une seule ligne en
 * attente portant cette quantité.
 */
const CONFIRMATION_MARKER = /(vous avez choisi|c'est not[ée]|bien not[ée]|est confirm[ée]|j'ai (?:bien )?enregistr[ée])/i

function applyAssistantConfirmations(state, assistantMessage, products) {
    if (!assistantMessage || !Array.isArray(products) || products.length === 0) return

    for (const sentence of String(assistantMessage).split(/(?<=[.!?])\s+|\n+/)) {
        if (sentence.includes('?')) continue
        if (!CONFIRMATION_MARKER.test(sentence)) continue

        const quantityMatch = sentence.match(/\b(\d{1,4})\b/)
        if (!quantityMatch) continue
        if (CURRENCY_WORD.test(sentence.slice(quantityMatch.index + quantityMatch[0].length).trimStart())) continue
        const quantity = parseInt(quantityMatch[1], 10)

        const pending = state.items.filter(it => it.variant_status !== 'valid' && it.quantity === quantity && it.product_id)
        if (pending.length !== 1) continue

        const product = products.find(p => p.id === pending[0].product_id)
        if (!product) continue

        // La couleur doit exister VRAIMENT au catalogue : on ne recopie pas une invention.
        let confirmed = null
        for (const word of normalizeText(sentence).split(/\s+/).filter(Boolean)) {
            confirmed = matchesVariantOptionExactly(product, stripEdgePunctuation(word))
            if (confirmed) break
        }
        if (!confirmed) continue

        applyStatus(pending[0], 'valid', confirmed, pending[0].quantity)
    }
}

function updateLeadStateFromUserMessage(previousState, text, products = [], options = {}) {
    const state = cloneState(previousState)
    if (!text || products.length === 0) return state
    // Un message de position ("Ma position : <lieu> (<lien>)") contient des coordonnées
    // GPS — des nombres sans rapport avec des quantités d'articles. Garde-fou posé ici
    // (pas seulement chez l'appelant) pour que la fonction reste sûre quel que soit
    // l'appelant, présent ou futur.
    if (/^Ma position\s*:/.test(text)) return state

    // Un mode déjà choisi n'est écrasé que par un choix explicite contraire du client.
    const fulfillment = detectFulfillmentMode(text)
    if (fulfillment) state.fulfillment_mode = fulfillment

    // Article hors catalogue déjà signalé au client : on le note, pour que le garde-fou qui
    // veille à ce qu'aucune ligne ne soit passée sous silence (generator.js#
    // findUnannouncedUnknownItem) cesse d'insister une fois la chose dite. Sans ce marqueur,
    // l'agent répéterait « nous ne vendons pas d'ardoises » à chaque récapitulatif suivant.
    if (options.lastAssistantMessage) {
        const saidByAgent = normalizeText(options.lastAssistantMessage).split(/\s+/).filter(Boolean)
        for (const mention of state.unmatched_mentions) {
            if (mention.announced === true) continue
            const head = singularize(normalizeText(String(mention.text || '').trim().split(/\s+/)[0] || ''))
            if (head.length < 3) continue
            const named = saidByAgent.some(word => fuzzyDistanceOk(singularize(word.replace(/[^\p{L}\p{N}]/gu, '')), head))
            if (named) mention.announced = true
        }
    }

    // Ce que l'agent a acté au tour précédent fait partie de l'état de la conversation.
    applyAssistantConfirmations(state, options.lastAssistantMessage, products)

    const existingByKey = new Map(state.items.map(it => [keyOf(it), it]))
    const segments = splitSegments(text)

    // Dernière quantité "nue" (aucun produit nommé) vue dans CE message, tous segments
    // confondus — jamais persistée dans state, donc ne fuite jamais vers le message
    // suivant. Sert à désambiguïser une réponse plus loin dans le MÊME message quand
    // 2+ articles du même produit sont en attente (ex: "Finalement les 15, je les veux
    // rouge" — la virgule sépare "15" de "rouge" en deux segments distincts ; sans ce
    // suivi, "rouge" ne peut jamais se rattacher puisqu'il y a 2 candidats ambigus).
    let lastBareQuantity = null
    // Dernier produit réellement nommé dans CE message, tous segments confondus —
    // contrairement à anchorProduct qui est réinitialisé à chaque segment. Sert aux
    // énumérations elliptiques coupées par une virgule ou un " et ".
    let messageAnchorProduct = null
    // Lignes créées ou mises à jour pendant le traitement de CE message. Sert à distinguer
    // une énumération (« 5 gourde, 14 ardoise » — le client liste) d'une réponse à une
    // question posée au tour précédent (« Orange » — le client répond). Voir plus bas.
    const touchedThisMessage = new Set()

    for (const segment of segments) {
        // Produit identifié plus tôt DANS CE MÊME SEGMENT (ex: "Gourde" dans "Gourde 5
        // rouge 13 bleu") — hérité par les morceaux suivants qui ne renomment pas le
        // produit, sans quoi "13 bleu" (2e paire quantité+variante) serait perdu.
        let anchorProduct = null
        const chunks = splitByRepeatedQuantities(segment)

        for (const chunk of chunks) {
            // `let` : la quantité peut être complétée plus bas par sa forme en toutes
            // lettres, une fois seulement qu'un produit réel a été identifié.
            let { quantity, rest } = parseSegment(chunk)
            if (!rest) continue

            // "je n'ai pas choisi de gourde" (rejette un produit) ou "enlève 5 sacs"
            // (modifie une ligne existante) ne sont jamais des commandes à tracker —
            // voir isNegationSegment/isModificationSegment pour les bugs réels évités.
            if (isNegationSegment(rest) || isModificationSegment(rest)) {
                // On ne devine pas CE QUI change, mais on note QUE quelque chose a changé :
                // sans ce drapeau, l'état continue d'affirmer des lignes que le client vient
                // d'annuler. Cas réel : "Non je ne veux pas 10 sac enfant noir" — l'IA retire
                // bien la ligne de la commande, l'état la garde indéfiniment.
                state.has_unapplied_change = true
                continue
            }

            // "7" seul (réponse à "combien en voulez-vous ?") : parseSegment retombe sur
            // le segment entier ("rest || segment.trim()") quand il ne reste rien après
            // extraction du nombre — donc rest="7", pas "". Sans ce garde-fou, ce chiffre
            // est ensuite traité comme s'il était lui-même un nom de produit inconnu (bug
            // réel constaté : "produit non reconnu : 7"). Un nombre seul ne porte aucune
            // information de produit exploitable ici, on l'ignore.
            if (isPurelyNumeric(rest.trim())) continue

            let product = findBestProduct(products, rest)
            if (!product && anchorProduct) product = anchorProduct

            // Énumération elliptique répartie sur PLUSIEURS segments : "Sac 5 bleu, 3 jaune
            // et 2 noir" est découpé par la virgule et " et ", donc anchorProduct — volontairement
            // limité au segment courant — ne couvre pas "3 jaune" ni "2 noir". Résultat observé
            // en production : ces deux morceaux étaient enregistrés comme des ARTICLES INCONNUS
            // du catalogue, et le résumé ordonnait à l'IA d'annoncer au client qu'on ne vend pas
            // de "jaune".
            // On étend donc l'ancre au dernier produit nommé dans le MESSAGE, mais uniquement
            // pour un morceau qui est sans ambiguïté une paire quantité + variante réelle de ce
            // produit. Sans cette double condition, une phrase sans rapport ("mon nom est Alain")
            // hériterait du produit et créerait une ligne fantôme.
            if (!product && messageAnchorProduct && quantity !== null) {
                const candidate = cleanCandidateVariantText(rest)
                if (candidate && matchesVariantOptionExactly(messageAnchorProduct, candidate)) {
                    product = messageAnchorProduct
                }
            }

            if (!product) {
                if (quantity !== null) lastBareQuantity = quantity

                // Le segment ne nomme aucun produit — peut être une réponse "nue" à une
                // question de variante déjà posée (ex: le client répond juste "bleu" sans
                // répéter "sac"). On tente de la rattacher SEULEMENT s'il n'y a qu'un seul
                // article en attente (statut non-valide) — sinon, ambigu, on ne devine pas.
                let pendingItems = state.items.filter(it => it.variant_status !== 'valid' && it.product_id)

                // 2+ articles en attente pour des produits différents ou le même produit :
                // si une quantité NUE a déjà été vue plus tôt dans CE message et qu'elle
                // correspond exactement à UN SEUL des articles en attente, ce n'est pas une
                // supposition — c'est le client qui redonne le chiffre exact d'une ligne
                // déjà connue pour la désigner (ex: "Finalement les 15, je les veux rouge").
                if (pendingItems.length > 1 && lastBareQuantity !== null) {
                    const narrowed = pendingItems.filter(it => it.quantity === lastBareQuantity)
                    if (narrowed.length === 1) pendingItems = narrowed
                }

                // Dernier recours avant de s'abstenir : la question que l'agent vient de
                // poser désigne peut-être la ligne sans ambiguïté (voir la fonction).
                if (pendingItems.length > 1) {
                    const answered = narrowPendingByAssistantQuestion(options.lastAssistantMessage, pendingItems)
                    if (answered) pendingItems = [answered]
                }

                if (pendingItems.length === 1) {
                    const pendingItem = pendingItems[0]
                    const pendingProduct = products.find(p => p.id === pendingItem.product_id)
                    if (pendingProduct) {
                        const pendingResult = calculateItemPrice(pendingProduct, {}, rest, 1)
                        // calculateItemPrice matche par INCLUSION : "10 ardoise noir" contient
                        // "noir" et serait pris pour la couleur du sac en attente — l'ardoise,
                        // article inconnu du catalogue, disparaît alors en écrasant la ligne
                        // existante (bug réel présent avant ce correctif : "4 sac vert, 10
                        // ardoise noir" ne laissait qu'un "sac Noir ×10").
                        // Une vraie réponse nue tient en un mot ("noire", "bleu foncé" pour une
                        // option en deux mots). Dès qu'un mot du reliquat n'appartient à AUCUNE
                        // option du produit, ce n'est pas une réponse de variante.
                        const strayWord = pendingResult.variantOptionName
                            ? cleanCandidateVariantText(rest).split(/\s+/).filter(Boolean)
                                .find(word => !productHasVariantWord(pendingProduct, word))
                            : null
                        if (!pendingResult.error && pendingResult.variantOptionName && !strayWord) {
                            existingByKey.delete(keyOf(pendingItem))
                            applyStatus(pendingItem, 'valid', pendingResult.variantOptionName, quantity)
                            existingByKey.set(keyOf(pendingItem), pendingItem)
                            // Le produit est désormais connu pour la SUITE du message : sans ça,
                            // le second morceau d'une répartition n'avait plus aucune ancre.
                            // Bug réel (13/08/2026) : le client annonce 6 gourdes, l'agent
                            // demande la couleur, il répond « 3 rouge et 4 bleu ». Le premier
                            // morceau se rattachait bien à la ligne en attente — ce qui la
                            // rendait valide, donc vidait la liste des lignes en attente — et le
                            // second, « 4 bleu », se retrouvait sans produit ni ancre : il
                            // finissait enregistré comme un ARTICLE INCONNU nommé "bleu", et le
                            // résumé ordonnait à l'IA d'annoncer au client qu'on n'en vend pas.
                            messageAnchorProduct = pendingProduct
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
                        const cleaned = cleanCandidateVariantText(rest)
                        const cleanedWordCount = cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0

                        // ⛔ UN ARTICLE VOISIN N'EST PAS UNE COULEUR.
                        //
                        // Défaut systématique constaté le 13/08/2026 (5 cas sur 5 en corpus) :
                        // quand le MÊME message nomme un produit en attente de variante ET un
                        // article inconnu, l'article inconnu était absorbé comme la « couleur »
                        // du produit — et sa quantité écrasait celle du produit.
                        //   « 5 gourde, 14 ardoise »   → 14 gourdes couleur "ardoise"
                        //   « 5 gourde et 3 chaises »  → 3 gourdes couleur "chaises"
                        //   « 10 sac noir, 5 gourde, 7 tabouret » → 7 gourdes couleur "tabouret"
                        // Trois dégâts d'un coup : la quantité est fausse, l'article inconnu
                        // disparaît (jamais signalé au client), et le résumé ordonne à l'IA de
                        // refuser une couleur que le client n'a jamais demandée.
                        //
                        // Le discriminant est la QUANTITÉ PROPRE du morceau, pas sa longueur :
                        // « 14 ardoise » compte ses propres unités, c'est un article ; « verte »
                        // n'en a pas, c'est un qualificatif. Combiné au fait que la ligne vient
                        // d'être créée dans CE message (donc le client énumère, il ne répond pas
                        // à une question), le cas est tranché sans ambiguïté.
                        const chunkIsNeighbouringItem = quantity !== null && touchedThisMessage.has(pendingItem)

                        if (!chunkIsNeighbouringItem && productHasRealVariants(pendingProduct) && pendingItem.variant_status === 'missing') {
                            // LIMITE CONNUE : ce plafond de 3 mots laisse passer une phrase sans
                            // rapport comme couleur invalide ("je suis a cocody riviera 3" →
                            // couleur "cocody riviera"). Le resserrer à 1 mot a été essayé et
                            // rejeté : il laisse passer les mots isolés ("possible" dans
                            // "livraison possible ?") tout en cassant des cas légitimes en deux
                            // mots. La longueur n'est pas le bon discriminant ici — il faudrait
                            // savoir si une question de variante vient d'être posée, information
                            // que ce moteur n'a pas (il ne voit que les messages du client).
                            if (cleaned && cleanedWordCount <= 3) {
                                existingByKey.delete(keyOf(pendingItem))
                                applyStatus(pendingItem, 'invalid', cleaned, quantity)
                                existingByKey.set(keyOf(pendingItem), pendingItem)
                                // Même raison que ci-dessus : la suite du message peut porter
                                // le second morceau d'une répartition ("verte et 4 bleu").
                                messageAnchorProduct = pendingProduct
                                continue
                            }
                        }

                        // Reformulation pure ("svp plutôt 10" une fois les mots courants
                        // retirés) : plus AUCUN mot exploitable après nettoyage, mais un
                        // chiffre est présent — mise à jour de quantité pure, sans toucher au
                        // statut/valeur, quel que soit le statut actuel. Volontairement limité
                        // au cas où `cleaned` est VIDE (pas juste court) : un reliquat non-vide
                        // peut être un vrai nom de produit non reconnu avec sa propre quantité
                        // (ex: "je veux aussi 5 chapex rouges" après un article déjà en
                        // attente) — régression réelle constatée en testant une version plus
                        // permissive de ce correctif, qui avalait "chapex rouges" comme une
                        // simple correction de quantité. Ne couvre donc pas toutes les
                        // reformulations ("finalement remet 15" garde un reliquat non vide,
                        // "finalement remet") — cas volontairement laissé à l'IA plutôt que de
                        // rouvrir une liste de mots-clés (même raisonnement que la négation).
                        if (!cleaned && quantity !== null) {
                            pendingItem.quantity = quantity
                            continue
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
                // Plafond resserré de 4 à 2 mots : un nom d'article inconnu tient en 1-2 mots
                // ("chaises blanches", "ardoise noir"). Au-delà, c'est un morceau de phrase —
                // "autres pour mon fils" et "suis cocody riviera" étaient enregistrés comme
                // des articles commandés (constaté sur corpus difficile, 11/08/2026).
                if (quantity !== null && filteredRest && restWordCount > 0 && restWordCount <= 2) {
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
            messageAnchorProduct = product

            // Quantité en toutes lettres : sûre à lire seulement maintenant, un produit réel
            // ayant été identifié dans ce morceau (voir WORD_QUANTITIES).
            if (quantity === null) quantity = parseWordQuantity(chunk)

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

            // Répétition, pas nouvelle commande : le client qui redit "les 10 sacs c'est bien
            // noté" ne commande pas 10 sacs de plus. Quand le segment n'apporte AUCUNE
            // information de variante (status 'missing') mais que ce produit a déjà une ligne
            // portant exactement cette quantité, c'est un rappel de la ligne existante.
            // Ne s'applique qu'à 'missing' : un statut valide ou invalide apporte, lui, une
            // information nouvelle qui mérite sa propre ligne.
            if (!existing && status === 'missing' && quantity !== null) {
                const sameQuantityLine = state.items.filter(
                    it => it.product_id === product.id && it.quantity === quantity
                )
                if (sameQuantityLine.length === 1) continue
            }

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
                let pendingCandidates = state.items.filter(it => it.product_id === product.id && it.variant_status !== 'valid')
                // Même désambiguïsation par quantité nue que dans la branche "!product"
                // ci-dessus (voir lastBareQuantity) — utile quand le produit ET la couleur
                // sont nommés ensemble dans le segment qui lève l'ambiguïté.
                if (pendingCandidates.length > 1 && lastBareQuantity !== null) {
                    const narrowed = pendingCandidates.filter(it => it.quantity === lastBareQuantity)
                    if (narrowed.length === 1) pendingCandidates = narrowed
                }
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
                    // Avant de créer un doublon, vérifier si un AUTRE article partageant déjà
                    // cette même clé — donc devenu invisible pour existingByKey, qui n'en garde
                    // qu'un seul par clé alors que state.items peut en avoir plusieurs (voir
                    // branche ci-dessous) — a déjà exactement cette quantité. Ex: "15 gourdes"
                    // -> "10 gourdes" (crée un 2e article, le 1er devient invisible pour la Map)
                    // -> "15 gourdes" à nouveau : sans cette recherche, le 3e message créait un
                    // 3e article identique au 1er (même produit/statut/quantité) au lieu de le
                    // reconnaître — bug réel constaté et reproduit.
                    const revived = state.items.find(it => it !== existing && keyOf(it) === key && it.quantity === quantity)
                    if (revived) {
                        applyStatus(revived, status, value, quantity)
                        existingByKey.set(key, revived)
                        touchedThisMessage.add(revived)
                    } else {
                        const newItem = makeItem(product, status, value, quantity)
                        state.items.push(newItem)
                        existingByKey.set(key, newItem)
                        touchedThisMessage.add(newItem)
                    }
                } else {
                    touchedThisMessage.add(existing)
                    applyStatus(existing, status, value, quantity)
                    existingByKey.set(key, existing)
                }
            } else {
                const newItem = makeItem(product, status, value, quantity)
                state.items.push(newItem)
                existingByKey.set(key, newItem)
                touchedThisMessage.add(newItem)
            }
        }
    }

    state.quantity_drift = detectQuantityDrift(previousState, state)

    return state
}

/**
 * La répartition que le client vient de donner contredit-elle la quantité qu'il avait
 * annoncée ?
 *
 * Cas réel (13/08/2026) : « je veux 6 gourdes », puis — invité à choisir la couleur —
 * « 3 rouge et 4 bleu », soit SEPT. L'agent a enregistré 7 sans un mot. Le client se
 * souvient d'avoir dit 6, le vendeur en livrera 7, et rien dans la conversation ne signale
 * l'écart.
 *
 * Ce n'est pas forcément une erreur : le client a pu changer d'avis en cours de phrase.
 * D'où le choix de ne RIEN trancher ici — on constate l'écart, on le remonte dans le résumé,
 * et c'est l'IA qui décide comment le faire confirmer.
 *
 * Calculé par comparaison avant/après plutôt qu'en instrumentant la découpe : la répartition
 * peut arriver par des chemins très différents (ancre de message, réponse nue, produit
 * renommé), et un seul point de contrôle en sortie les couvre tous.
 *
 * Non persisté : cloneState ne recopie pas cette clé, donc le constat vit exactement le tour
 * où il est fait. Un marqueur stocké survivrait à la situation qu'il décrit — même
 * raisonnement que detectPendingVariantAssignment.
 */
function totalsByProduct(items = []) {
    const totals = new Map()
    for (const item of items) {
        if (!item?.product_name) continue
        const current = totals.get(item.product_name) || { lines: 0, total: 0, complete: true }
        current.lines += 1
        if (item.quantity === null) current.complete = false
        else current.total += item.quantity
        totals.set(item.product_name, current)
    }
    return totals
}

function detectQuantityDrift(previousState, nextState) {
    const before = totalsByProduct(previousState?.items || [])
    const after = totalsByProduct(nextState?.items || [])

    for (const [productName, next] of after) {
        const prev = before.get(productName)
        if (!prev) continue
        // Une seule ligne annoncée AVANT, plusieurs APRÈS : c'est bien une répartition de la
        // quantité initiale, et non l'ajout d'un article sans rapport.
        if (prev.lines !== 1 || next.lines < 2) continue
        if (!prev.complete || !next.complete) continue
        if (prev.total === next.total) continue

        return { product_name: productName, announced: prev.total, distributed: next.total }
    }

    return null
}

/**
 * Une valeur de variante VALIDE vient-elle d'être donnée alors que plusieurs lignes
 * du même produit l'attendent ? Le moteur refuse (à raison) de deviner laquelle est
 * visée — mais sans le dire, le résumé continue d'affirmer au tour suivant que la
 * couleur demandée est celle, invalide, du premier tour. L'IA lit alors un état qui
 * contredit la conversation et repose une question déjà répondue.
 * Ceci ne décide rien : ça constate qu'une affectation reste à faire, et c'est l'IA
 * qui choisit quoi en demander.
 * Calculé à partir du message du tour courant, jamais persisté : un marqueur stocké
 * survivrait à la situation qu'il décrit — exactement le défaut qu'on corrige ici.
 */
function detectPendingVariantAssignment(state, lastUserMessage, products) {
    if (!lastUserMessage || !Array.isArray(products) || products.length === 0) return null

    const pendingItems = state.items.filter(it => it.variant_status !== 'valid' && it.product_id)
    if (pendingItems.length < 2) return null
    if (new Set(pendingItems.map(it => it.product_id)).size !== 1) return null

    const product = products.find(p => p.id === pendingItems[0].product_id)
    if (!product) return null

    // Même validation que le reste du moteur — jamais une seconde logique de matching.
    const result = calculateItemPrice(product, {}, cleanCandidateVariantText(lastUserMessage), 1)
    if (result.error || !result.variantOptionName) return null

    return { variant: result.variantOptionName, items: pendingItems }
}

/**
 * Construit un résumé texte de l'état, à injecter dans le prompt — l'IA n'a
 * plus qu'à s'en servir pour formuler sa question suivante, jamais à
 * reconstruire cet état lui-même depuis l'historique brut.
 *
 * `options` est facultatif : sans lui le résumé reste correct, il perd seulement
 * la mention d'une affectation de variante non résolue (voir ci-dessus).
 */
function buildLeadStateSummary(state, options = {}) {
    if (!state || (state.items.length === 0 && state.unmatched_mentions.length === 0)) return null

    const lines = []
    for (const item of state.items) {
        const quantityKnown = item.quantity !== null
        const qtyPart = quantityKnown ? `quantité ${item.quantity}` : 'quantité MANQUANTE'
        let variantPart
        if (item.variant_status === 'valid') {
            variantPart = `variante ${item.variant}`
        } else if (item.variant_status === 'invalid') {
            // Énonce un FAIT, jamais un ordre. La version précédente finissait par
            // "et redemande une variante réelle" : cet impératif était ré-émis à chaque
            // tour, y compris APRÈS que le client ait donné une couleur valide, et l'IA
            // l'exécutait — elle reposait une question déjà répondue (mesuré : le cas
            // échouait 8 fois sur 8, contre 8/8 correct sans l'impératif).
            variantPart = `⛔ le client a demandé "${item.requested_variant}" — CETTE VALEUR N'EXISTE PAS pour cet article, dis-le clairement au client`
        } else {
            variantPart = 'variante manquante si applicable'
        }
        // Marqueur collé à la donnée elle-même plutôt qu'une règle générale ailleurs
        // dans le prompt — bug réel constaté : une règle générale ("ne redemande jamais
        // une quantité déjà connue") a échoué dès le 1er test réel après déploiement,
        // précisément quand un autre article du même message posait problème (produit
        // non reconnu). L'instruction collée au fait au moment où l'IA le lit est plus
        // fiable qu'une règle à se rappeler et réappliquer depuis ailleurs.
        let knownSuffix = ''
        if (item.variant_status === 'valid' && quantityKnown) {
            knownSuffix = ' ✅ COMPLET — ne redemande JAMAIS cette quantité ni cette variante, elles sont déjà connues'
        } else if (quantityKnown) {
            // Une quantité connue reste connue même quand la variante ne l'est pas : sans
            // cette protection, la seule donnée acquise de la ligne arrivait nue et c'est
            // elle que l'IA redemandait.
            knownSuffix = ' ✅ QUANTITÉ ACQUISE — ne la redemande JAMAIS, seule la variante reste à déterminer'
        }
        lines.push(`- ${item.product_name} (${variantPart}) : ${qtyPart}${knownSuffix}`)
    }
    for (const mention of state.unmatched_mentions) {
        lines.push(`- "${mention.text}" (quantité ${mention.quantity}) : article non reconnu dans le catalogue`)
    }

    // Le mode de récupération est un FAIT donné par le client, au même titre qu'une
    // quantité. Sans lui dans le résumé, l'agent reposait la question « boutique ou
    // livraison ? » alors qu'elle avait déjà été tranchée (mesuré : 6 fois sur 8 sur une
    // commune donnée), et n'ajoutait alors aucun frais de livraison au récap.
    if (state.fulfillment_mode === 'pickup') {
        lines.push('- Mode de récupération : RETRAIT EN BOUTIQUE ✅ déjà choisi par le client — ne le redemande JAMAIS, ne demande aucune adresse, aucun frais de livraison.')
    } else if (state.fulfillment_mode === 'delivery') {
        lines.push('- Mode de récupération : LIVRAISON ✅ déjà choisi par le client — ne le redemande JAMAIS. Le récap chiffré DOIT porter les frais de livraison de sa commune.')
    }

    // Écart entre la quantité annoncée et la répartition donnée ensuite (6 gourdes → 3 + 4).
    // Énoncé comme un FAIT chiffré : le système ne tranche pas lequel des deux nombres fait
    // foi, seul le client le sait.
    if (state.quantity_drift) {
        const { product_name, announced, distributed } = state.quantity_drift
        lines.push(`⚠️ Le client avait annoncé ${announced} ${product_name} ; la répartition qu'il vient de donner en totalise ${distributed}. Le système ne tranche pas — signale-lui l'écart et fais-lui confirmer le total avant d'aller plus loin.`)
    }

    const pending = detectPendingVariantAssignment(state, options.lastUserMessage, options.products)
    if (pending) {
        const quantities = pending.items.map(it => it.quantity).filter(q => q !== null)
        lines.push(`⚠️ Le client a répondu "${pending.variant}" (valeur valide). Le système n'a PAS pu déterminer si cela concerne la ligne de ${quantities.join(', celle de ')}, ou toutes — cette information n'existe nulle part, ne la devine pas.`)
        lines.push(`⚠️ Le SEUL trou restant est cette affectation. Les quantités ${quantities.join(' et ')} sont définitives : aucune question de quantité n'a de sens ici, quelle que soit la formulation.`)
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
    // Exportés pour que generator.js reconnaisse un produit dans une phrase de l'IA avec
    // EXACTEMENT la même tolérance que le moteur (fautes, pluriels) — sans quoi il faudrait
    // une troisième copie locale de la distance de Levenshtein, vouée à diverger.
    normalizeText,
    singularize,
    fuzzyDistanceOk,
}
