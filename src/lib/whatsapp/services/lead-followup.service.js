
/**
 * ═══════════════════════════════════════════════════════════════
 * RELANCE APRÈS CLÔTURE D'UN LEAD (mode lead_only)
 * ═══════════════════════════════════════════════════════════════
 *
 * Une fois le récapitulatif final envoyé, le lead est enregistré et le cycle est terminé :
 * l'historique visible par l'IA est coupé et la mémoire des articles est vidée, pour qu'une
 * éventuelle nouvelle demande reparte d'une page blanche sans se mélanger à la précédente.
 *
 * Se pose alors la question de ce que devient le message suivant du client. Trois versions
 * ont été écartées :
 *   - couper le bot (escalade immédiate) : « je veux aussi 3 sacs » devenait une vente perdue,
 *     et le message d'après ne recevait plus rien du tout ;
 *   - laisser l'IA reprendre la main directement : un simple « Merci » relançait le catalogue
 *     complet, comme si le client entamait une conversation ;
 *   - demander à l'IA de trancher elle-même entre « modification » et « nouveau besoin » :
 *     un jugement, donc faillible, donc à surveiller.
 *
 * Retenu : une relance en deux temps, entièrement déterministe. Le client est explicitement
 * invité à dire s'il veut passer une NOUVELLE commande. Le modèle n'a rien à classer, et les
 * textes ci-dessous ne peuvent pas dévier.
 *
 * ⚠️ PÉRIMÈTRE : tout ce fichier s'applique STRICTEMENT hors de la conversation de vente —
 * il commence après le récap final et s'arrête dès que le client rentre dans un nouveau
 * cycle. Aucune de ces phrases ne peut apparaître pendant une commande en cours. Même
 * famille que le message de transfert humain, déjà en dur dans message.js.
 *
 * Machine à états (metadata.lead_followup) :
 *
 *   [clôture]  ──────────────────────────────▶  pending
 *   pending    ── message quelconque ────────▶  asked          (envoie la relance)
 *   pending    ── message nommant un article ▶  (effacé)       → l'IA reprend, nouveau cycle
 *   asked      ── accord ────────────────────▶  (effacé)       → l'IA reprend, nouveau cycle
 *   asked      ── article nommé ─────────────▶  (effacé)       → l'IA reprend, nouveau cycle
 *   asked      ── refus ─────────────────────▶  pending        (accuse réception)
 *   asked      ── non classé (1re fois) ─────▶  asked          (redirige vers le conseiller)
 *   asked      ── non classé (2e fois) ──────▶  escalade       (prévient un humain)
 */

const { normalizeText, singularize, fuzzyDistanceOk } = require('./lead-state.service')

const FOLLOWUP_KEY = 'lead_followup'

// Seuil d'escalade : deux messages consécutifs que l'on n'a pas su classer. Le premier
// reçoit une redirection vers le conseiller, le second déclenche l'escalade — un humain est
// prévenu et le bot se tait. C'est la SEULE situation où il se tait.
const UNCLASSIFIED_ESCALATION_THRESHOLD = 2

/**
 * Accords EXPLICITES. Priment sur tout le reste, y compris sur un « merci » présent dans la
 * même phrase : « oui merci, je veux ajouter des sacs » est un accord poli, pas un refus.
 */
