/**
 * ═══════════════════════════════════════════════════════════════
 * GENERATOR.JS v2.7 - VERSION CONSOLIDÉE (AUDIT COMPLET)
 * ═══════════════════════════════════════════════════════════════
 * 
 * CORRECTIONS INCLUSES :
 * ✅ #2 : Pre-check valide les OPTIONS (pas juste les clés)
 * ✅ #7 : Retry avec backoff exponentiel pour OpenAI
 * ✅ Logs de debug complets
 * ✅ Import findMatchingOption depuis tools.js
 */

const { TOOLS, handleToolCall, findMatchingOption, getOptionValue, productHasRealVariants, VARIANT_CATEGORY_LABELS } = require('./tools')
const { findRelevantDocuments } = require('./rag')
const { verifyResponseIntegrity } = require('../utils/security')
const { buildAdaptiveSystemPrompt } = require('./prompt-builder')
const {
    buildCheckoutStateGuidance,
    mergeCheckoutStateIntoToolArgs,
} = require('../services/checkout-state.service')
const {
    buildCartStateGuidance,
    mergeCartStateIntoToolArgs,
} = require('../services/cart-state.service')
const {
    buildBookingStateGuidance,
    mergeBookingStateIntoToolArgs,
} = require('../services/booking-state.service')
const {
    buildRestaurantStateGuidance,
    hasRestaurantStateData,
    mergeRestaurantStateIntoToolArgs,
} = require('../services/restaurant-state.service')
// Même tolérance aux fautes/pluriels que le moteur d'extraction : indispensable pour
// reconnaître un produit dans une phrase écrite par l'IA (voir findStaleQuantityQuestion).
const { normalizeText, singularize, fuzzyDistanceOk } = require('../services/lead-state.service')

// Configuration
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

/**
 * Sleep helper pour retry
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Supprime les doublons texte/caption après envoi d'image.
 * Si l'IA génère "Voici Tecno Camon 20 !" alors que la caption dit déjà "Voici Tecno Camon 20 !",
 * on retire cette répétition du texte.
 */
function stripImageDoublons(content, imageActions) {
    if (!content || !imageActions || imageActions.length === 0) return content
    let cleaned = content
    for (const img of imageActions) {
        const caption = (img.caption || '').trim()
        const productName = (img.product_name || '').trim()
        // Retirer la caption exacte si elle apparaît en début de texte
        if (caption) {
            const escaped = caption.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            cleaned = cleaned.replace(new RegExp(`^\\s*${escaped}\\s*[!.]?\\s*`, 'i'), '').trim()
        }
        // Retirer "Voici [nom]" / "Voici le [nom]" / "Voici la [nom]"
        if (productName) {
            const escapedName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            cleaned = cleaned.replace(
                new RegExp(`Voici\\s+(?:le\\s+|la\\s+|l')?${escapedName}\\s*[!.]?`, 'gi'),
                ''
            ).trim()
        }
    }
    return cleaned.trim()
}

/**
 * Supprime les images/liens markdown générés par l'IA à la place du tool send_image.
 * Couvre : ![alt](url) et [texte](url_image)
 */
/**
 * Filet de sécurité mode lead_only : le prompt interdit déjà toute mention de
 * paiement en ligne / lien de paiement (le total est une estimation, jamais un
 * encaissement), mais cette règle n'est pas toujours suivie par le modèle.
 * Retire uniquement la/les phrase(s) fautive(s), sans toucher au reste du message.
 */
function stripLeadOnlyPaymentMentions(content, isLeadOnlyMode) {
    if (!isLeadOnlyMode || !content) return content

    const forbiddenPatterns = [
        /lien de paiement/i,
        /paiement s[ée]curis[ée]/i,
        /payer en ligne/i,
        /paiement en ligne/i,
        /payer\s.{0,20}(en ligne|à la livraison|a la livraison)/i,
        /mode de paiement/i,
    ]

    // Découpe par ligne (les récaps lead_only structurent une info par ligne) plutôt
    // que par phrase — un récap n'a souvent aucun point avant la question finale,
    // ce qui ferait retirer tout le bloc au lieu de la seule ligne fautive.
    const lines = content.split('\n')
    const cleaned = lines.filter(line => !forbiddenPatterns.some(re => re.test(line)))

    const result = cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    if (result !== content.trim()) {
        console.log('⚠️ [lead_only] Mention de paiement interdite retirée de la réponse IA')
    }
    return result
}

/**
 * Filet de sécurité mode lead_only : l'ÉTAPE 5 du workflow donne un GABARIT de récap
 * de clôture ("*• Nom : <valeur>*"). Observé en prod : le modèle recopie ce gabarit
 * sans le remplir, et le client reçoit littéralement "<valeur>" sur WhatsApp — alors
 * qu'il n'a encore donné ni nom ni téléphone.
 *
 * Deux dégâts : le message est incompréhensible pour le client, ET le bloc
 * "*Vos coordonnées :*" déclenche le filet capture_lead plus bas, qui enregistre un
 * lead vide avant que le client ait rien fourni.
 *
 * On retire donc le bloc de clôture entier quand il contient un champ non rempli. Le
 * reste du message (récap chiffré, question de collecte) est conservé intact — c'est
 * justement la question qu'il fallait poser.
 */
const LEAD_ONLY_PLACEHOLDER = /<\s*valeur\s*>|\[\s*(?:valeur|non\s+fourni|non\s+renseign[ée]|manquant[e]?|à\s+compléter)\s*\]/i

function stripLeadOnlyUnfilledRecap(content, isLeadOnlyMode) {
    if (!isLeadOnlyMode || !content || !LEAD_ONLY_PLACEHOLDER.test(content)) return content

    const lines = content.split('\n')
    const kept = []
    let insideCoordinatesBlock = false

    for (const line of lines) {
        if (/^\s*\*?\s*Vos coordonnées\s*:/i.test(line)) {
            insideCoordinatesBlock = true
            continue
        }
        if (insideCoordinatesBlock) {
            // Le bloc court jusqu'à la première ligne qui n'est plus une puce de champ.
            if (/^\s*$/.test(line) || /^\s*\*?\s*[•\-]/.test(line)) continue
            insideCoordinatesBlock = false
        }
        if (LEAD_ONLY_PLACEHOLDER.test(line)) continue
        kept.push(line)
    }

    const result = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    console.log('⚠️ [lead_only] Récap de clôture non rempli (<valeur>) retiré de la réponse IA')
    return result
}

/**
 * L'agent raconte sa mécanique interne au lieu d'agir.
 *
 * Observé en production le 12/08/2026 : « Parfait ! Pour les 10 sacs enfant noir, je vais
 * calculer le récapitulatif avec les frais de livraison. » — puis rien, le calcul arrive au
 * message suivant. Pire chez un autre client : « Je vais maintenant vérifier les frais pour
 * Angré Château. Un instant, s'il vous plaît. … » suivi, DANS LE MÊME MESSAGE, du résultat.
 * L'attente était donc du théâtre : il n'y a jamais eu de pause.
 *
 * Le client n'a pas à savoir qu'un calcul va avoir lieu, il attend le résultat. On retire
 * ces annonces et les points de suspension isolés qui les accompagnent, sans toucher au
 * reste — le récapitulatif qui suit dans le même message est conservé intact.
 */
// Retrait à la PHRASE, jamais à la proposition : la narration est souvent enchâssée
// ("Pour les 10 sacs enfant noir, je vais calculer le récapitulatif."). Couper la seule
// proposition laisserait un fragment tronqué — « Parfait ! Pour les 10 sacs enfant noir, ».
const NARRATION_PATTERNS = [
    // "ajouter" fait partie de la même famille : « Pour les 5 gourdes en Rouge, je vais
    // ajouter cela à votre commande. » — observé en production, dans le message qui a
    // justement fabriqué un récap sans prix (voir findPricelessRecap). Le client n'a pas à
    // savoir qu'un ajout va avoir lieu : il attend de le voir fait.
    /\b(?:je\s+vais|je\s+m['’]en\s+vais)\s+(?:maintenant\s+|tout\s+de\s+suite\s+|d['’]abord\s+)?(?:calculer|v[ée]rifier|pr[ée]parer|consulter|regarder|proc[ée]der|effectuer|lancer|ajouter)\b/i,
    /\b(?:un\s+instant|un\s+moment|patientez|veuillez\s+patienter)\b/i,
    /\bje\s+(?:vous\s+)?reviens\s+(?:vers\s+vous\s+)?(?:dans|tout\s+de\s+suite)\b/i,
]