const STRONG_ACCEPT = [
    /\boui\b/, /\bouais\b/, /\bwi\b/,
    /\byes\b/, /\byeah\b/, /\byep\b/, /\byup\b/,
    // Intention d'achat EXPLICITE seulement. « je veux » seul a été retiré après essai :
    // il classait « je veux juste changer mon numéro » comme un accord, alors que c'est
    // précisément le message à rediriger vers un conseiller. Le verbe d'achat, lui, ne
    // laisse aucune ambiguïté (« commande » au singulier n'est pas matché : \bcommander\b).
    /\bcommander\b/, /\bacheter\b/,
    /\bnouvelle\s+commande\b/, /\bune\s+autre\s+commande\b/,
    // Idem côté anglais : « order » seul attraperait « my order is wrong ».
    /\bbuy\b/, /\bnew\s+order\b/, /\banother\s+order\b/,
    /\b(?:place|make)\s+(?:a\s+|an\s+)?(?:new\s+)?order\b/,
    /\bi\s+want\s+to\s+(?:order|buy)\b/, /\bi[' ]?d\s+like\s+to\s+(?:order|buy)\b/,
]

/**
 * Refus, ou politesse de fin de conversation. « Merci » en fait partie : c'est la façon la
 * plus courante de décliner en français, et le traiter comme un accord déclencherait un
 * catalogue non sollicité.
 */
const DECLINE = [
    /\bnon\b/, /\bnan\b/, /\bnope?\b/,
    /\bmerci\b/, /\bthanks?\b/, /\bthank\s+you\b/,
    /\brien\b/, /\baucun[e]?\b/, /\bnothing\b/,
    /\bc[' ]?est\s+bon\b/, /\bca\s+va\b/, /\bca\s+ira\b/, /\bthat[' ]?s\s+all\b/, /\bi[' ]?m\s+good\b/,
    /\bpas\s+maintenant\b/, /\bplus\s+tard\b/, /\bune\s+autre\s+fois\b/,
    /\bnot\s+now\b/, /\blater\b/, /\banother\s+time\b/,
    /\ba\s+bientot\b/, /\bau\s+revoir\b/, /\bbonne\s+journee\b/, /\bbonne\s+soiree\b/,
    /\bbye\b/, /\bgoodbye\b/, /\bgood\s+day\b/,
]

/**
 * Demandes de correction ou signalements de problème. Elles PRIMENT sur un refus présent
 * dans la même phrase.
 *
 * Trouvé par les tests : « Non je veux juste changer mon numéro » contient « non » et
 * partait donc en refus poli — le client recevait « très bien, à bientôt » alors qu'il
 * signalait une erreur sur son dossier. Or c'est exactement la population que la redirection
 * vers un conseiller existe pour servir : après la clôture, le cycle est archivé et l'agent
 * n'a plus accès à la demande, seul un humain peut la modifier.
 *
 * Liste volontairement centrée sur la modification et l'incident, pas sur toute demande :
 * un « non » suivi d'une phrase anodine reste un refus.
 */
const REQUEST_MARKER = [
    /\bchanger\b/, /\bmodifier\b/, /\bcorriger\b/, /\brectifier\b/, /\bremplacer\b/,
    /\bannuler\b/, /\bsupprimer\b/, /\benlever\b/,
    /\berreur\b/, /\btromp[ée]e?\b/, /\bfaux\b/, /\bfausse\b/, /\burgent\b/, /\bprobleme\b/,
    /\bchange\b/, /\bmodify\b/, /\bcorrect\b/, /\bcancel\b/, /\bremove\b/, /\breplace\b/,
    /\bwrong\b/, /\bmistake\b/, /\bissue\b/, /\bproblem\b/, /\burgent\b/,
]

/**
 * Accords FAIBLES : ils valent oui seuls, mais s'inclinent devant un refus présent dans la
 * même phrase. « Ok merci » et « d'accord merci » sont des refus polis, pas des acceptations.
 */
const WEAK_ACCEPT = [
    /\bok\b/, /\bokay\b/, /\bd[' ]?accord\b/, /\bdac\b/,
    /\bbien\s+sur\b/, /\bcarrement\b/, /\ballons\s*y\b/,
    /\bsure\b/, /\bof\s+course\b/, /\babsolutely\b/,
]

/**
 * Un message vide une fois les emojis et la ponctuation retirés (« 👍 », « 🙏🙏 », « ... »)
 * est un acquiescement muet. On le range avec les refus PLUTÔT que dans les non classés :
 * sinon deux emojis d'affilée suffiraient à escalader, et le marchand recevrait des alertes
 * pour du bruit.
 */
function isSilentAcknowledgement(text) {
    const letters = String(text || '').replace(/[^\p{L}\p{N}]/gu, '')
    return letters.length === 0
}

/**
 * @returns {'accept'|'decline'|'unclassified'}
 */
function classifyFollowupReply(text) {
    if (isSilentAcknowledgement(text)) return 'decline'

    const normalized = ` ${normalizeText(text)} `

    if (STRONG_ACCEPT.some(re => re.test(normalized))) return 'accept'
    // Avant DECLINE, volontairement : « Non je veux juste changer mon numéro » doit atteindre
    // un conseiller, pas recevoir un « très bien, à bientôt ».
    if (REQUEST_MARKER.some(re => re.test(normalized))) return 'unclassified'
    if (DECLINE.some(re => re.test(normalized))) return 'decline'
    if (WEAK_ACCEPT.some(re => re.test(normalized))) return 'accept'

    return 'unclassified'
}

/**
 * Le message nomme-t-il un article du catalogue ?
 *
 * Quand c'est le cas, la relance est INUTILE et même nuisible : le client a déjà exprimé son
 * intention. Lui demander « souhaitez-vous passer une nouvelle commande ? » l'obligerait à
 * répondre « oui », puis à retaper sa commande — l'ardoise ayant été effacée à la clôture.
 *
 * Comparaison tolérante empruntée au moteur d'état (fautes, pluriels) : le catalogue dit
 * « goube enfant », les clients écrivent « gourde ». On compare sur le premier mot
 * significatif du nom, comme le fait déjà generator.js.
 */
function mentionsCatalogProduct(text, products = []) {
    const words = normalizeText(text).split(/\s+/).filter(Boolean)
    if (words.length === 0) return false

    return (products || []).some(product => {
        const head = singularize(normalizeText(String(product?.name || '').trim().split(/\s+/)[0] || ''))
        if (head.length < 3) return false
        return words.some(word => fuzzyDistanceOk(singularize(word.replace(/[^\p{L}\p{N}]/gu, '')), head))
    })
}

function phoneLine(escalationPhone, label) {
    return escalationPhone ? `\n\n📞 ${label} ${escalationPhone}` : ''
}

/**
 * Les quatre messages de la relance, en français et en anglais.
 *
 * Volontairement NON configurables par le marchand pour l'instant : quatre champs de plus
 * dans le formulaire d'agent pour un gain incertain, alors qu'on ne sait pas encore lesquels
 * méritent d'être ajustés. Le seul élément variable est le numéro d'escalade de l'agent.
 */
function buildFollowupMessages(agent = {}) {
    const phone = agent.escalation_phone || ''
    const isEnglish = agent.language === 'en'

    if (isEnglish) {
        return {
            question: `Your previous request has been saved ✅ Our team will contact you to finalise it.\n\nWould you like to place a *new order*?\nReply *Yes* to start.${phoneLine(phone, 'To change or follow up on your previous request:')}`,
            declined: `Perfect 🙌 Your request is with our team, they will get back to you shortly.${phoneLine(phone, 'Any questions in the meantime?')}`,
            redirect: phone
                ? `An advisor will be better placed to help you with this 🙏\n📞 ${phone}\n\nIf you would like to place a *new order*, reply *Yes*.`
                : `An advisor will be better placed to help you with this — our team will get back to you very soon 🙏\n\nIf you would like to place a *new order*, reply *Yes*.`,
            escalated: `I am passing your message on to an advisor, they will call you back very soon 🙏${phoneLine(phone, '')}`,
        }
    }

    return {
        question: `Votre demande précédente est bien enregistrée ✅ Notre équipe vous recontacte pour la finaliser.\n\nSouhaitez-vous passer une *nouvelle commande* ?\nRépondez *Oui* pour démarrer.${phoneLine(phone, 'Pour modifier ou suivre la demande précédente :')}`,
        declined: `Très bien 🙌 Votre demande est entre les mains de notre équipe, vous serez recontacté rapidement.${phoneLine(phone, "Une question d'ici là ?")}`,
        redirect: phone
            ? `Pour cette demande, un conseiller pourra mieux vous répondre 🙏\n📞 ${phone}\n\nSi vous souhaitez passer une *nouvelle commande*, répondez *Oui*.`
            : `Pour cette demande, un conseiller pourra mieux vous répondre — notre équipe vous recontacte très bientôt 🙏\n\nSi vous souhaitez passer une *nouvelle commande*, répondez *Oui*.`,
        escalated: `Je transmets votre message à un conseiller, il vous rappelle très vite 🙏${phoneLine(phone, '')}`,
    }
}

function getFollowupState(metadata) {
    const raw = metadata?.[FOLLOWUP_KEY]
    if (!raw || typeof raw !== 'object') return null
    if (raw.stage !== 'pending' && raw.stage !== 'asked') return null
    return { stage: raw.stage, unclassified: Number(raw.unclassified) || 0 }
}

/**
 * Décide ce qu'il advient du message entrant, SANS effet de bord : la fonction ne lit rien
 * et n'écrit rien: elle reçoit l'état et rend la décision. C'est ce qui la rend testable
 * unitairement, contrairement au reste du handler.
 *
 * @returns {{action: 'ask'|'decline'|'redirect'|'escalate'|'handover', nextState: object|null, reason: string}}
 *   - `handover` = effacer l'état et laisser l'IA traiter le message normalement.
 */
function decideFollowupAction(followupState, text, products = []) {
    if (!followupState) return { action: 'handover', nextState: null, reason: 'aucune relance en cours' }

    // Un article nommé vaut intention certaine, à n'importe quel stade : on ne fait pas
    // perdre deux messages à un client qui vient d'énoncer sa commande.
    if (mentionsCatalogProduct(text, products)) {
        return { action: 'handover', nextState: null, reason: 'le message nomme un article du catalogue' }
    }

    if (followupState.stage === 'pending') {
        return { action: 'ask', nextState: { stage: 'asked', unclassified: 0 }, reason: 'premier message après la clôture' }
    }

    const reply = classifyFollowupReply(text)

    if (reply === 'accept') {
        return { action: 'handover', nextState: null, reason: 'le client accepte une nouvelle commande' }
    }

    if (reply === 'decline') {
        // Retour en attente plutôt qu'un état terminal : s'il réécrit dans deux jours, il
        // retrouve la question au lieu d'un catalogue surgi de nulle part.
        return { action: 'decline', nextState: { stage: 'pending', unclassified: 0 }, reason: 'le client décline' }
    }

    const unclassified = followupState.unclassified + 1
    if (unclassified >= UNCLASSIFIED_ESCALATION_THRESHOLD) {
        return { action: 'escalate', nextState: null, reason: `${unclassified} messages non classés consécutifs` }
    }

    return { action: 'redirect', nextState: { stage: 'asked', unclassified }, reason: 'message non classé' }
}

module.exports = {
    FOLLOWUP_KEY,
    UNCLASSIFIED_ESCALATION_THRESHOLD,
    classifyFollowupReply,
    mentionsCatalogProduct,
    buildFollowupMessages,
    getFollowupState,
    decideFollowupAction,
}