function stripLeadOnlyNarration(content, isLeadOnlyMode) {
    if (!isLeadOnlyMode || !content) return content

    const keptLines = []
    for (const line of content.split('\n')) {
        // Points de suspension seuls sur leur ligne : simulation d'attente, rien d'autre.
        if (/^\s*(?:\.{2,}|…)\s*$/.test(line)) continue

        const sentences = line.split(/(?<=[.!?])\s+/)
        const kept = sentences.filter(sentence => !NARRATION_PATTERNS.some(re => re.test(sentence)))
        if (kept.length === sentences.length) { keptLines.push(line); continue }
        const rebuilt = kept.join(' ').trim()
        if (rebuilt) keptLines.push(rebuilt)
    }

    const cleaned = keptLines.join('\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

    // Filet : si TOUT le message était de la narration (« Un instant, je vérifie. » envoyé
    // seul), le nettoyage renverrait une chaîne vide et le client ne recevrait rien du tout —
    // pire que la narration elle-même. On préfère alors laisser le message d'origine.
    if (!cleaned && content.trim()) {
        console.log('⚠️ [lead_only] Message entièrement narratif — conservé tel quel plutôt que vidé')
        return content
    }

    if (cleaned !== content.trim()) {
        console.log('⚠️ [lead_only] Narration interne retirée de la réponse IA')
    }
    return cleaned
}

/**
 * Le résumé d'état injecté dans le prompt porte des marqueurs destinés au MODÈLE
 * ("✅ COMPLET", "✅ QUANTITÉ ACQUISE", les notes ⚠️ d'affectation non résolue). Observé
 * en production : le modèle les recopie tels quels dans sa réponse au client —
 * "- 10 sacs enfant (Noir) ✅ COMPLET" est parti sur WhatsApp.
 *
 * Ces marqueurs sont de la mécanique interne : ils ne veulent rien dire pour un client
 * et trahissent le fonctionnement du système. On les retire sans toucher au reste de la
 * ligne, qui elle est légitime.
 */
function stripLeadOnlyInternalMarkers(content, isLeadOnlyMode) {
    if (!isLeadOnlyMode || !content) return content

    let cleaned = content
        // Marqueur accolé à une ligne d'article : on coupe du marqueur à la fin de la ligne.
        .replace(/\s*✅\s*(?:COMPLET|QUANTITÉ ACQUISE)[^\n]*/gi, '')
        // Consignes internes recopiées mot pour mot.
        .replace(/[^\n]*(?:Le système n'a PAS pu déterminer|Le SEUL trou restant)[^\n]*\n?/gi, '')
        .replace(/\s*—?\s*dis-le clairement au client/gi, '')
        .replace(/\s*⛔\s*le client a demandé[^\n]*/gi, '')

    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()
    if (cleaned !== content.trim()) {
        console.log('⚠️ [lead_only] Marqueur interne du résumé d\'état retiré de la réponse IA')
    }
    return cleaned
}

/**
 * L'agent annonce-t-il indisponible une variante qui EXISTE au catalogue ?
 *
 * Cas réel (conversation du 11/08/2026) : le client ouvre par « pas de gourde pour moi,
 * juste 9 sacs », puis se ravise et demande 4 gourdes rouges. L'agent répond « Nous n'avons
 * pas de gourde rouge » — alors que le Rouge est au catalogue à 9 000 FCFA, et qu'il le
 * liste comme disponible deux lignes plus bas. Le client insiste, l'agent refuse, la vente
 * est perdue. Le modèle a transformé le refus du CLIENT en indisponibilité de la BOUTIQUE.
 *
 * C'est vérifiable sans jugement : ou bien la variante est dans le catalogue, ou bien elle
 * n'y est pas. On ne réécrit rien nous-mêmes — on renvoie le constat au modèle.
 */
const UNAVAILABILITY_CLAIM = /(?:n['’]\s*(?:avons|ai|avez)\s+(?:pas|plus)|ne\s+(?:vendons|vend|proposons)\s+pas|pas\s+disponible|non\s+disponible|indisponible|n['’]?existe\s+pas|nous\s+n['’]en\s+avons\s+pas)/i
// Coupe la fenêtre d'analyse avant une éventuelle ÉNUMÉRATION des couleurs réellement
// proposées : sans ça, "pas de sac en rose, seulement Bleu, Jaune et Noir" ferait croire
// à tort que l'agent déclare Bleu indisponible.
const LISTING_MARKER = /\b(seulement|uniquement|disponibles?|voici|nos couleurs|les options|les couleurs|par contre|en revanche|mais)\b|[:•]/i

function findFalseUnavailabilityClaim(content, products) {
    if (!content || !Array.isArray(products) || products.length === 0) return null

    for (const sentence of content.split(/(?<=[?!.])\s+|\n/)) {
        const claim = sentence.match(UNAVAILABILITY_CLAIM)
        if (!claim) continue

        // Fenêtre = la phrase entière, car la négation peut venir APRÈS le produit
        // ("La couleur rouge pour la gourde n'est pas disponible"). On la tronque
        // seulement à une énumération qui SUIT la négation.
        const afterClaim = claim.index + claim[0].length
        const listing = sentence.slice(afterClaim).search(LISTING_MARKER)
        const window = listing >= 0 ? sentence.slice(0, afterClaim + listing) : sentence

        const normalizedWindow = normalizeText(window)
        const windowWords = normalizedWindow.split(/\s+/).filter(Boolean)

        for (const product of products) {
            const head = singularize(normalizeText(String(product.name || '').split(/\s+/)[0] || ''))
            if (head.length < 3) continue
            if (!windowWords.some(w => fuzzyDistanceOk(singularize(w), head))) continue

            for (const variant of product.variants || []) {
                for (const option of variant.options || []) {
                    const value = option?.value ?? option?.name ?? option
                    const normalizedValue = singularize(normalizeText(value))
                    if (normalizedValue.length < 3) continue
                    if (windowWords.some(w => fuzzyDistanceOk(singularize(w), normalizedValue))) {
                        return { sentence: sentence.trim(), product: product.name, variant: value }
                    }
                }
            }
        }
    }
    return null
}

/**
 * Corrige une réponse fautive par une RÉÉCRITURE, pas par une nouvelle génération.
 *
 * L'approche précédente rejouait toute la conversation avec le prompt système entier
 * (~33 000 caractères) augmenté d'une note de correction. Elle échouait jusqu'à 7 fois
 * sur 8 sur les cas tenaces, et c'est logique : ce prompt répète en boucle « ne suppose
 * jamais une quantité, si elle manque demande-la ». Le modèle repartait du même contexte,
 * refaisait le même raisonnement, et rejetait la note de correction. On ne lui demandait
 * pas de reformuler, on lui demandait de se contredire.
 *
 * Ici, aucune règle métier : un message écrit, les faits acquis, les derniers échanges
 * pour ne pas redemander ce qui a déjà été donné, et une consigne d'édition. Le modèle
 * choisit toujours la question suivante — on lui retire seulement celle qui est impossible.
 */
/**
 * Régénère une réponse quand la correction exige un OUTIL (preview_cart), pas une réécriture.
 *
 * Défaut réel corrigé ici (production, 12/08/2026) : l'ancienne version ne lisait que
 * `.choices[0].message.content`. Or, invité à recalculer un total, le modèle répond
 * naturellement par un tool_call — dont le `content` est vide. Le code concluait
 * « reformulation sans texte (appel d'outil seul), réponse initiale conservée » et gardait
 * la réponse fautive. Le garde-fou ne pouvait donc jamais rien réparer : il constatait le
 * problème, le journalisait, et laissait partir le message tel quel.
 *
 * On exécute donc les outils demandés, on réinjecte leurs résultats, et on redemande la
 * réponse finale — exactement la boucle du tour normal. Le second appel se fait SANS outils :
 * à ce stade preview_cart a déjà répondu, on veut du texte, pas une nouvelle demande d'outil.
 */
async function regenerateThroughTools({
    openai, model, maxTokens, temperature, systemPrompt, messages, toolsConfig, correction, runToolCall,
}) {
    const correctedHistory = [
        { role: 'system', content: `${systemPrompt}\n\n${correction}` },
        ...messages.slice(1),
    ]

    const first = await callOpenAIWithRetry(openai, {
        model,
        messages: correctedHistory,
        max_tokens: maxTokens,
        temperature,
        ...toolsConfig,
    })

    const firstMessage = first.choices[0]?.message
    if (!firstMessage) return null
    if (!firstMessage.tool_calls || firstMessage.tool_calls.length === 0) {
        return firstMessage.content || null
    }

    const withToolResults = [...correctedHistory, firstMessage]
    for (const rawToolCall of firstMessage.tool_calls) {
        const { toolCall, result } = await runToolCall(rawToolCall)
        withToolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: result })
    }

    const second = await callOpenAIWithRetry(openai, {
        model,
        messages: withToolResults,
        max_tokens: maxTokens,
        temperature,
    })

    return second.choices[0]?.message?.content || null
}

async function rewriteWithoutImpossibleQuestion(openai, model, content, leadState, recentMessages, reason, offendingSentence) {
    const facts = []
    for (const item of leadState?.items || []) {
        const parts = []
        if (item.variant_status === 'valid' && item.variant) parts.push(`couleur ${item.variant}`)
        if (item.quantity !== null) parts.push(`quantité ${item.quantity}`)
        if (parts.length > 0) facts.push(`- ${item.product_name} : ${parts.join(', ')}`)
    }
    if (leadState?.fulfillment_mode === 'pickup') facts.push('- mode de récupération : retrait en boutique')
    if (leadState?.fulfillment_mode === 'delivery') facts.push('- mode de récupération : livraison')

    // Ce qui manque VRAIMENT, d'après l'état — jamais une étape que le backend décide.
    // Sans cette liste, la réécriture comblait le vide en inventant une question sur une
    // information déjà connue : elle remplaçait « quelle quantité ? » par « quelle
    // couleur ? » pour un article dont la couleur était acquise.
    const pending = []
    for (const item of leadState?.items || []) {
        if (item.variant_status !== 'valid') pending.push(`- la couleur de ${item.product_name}`)
        if (item.quantity === null) pending.push(`- la quantité de ${item.product_name}`)
    }
    if (!leadState?.fulfillment_mode) pending.push('- le mode de récupération : retrait en boutique ou livraison')

    const exchanges = (recentMessages || []).slice(-4)
        .map(m => `${m.role === 'user' ? 'Client' : 'Agent'}: ${String(m.content || '').slice(0, 300)}`)
        .join('\n')

    const completion = await callOpenAIWithRetry(openai, {
        model,
        temperature: 0,
        max_tokens: 500,
        messages: [
            {
                role: 'system',
                content: [
                    "Tu réécris un message WhatsApp déjà rédigé. Tu ne conseilles pas un client, tu édites un texte.",
                    // La phrase à retirer est citée mot pour mot : sans ça, le modèle
                    // conservait l'affirmation fautive au nom du « garde le reste intact »,
                    // et produisait un message qui refusait et acceptait à la fois.
                    `Ta tâche : SUPPRIMER INTÉGRALEMENT cette phrase du message : « ${String(offendingSentence || '').slice(0, 300)} »`,
                    `Raison : ${reason}`,
                    'Cette phrase doit disparaître entièrement. Ne la reformule pas, ne la nuance pas, ne la remplace pas par une variante du même propos.',
                    'Les informations listées comme acquises ne se discutent pas, ne se vérifient pas et ne se redemandent pas.',
                    'Garde tout le reste intact : ton, emojis, mise en forme, et toute question portant sur autre chose.',
                    "Si la suppression laisse le message sans suite, enchaîne sur ce qui manque encore d'après les échanges ci-dessous. Tu choisis la formulation.",
                    "Ne pose qu'UNE seule question. Ne redemande jamais une information déjà donnée par le client dans ces échanges.",
                    'Ne termine jamais par une formule vague ("je suis à votre disposition", "quelle est la prochaine étape").',
                    'Réponds UNIQUEMENT par le message réécrit, sans commentaire ni guillemets.',
                ].join('\n'),
            },
            {
                role: 'user',
                content: [
                    facts.length > 0 ? `INFORMATIONS ACQUISES :\n${facts.join('\n')}` : 'INFORMATIONS ACQUISES : aucune.',
                    pending.length > 0
                        ? `\nCE QUI MANQUE ENCORE :\n${pending.join('\n')}`
                        : "\nCE QUI MANQUE ENCORE : rien sur les articles ni sur le mode de récupération — il reste à collecter les coordonnées du client, sauf si les échanges ci-dessous montrent qu'elles ont déjà été données.",
                    exchanges ? `\nDERNIERS ÉCHANGES :\n${exchanges}` : '',
                    `\nMESSAGE À RÉÉCRIRE :\n${content}`,
                ].join('\n'),
            },
        ],
    })
    return (completion.choices[0]?.message?.content || '').trim()
}

/**
 * Coordonnées d'une demande précédente déjà close, à PROPOSER au client — jamais à
 * réutiliser en silence.
 *
 * Avant ce bloc, l'agent les reprenait de lui-même parce qu'il voyait encore le récap du
 * cycle précédent dans son historique. Le client découvrait ses anciennes coordonnées dans
 * le récapitulatif final, sans avoir jamais eu l'occasion de dire qu'elles avaient changé —
 * et le même mécanisme a fini par afficher une adresse de livraison sur une commande à
 * retirer en boutique (13/08/2026).
 *
 * Le système fournit une DONNÉE ; c'est l'agent qui formule la proposition et interprète la
 * réponse. Même principe que le bloc "CLIENT CONNU" du flux de commande normal, qui propose
 * de réutiliser les informations d'une commande passée.
 */
function buildKnownContactSection(leadKnownContact) {
    if (!leadKnownContact || (!leadKnownContact.name && !leadKnownContact.phone)) return ''

    const champs = [
        leadKnownContact.name ? `• Nom : ${leadKnownContact.name}` : null,
        leadKnownContact.phone ? `• Téléphone : ${leadKnownContact.phone}` : null,
        leadKnownContact.email ? `• Email : ${leadKnownContact.email}` : null,
        leadKnownContact.address ? `• Adresse de livraison : ${leadKnownContact.address}` : null,
    ].filter(Boolean).join('\n')

    return `\n\n👤 COORDONNÉES DÉJÀ CONNUES (source système — demande précédente de ce même client, déjà close) :
${champs}

Au moment de collecter les coordonnées (ÉTAPE 4), ne pose PAS les questions une par une : propose d'abord ces informations en UN SEUL message et laisse le client trancher.
✅ "Je reprends vos coordonnées :
${champs}

C'est toujours bon, ou souhaitez-vous changer quelque chose ?"
    - S'il confirme → enchaîne directement sur le récapitulatif de clôture avec ces valeurs.
    - S'il corrige UN SEUL champ → garde les autres tels quels, ne les redemande pas.
    - ⛔ N'affiche PAS la ligne Adresse s'il a choisi le RETRAIT EN BOUTIQUE — une commande à retirer n'a pas d'adresse de livraison.
    - ⛔ Ne propose ce bloc qu'une fois le récapitulatif chiffré affiché et le mode de récupération connu, jamais avant.
    - ⛔ Ces valeurs viennent d'une demande PRÉCÉDENTE et déjà enregistrée : ne les mentionne jamais comme si elles appartenaient à la demande en cours tant que le client ne les a pas confirmées.`
}

/**
 * Un article que le catalogue ne vend pas, passé sous silence.
 *
 * Cas réel (13/08/2026) : « juste 5 sacs enfant noir, 16 ardoise. Je veux être livré a
 * adjame. Je me nom Coulibaly fatou ». L'agent a répondu par un récapitulatif chiffré
 * complet — articles, frais de livraison, total — SANS un mot sur les 16 ardoises. Le client
 * a dû relancer lui-même (« Et les ardoises ») pour obtenir la réponse. Entre les deux, rien
 * ne lui disait qu'elles n'étaient pas dans sa commande.
 *
 * Le prompt l'interdit déjà, et l'agent l'avait d'ailleurs respecté cinq minutes plus tôt sur
 * une autre conversation. La différence : ici le message empilait une négation, deux
 * articles, un mode de livraison, une commune et un nom — l'agent a foncé au récap.
 *
 * Vérifiable sans jugement : le moteur a enregistré une mention non reconnue, le message
 * conclut (récap chiffré ou demande de coordonnées), et le nom de cet article n'y figure pas.
 */
const UNKNOWN_ITEM_TRIGGER = /TOTAL\s*:|num[ée]ro\s+de\s+t[ée]l[ée]phone|pr[ée]nom\s+et\s+nom|vos\s+coordonn[ée]es/i

function findUnannouncedUnknownItem(content, leadState) {
    if (!content || !leadState || !Array.isArray(leadState.unmatched_mentions)) return null
    // `announced` est posé par le moteur dès qu'un message de l'agent a nommé l'article —
    // sans quoi le constat se répéterait à chaque récap suivant et l'agent radoterait.
    const pending = leadState.unmatched_mentions.filter(m => m && m.text && m.announced !== true)
    if (pending.length === 0) return null
    if (!UNKNOWN_ITEM_TRIGGER.test(content)) return null

    const words = normalizeText(content).split(/\s+/).filter(Boolean)
    for (const mention of pending) {
        const head = singularize(normalizeText(String(mention.text).trim().split(/\s+/)[0] || ''))
        if (head.length < 3) continue
        const named = words.some(word => fuzzyDistanceOk(singularize(word.replace(/[^\p{L}\p{N}]/gu, '')), head))
        if (!named) return { mention }
    }

    return null
}

/**
 * Réécriture par AJOUT, et non par suppression : ici le message n'affirme rien de faux, il
 * omet. rewriteWithoutImpossibleQuestion ne sait que retirer une phrase citée — d'où cette
 * variante, volontairement minimale pour ne pas défaire un récapitulatif correct.
 */
async function rewriteAddingUnknownItemNotice(openai, model, content, mention) {
    const completion = await callOpenAIWithRetry(openai, {
        model,
        temperature: 0,
        max_tokens: 500,
        messages: [
            {
                role: 'system',
                content: [
                    "Tu réécris un message WhatsApp déjà rédigé. Tu ne conseilles pas un client, tu édites un texte.",
                    `Ta tâche : AJOUTER UNE PHRASE COURTE indiquant que "${mention.text}" ne fait pas partie du catalogue et ne peut pas être vendu.`,
                    'Place-la en TÊTE du message, avant le reste.',
                    "Ne touche à RIEN d'autre : ni les articles listés, ni les montants, ni les totaux, ni la question finale, ni les emojis, ni la mise en forme.",
                    "N'invente aucun prix et ne propose aucun article de remplacement.",
                    'Réponds UNIQUEMENT par le message réécrit, sans commentaire ni guillemets.',
                ].join('\n'),
            },
            { role: 'user', content: `MESSAGE À RÉÉCRIRE :\n${content}` },
        ],
    })
    return (completion.choices[0]?.message?.content || '').trim()
}

/**
 * L'agent annonce-t-il un tarif de livraison pour un lieu qui n'est pas dans tes zones ?
 *
 * Cas réel (12/08/2026) : le client répond « Angré château ». Angré est un quartier de
 * Cocody, facturé 1 000 FCFA dans la configuration. L'agent a annoncé 2 000 FCFA — un
 * montant qui existe ailleurs dans la grille, mais pas pour ce lieu. Le client a vu un
 * prix, le vendeur en verra un autre.
 *
 * Le prompt dit pourtant : si le lieu ne correspond CLAIREMENT à aucune entrée, demander
 * de préciser la commune. C'est vérifiable sans jugement — ou bien un nom de zone
 * configurée apparaît dans la conversation, ou bien il n'y en a aucun.
 */
const FEE_ANNOUNCEMENT = /(?:frais\s+(?:de\s+)?livraison|frais\s+(?:sont|est|s['’]?[ée]l[èe]vent))[^\n]{0,40}?\d/i

function collectDeliveryZoneNames(agent) {
    const zones = agent?.delivery_zones || {}
    return [...(zones.communes || []), ...(zones.hors_abidjan || []), ...(zones.international || [])]
        .map(zone => normalizeText(zone?.name || ''))
        .filter(name => name.length >= 3)
}

function findInventedDeliveryFee(content, agent, conversationHistory, userMessage = '') {
    if (!content || agent?.delivery_fee_mode !== 'zones') return null
    const announcement = content.match(FEE_ANNOUNCEMENT)
    if (!announcement) return null

    const zoneNames = collectDeliveryZoneNames(agent)
    if (zoneNames.length === 0) return null

    // Le lieu peut avoir été donné plusieurs tours plus tôt ("Koumassi"), pas forcément
    // dans le message qui annonce le tarif — on balaie donc la conversation récente.
    //
    // ⚠️ userMessage est INDISPENSABLE et séparé de conversationHistory : l'appelant
    // (generateAIResponse) ne pousse le message courant du client que dans `messages`,
    // jamais dans conversationHistory. Or le cas le plus fréquent est justement celui-là —
    // l'agent demande l'adresse, le client répond "Yopougon maroc", l'agent annonce le
    // tarif dans la foulée. Sans cette entrée, la commune n'apparaît NULLE PART dans le
    // foin et une zone parfaitement configurée passe pour une invention.
    // Mesuré en production le 12/08/2026 : 2 déclenchements, 2 faux positifs (Yopougon et
    // Marcory, tous deux configurés à 2 000 FCFA). Le garde-fou faisait supprimer une ligne
    // de frais correcte, et le client recevait un total sans livraison.
    const haystack = normalizeText([
        ...(conversationHistory || []).slice(-8).map(m => m?.content || ''),
        userMessage || '',
        content,
    ].join(' '))
    // Le tiret compte comme séparateur des deux côtés : "Port-Bouët" (nom de zone
    // configuré) et "Port Bouet" (façon la plus courante de l'écrire côté client, sans
    // tiret ni accent) doivent se découper en les mêmes mots — sinon aucune des deux
    // graphies ne matche l'autre, et une vraie zone se fait passer pour une invention.
    const haystackWords = haystack.split(/[\s-]+/).filter(Boolean)

    const zoneFound = zoneNames.some(zone => {
        const zoneWords = zone.split(/[\s-]+/).filter(Boolean)
        return zoneWords.every(word => haystackWords.some(w => fuzzyDistanceOk(singularize(w), singularize(word))))
    })
    if (zoneFound) return null

    return { sentence: (content.match(/[^\n]*(?:frais[^\n]*\d[^\n]*)/i) || [''])[0].trim() }
}

/**
 * Récapitulatif chiffré d'une commande EN LIVRAISON, mais sans ligne de frais.
 *
 * Cas réel mesuré : quand le client répond « Cocody », les frais de 1 000 FCFA sont absents
 * du récap 7 fois sur 8 — alors que Port-Bouët (2 000) et Yopougon (2 000) passent sans
 * problème. Le lead part donc sous-facturé. Le prompt dit déjà de rappeler preview_cart
 * avec delivery_fee ; le modèle ne le fait pas de façon fiable.
 *
 * Vérifiable sans jugement : la livraison est choisie (état du moteur), un total est
 * affiché, aucune ligne de frais n'apparaît, et la boutique facture bien la livraison.
 */
function findMissingDeliveryFee(content, leadState, agent) {
    if (!content || !leadState) return null
    if (leadState.fulfillment_mode !== 'delivery') return null
    if (agent?.delivery_fee_mode !== 'zones') return null

    // Uniquement sur un vrai récap chiffré : une phrase sans total n'a rien à porter.
    if (!/TOTAL\s*:/i.test(content)) return null
    if (/frais de livraison/i.test(content)) return null

    return { sentence: (content.match(/[^\n]*TOTAL\s*:[^\n]*/i) || [''])[0].trim() }
}

/**
 * Liste d'articles écrite à la main, sans prix ni total.
 *
 * Cas réel (12/08/2026) :
 *   « Voici le récapitulatif de votre demande :
 *       · Goube enfant (Rouge) x 5
 *     Vous passez en boutique ou vous souhaitez être livré ? »
 *
 * Aucun prix, aucun total : le modèle a rédigé le récap lui-même au lieu d'appeler
 * preview_cart. L'ÉTAPE 2 du workflow l'interdit explicitement, avec cet exemple précis —
 * la règle de prompt ne suffit pas. Et ce n'est pas un défaut cosmétique : le marchand a
 * observé qu'à chaque fois que ce récap apparaît, la suite de la conversation déraille
 * (le total ne sera jamais recalculé par l'outil, donc la livraison ne s'y ajoutera pas).
 *
 * Détection volontairement étroite, pour ne jamais toucher un message légitime : il faut
 * UNE ligne à puce se terminant par une quantité ("… x 5"), ET aucun montant nulle part
 * dans le message. Un vrai récap, une liste de couleurs ou le catalogue d'accueil portent
 * tous des montants — ils sont donc hors de portée par construction.
 */
const ITEM_LINE_WITHOUT_PRICE = /^[^\S\n]*[•·*\-–—][^\S\n]*\S.*?[^\S\n][x×][^\S\n]*\d+[^\S\n]*$/m
const ANY_AMOUNT = /\d[\d\s.,  ]*(?:FCFA|XOF|€|\$)/i

// Ligne à puce portant un chiffre — la quantité, où qu'elle soit placée dans la ligne.
//
// ⚠️ La première version exigeait « … x N » EN FIN de ligne, parce que c'était la forme du
// seul échantillon dont je disposais (« · Goube enfant (Rouge) x 5 »). Le 13/08/2026 le même
// défaut est réapparu sous une autre forme — « · 10 sacs enfant (Noir) », quantité en tête —
// et le détecteur est resté muet. La leçon vaut d'être écrite : ce qu'on cherche n'est pas
// une syntaxe, c'est une PROPRIÉTÉ — une liste d'articles sans le moindre montant.
const BULLET_LINE_WITH_DIGIT = /^[^\S\n]*[•·*\-–—][^\S\n]*[^\n]*\d[^\n]*$/
// Les lignes du bloc de coordonnées portent elles aussi des chiffres (le téléphone) : ce sont
// des paires « libellé : valeur », jamais des articles.
// Préfixe volontairement permissif : le gras WhatsApp place son astérisque AVANT la puce
// (« *• Téléphone : 0987543257* »), ce qu'une lecture trop littérale de la ligne manquait —
// le bloc de coordonnées passait alors pour une liste d'articles sans prix.
const CONTACT_FIELD_LINE = /^[\s*•·\-–—]+\*?\s*(?:nom|pr[ée]nom|t[ée]l[ée]phone|adresse|e-?mail|entreprise|pr[ée]cision|date|heure)\b/i

function findPricelessRecap(content, isLeadOnlyMode) {
    if (!isLeadOnlyMode || !content) return null
    if (ANY_AMOUNT.test(content)) return null

    for (const line of content.split('\n')) {
        if (!BULLET_LINE_WITH_DIGIT.test(line)) continue
        if (CONTACT_FIELD_LINE.test(line)) continue
        return { sentence: line.trim() }
    }

    return null
}

/**
 * Une question de quantité portant sur un article dont la quantité est DÉJÀ connue est
 * prouvablement fausse : l'information existe dans lead_state, elle a été affichée à l'IA,
 * et la reposer fait répéter le client ("J'ai dis 10", observé en prod).
 *
 * Quatre règles de prompt successives n'ont pas suffi à l'éliminer — il reste ~20 % des
 * réponses. On détecte donc le cas par code, comme preCheckCreateOrder rejette un appel
 * d'outil invalide. Ce détecteur ne CHOISIT PAS la question suivante : il constate qu'une
 * question précise est impossible et laisse l'IA reformuler librement.
 *
 * Ciblage strict pour éviter les faux positifs : on n'examine que la phrase interrogative
 * contenant la demande de quantité, et on ne la rejette QUE si elle nomme un article
 * complet SANS nommer d'article dont la quantité manque réellement (cas légitime :
 * "10 sacs noirs, c'est noté. Pour les gourdes rouges, quelle quantité ?").
 */
const QUANTITY_QUESTION = /(quelle\s+(?:est\s+la\s+)?quantit[ée]|combien\s+(?:en\s+|de\s+)?(?:voulez|souhaitez|d[ée]sirez)|combien\s+de\s+|nombre\s+(?:de|d')\s*\w+\s+souhait)/i
// Symétrique de la quantité : redemander une couleur déjà choisie est tout aussi
// impossible. Découvert en vérifiant la réécriture — elle remplaçait la question de
// quantité par une question de couleur sur un article dont la couleur était connue,
// et ma mesure ne voyait rien puisqu'elle ne cherchait que les quantités.
const VARIANT_QUESTION = /(quelle\s+(?:est\s+la\s+)?(?:couleur|taille|variante)|quel\s+(?:coloris|mod[èe]le)|choisir\s+(?:une\s+)?couleur)/i

function findStaleQuantityQuestion(content, leadState) {
    if (!content || !leadState || !Array.isArray(leadState.items)) return null

    const known = leadState.items.filter(item => item.quantity !== null && item.product_name)
    const stillMissing = leadState.items.filter(item => item.quantity === null && item.product_name)
    // Pour les variantes : une ligne dont la couleur est acquise ne doit plus être
    // questionnée ; une ligne dont la couleur manque ou a été refusée, si.
    const variantKnown = leadState.items.filter(item => item.variant_status === 'valid' && item.product_name)
    const variantMissing = leadState.items.filter(item => item.variant_status !== 'valid' && item.product_name)
    if (known.length === 0 && variantKnown.length === 0) return null

    const mentions = (sentence, name) => {
        // Compare sur le premier mot significatif du nom produit ("sac" pour "sac enfant") :
        // l'IA écrit "sacs enfants", "sac enfant Noir", rarement le nom exact du catalogue.
        // Le second mot est écarté volontairement — "enfant" est commun aux deux produits de
        // ce catalogue et confondrait les lignes.
        //
        // Comparaison TOLÉRANTE, pas littérale : le catalogue peut contenir une faute que le
        // client et le modèle ne reprennent pas. Cas réel — le produit s'appelle "goube
        // enfant", tout le monde écrit "gourde" ; une comparaison stricte ne voyait donc
        // jamais le produit et le garde-fou restait muet (8 échecs sur 8 en vérification
        // de bout en bout).
        const head = singularize(normalizeText(String(name).trim().split(/\s+/)[0] || ''))
        if (head.length < 3) return false
        return normalizeText(sentence).split(/\s+/).filter(Boolean)
            .some(word => fuzzyDistanceOk(singularize(word.replace(/[^\p{L}\p{N}]/gu, '')), head))
    }

    for (const sentence of content.split(/(?<=[?!.])\s+|\n/)) {
        // Question de VARIANTE sur une couleur déjà acquise (même raisonnement que la
        // quantité : on ne signale rien tant qu'une ligne attend réellement sa couleur).
        if (VARIANT_QUESTION.test(sentence) && variantMissing.length === 0) {
            const namedTarget = variantKnown.find(item => mentions(sentence, item.product_name))
            const target = namedTarget || (variantKnown.length > 0 ? variantKnown[0] : null)
            if (target) {
                return { sentence: sentence.trim(), item: target, variantAlreadyKnown: true }
            }
        }

        if (!QUANTITY_QUESTION.test(sentence)) continue
        if (stillMissing.some(item => mentions(sentence, item.product_name))) continue

        const target = known.find(item => mentions(sentence, item.product_name))
        if (target) return { sentence: sentence.trim(), item: target }

        // Question NUE, sans nom de produit : "Vous avez choisi une gourde enfant en bleu.
        // Combien en souhaitez-vous ?" — le modèle scinde régulièrement en deux phrases, et
        // exiger le produit dans la même phrase rendait le détecteur aveugle à cette forme,
        // pourtant la plus fréquente (5 fois sur 6 en vérification de bout en bout).
        // Elle porte forcément sur le sujet en cours : elle n'est donc fautive que si PLUS
        // AUCUN article n'attend de quantité. S'il en reste un, la question est légitime et
        // on ne touche à rien.
        if (stillMissing.length === 0) {
            return { sentence: sentence.trim(), item: known[0] }
        }
    }
    return null
}

function stripMarkdownImages(content) {
    if (!content) return content
    // Supprimer ![alt](url)
    let cleaned = content.replace(/!\[[^\]]*\]\(https?:\/\/[^)]+\)/g, '')
    // Supprimer [texte](url) pointant vers une image
    cleaned = cleaned.replace(
        /\[[^\]]+\]\(https?:\/\/[^)]+\.(?:jpg|jpeg|png|gif|webp)[^)]*\)/gi,
        ''
    )
    // Supprimer les labels d'énumération d'images générés par l'IA
    // ex: "Voici la première image :", "Et voici la 2ème image :", "Voici l'image suivante :"
    cleaned = cleaned.replace(
        /(?:et\s+)?voici\s+(?:la\s+)?(?:première|deuxième|troisième|quatrième|[\d]+[eè]?me?|l['']image\s+suivante|une?\s+(?:autre\s+)?image?)\s*(?:image\s*)?:/gi,
        ''
    )
    // Nettoyer les lignes vides consécutives laissées par les suppressions
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()
    return cleaned
}

function detectServiceEngine(products = [], userMessage = '') {
    const serviceProducts = products.filter(product => product.product_type === 'service')
    if (serviceProducts.length === 0) {
        return null
    }

    const isServiceOnlyAgent = products.length > 0 && serviceProducts.length === products.length
    if (isServiceOnlyAgent) {
        const subtype = serviceProducts[0]?.service_subtype || 'other'
        if (subtype === 'restaurant') return 'RESTAURANT'
        return null
    }

    const lowerMessage = String(userMessage || '').toLowerCase()
    const matchedProduct = products
        .filter(product => lowerMessage.includes(String(product.name || '').toLowerCase()))
        .sort((a, b) => String(b.name || '').length - String(a.name || '').length)[0]

    if (matchedProduct?.product_type === 'service' && matchedProduct?.service_subtype === 'restaurant') {
        return 'RESTAURANT'
    }

    return null
}

function hasRestaurantServiceProduct(products = []) {
    return (products || []).some(
        product => product?.product_type === 'service' && product?.service_subtype === 'restaurant'
    )
}

/**
 * 🔍 PRE-CHECK AMÉLIORÉ v2.7
 * Vérifie que les variantes ET leurs valeurs sont valides
 */
function preCheckCreateOrder(toolCall, products) {
    if (toolCall.function.name !== 'create_order') {
        return { valid: true }
    }

    try {
        const args = JSON.parse(toolCall.function.arguments)

        // Log détaillé
        console.log('═══════════════════════════════════════════════')
        console.log('🔍 PRE-CHECK create_order')
        console.log(JSON.stringify(args, null, 2))
        console.log('═══════════════════════════════════════════════')

        if (!args.items || !Array.isArray(args.items)) {
            console.log('❌ PRE-CHECK: items manquants')
            return { valid: false, error: 'Items manquants dans la requête' }
        }

        for (const item of args.items) {
            console.log(`📦 Vérification: "${item.product_name}" x${item.quantity}`)
            console.log(`   selected_variants:`, item.selected_variants || '❌ NON FOURNI')

            // Trouver le produit
            const productName = item.product_name?.toLowerCase() || ''
            const product = products.find(p => {
                const pName = p.name.toLowerCase()
                return pName === productName ||
                    productName.includes(pName) ||
                    pName.includes(productName)
            })

            if (!product) {
                console.log(`   ⚠️ Produit non trouvé - sera géré par handleToolCall`)
                continue
            }

            console.log(`   ✅ Produit: "${product.name}"`)

            // Vérifier les variantes
            if (productHasRealVariants(product)) {
                console.log(`   📋 Variantes requises: ${product.variants.map(v => v.name).join(', ')}`)

                const selectedVariants = item.selected_variants || {}

                for (const variant of product.variants) {
                    if (!variant.options || !Array.isArray(variant.options) || variant.options.length === 0) {
                        continue
                    }

                    // Les suppléments/additifs sont optionnels : on ne bloque jamais create_order
                    // si le client n'en a pas choisi.
                    if (variant.type === 'additive' || variant.type === 'supplement') {
                        console.log(`   ℹ️ ${variant.name}: supplément optionnel, non bloquant`)
                        continue
                    }

                    const variantName = variant.name
                    const variantNameLower = variantName.toLowerCase()

                    // Chercher la clé correspondante avec validation par valeur.
                    // Quand plusieurs groupes partagent le même name (ex: deux "Couleur"),
                    // on identifie le bon groupe en vérifiant que la valeur est valide dedans.
                    const catLabel = (VARIANT_CATEGORY_LABELS[variant.category] || '').toLowerCase()
                    const selectedEntry = Object.entries(selectedVariants).find(([k, v]) => {
                        const kLower = k.toLowerCase()
                        const keyMatch = kLower === variantNameLower || (catLabel && kLower === catLabel)
                        return keyMatch && !!findMatchingOption(variant, v)
                    })

                    if (!selectedEntry) {
                        const options = variant.options.map(o => getOptionValue(o)).join(', ')
                        console.log(`   ❌ Variante "${variantName}" MANQUANTE ou valeur invalide`)

                        return {
                            valid: false,
                            error: `Variante "${variantName}" absente ou invalide dans selected_variants. ` +
                                `Le client l'a déjà précisée dans la conversation : retrouve la valeur et rappelle create_order IMMÉDIATEMENT. ` +
                                `NE REDEMANDE PAS au client. Options valides : ${options}.`
                        }
                    }

                    const selectedValue = selectedEntry[1]
                    const validOption = findMatchingOption(variant, selectedValue)
                    const matchedValue = getOptionValue(validOption)
                    console.log(`   ✅ ${variantName}: "${selectedValue}" → "${matchedValue}"`)
                }
            } else {
                console.log(`   ℹ️ Pas de variantes requises`)
            }
        }

        console.log('✅ PRE-CHECK PASSED')
        return { valid: true }

    } catch (e) {
        console.error('❌ PRE-CHECK ERROR:', e.message)
        return { valid: true } // En cas d'erreur de parsing, laisser handleToolCall gérer
    }
}

function hydrateToolCallArguments(toolCall, checkoutState, cartState, bookingState, restaurantState, customerPhone) {
    try {
        const parsedArgs = JSON.parse(toolCall.function.arguments)

        // find_order : injecter le téléphone WhatsApp si l'IA n'en a pas fourni
        if (toolCall.function.name === 'find_order' && !parsedArgs.phone_number && customerPhone) {
            parsedArgs.phone_number = customerPhone
        }

        const mergedCheckoutArgs = mergeCheckoutStateIntoToolArgs(toolCall.function.name, parsedArgs, checkoutState)
        const mergedCartArgs = mergeCartStateIntoToolArgs(toolCall.function.name, mergedCheckoutArgs, cartState)
        const mergedBookingArgs = mergeBookingStateIntoToolArgs(toolCall.function.name, mergedCartArgs, bookingState)
        const mergedArgs = mergeRestaurantStateIntoToolArgs(toolCall.function.name, mergedBookingArgs, restaurantState)

        return {
            ...toolCall,
            function: {
                ...toolCall.function,
                arguments: JSON.stringify(mergedArgs)
            }
        }
    } catch {
        return toolCall
    }
}

function formatDirectToolResponse(parsedResult) {
    const parts = []

    if (parsedResult.items) parts.push(parsedResult.items)
    if (parsedResult.message) parts.push(parsedResult.message)

    return parts.filter(Boolean).join('\n\n')
}

/**
 * Appel OpenAI avec retry
 */
async function callOpenAIWithRetry(openai, params, maxRetries = MAX_RETRIES) {
    let lastError = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const completion = await openai.chat.completions.create(params)
            return completion
        } catch (error) {
            lastError = error
            console.log(`⚠️ OpenAI attempt ${attempt}/${maxRetries} failed:`, error.message)

            // Ne pas retry si c'est une erreur de contenu (pas réseau)
            if (error.code === 'content_filter' || error.code === 'invalid_api_key') {
                throw error
            }

            if (attempt < maxRetries) {
                const delay = RETRY_DELAY_MS * attempt
                console.log(`   ⏳ Retry in ${delay}ms...`)
                await sleep(delay)
            }
        }
    }

    throw lastError
}

/**
 * Generate AI Response v2.7
 */
async function generateAIResponse(options, dependencies) {
    const { openai, supabase, activeSessions, CinetPay } = dependencies

    let imageActions = []  // Collecter les images à envoyer

    try {
        const {

            agent,
            conversationHistory,
            userMessage,
            products,
            orders,
            customerPhone,
            conversationId,
            currency = 'USD',
            checkoutState,
            cartState,
            cartQuestionDetected = false,
            checkoutQuestionDetected = false,
            bookingState,
            restaurantState,
            restaurantQuestionDetected = false,
            hasKnowledgeBase = false,
            leadStateSummary = null,
            leadState = null,
            leadKnownContact = null
        } = options

        // RAG - Documents pertinents
        let relevantDocs = await findRelevantDocuments(openai, supabase, agent.id, userMessage)

        // Data Sync API — ajouter les données externes synchronisées (produits, FAQ, etc.)
        // Guard strict : si table absente ou erreur → aucun impact sur le flux existant
        let hasExternalData = false
        try {
            const { data: externalData } = await supabase
                .from('agent_external_data')
                .select('data_type, external_id, data')
                .eq('agent_id', agent.id)
                .limit(100)
            if (externalData && externalData.length > 0) {
                const extraDocs = externalData.map(entry => {
                    const d = entry.data || {}
                    const lines = []
                    if (d.name) lines.push(d.name)
                    if (d.description) lines.push(d.description)
                    if (d.price !== undefined) lines.push(`Prix : ${d.price}`)
                    if (d.stock !== undefined) lines.push(`Stock : ${d.stock}`)
                    const reserved = new Set(['name', 'description', 'price', 'stock'])
                    Object.entries(d).forEach(([k, v]) => {
                        if (!reserved.has(k) && v !== null && v !== undefined && typeof v !== 'object') {
                            lines.push(`${k} : ${v}`)
                        }
                    })
                    return { content: lines.filter(Boolean).join(' — ') }
                }).filter(doc => doc.content.length > 0)
                relevantDocs = [...(relevantDocs || []), ...extraDocs]
                hasExternalData = extraDocs.length > 0 && agent.ecommerce_mode === 'external_sync'
            }
        } catch (_) {
            // Silencieux — le RAG normal fonctionne sans les données externes
        }

        // Live Query API — appel sortant en temps réel (stock, statut commande, etc.)
        // Guard strict : timeout 3s, fail silencieux, zéro impact si absent
        if (agent.live_query_url) {
            try {
                const lqBody = JSON.stringify({
                    customer_phone: customerPhone,
                    message: userMessage,
                    conversation_id: conversationId,
                    agent_id: agent.id,
                })

                const headers = { 'Content-Type': 'application/json' }

                // Signature HMAC-SHA256 optionnelle si live_query_secret configuré
                if (agent.live_query_secret) {
                    const { createHmac } = require('node:crypto')
                    const sig = createHmac('sha256', agent.live_query_secret).update(lqBody).digest('hex')
                    headers['X-Wazzap-Signature'] = `sha256=${sig}`
                }

                const controller = new AbortController()
                const lqTimeout = setTimeout(() => controller.abort(), 3000)

                const lqResponse = await fetch(agent.live_query_url, {
                    method: 'POST',
                    headers,
                    body: lqBody,
                    signal: controller.signal,
                })
                clearTimeout(lqTimeout)

                if (lqResponse.ok) {
                    const lqData = await lqResponse.json().catch(() => null)
                    if (lqData) {
                        const lqContent = lqData.answer
                            || (lqData.data ? JSON.stringify(lqData.data) : null)
                            || (lqData.result ? JSON.stringify(lqData.result) : null)
                        if (lqContent) {
                            relevantDocs = [...(relevantDocs || []), {
                                content: `[Données temps réel]: ${lqContent}`
                            }]
                        }
                    }
                }
            } catch (_) {
                // Timeout ou erreur réseau → l'agent répond sans live data
            }
        }

        // Formater les horaires
        let formattedHours = 'Non spécifiés'
        if (agent.business_hours) {
            try {
                const hoursObj = typeof agent.business_hours === 'string'
                    ? JSON.parse(agent.business_hours)
                    : agent.business_hours

                const dayMap = {
                    monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
                    thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche'
                }

                formattedHours = Object.entries(hoursObj).map(([dayKey, schedule]) => {
                    const dayName = dayMap[dayKey] || dayKey
                    if (schedule.closed) return `${dayName}: Fermé`
                    return `${dayName}: ${schedule.open} - ${schedule.close}`
                }).join('\n  ')
            } catch (_e) {
                formattedHours = String(agent.business_hours)
            }
        }

        // Lien GPS
        const gpsLink = (agent.latitude && agent.longitude)
            ? `https://www.google.com/maps?q=${agent.latitude},${agent.longitude}`
            : ''

        // 3. Construire le System Prompt
        // external_sync : produits dans agent_external_data (pas dans products) → jamais support client
        const isSupportClientMode = (products || []).length === 0 && hasKnowledgeBase && agent.ecommerce_mode !== 'external_sync'
        // Mode Lead Only : catalogue conservé (produits/images/variantes), mais aucun outil
        // transactionnel — la conversation se termine par capture_lead au lieu de create_order.
        const isLeadOnlyMode = agent.conversation_mode === 'lead_only'
        const activeEngineHint =
            hasRestaurantServiceProduct(products || []) && hasRestaurantStateData(restaurantState)
                ? 'RESTAURANT'
                : null
        // external_sync : les produits externes dans relevantDocs jouent le rôle de KB
        const effectiveHasKnowledgeBase = hasKnowledgeBase || hasExternalData
        let systemPrompt = buildAdaptiveSystemPrompt(
            agent,
            products || [],
            orders || [],
            relevantDocs || [],
            currency,
            options.gpsLink || gpsLink || '',
            options.formattedHours || formattedHours || 'Non spécifiés',
            options.justOrdered || false, // Passer le flag de reset
            userMessage || '', // v2.19: Intent Detection Context
            effectiveHasKnowledgeBase,
            activeEngineHint
        )
        // Coordonnées d'une demande précédente déjà close. Elles ne sont PAS réinjectées
        // comme des acquis : le client doit pouvoir dire qu'elles ont changé. Avant ce bloc,
        // l'agent les reprenait en silence — parce qu'il voyait encore le récap du cycle
        // précédent — et le client découvrait ses anciennes coordonnées dans le récap final,
        // sans avoir jamais eu l'occasion de les corriger.
        if (isLeadOnlyMode) {
            const knownContactSection = buildKnownContactSection(leadKnownContact)
            if (knownContactSection) systemPrompt += knownContactSection
        }

        if (isLeadOnlyMode && leadStateSummary) {
            systemPrompt += `\n\nARTICLES DÉJÀ IDENTIFIÉS (source système, prioritaire — ne redemande jamais une quantité ou variante déjà connue ici, ne recalcule rien toi-même, utilise ces valeurs exactes dans preview_cart) :\n${leadStateSummary}`
        }
        if (!isSupportClientMode) {
            const checkoutStateGuidance = buildCheckoutStateGuidance(checkoutState, {
                questionDetected: checkoutQuestionDetected,
                escalationPhone: agent.escalation_phone || null,
            })
            if (checkoutStateGuidance) {
                systemPrompt += '\n\n' + checkoutStateGuidance
            }
            const cartStateGuidance = buildCartStateGuidance(cartState, products || [], {
                questionDetected: cartQuestionDetected,
                escalationPhone: agent.escalation_phone || null,
            })
            if (cartStateGuidance) {
                systemPrompt += '\n\n' + cartStateGuidance
            }
            const bookingStateGuidance = buildBookingStateGuidance(
                bookingState,
                (products || []).filter(product => product.product_type === 'service' && product.service_subtype !== 'restaurant')
            )
            if (bookingStateGuidance) {
                systemPrompt += '\n\n' + bookingStateGuidance
            }
            const restaurantStateGuidance = buildRestaurantStateGuidance(restaurantState, { questionDetected: restaurantQuestionDetected, escalationPhone: agent.escalation_phone || null })
            if (restaurantStateGuidance) {
                systemPrompt += '\n\n' + restaurantStateGuidance
            }
        }
        // Injecter la règle de salutation si c'est le premier message
        const isFirstMessage = !conversationHistory || conversationHistory.filter(m => m.role === 'user').length === 0
        if (isFirstMessage) {
            systemPrompt += '\n\n📌 PREMIER MESSAGE : Le client t\'écrit pour la première fois. Commence OBLIGATOIREMENT par le saluer chaleureusement (ex: "Bonjour ! 😊") avant de répondre à sa demande.'
        }

        // Injection dynamique si le message contient une demande d'image
        const hasImageKeyword = /\b(montre[z]?|photo[s]?|image[s]?|voir|affiche[z]?)\b/i.test(userMessage || '')
        if (hasImageKeyword) {
            systemPrompt += '\n\n🚨 RAPPEL URGENT IMAGE : Ce message contient une demande d\'image. Règle STRICTE : appelle send_image UNIQUEMENT pour le(s) produit(s) où "image", "photo" ou "montrez" est explicitement demandé. Pour les questions "prix [produit]" → réponds UNIQUEMENT avec le prix en texte, AUCUNE image.\n⚠️ RÈGLE CRITIQUE KB IMAGES : Si la section INFOS UTILES contient [IMAGES DISPONIBLES], tu DOIS utiliser le product_name ET le image_url EXACTS listés dans cette section — jamais le nom du produit catalogue. Ex : client demande "robe verte" → KB liste product_name="robe verte" image_url="https://..." → appelle send_image(product_name="robe verte", image_url="https://...").'
        }

        console.log(`📝 Prompt size: ${systemPrompt.length} chars`)

        // Préparer les messages
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-50) // Garder les 50 derniers messages
        ]

        // Gérer les images
        if (options.imageBase64) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: userMessage || "Que penses-tu de cette image ?" },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${options.imageBase64}` } }
                ]
            })
        } else {
            messages.push({ role: 'user', content: userMessage })
        }

        const modelToUse = options.imageBase64 ? 'gpt-4o' : (agent.model || 'gpt-4o-mini')
        const activeServiceEngine = activeEngineHint || detectServiceEngine(products || [], userMessage || '')
        const isRestaurantMode = activeServiceEngine === 'RESTAURANT'

        // Feature flags globaux — désactiver les tools si le flag est explicitement à false
        const flagBooking = options.featureFlags?.ai_tools_booking !== false
        const flagOrders = options.featureFlags?.ai_tools_orders !== false
        const FLAG_DISABLED_TOOLS = [
            ...(!flagBooking ? ['create_booking'] : []),
            ...(!flagOrders ? ['create_order', 'create_restaurant_checkout', 'check_payment_status'] : []),
        ]

        // En mode Support Client (KB-only), désactiver tous les tools transactionnels
        // send_image est conservé : l'agent support peut envoyer des images depuis la KB
        // capture_lead est conservé uniquement si lead_collection_enabled
        const SUPPORT_CLIENT_DISABLED_TOOLS = ['create_order', 'check_payment_status', 'create_booking', 'find_order', 'create_restaurant_checkout']
        const RESTAURANT_DISABLED_TOOLS = ['create_order', 'create_booking']
        // preview_cart calcule un récap chiffré fiable pour le mode collecte de leads —
        // inutile ailleurs (create_order/create_restaurant_checkout font déjà ce calcul en interne).
        const activeTools = isLeadOnlyMode
            // Mêmes outils transactionnels désactivés que le mode support client, mais
            // capture_lead reste toujours actif ici (pas conditionné à lead_collection_enabled,
            // qui a une sémantique différente : capturer un lead EN PLUS d'une commande normale).
            ? TOOLS.filter(t => !SUPPORT_CLIENT_DISABLED_TOOLS.includes(t.function?.name) && !FLAG_DISABLED_TOOLS.includes(t.function?.name))
            : isSupportClientMode
                ? TOOLS.filter(t => {
                    if (SUPPORT_CLIENT_DISABLED_TOOLS.includes(t.function?.name)) return false
                    if (FLAG_DISABLED_TOOLS.includes(t.function?.name)) return false
                    if (t.function?.name === 'preview_cart') return false
                    if (t.function?.name === 'capture_lead' && !agent.lead_collection_enabled) return false
                    return true
                })
                : isRestaurantMode
                    ? TOOLS.filter(t => !RESTAURANT_DISABLED_TOOLS.includes(t.function?.name) && !FLAG_DISABLED_TOOLS.includes(t.function?.name) && t.function?.name !== 'preview_cart')
                    : TOOLS.filter(t => t.function?.name !== 'capture_lead' && t.function?.name !== 'preview_cart' && !FLAG_DISABLED_TOOLS.includes(t.function?.name))
        const toolsConfig = activeTools.length > 0
            ? { tools: activeTools, tool_choice: 'auto' }
            : {}

        // Appel OpenAI avec retry
        const completion = await callOpenAIWithRetry(openai, {
            model: modelToUse,
            messages,
            max_tokens: agent.max_tokens || 500,
            temperature: agent.temperature || 0.7,
            ...toolsConfig
        })

        const responseMessage = completion.choices[0].message
        let content = responseMessage.content

        // ═══════════════════════════════════════════════════════════
        // GESTION DES TOOL CALLS
        // ═══════════════════════════════════════════════════════════
        let capturedLeadThisTurn = false
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            console.log('🤖 Tool calls:', responseMessage.tool_calls.length)

            const newHistory = [...messages, responseMessage]
            let directToolResponse = null

            for (const rawToolCall of responseMessage.tool_calls) {
                const toolCall = hydrateToolCallArguments(rawToolCall, checkoutState, cartState, bookingState, restaurantState, customerPhone)
                console.log(`🔧 Tool: ${toolCall.function.name}`)
                if (toolCall.function.name === 'capture_lead') capturedLeadThisTurn = true

                // Pre-check pour create_order
                const preCheck = preCheckCreateOrder(toolCall, products || [])

                if (!preCheck.valid) {
                    console.log('🚫 PRE-CHECK BLOCKED:', preCheck.error)

                    newHistory.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({
                            success: false,
                            blocked_by_precheck: true,
                            error: preCheck.error
                        })
                    })
                    continue
                }

                // Exécuter le tool
                const toolResult = await handleToolCall(
                    toolCall,
                    agent.id,
                    customerPhone,
                    products,
                    conversationId,
                    supabase,
                    { relevantDocs, userMessage }
                )

                // Collecter les actions d'images pour envoi réel
                try {
                    const parsedResult = JSON.parse(toolResult)
                    if (parsedResult.action === 'send_image' && parsedResult.image_url) {
                        if (!imageActions) imageActions = []
                        imageActions.push({
                            image_url: parsedResult.image_url,
                            caption: parsedResult.caption || '',
                            product_name: parsedResult.product_name
                        })
                        console.log(`📸 Image à envoyer: ${parsedResult.product_name}`)
                    }

                    if (
                        parsedResult.success &&
                        ['create_order', 'create_booking', 'create_restaurant_checkout', 'check_payment_status', 'find_order'].includes(toolCall.function.name)
                    ) {
                        const formattedResponse = formatDirectToolResponse(parsedResult)
                        if (formattedResponse) {
                            directToolResponse = formattedResponse
                        }
                    }
                } catch (_e) {
                    // Pas de parsing nécessaire
                }

                newHistory.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                })
            }

            if (directToolResponse) {
                content = directToolResponse
            } else {
                // Second appel pour la réponse finale (avec retry)
                const secondCompletion = await callOpenAIWithRetry(openai, {
                    model: agent.model || 'gpt-4o-mini',
                    messages: newHistory,
                    max_tokens: agent.max_tokens || 500,
                    temperature: agent.temperature || 0.7
                })

                content = secondCompletion.choices[0].message.content
            }
        }

        // Post-processing : supprimer markdown images et doublons caption/texte
        content = stripMarkdownImages(content)
        content = stripImageDoublons(content, imageActions)
        content = stripLeadOnlyPaymentMentions(content, isLeadOnlyMode)
        // Avant le filet capture_lead ci-dessous : un récap de clôture non rempli ne doit
        // ni partir au client, ni compter comme une clôture qui déclenche l'enregistrement.
        content = stripLeadOnlyUnfilledRecap(content, isLeadOnlyMode)
        content = stripLeadOnlyInternalMarkers(content, isLeadOnlyMode)
        content = stripLeadOnlyNarration(content, isLeadOnlyMode)

        // Question portant sur une quantité déjà connue : on ne la corrige pas nous-mêmes,
        // on renvoie le constat au modèle et on le laisse reformuler (voir
        // findStaleQuantityQuestion). Un seul essai : au-delà, mieux vaut la réponse
        // imparfaite qu'une latence supplémentaire pour le client.
        if (isLeadOnlyMode) {
            // Jusqu'à 2 tentatives : mesuré, une seule ne suffit pas quand le signal de
            // quantité est faible ("une gourde" = 1), le modèle voulant reconfirmer.
            for (let attempt = 1; attempt <= 2; attempt++) {
            const staleQuantity = findStaleQuantityQuestion(content, leadState)
            const falseUnavailable = findFalseUnavailabilityClaim(content, products || [])
            const missingFee = findMissingDeliveryFee(content, leadState, agent)
            const inventedFee = findInventedDeliveryFee(content, agent, conversationHistory, userMessage)
            const pricelessRecap = findPricelessRecap(content, isLeadOnlyMode)
            const unknownItem = findUnannouncedUnknownItem(content, leadState)
            const stale = staleQuantity
                || (falseUnavailable && {
                    sentence: falseUnavailable.sentence,
                    item: { product_name: falseUnavailable.product, quantity: null },
                    unavailable: falseUnavailable,
                })
                || (inventedFee && {
                    sentence: inventedFee.sentence,
                    item: { product_name: 'livraison', quantity: null },
                    inventedFee: true,
                })
                || (missingFee && {
                    sentence: missingFee.sentence,
                    item: { product_name: 'livraison', quantity: null },
                    missingFee: true,
                })
                || (pricelessRecap && {
                    sentence: pricelessRecap.sentence,
                    item: { product_name: 'récapitulatif', quantity: null },
                    pricelessRecap: true,
                })
                || (unknownItem && {
                    sentence: unknownItem.mention.text,
                    item: { product_name: unknownItem.mention.text, quantity: unknownItem.mention.quantity },
                    unknownItem: unknownItem.mention,
                })
            if (!stale) break
            {
                try {
                    // La phrase fautive est journalisée telle quelle : sans elle, impossible
                    // de comprendre a posteriori pourquoi le modèle a reposé la question.
                    // Tronquée à 160 caractères pour rester lisible dans les logs PM2.
                    const motif = stale.inventedFee
                        ? `supprimer l'annonce de tarif de livraison. Le lieu donné par le client ne correspond à AUCUNE zone configurée, donc ce montant est inventé. Le message doit demander au client de préciser sa commune au lieu d'annoncer un prix.`
                        : stale.unavailable
                        ? `supprimer l'affirmation « ${stale.unavailable.variant} n'est pas disponible » pour "${stale.unavailable.product}". C'EST FAUX : cette couleur est au catalogue et se vend. Le message doit accepter la demande du client au lieu de la refuser.`
                        : stale.variantAlreadyKnown
                            ? `supprimer la question qui redemande la couleur de "${stale.item.product_name}", déjà choisie (${stale.item.variant}).`
                            : `supprimer la question qui redemande la quantité de "${stale.item.product_name}", déjà connue (${stale.item.quantity}).`
                    console.log(stale.inventedFee
                        ? '⚠️ [lead_only] Tarif de livraison annoncé pour un lieu hors zones configurées — reformulation demandée'
                        : stale.missingFee
                        ? '⚠️ [lead_only] Récap de livraison sans frais de livraison — reformulation demandée'
                        : stale.pricelessRecap
                        ? '⚠️ [lead_only] Récap d\'articles écrit à la main, sans prix ni total — reformulation demandée'
                        : stale.unknownItem
                        ? `⚠️ [lead_only] Article hors catalogue passé sous silence (${stale.unknownItem.text} × ${stale.unknownItem.quantity}) — reformulation demandée`
                        : stale.unavailable
                            ? `⚠️ [lead_only] Variante du catalogue annoncée indisponible à tort (${stale.unavailable.product} / ${stale.unavailable.variant}) — reformulation demandée`
                            : `⚠️ [lead_only] Question sur une quantité déjà connue (${stale.item.product_name} = ${stale.item.quantity}) — reformulation demandée`)
                    console.log(`   ↳ phrase fautive : "${stale.sentence.slice(0, 160)}"`)
                    // Deux cas exigent un OUTIL et non une réécriture de texte : les frais de
                    // livraison manquants et le récap sans prix. Dans les deux, seul
                    // preview_cart connaît les montants — une réécriture ne peut que les
                    // inventer, ce qui est précisément ce qu'on cherche à empêcher.
                    const rewritten = stale.unknownItem
                        ? await rewriteAddingUnknownItemNotice(openai, modelToUse, content, stale.unknownItem)
                        : (stale.missingFee || stale.pricelessRecap)
                        ? await regenerateThroughTools({
                            openai,
                            model: modelToUse,
                            maxTokens: agent.max_tokens || 500,
                            temperature: agent.temperature || 0.7,
                            systemPrompt,
                            messages,
                            toolsConfig,
                            correction: stale.missingFee
                                ? `🚨 CORRECTION IMMÉDIATE : ta réponse précédente affichait un total sans ligne "Frais de livraison" alors que le client a choisi la LIVRAISON. Rappelle preview_cart avec la liste complète des articles ET delivery_fee = le tarif exact de sa commune, puis reproduis le nouveau recap_text.`
                                : `🚨 CORRECTION IMMÉDIATE : ta réponse précédente listait des articles SANS AUCUN PRIX ni total (« ${stale.sentence.slice(0, 120)} »). Une liste d'articles sans prix n'existe pas dans ce mode. Appelle preview_cart avec la liste complète des articles (et delivery_fee si le client a déjà choisi la livraison), puis reproduis son recap_text EXACTEMENT, avant de poser ta question suivante.`,
                            runToolCall: async (rawToolCall) => {
                                const toolCall = hydrateToolCallArguments(
                                    rawToolCall, checkoutState, cartState, bookingState, restaurantState, customerPhone
                                )
                                console.log(`   ↳ 🔧 outil rappelé pour la correction : ${toolCall.function.name}`)
                                const result = await handleToolCall(
                                    toolCall, agent.id, customerPhone, products, conversationId, supabase,
                                    { relevantDocs, userMessage }
                                )
                                return { toolCall, result }
                            },
                        })
                        // Réécriture ciblée, sans le prompt métier : voir
                        // rewriteWithoutImpossibleQuestion pour la raison détaillée.
                        : await rewriteWithoutImpossibleQuestion(
                            openai, modelToUse, content, leadState, conversationHistory, motif, stale.sentence
                        )
                    if (rewritten) {
                        content = stripLeadOnlyUnfilledRecap(
                            stripLeadOnlyPaymentMentions(stripMarkdownImages(rewritten), isLeadOnlyMode),
                            isLeadOnlyMode
                        )
                        // Vérifie que la reformulation a réellement réglé le problème : c'est
                        // le seul moyen de savoir, en production, si le garde-fou tient ou si
                        // le modèle repose la même question malgré la correction.
                        const stillStale = findStaleQuantityQuestion(content, leadState)
                            || findFalseUnavailabilityClaim(content, products || [])
                            || findMissingDeliveryFee(content, leadState, agent)
                            || findInventedDeliveryFee(content, agent, conversationHistory, userMessage)
                            || findPricelessRecap(content, isLeadOnlyMode)
                            || findUnannouncedUnknownItem(content, leadState)
                        console.log(stillStale
                            ? `   ↳ ❌ reformulation INSUFFISANTE, l'erreur persiste : "${stillStale.sentence.slice(0, 160)}"`
                            : '   ↳ ✅ reformulation OK, la question a disparu')
                    } else {
                        console.log('   ↳ ⚠️ reformulation sans texte (appel d\'outil seul), réponse initiale conservée')
                    }
                } catch (retryErr) {
                    console.error('⚠️ [lead_only] Reformulation échouée, réponse initiale conservée:', retryErr?.message || retryErr)
                    break
                }
            }
            }
        }

        // Filet de sécurité mode lead_only : le récap de clôture (bloc "*Vos coordonnées :*"
        // imposé par l'ÉTAPE 5 du workflow) ne doit JAMAIS être envoyé sans que capture_lead
        // ait réellement été appelé — observé en production : le modèle écrit parfois le
        // message de succès sans appeler l'outil, et aucun lead n'est enregistré. On force
        // l'appel ici ; capture_lead est idempotent par conversation_id (upsert), donc aucun
        // risque de doublon si l'IA l'avait en fait déjà appelé plus tôt dans l'historique.
        if (isLeadOnlyMode && !capturedLeadThisTurn && content && content.includes('*Vos coordonnées :*')) {
            try {
                console.log('⚠️ [lead_only] Récap de clôture détecté sans capture_lead — appel forcé')
                const captureTool = TOOLS.find(t => t.function?.name === 'capture_lead')
                if (captureTool) {
                    const forcedCompletion = await callOpenAIWithRetry(openai, {
                        model: agent.model || 'gpt-4o-mini',
                        messages: [...messages, { role: 'assistant', content }],
                        max_tokens: 500,
                        temperature: agent.temperature || 0.7,
                        tools: [captureTool],
                        tool_choice: { type: 'function', function: { name: 'capture_lead' } }
                    })
                    const forcedToolCall = forcedCompletion.choices[0]?.message?.tool_calls?.[0]
                    if (forcedToolCall) {
                        await handleToolCall(forcedToolCall, agent.id, customerPhone, products, conversationId, supabase, { relevantDocs, userMessage })
                        console.log('✅ [lead_only] capture_lead forcé exécuté avec succès')
                    }
                }
            } catch (forceErr) {
                console.error('⚠️ [lead_only] Échec du filet de sécurité capture_lead:', forceErr?.message || forceErr)
            }
        }

        // Vérification d'intégrité (prix)
        const integrityCheck = verifyResponseIntegrity(content, products)
        if (!integrityCheck.isValid) {
            console.log('⚠️ Integrity issues detected:', integrityCheck.issues)
            // TODO: Optionnellement régénérer si hallucination critique
        }

        return {
            content: content,
            tokensUsed: (completion.usage?.total_tokens || 0) + 100,
            imageActions: imageActions || []  // Retourner les images à envoyer
        }


    } catch (error) {
        console.error('❌ OpenAI Error:', error)

        // Logger à Sentry si disponible
        try {
            const Sentry = require('@sentry/node')
            Sentry.captureException(error, {
                tags: { component: 'generator', type: 'openai_error' },
                extra: {
                    agentId: options.agent?.id,
                    customerPhone: options.customerPhone,
                    messageLength: options.userMessage?.length
                }
            })
        } catch (_e) {
            // Sentry non configuré, ignorer
        }

        return {
            content: 'Désolé, je rencontre un problème technique momentané. Veuillez réessayer dans quelques instants.',
            tokensUsed: 0
        }
    }
}

// stripLeadOnlyUnfilledRecap est exporté uniquement pour être testable unitairement :
// son déclenchement dépend d'une sortie du modèle, impossible à provoquer autrement.
module.exports = { generateAIResponse, stripLeadOnlyUnfilledRecap, findStaleQuantityQuestion, findFalseUnavailabilityClaim, stripLeadOnlyNarration, findInventedDeliveryFee, findMissingDeliveryFee, findPricelessRecap, findUnannouncedUnknownItem, buildKnownContactSection }
