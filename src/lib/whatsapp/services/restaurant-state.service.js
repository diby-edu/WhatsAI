'use strict'

const { normalizePhoneNumber } = require('../ai/tools/tool-helpers')

// ═══════════════════════════════════════════════════════════════
// STAGES
// ═══════════════════════════════════════════════════════════════

const RESTAURANT_STAGE = {
    MENU_HOME:      'MENU_HOME',      // Menu principal (1=carte, 2=boissons, 3=réserver)
    SECTION:        'SECTION',        // Navigation section par section (starters→mains→extras→desserts)
    DRINKS:         'DRINKS',         // Section boissons
    MODE:           'MODE',           // Choix mode (sur place / emporter / livraison)
    CUSTOMER_FLOW:  'CUSTOMER_FLOW',  // Collecte infos client
    RECAP:          'RECAP',          // Récap final + confirmation
    READY:          'READY',          // Confirmé → déclenche create_restaurant_checkout
    DEPOSIT:        'DEPOSIT',        // En attente de paiement d'acompte
}

// ═══════════════════════════════════════════════════════════════
// CONFIG SECTIONS
// ═══════════════════════════════════════════════════════════════

const SECTION_ORDER_CANONICAL = ['starters', 'mains', 'extras', 'desserts']

const SECTION_CONFIG = {
    starters: { label: 'ENTRÉES',      emoji: '🥗', singular: 'entrée'      },
    mains:    { label: 'PLATS',         emoji: '🍽️', singular: 'plat'        },
    extras:   { label: 'SUPPLÉMENTS',   emoji: '➕', singular: 'supplément'  },
    desserts: { label: 'DESSERTS',      emoji: '🍰', singular: 'dessert'     },
    drinks:   { label: 'BOISSONS',      emoji: '🥤', singular: 'boisson'     },
}

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
}

// ═══════════════════════════════════════════════════════════════
// STATE CLONING
// ═══════════════════════════════════════════════════════════════

function cloneCartItems(items = []) {
    return Array.isArray(items)
        ? items.map(item => ({
            product_id:       item.product_id || null,
            product_name:     item.product_name || '',
            menu_section_slug: item.menu_section_slug || null,
            quantity:         Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1,
            unit_price_fcfa:  Number.isFinite(Number(item.unit_price_fcfa)) ? Number(item.unit_price_fcfa) : 0,
            line_total_fcfa:  Number.isFinite(Number(item.line_total_fcfa)) ? Number(item.line_total_fcfa) : 0,
        }))
        : []
}

function cloneCustomerFlow(cf = {}) {
    return {
        scheduled_date:   cf.scheduled_date || null,
        scheduled_time:   cf.scheduled_time || null,
        party_size:       Number.isFinite(Number(cf.party_size)) ? Number(cf.party_size) : null,
        delivery_address: cf.delivery_address || null,
        customer_name:    cf.customer_name || null,
        customer_phone:   cf.customer_phone || null,
        notes:            cf.notes === undefined ? null : cf.notes,
        note_declined:    cf.note_declined === true,
        payment_method:   cf.payment_method || null,
    }
}

function cloneRestaurantState(state = {}) {
    return {
        stage:                 state.stage || RESTAURANT_STAGE.MENU_HOME,
        section_order:         Array.isArray(state.section_order) ? [...state.section_order] : [],
        current_section_index: Number.isFinite(Number(state.current_section_index)) ? Number(state.current_section_index) : 0,
        drinks_enabled:        state.drinks_enabled === true,
        cart_items:            cloneCartItems(state.cart_items || []),
        fulfillment_mode:      state.fulfillment_mode || null,
        customer_flow:         cloneCustomerFlow(state.customer_flow || {}),
        awaiting_cf_field:     state.awaiting_cf_field || null,
        last_prompt_kind:      state.last_prompt_kind || null,
        modification_origin:   state.modification_origin || null, // 'RECAP' si modification depuis le récap
        updated_at:            state.updated_at || null,
    }
}

// ═══════════════════════════════════════════════════════════════
// STATE GET / SET / CLEAR
// ═══════════════════════════════════════════════════════════════

function getRestaurantState(metadata = {}) {
    return cloneRestaurantState(metadata.restaurant || {})
}

function setRestaurantState(metadata = {}, restaurantState) {
    return {
        ...(metadata || {}),
        restaurant: {
            ...cloneRestaurantState(restaurantState),
            updated_at: new Date().toISOString(),
        },
    }
}

function clearRestaurantState(metadata = {}) {
    return { ...(metadata || {}), restaurant: null }
}

function hasRestaurantStateData(state = {}) {
    const s = cloneRestaurantState(state)
    return Boolean(
        s.cart_items.length > 0 ||
        s.fulfillment_mode ||
        s.customer_flow.customer_name ||
        s.customer_flow.customer_phone ||
        s.customer_flow.scheduled_date ||
        s.stage !== RESTAURANT_STAGE.MENU_HOME
    )
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTS HELPERS
// ═══════════════════════════════════════════════════════════════

function buildSectionOrder(products) {
    const present = new Set(products.map(p => p.menu_section_slug).filter(Boolean))
    return SECTION_ORDER_CANONICAL.filter(slug => present.has(slug))
}

function sortRestaurantSectionProducts(products = []) {
    return [...products].sort((a, b) => {
        const aSort = Number.isFinite(Number(a.menu_sort_order)) ? Number(a.menu_sort_order) : Number.MAX_SAFE_INTEGER
        const bSort = Number.isFinite(Number(b.menu_sort_order)) ? Number(b.menu_sort_order) : Number.MAX_SAFE_INTEGER
        if (aSort !== bSort) return aSort - bSort
        return String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' })
    })
}

function getProductsForSection(products, slug) {
    return sortRestaurantSectionProducts(products.filter(p => p.menu_section_slug === slug))
}

function getDrinkProducts(products) {
    return sortRestaurantSectionProducts(products.filter(p => p.menu_section_slug === 'drinks'))
}

// ═══════════════════════════════════════════════════════════════
// DETECTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function detectMenuChoice(text) {
    const n = normalizeText(text)
    if (n === '1' || ['notre carte', 'la carte', 'voir la carte', 'voir le menu', 'les plats', 'commander'].includes(n)) return 1
    if (n === '2' || ['boisson', 'boissons', 'drink', 'drinks'].includes(n)) return 2
    if (n === '3' || ['reserver', 'reservation', 'une table', 'reserver une table'].includes(n)) return 3
    return null
}

function detectSuiteCommand(text) {
    return /\bsuite\b|\bsuivant\b|\bcontinuer\b/.test(normalizeText(text))
}

function detectValiderCommand(text) {
    return /\bvalider\b|\bfinaliser\b/.test(normalizeText(text))
}

function isFreshRestaurantRestartRequest(text, restaurantProducts = []) {
    const normalized = normalizeText(text)
    if (!normalized) return false

    const explicitIntent = /\b(je veux|je voudrais|je souhaite|j aimerais|j'aimerais)\b/.test(normalized)
    const reservationIntent = /reserver|reservation|\bune table\b/.test(normalized)
    const inlineMode = detectFulfillmentMode(text)
    const itemResult = extractItemsFromText(text, restaurantProducts, [])
    const hasStructuredDetails = Boolean(
        extractDate(text)
        || extractTime(text)
        || extractPartySize(text)
        || inlineMode
        || itemResult.captured.length > 0
    )

    return explicitIntent && hasStructuredDetails && (reservationIntent || itemResult.captured.length > 0 || inlineMode)
}

function detectRetourCommand(text) {
    return /\bretour\b|\bannuler\b/.test(normalizeText(text))
}

function detectModifierSection(text) {
    const n = normalizeText(text)
    if (/modifier.*entree|modifier.*starters|retour.*entree/.test(n)) return 'starters'
    if (/modifier.*plat|modifier.*mains|retour.*plat/.test(n)) return 'mains'
    if (/modifier.*supplement|modifier.*extras|retour.*supplement/.test(n)) return 'extras'
    if (/modifier.*dessert|retour.*dessert/.test(n)) return 'desserts'
    if (/modifier.*boisson|modifier.*drink|retour.*boisson/.test(n)) return 'drinks'
    if (/\bmodifier\b/.test(n)) return 'generic'
    return null
}

function detectFulfillmentMode(text) {
    const n = normalizeText(text)
    if (/(livraison|livrer|a domicile|chez moi|en livraison)/.test(n)) return 'delivery'
    if (/(a emporter|emporter|retrait|retirer|takeaway)/.test(n)) return 'takeaway'
    if (/(sur place|manger sur place|surplace|au restaurant|en salle)/.test(n)) return 'dine_in'
    if (/^1$/.test(n.trim())) return 'dine_in'
    if (/^2$/.test(n.trim())) return 'takeaway'
    if (/^3$/.test(n.trim())) return 'delivery'
    return null
}

function isPositiveReply(text) {
    const n = normalizeText(text)
    return ['oui', 'ok', 'okay', 'daccord', "d'accord", 'je confirme', 'confirme', 'cest bon', "c'est bon", 'yes'].includes(n)
}

function isNegativeReply(text) {
    const n = normalizeText(text)
    return ['non', 'modifier', 'je veux modifier', 'corriger', 'pas encore'].includes(n)
}

// ═══════════════════════════════════════════════════════════════
// OFF-TOPIC QUESTION DETECTION
// ═══════════════════════════════════════════════════════════════

function isOffTopicQuestion(text) {
    const n = normalizeText(text)
    if (/(est[- ]ce qu[e']|est[- ]ce que vous|avez[- ]vous|vous avez|y a[- ]t[- ]il|il y a[- ]t[- ]il|proposez[- ]vous|vous proposez|faites[- ]vous|vous faites|c[' ]est quoi|qu[' ]est[- ]ce que|pouvez[- ]vous me|puis[- ]je savoir|acceptez[- ]vous)\b/.test(n)) return true
    if (/(wifi|internet|parking|stationnement|horaire|heure d ouverture|ferme|fermeture|climatise|climatisation|air conditionne|tenue|dress.?code|carte bancaire|visa|mastercard|terminal de paiement)\b/.test(n)) return true
    if (/(dispo|disponible|au menu|dans.*menu|sur.*carte|dans.*carte)\b/.test(n)) return true
    if (/(ou etes.vous|ou vous trouvez|comment venir|comment y aller|l adresse|votre adresse|ou se trouve|ou est.ce)\b/.test(n)) return true
    if (/(specialite|ambiance|capacite|nombre de table|terrasse|privatiser|privatisation|seminaire|animaux|enfants bienvenus|accessibilite|cuisine typique)\b/.test(n)) return true
    return false
}

// ═══════════════════════════════════════════════════════════════
// ITEM EXTRACTION
// ═══════════════════════════════════════════════════════════════

const FRENCH_NUMBER_WORDS = {
    'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
    'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
    'onze': 11, 'douze': 12, 'quinze': 15, 'vingt': 20,
}

function extractQuantityFromSegment(text) {
    const n = normalizeText(text)
    if (!n) return null

    const startMatch = n.match(/^(\d{1,3})(?:\s|$)/)
    if (startMatch) { const q = Number(startMatch[1]); if (Number.isFinite(q) && q > 0) return q }

    const endMatch = n.match(/(?:^|\s)(\d{1,3})$/)
    if (endMatch) { const q = Number(endMatch[1]); if (Number.isFinite(q) && q > 0) return q }

    const inlineMatch = n.match(/\b(\d{1,3})\b/)
    if (inlineMatch) { const q = Number(inlineMatch[1]); if (Number.isFinite(q) && q > 0) return q }

    for (const [word, value] of Object.entries(FRENCH_NUMBER_WORDS)) {
        if (new RegExp(`\\b${word}\\b`).test(n)) return value
    }
    return null
}

function scoreProductMatch(searchName, product) {
    const ns = normalizeText(searchName)
    const np = normalizeText(product?.name)
    const nt = normalizeText(`${product?.name || ''} ${product?.description || ''}`)
    if (!ns || !np) return 0
    if (np === ns) return 100
    if (ns.includes(np) || np.includes(ns)) return 60
    const terms = ns.split(/\s+/).filter(t => t.length > 2)
    const nameHits = terms.filter(t => np.includes(t)).length
    const textHits = terms.filter(t => nt.includes(t)).length
    return nameHits * 12 + textHits * 3
}

function findProductByName(products, name) {
    let best = null, bestScore = 0
    for (const p of products) {
        const score = scoreProductMatch(name, p)
        if (score > bestScore) { best = p; bestScore = score }
    }
    return bestScore >= 10 ? best : null
}

function splitSegments(text) {
    return String(text || '')
        .split(/\s*(?:,|\+|;|\bet\b|\bpuis\b)\s*/i)
        .map(s => s.trim())
        .filter(Boolean)
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractQuantityForProductSegment(segment, product) {
    const normalizedSegment = normalizeText(segment)
    const normalizedProduct = normalizeText(product?.name)
    if (!normalizedSegment || !normalizedProduct) return extractQuantityFromSegment(segment) || 1

    const idx = normalizedSegment.indexOf(normalizedProduct)
    if (idx >= 0) {
        const before = normalizedSegment.slice(0, idx).trim()
        const after = normalizedSegment.slice(idx + normalizedProduct.length).trim()

        if (before) {
            const trailingDigits = before.match(/(\d{1,3})\s*$/)
            if (trailingDigits) {
                const value = Number(trailingDigits[1])
                if (Number.isFinite(value) && value > 0) return value
            }

            for (const [word, value] of Object.entries(FRENCH_NUMBER_WORDS)) {
                if (new RegExp(`\\b${escapeRegExp(word)}\\s*$`).test(before)) return value
            }
        }

        if (after) {
            const leadingDigits = after.match(/^(?:x\s*)?(\d{1,3})\b/)
            if (leadingDigits) {
                const value = Number(leadingDigits[1])
                if (Number.isFinite(value) && value > 0) return value
            }

            for (const [word, value] of Object.entries(FRENCH_NUMBER_WORDS)) {
                if (new RegExp(`^(?:x\\s*)?${escapeRegExp(word)}\\b`).test(after)) return value
            }
        }
    }

    return extractQuantityFromSegment(segment) || 1
}

function extractItemsFromText(text, products, currentItems) {
    if (!products || products.length === 0) return { items: cloneCartItems(currentItems), captured: [] }
    const nextItems = cloneCartItems(currentItems)
    const captured = []
    const segments = splitSegments(text)
    const toInspect = segments.length > 0 ? segments : [text]

    for (const seg of toInspect) {
        const product = findProductByName(products, seg)
        if (!product) continue
        const qty = extractQuantityForProductSegment(seg, product)
        const existing = nextItems.find(i => i.product_id === product.id)
        if (existing) {
            existing.quantity += qty
            existing.line_total_fcfa = Number(product.price_fcfa || 0) * existing.quantity
        } else {
            nextItems.push({
                product_id:        product.id,
                product_name:      product.name,
                menu_section_slug: product.menu_section_slug || null,
                quantity:          qty,
                unit_price_fcfa:   Number(product.price_fcfa || 0),
                line_total_fcfa:   Number(product.price_fcfa || 0) * qty,
            })
        }
        captured.push({ type: 'item', value: `${qty}x ${product.name}` })
    }
    return { items: nextItems, captured }
}

// ═══════════════════════════════════════════════════════════════
// DATE / TIME EXTRACTION (langage naturel)
// ═══════════════════════════════════════════════════════════════

const MONTH_NAMES_FR = {
    'janvier': 1, 'fevrier': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
    'juillet': 7, 'aout': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11, 'decembre': 12,
}

const DAY_NAMES_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

function extractDate(text) {
    const raw = String(text || '')
    const n = normalizeText(raw)
    const today = new Date()

    // ISO: YYYY-MM-DD
    const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

    // FR: DD/MM/YYYY ou DD-MM-YYYY
    const fr = raw.match(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/)
    if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`

    // "demain"
    if (/\bdemain\b/.test(n)) {
        const d = new Date(today); d.setDate(d.getDate() + 1)
        return d.toISOString().slice(0, 10)
    }

    // "aujourd'hui" / "ce soir" / "ce midi"
    if (/\baujourd.?hui\b|ce soir\b|ce midi\b/.test(n)) return today.toISOString().slice(0, 10)

    // "après-demain"
    if (/\bapres[- ]?demain\b/.test(n)) {
        const d = new Date(today); d.setDate(d.getDate() + 2)
        return d.toISOString().slice(0, 10)
    }

    // Noms de jours (prochain)
    for (let i = 0; i < DAY_NAMES_FR.length; i++) {
        if (new RegExp(`\\b${DAY_NAMES_FR[i]}\\b`).test(n)) {
            const d = new Date(today)
            let daysAhead = i - d.getDay()
            if (daysAhead <= 0) daysAhead += 7
            d.setDate(d.getDate() + daysAhead)
            return d.toISOString().slice(0, 10)
        }
    }

    // "le 5 avril" / "5 avril"
    for (const [name, month] of Object.entries(MONTH_NAMES_FR)) {
        const m = n.match(new RegExp(`\\b(\\d{1,2})\\s+${name}\\b`))
        if (m) {
            const day = Number(m[1])
            if (day >= 1 && day <= 31) {
                let year = today.getFullYear()
                const tentative = new Date(year, month - 1, day)
                if (tentative < today) year++
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            }
        }
    }

    // DD/MM ou D/M (sans année)
    const short = raw.match(/\b(\d{1,2})[/-](\d{1,2})\b/)
    if (short) {
        const day = Number(short[1]), month = Number(short[2])
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            let year = today.getFullYear()
            const tentative = new Date(year, month - 1, day)
            if (tentative < today) year++
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
    }

    return null
}

function extractTime(text) {
    const raw = String(text || '')
    const n = normalizeText(raw)

    if (/\bmidi\b/.test(n)) return '12:00'
    if (/\bminuit\b/.test(n)) return '00:00'

    // HH:MM ou HHhMM
    const full = raw.match(/\b(\d{1,2})[hH:](\d{2})\b/)
    if (full) {
        const h = Number(full[1]), m = Number(full[2])
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        }
    }

    // "15h" sans minutes
    const hourOnly = raw.match(/\b(\d{1,2})\s*(?:h|heure|heures)\b/i)
    if (hourOnly) {
        const h = Number(hourOnly[1])
        if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:00`
    }

    return null
}

// ═══════════════════════════════════════════════════════════════
// OTHER FIELD EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractPartySize(text) {
    const n = normalizeText(text)
    const patterns = [
        /\b(\d{1,2})\s*(?:personnes?|pers?|adultes?|couverts?)\b/,
        /\bnous serons\s+(\d{1,2})\b/,
        /\bpour\s+(\d{1,2})\s+personnes?\b/,
        /\bpour\s+(\d{1,2})\b/,
    ]
    for (const p of patterns) {
        const m = n.match(p)
        if (m) {
            const s = Number(m[1])
            if (Number.isFinite(s) && s > 0 && s <= 50) return s
        }
    }
    for (const [word, value] of Object.entries(FRENCH_NUMBER_WORDS)) {
        if (new RegExp(`^${word}$`).test(n)) return value
    }
    // Simple digit answer (ex: "4")
    const simple = n.match(/^(\d{1,2})$/)
    if (simple) {
        const s = Number(simple[1])
        if (s > 0 && s <= 50) return s
    }
    return null
}

function extractCustomerPhone(text) {
    const candidates = String(text || '').match(/(?:\+|00)?\d[\d\s().-]{7,}\d/g) || []
    for (const c of candidates) {
        const norm = normalizePhoneNumber(c)
        if (norm) return norm
    }
    return null
}

function extractCustomerName(text, force = false) {
    const raw = String(text || '').trim()
    if (!raw) return null
    const explicit = raw.match(/(?:je m[' ]appelle|mon nom est|moi c[' ]est|c[' ]est)\s+(.+)$/i)
    const source = explicit ? explicit[1] : (force ? raw : null)
    if (!source) return null
    const cleaned = source.replace(/[^\p{L}A-Za-z' -]/gu, ' ').replace(/\s+/g, ' ').trim()
    if (!cleaned) return null
    const words = cleaned.split(' ').filter(Boolean)
    if (words.length < 1 || words.length > 6) return null
    return cleaned
}

function extractDeliveryAddress(text, force = false) {
    const raw = String(text || '').trim()
    if (!raw) return null
    const mapsLink = raw.match(/https?:\/\/(maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl|www\.google\.com\/maps)[^\s]*/i)
    if (mapsLink) return mapsLink[0]
    const n = normalizeText(raw)
    if (!force && !/(adresse|livraison|quartier|avenue|rue|boulevard|commune|immeuble|maison|appartement)/.test(n)) return null
    const cleaned = raw.replace(/\s+/g, ' ').trim()
    return cleaned.length >= 8 ? cleaned : null
}

function captureCustomerFlowFields(state, text, options = {}) {
    const cf = cloneCustomerFlow(state.customer_flow || {})
    const mode = state.fulfillment_mode
    const awaitingType = options.awaitingType || null
    let captured = false

    const needsSchedule = mode === 'dine_in' || mode === 'booking_only' || mode === 'takeaway'

    if (needsSchedule && !cf.scheduled_date) {
        const date = extractDate(text)
        if (date) {
            cf.scheduled_date = date
            captured = true
        }
    }

    if (needsSchedule && !cf.scheduled_time) {
        const time = extractTime(text)
        if (time) {
            cf.scheduled_time = time
            captured = true
        }
    }

    if ((mode === 'dine_in' || mode === 'booking_only') && !cf.party_size) {
        const partySize = extractPartySize(text)
        if (partySize) {
            cf.party_size = partySize
            captured = true
        }
    }

    if (mode === 'delivery' && !cf.delivery_address) {
        const address = extractDeliveryAddress(text, awaitingType === 'delivery_address')
        if (address) {
            cf.delivery_address = address
            captured = true
        }
    }

    if (!cf.customer_phone) {
        const phone = extractCustomerPhone(text)
        if (phone) {
            cf.customer_phone = phone
            captured = true
        }
    }

    if (!cf.customer_name) {
        const name = extractCustomerName(text, awaitingType === 'customer_info')
        if (name) {
            cf.customer_name = name
            captured = true
        }
    }

    if (awaitingType === 'notes' && cf.notes === null && !cf.note_declined) {
        const normalized = normalizeText(text)
        if (['non', 'aucune', 'aucun', 'rien', 'ras'].includes(normalized)) {
            cf.note_declined = true
            cf.notes = null
            captured = true
        } else {
            cf.notes = String(text || '').trim()
            captured = true
        }
    }

    state.customer_flow = cf
    return captured
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE BUILDERS
// ═══════════════════════════════════════════════════════════════

function formatPrice(price_fcfa) {
    if (!price_fcfa) return 'Prix sur demande'
    return `${Number(price_fcfa).toLocaleString('fr-FR')} FCFA`
}

function formatReadableDate(isoDate) {
    if (!isoDate) return isoDate
    try {
        const [year, month, day] = isoDate.split('-')
        const d = new Date(Number(year), Number(month) - 1, Number(day))
        const dayName = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][d.getDay()]
        const monthName = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][d.getMonth()]
        return `${dayName} ${Number(day)} ${monthName}`
    } catch {
        return isoDate
    }
}

function buildSectionMessage(slug, products, cartItems, state) {
    const config = SECTION_CONFIG[slug]
    if (!config) return null
    const sectionProducts = getProductsForSection(products, slug)
    if (sectionProducts.length === 0) return null

    const lines = [`${config.emoji} *${config.label}*`]
    for (const p of sectionProducts) {
        lines.push(`• ${p.name} — ${formatPrice(p.price_fcfa)}`)
    }

    const example = sectionProducts[0]?.name?.toLowerCase() || 'article'
    lines.push(`Choisissez et précisez la quantité (ex : "1 ${example}")`)

    if (slug === 'drinks') {
        const lastFoodSlug = state.section_order[state.section_order.length - 1]
        const lastLabel = (lastFoodSlug && SECTION_CONFIG[lastFoodSlug]?.label.toLowerCase()) || 'desserts'
        lines.push(`ou tapez "valider" pour finaliser · "modifier" pour les ${lastLabel}.`)
    } else {
        const idx = state.current_section_index
        const order = state.section_order
        const isFirst = idx === 0
        const isLast = idx === order.length - 1
        const prevLabel = !isFirst ? SECTION_CONFIG[order[idx - 1]]?.label.toLowerCase() : null
        const nextSlug = !isLast ? order[idx + 1] : null
        const nextLabel = nextSlug ? SECTION_CONFIG[nextSlug]?.label.toLowerCase() : null

        if (isLast) {
            const nextTarget = state.drinks_enabled ? 'les boissons' : 'continuer'
            if (isFirst) {
                lines.push(`ou tapez "suite" pour ${nextTarget}.`)
            } else {
                lines.push(`ou tapez "suite" pour ${nextTarget} · "modifier" pour les ${prevLabel}.`)
            }
        } else {
            if (isFirst) {
                lines.push(`ou tapez "suite" pour les ${nextLabel}.`)
            } else {
                lines.push(`ou tapez "suite" pour les ${nextLabel} · "modifier" pour les ${prevLabel}.`)
            }
        }
    }

    return lines.join('\n')
}

// Message de modification de section (depuis RECAP) — affiche la sélection actuelle + retour
function buildSectionModificationMessage(slug, products, cartItems, state) {
    const config = SECTION_CONFIG[slug]
    const sectionProducts = slug === 'drinks'
        ? getDrinkProducts(products)
        : getProductsForSection(products, slug)
    if (!config || sectionProducts.length === 0) return null

    const lines = [`${config.emoji} *${config.label}*`]

    // Sélection actuelle
    const current = (cartItems || []).filter(i => i.menu_section_slug === slug)
    if (current.length > 0) {
        lines.push(`Sélection actuelle : ${current.map(i => `${i.quantity}× ${i.product_name}`).join(', ')}`)
    }

    for (const p of sectionProducts) {
        lines.push(`· ${p.name} — ${formatPrice(p.price_fcfa)}`)
    }

    lines.push(`Retapez votre sélection complète pour remplacer`)
    lines.push(`ou tapez "retour" pour annuler.`)

    return lines.join('\n')
}

function buildIntermediateRecap(cartItems) {
    const foodItems = cartItems.filter(i => i.menu_section_slug !== 'drinks')
    const lines = ['Votre commande :']
    let subtotal = 0

    for (const slug of SECTION_ORDER_CANONICAL) {
        const items = foodItems.filter(i => i.menu_section_slug === slug)
        const config = SECTION_CONFIG[slug]
        if (!config) continue
        if (items.length > 0) {
            for (const item of items) {
                lines.push(`${config.emoji} ${item.quantity}× ${item.product_name} — ${item.line_total_fcfa.toLocaleString('fr-FR')} FCFA`)
                subtotal += item.line_total_fcfa
            }
        } else {
            lines.push(`${config.emoji} Aucun ${config.singular}`)
        }
    }

    lines.push(`💰 Sous-total : ${subtotal.toLocaleString('fr-FR')} FCFA`)
    return lines.join('\n')
}

function buildItemsCapturedAck(capturedItems = []) {
    if (!Array.isArray(capturedItems) || capturedItems.length === 0) return null
    return `✅ ${capturedItems.map(c => c.value).join(', ')} ajouté${capturedItems.length > 1 ? 's' : ''}`
}

function buildFinalCartRecap(cartItems) {
    const lines = ['Récapitulatif final :']
    let total = 0
    for (const slug of [...SECTION_ORDER_CANONICAL, 'drinks']) {
        const items = cartItems.filter(i => i.menu_section_slug === slug)
        for (const item of items) {
            const emoji = SECTION_CONFIG[slug]?.emoji || '•'
            lines.push(`${emoji} ${item.quantity}× ${item.product_name} — ${item.line_total_fcfa.toLocaleString('fr-FR')} FCFA`)
            total += item.line_total_fcfa
        }
    }
    lines.push(`💰 Total : ${total.toLocaleString('fr-FR')} FCFA`)
    return lines.join('\n')
}

function buildModeQuestion() {
    return [
        '✏️ Tapez "modifier entrées/plats/suppléments/desserts/boissons" pour corriger',
        'ou choisissez le mode :',
        '1️⃣ Sur place',
        '2️⃣ À emporter',
        '3️⃣ Livraison',
    ].join('\n')
}

function buildFinalRecap(state) {
    const cf = state.customer_flow
    const lines = ['Récapitulatif de votre réservation :']

    if (state.cart_items.length > 0) {
        let total = 0
        const itemParts = []
        for (const slug of [...SECTION_ORDER_CANONICAL, 'drinks']) {
            for (const item of state.cart_items.filter(i => i.menu_section_slug === slug)) {
                itemParts.push(`${SECTION_CONFIG[slug]?.emoji || '•'} ${item.quantity}× ${item.product_name}`)
                total += item.line_total_fcfa
            }
        }
        if (itemParts.length > 0) {
            lines.push(itemParts.join(' | '))
            lines.push(`💰 Total : ${total.toLocaleString('fr-FR')} FCFA`)
        }
    }

    if (cf.scheduled_date) {
        const dateStr = formatReadableDate(cf.scheduled_date)
        const timeStr = cf.scheduled_time ? ` à ${cf.scheduled_time}` : ''
        const partyStr = cf.party_size ? ` — ${cf.party_size} personne${cf.party_size > 1 ? 's' : ''}` : ''
        if (state.fulfillment_mode === 'takeaway') {
            lines.push(`🕐 Récupération : ${dateStr}${timeStr}`)
        } else {
            lines.push(`📅 ${dateStr}${timeStr}${partyStr}`)
        }
    } else if (cf.party_size) {
        lines.push(`👥 ${cf.party_size} personne${cf.party_size > 1 ? 's' : ''}`)
    }

    if (cf.delivery_address) lines.push(`🚚 Livraison : ${cf.delivery_address}`)

    if (cf.customer_name || cf.customer_phone) {
        const parts = []
        if (cf.customer_name) parts.push(`👤 ${cf.customer_name}`)
        if (cf.customer_phone) parts.push(`📱 ${cf.customer_phone}`)
        lines.push(parts.join(' | '))
    }

    if (cf.note_declined) {
        lines.push('📝 Notes : Aucune')
    } else if (cf.notes) {
        lines.push(`📝 Notes : ${cf.notes}`)
    }

    lines.push('Confirmez-vous ?')
    return lines.join('\n')
}

function buildCustomerFlowIntro(state) {
    const cf = state.customer_flow || {}
    const lines = ['Bonjour !']

    if (state.fulfillment_mode === 'booking_only') {
        const parts = ['Je vous aide pour votre reservation de table']
        if (cf.scheduled_date) {
            const dateStr = formatReadableDate(cf.scheduled_date)
            const timeStr = cf.scheduled_time ? ` a ${cf.scheduled_time}` : ''
            parts.push(`le ${dateStr}${timeStr}`)
        }
        if (cf.party_size) {
            parts.push(`pour ${cf.party_size} personne${cf.party_size > 1 ? 's' : ''}`)
        }
        lines.push(parts.join(' ') + '.')
        return lines.join('\n')
    }

    if (state.fulfillment_mode === 'dine_in') {
        const parts = ['Je vous aide pour votre reservation au restaurant']
        if (cf.scheduled_date) {
            const dateStr = formatReadableDate(cf.scheduled_date)
            const timeStr = cf.scheduled_time ? ` a ${cf.scheduled_time}` : ''
            parts.push(`le ${dateStr}${timeStr}`)
        }
        if (cf.party_size) {
            parts.push(`pour ${cf.party_size} personne${cf.party_size > 1 ? 's' : ''}`)
        }
        if (Array.isArray(state.cart_items) && state.cart_items.length > 0) {
            parts.push('avec votre precommande')
        }
        lines.push(parts.join(' ') + '.')
        return lines.join('\n')
    }

    if (state.fulfillment_mode === 'takeaway') {
        lines.push('Je vous aide pour votre commande a emporter.')
        return lines.join('\n')
    }

    if (state.fulfillment_mode === 'delivery') {
        lines.push('Je vous aide pour votre commande en livraison.')
        return lines.join('\n')
    }

    return lines.join('\n')
}

function buildCustomerFlowPromptReply(state, awaitingField, options = {}) {
    if (!awaitingField?.prompt) return null

    const parts = []
    if (options.includeGreeting) {
        parts.push(buildCustomerFlowIntro(state))
    } else if (awaitingField.type === 'customer_info' && awaitingField.label === 'numero de telephone' && state.customer_flow?.customer_name) {
        parts.push(`Parfait ${state.customer_flow.customer_name}.`)
    }

    parts.push(awaitingField.prompt)
    return parts.filter(Boolean).join('\n\n')
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMER FLOW — CHAMP EN ATTENTE
// ═══════════════════════════════════════════════════════════════

function buildAwaitingCfField(state) {
    const cf = state.customer_flow
    const mode = state.fulfillment_mode

    if ((mode === 'dine_in' || mode === 'booking_only' || mode === 'takeaway') && (!cf.scheduled_date || !cf.scheduled_time)) {
        const bothMissing = !cf.scheduled_date && !cf.scheduled_time
        const onlyDateMissing = !cf.scheduled_date && cf.scheduled_time
        const onlyTimeMissing = cf.scheduled_date && !cf.scheduled_time

        return {
            type: 'date_time',
            label: bothMissing ? 'date et heure' : onlyDateMissing ? 'date' : 'heure',
            prompt: mode === 'takeaway'
                ? bothMissing
                    ? 'Pour quelle date et heure de récupération ? 🕐'
                    : onlyDateMissing
                        ? 'Pour quelle date de récupération ? 📅'
                        : 'À quelle heure souhaitez-vous récupérer votre commande ? (format conseillé : HH:MM) ⏰'
                : bothMissing
                    ? 'Pour quelle date et à quelle heure ? 📅⏰'
                    : onlyDateMissing
                        ? 'Pour quelle date ? 📅'
                        : 'À quelle heure souhaitez-vous venir ? (format conseillé : HH:MM) ⏰',
        }
    }

    if ((mode === 'dine_in' || mode === 'booking_only') && !cf.party_size) {
        return { type: 'party_size', label: 'nombre de personnes', prompt: 'Pour combien de personnes ? 👥' }
    }

    if (mode === 'delivery' && !cf.delivery_address) {
        return { type: 'delivery_address', label: 'adresse de livraison', prompt: 'Quelle est votre adresse de livraison ? 📍' }
    }

    if ((mode === 'dine_in' || mode === 'booking_only') && cf.notes === null && !cf.note_declined) {
        return { type: 'notes', label: 'demandes particulières', prompt: 'Avez-vous des demandes particulières ? (tapez "non" si aucune)' }
    }

    if (!cf.customer_name || !cf.customer_phone) {
        if (!cf.customer_name) {
            return { type: 'customer_info', label: 'nom complet', prompt: 'Quel est votre nom complet, s\'il vous plaît ? 👤' }
        }
        return { type: 'customer_info', label: 'numero de telephone', prompt: 'Quel est votre numéro de téléphone avec l\'indicatif, s\'il vous plaît ? 📱' }
    }

    return null
}

// ═══════════════════════════════════════════════════════════════
// ADVANCE SECTION HELPER
// ═══════════════════════════════════════════════════════════════

function advanceSectionOrDrinks(state, products, ackMessage) {
    const nextIndex = state.current_section_index + 1

    if (nextIndex < state.section_order.length) {
        state.current_section_index = nextIndex
        const nextSlug = state.section_order[nextIndex]
        const sectionMsg = buildSectionMessage(nextSlug, products, state.cart_items, state)
        const reply = ackMessage ? `${ackMessage}\n\n${sectionMsg}` : sectionMsg
        state.last_prompt_kind = RESTAURANT_STAGE.SECTION
        return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: reply }
    }

    if (state.drinks_enabled) {
        state.stage = RESTAURANT_STAGE.DRINKS
        const foodRecap = buildIntermediateRecap(state.cart_items)
        const drinksMsg = buildSectionMessage('drinks', products, state.cart_items, state)
        const parts = []
        if (ackMessage) parts.push(ackMessage)
        parts.push(foodRecap)
        if (drinksMsg) parts.push(drinksMsg)
        state.last_prompt_kind = RESTAURANT_STAGE.DRINKS
        return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: parts.join('\n\n') }
    }

    // Pas de boissons → directement au choix du mode
    state.stage = RESTAURANT_STAGE.MODE
    const cartRecap = buildFinalCartRecap(state.cart_items)
    const modeMsg = buildModeQuestion()
    const parts = []
    if (ackMessage) parts.push(ackMessage)
    if (state.cart_items.length > 0) parts.push(cartRecap)
    parts.push(modeMsg)
    state.last_prompt_kind = RESTAURANT_STAGE.MODE
    return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: parts.join('\n\n') }
}

// ═══════════════════════════════════════════════════════════════
// MAIN UPDATE FUNCTION
// ═══════════════════════════════════════════════════════════════

function updateRestaurantStateFromUserMessage(previousState, text, restaurantProducts = []) {
    const state = cloneRestaurantState(previousState)
    const normalized = normalizeText(text)
    if (!normalized) return { state, stateChanged: false, shouldBypassAI: false, questionDetected: false, directReply: null }

    // Initialiser section_order et drinks_enabled si vide
    if (state.section_order.length === 0 && restaurantProducts.length > 0) {
        state.section_order = buildSectionOrder(restaurantProducts)
        state.drinks_enabled = getDrinkProducts(restaurantProducts).length > 0
    }

    const questionDetected = isOffTopicQuestion(text)
    const noOp = { state, stateChanged: false, shouldBypassAI: false, questionDetected, directReply: null }

    if (
        [RESTAURANT_STAGE.DEPOSIT, RESTAURANT_STAGE.READY].includes(state.stage)
        && isFreshRestaurantRestartRequest(text, restaurantProducts)
    ) {
        const restartedState = cloneRestaurantState({})
        restartedState.section_order = state.section_order.length > 0
            ? [...state.section_order]
            : buildSectionOrder(restaurantProducts)
        restartedState.drinks_enabled = state.drinks_enabled === true
            || getDrinkProducts(restaurantProducts).length > 0
        return updateRestaurantStateFromUserMessage(restartedState, text, restaurantProducts)
    }

    // ──────────────────────────────────────────────
    // STAGE: MENU_HOME
    // ──────────────────────────────────────────────
    if (state.stage === RESTAURANT_STAGE.MENU_HOME) {
        if (questionDetected) return noOp

        const choice = detectMenuChoice(text)
        const reservationIntent = /reserver|reservation|\bune table\b/.test(normalized)

        if (choice === 1) {
            // Notre Carte → première section
            if (state.section_order.length === 0) {
                // Pas de sections food → boissons
                state.stage = RESTAURANT_STAGE.DRINKS
                const drinksMsg = buildSectionMessage('drinks', restaurantProducts, state.cart_items, state)
                state.last_prompt_kind = RESTAURANT_STAGE.DRINKS
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: drinksMsg }
            }
            state.stage = RESTAURANT_STAGE.SECTION
            state.current_section_index = 0
            const sectionMsg = buildSectionMessage(state.section_order[0], restaurantProducts, state.cart_items, state)
            state.last_prompt_kind = RESTAURANT_STAGE.SECTION
            return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: sectionMsg }
        }

        if (choice === 2) {
            state.stage = RESTAURANT_STAGE.DRINKS
            const drinksMsg = buildSectionMessage('drinks', restaurantProducts, state.cart_items, state)
            state.last_prompt_kind = RESTAURANT_STAGE.DRINKS
            return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: drinksMsg }
        }

        if (choice === 3) {
            state.fulfillment_mode = 'booking_only'
            state.stage = RESTAURANT_STAGE.CUSTOMER_FLOW
            captureCustomerFlowFields(state, text)
            state.awaiting_cf_field = buildAwaitingCfField(state)
            if (!state.awaiting_cf_field) {
                state.stage = RESTAURANT_STAGE.RECAP
                state.last_prompt_kind = RESTAURANT_STAGE.RECAP
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: buildFinalRecap(state) }
            }
            state.last_prompt_kind = RESTAURANT_STAGE.CUSTOMER_FLOW
            return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: buildCustomerFlowPromptReply(state, state.awaiting_cf_field, { includeGreeting: true }) }
        }

        // Commande directe (sans passer par le menu)
        const allProducts = restaurantProducts
        const itemResult = extractItemsFromText(text, allProducts, state.cart_items)
        const inlineMode = detectFulfillmentMode(text)

        if (reservationIntent && itemResult.captured.length > 0) {
            state.cart_items = itemResult.items
            state.fulfillment_mode = 'dine_in'
            state.stage = RESTAURANT_STAGE.CUSTOMER_FLOW
            captureCustomerFlowFields(state, text)
            state.awaiting_cf_field = buildAwaitingCfField(state)

            if (!state.awaiting_cf_field) {
                state.stage = RESTAURANT_STAGE.RECAP
                state.last_prompt_kind = RESTAURANT_STAGE.RECAP
                const parts = [buildItemsCapturedAck(itemResult.captured), buildFinalRecap(state)].filter(Boolean)
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: parts.join('\n\n') }
            }

            state.last_prompt_kind = RESTAURANT_STAGE.CUSTOMER_FLOW
            const parts = [
                buildItemsCapturedAck(itemResult.captured),
                buildCustomerFlowPromptReply(state, state.awaiting_cf_field, { includeGreeting: true })
            ].filter(Boolean)
            return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: parts.join('\n\n') }
        }

        if (itemResult.captured.length > 0) {
            state.cart_items = itemResult.items

            if (inlineMode && inlineMode !== 'booking_only') {
                state.fulfillment_mode = inlineMode
                state.stage = RESTAURANT_STAGE.CUSTOMER_FLOW
                captureCustomerFlowFields(state, text)
                state.awaiting_cf_field = buildAwaitingCfField(state)

                if (!state.awaiting_cf_field) {
                    state.stage = RESTAURANT_STAGE.RECAP
                    state.last_prompt_kind = RESTAURANT_STAGE.RECAP
                    const parts = [buildItemsCapturedAck(itemResult.captured), buildFinalRecap(state)].filter(Boolean)
                    return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: parts.join('\n\n') }
                }

                state.last_prompt_kind = RESTAURANT_STAGE.CUSTOMER_FLOW
                const parts = [
                    buildItemsCapturedAck(itemResult.captured),
                    buildCustomerFlowPromptReply(state, state.awaiting_cf_field, { includeGreeting: true })
                ].filter(Boolean)
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: parts.join('\n\n') }
            }

            state.stage = RESTAURANT_STAGE.MODE
            const ack = buildItemsCapturedAck(itemResult.captured)
            const cartRecap = buildFinalCartRecap(state.cart_items)
            const modeMsg = buildModeQuestion()
            state.last_prompt_kind = RESTAURANT_STAGE.MODE
            return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: `${ack}\n\n${cartRecap}\n\n${modeMsg}` }
        }

        // Réservation directe par texte
        if (/reserver|reservation|\bune table\b/.test(normalized)) {
            state.fulfillment_mode = 'booking_only'
            state.stage = RESTAURANT_STAGE.CUSTOMER_FLOW
            captureCustomerFlowFields(state, text)
            state.awaiting_cf_field = buildAwaitingCfField(state)
            if (!state.awaiting_cf_field) {
                state.stage = RESTAURANT_STAGE.RECAP
                state.last_prompt_kind = RESTAURANT_STAGE.RECAP
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: buildFinalRecap(state) }
            }
            state.last_prompt_kind = RESTAURANT_STAGE.CUSTOMER_FLOW
            return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: buildCustomerFlowPromptReply(state, state.awaiting_cf_field, { includeGreeting: true }) }
        }

        // Laisser l'IA afficher le menu principal (premier message, bonjour, etc.)
        return noOp
    }

    // ──────────────────────────────────────────────
    // STAGE: SECTION
    // ──────────────────────────────────────────────
    if (state.stage === RESTAURANT_STAGE.SECTION) {
        if (questionDetected) return noOp

        const currentSlug = state.section_order[state.current_section_index]

        // Mode modification depuis RECAP
        if (state.modification_origin === 'RECAP') {
            // "retour" → annuler la modification, revenir au récap
            if (detectRetourCommand(text)) {
                state.modification_origin = null
                state.stage = RESTAURANT_STAGE.RECAP
                state.last_prompt_kind = RESTAURANT_STAGE.RECAP
                const recap = buildFinalRecap(state)
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: recap }
            }

            // Capture items → remplacer la section + retour au récap
            const sectionProds = restaurantProducts.filter(p => p.menu_section_slug === currentSlug)
            const freshResult = extractItemsFromText(text, sectionProds, [])
            if (freshResult.captured.length > 0) {
                state.cart_items = [
                    ...state.cart_items.filter(i => i.menu_section_slug !== currentSlug),
                    ...freshResult.items,
                ]
                state.modification_origin = null
                state.stage = RESTAURANT_STAGE.RECAP
                state.last_prompt_kind = RESTAURANT_STAGE.RECAP
                const ack = `✅ ${freshResult.captured.map(c => c.value).join(', ')} sélectionné${freshResult.captured.length > 1 ? 's' : ''}`
                const recap = buildFinalRecap(state)
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: `${ack}\n\n${recap}` }
            }

            return noOp
        }

        // Navigation normale — commande de modification d'une section précédente
        const modifyTarget = detectModifierSection(text)
        if (modifyTarget && modifyTarget !== 'generic') {
            const targetIdx = state.section_order.indexOf(modifyTarget)
            if (targetIdx >= 0) {
                state.current_section_index = targetIdx
                state.cart_items = state.cart_items.filter(i => i.menu_section_slug !== modifyTarget)
                const sectionMsg = buildSectionMessage(modifyTarget, restaurantProducts, state.cart_items, state)
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: `🔄 Modification ${SECTION_CONFIG[modifyTarget]?.label.toLowerCase()}\n\n${sectionMsg}` }
            }
        }

        // Capture items (tous les produits food)
        const foodProducts = restaurantProducts.filter(p => p.menu_section_slug !== 'drinks')
        const itemResult = extractItemsFromText(text, foodProducts, state.cart_items)

        if (itemResult.captured.length > 0) {
            state.cart_items = itemResult.items
            const ack = `✅ ${itemResult.captured.map(c => c.value).join(', ')} ajouté${itemResult.captured.length > 1 ? 's' : ''}`
            return advanceSectionOrDrinks(state, restaurantProducts, ack)
        }

        // "suite" sans item
        if (detectSuiteCommand(text)) {
            return advanceSectionOrDrinks(state, restaurantProducts, null)
        }

        return noOp
    }

    // ──────────────────────────────────────────────
    // STAGE: DRINKS
    // ──────────────────────────────────────────────
    if (state.stage === RESTAURANT_STAGE.DRINKS) {
        if (questionDetected) return noOp

        // Mode modification depuis RECAP
        if (state.modification_origin === 'RECAP') {
            // "retour" → annuler la modification, revenir au récap
            if (detectRetourCommand(text)) {
                state.modification_origin = null
                state.stage = RESTAURANT_STAGE.RECAP
                state.last_prompt_kind = RESTAURANT_STAGE.RECAP
                const recap = buildFinalRecap(state)
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: recap }
            }

            // Capture boissons → remplacer + retour au récap
            const drinkProds = getDrinkProducts(restaurantProducts)
            const freshResult = extractItemsFromText(text, drinkProds, [])
            if (freshResult.captured.length > 0) {
                state.cart_items = [
                    ...state.cart_items.filter(i => i.menu_section_slug !== 'drinks'),
                    ...freshResult.items,
                ]
                state.modification_origin = null
                state.stage = RESTAURANT_STAGE.RECAP
                state.last_prompt_kind = RESTAURANT_STAGE.RECAP
                const ack = `✅ ${freshResult.captured.map(c => c.value).join(', ')} sélectionné${freshResult.captured.length > 1 ? 's' : ''}`
                const recap = buildFinalRecap(state)
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: `${ack}\n\n${recap}` }
            }

            return noOp
        }

        // Navigation normale — retour vers une section food
        const modifyTarget = detectModifierSection(text)
        if (modifyTarget && modifyTarget !== 'drinks' && modifyTarget !== 'generic') {
            const targetIdx = state.section_order.indexOf(modifyTarget)
            if (targetIdx >= 0) {
                state.stage = RESTAURANT_STAGE.SECTION
                state.current_section_index = targetIdx
                state.cart_items = state.cart_items.filter(i => i.menu_section_slug !== modifyTarget)
                const sectionMsg = buildSectionMessage(modifyTarget, restaurantProducts, state.cart_items, state)
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: `🔄 Modification ${SECTION_CONFIG[modifyTarget]?.label.toLowerCase()}\n\n${sectionMsg}` }
            }
        }

        // Capture boissons
        const drinkProducts = getDrinkProducts(restaurantProducts)
        const drinkResult = extractItemsFromText(text, drinkProducts, state.cart_items)

        if (drinkResult.captured.length > 0) {
            state.cart_items = drinkResult.items
            const ack = `✅ ${drinkResult.captured.map(c => c.value).join(', ')} ajouté${drinkResult.captured.length > 1 ? 's' : ''}`
            state.stage = RESTAURANT_STAGE.MODE
            const cartRecap = buildFinalCartRecap(state.cart_items)
            const modeMsg = buildModeQuestion()
            state.last_prompt_kind = RESTAURANT_STAGE.MODE
            return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: `${ack}\n\n${cartRecap}\n\n${modeMsg}` }
        }

        // "valider" / "suite" → mode sans boissons
        if (detectValiderCommand(text) || detectSuiteCommand(text)) {
            state.stage = RESTAURANT_STAGE.MODE
            const cartRecap = state.cart_items.length > 0 ? buildFinalCartRecap(state.cart_items) : null
            const modeMsg = buildModeQuestion()
            state.last_prompt_kind = RESTAURANT_STAGE.MODE
            const parts = cartRecap ? `${cartRecap}\n\n${modeMsg}` : modeMsg
            return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: parts }
        }

        return noOp
    }

    // ──────────────────────────────────────────────
    // STAGE: MODE
    // ──────────────────────────────────────────────
    if (state.stage === RESTAURANT_STAGE.MODE) {
        if (questionDetected) return noOp

        // Modification section depuis le mode
        const modifyTarget = detectModifierSection(text)
        if (modifyTarget && modifyTarget !== 'generic') {
            if (modifyTarget === 'drinks' && state.drinks_enabled) {
                state.stage = RESTAURANT_STAGE.DRINKS
                state.cart_items = state.cart_items.filter(i => i.menu_section_slug !== 'drinks')
                const drinksMsg = buildSectionMessage('drinks', restaurantProducts, state.cart_items, state)
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: `🔄 Modification boissons\n\n${drinksMsg}` }
            }
            const targetIdx = state.section_order.indexOf(modifyTarget)
            if (targetIdx >= 0) {
                state.stage = RESTAURANT_STAGE.SECTION
                state.current_section_index = targetIdx
                state.cart_items = state.cart_items.filter(i => i.menu_section_slug !== modifyTarget)
                const sectionMsg = buildSectionMessage(modifyTarget, restaurantProducts, state.cart_items, state)
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: `🔄 Modification ${SECTION_CONFIG[modifyTarget]?.label.toLowerCase()}\n\n${sectionMsg}` }
            }
        }

        const mode = detectFulfillmentMode(text)
        if (mode && mode !== 'booking_only') {
            state.fulfillment_mode = mode
            state.stage = RESTAURANT_STAGE.CUSTOMER_FLOW
            captureCustomerFlowFields(state, text)
            state.awaiting_cf_field = buildAwaitingCfField(state)
            if (!state.awaiting_cf_field) {
                state.stage = RESTAURANT_STAGE.RECAP
                state.last_prompt_kind = RESTAURANT_STAGE.RECAP
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: buildFinalRecap(state) }
            }
            state.last_prompt_kind = RESTAURANT_STAGE.CUSTOMER_FLOW
            return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: state.awaiting_cf_field.prompt }
        }

        return noOp
    }

    // ──────────────────────────────────────────────
    // STAGE: CUSTOMER_FLOW
    // ──────────────────────────────────────────────
    if (state.stage === RESTAURANT_STAGE.CUSTOMER_FLOW) {
        if (questionDetected) return noOp

        const awaitingType = state.awaiting_cf_field?.type
        const captured = captureCustomerFlowFields(state, text, { awaitingType })
        state.awaiting_cf_field = buildAwaitingCfField(state)

        if (!captured) {
            // Rien capturé → AI reformule la question
            return noOp
        }

        if (state.awaiting_cf_field) {
            // Encore des champs → prochain champ
            state.last_prompt_kind = RESTAURANT_STAGE.CUSTOMER_FLOW
            return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: buildCustomerFlowPromptReply(state, state.awaiting_cf_field) }
        }

        // Tous les champs collectés → RECAP
        state.stage = RESTAURANT_STAGE.RECAP
        state.last_prompt_kind = RESTAURANT_STAGE.RECAP
        const recap = buildFinalRecap(state)
        return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: recap }
    }

    // ──────────────────────────────────────────────
    // STAGE: RECAP
    // ──────────────────────────────────────────────
    if (state.stage === RESTAURANT_STAGE.RECAP) {
        if (questionDetected) return noOp

        if (isPositiveReply(normalized)) {
            state.stage = RESTAURANT_STAGE.READY
            state.last_prompt_kind = RESTAURANT_STAGE.READY
            return { state, stateChanged: true, shouldBypassAI: false, questionDetected: false, directReply: null }
        }

        // Modification section depuis le récap (affiche sélection actuelle + retour)
        const modifyTarget = detectModifierSection(text)
        if (modifyTarget && modifyTarget !== 'generic') {
            if (modifyTarget === 'drinks' && state.drinks_enabled) {
                state.stage = RESTAURANT_STAGE.DRINKS
                state.modification_origin = 'RECAP'
                // Items conservés : buildSectionModificationMessage les affiche
                const drinksMsg = buildSectionModificationMessage('drinks', restaurantProducts, state.cart_items, state)
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: drinksMsg }
            }
            const targetIdx = state.section_order.indexOf(modifyTarget)
            if (targetIdx >= 0) {
                state.stage = RESTAURANT_STAGE.SECTION
                state.current_section_index = targetIdx
                state.modification_origin = 'RECAP'
                // Items conservés : buildSectionModificationMessage les affiche
                const sectionMsg = buildSectionModificationMessage(modifyTarget, restaurantProducts, state.cart_items, state)
                return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: sectionMsg }
            }
        }

        if (isNegativeReply(normalized)) {
            // "non" générique → retour au mode
            state.stage = RESTAURANT_STAGE.MODE
            state.last_prompt_kind = RESTAURANT_STAGE.MODE
            const cartRecap = buildFinalCartRecap(state.cart_items)
            const modeMsg = buildModeQuestion()
            return { state, stateChanged: true, shouldBypassAI: true, questionDetected: false, directReply: `D'accord. Que souhaitez-vous modifier ?\n\n${cartRecap}\n\n${modeMsg}` }
        }

        return noOp
    }

    // ──────────────────────────────────────────────
    // STAGE: DEPOSIT (en attente de paiement d'acompte)
    // ──────────────────────────────────────────────
    if (state.stage === RESTAURANT_STAGE.DEPOSIT) {
        // Questions hors-parcours → IA répond + réancre sur le statut acompte
        if (questionDetected) return noOp

        // Client dit avoir payé → IA gère (ne peut pas confirmer sans webhook)
        if (/(j ai paye|paiement effectue|c est fait|j ai transfere|j ai envoye|j ai regle|transaction|recu de paiement)/.test(normalized)) {
            return noOp
        }

        // Toute autre réponse → ne pas relancer le flow
        return noOp
    }

    // Fallback (READY ou autre)
    return { state, stateChanged: false, shouldBypassAI: false, questionDetected, directReply: null }
}

// ═══════════════════════════════════════════════════════════════
// INFÉRENCE DEPUIS MESSAGE ASSISTANT
// ═══════════════════════════════════════════════════════════════

function inferRestaurantStateFromAssistantMessage(content, previousState = {}) {
    const state = cloneRestaurantState(previousState)
    const n = normalizeText(content)
    if (!n) return state

    // Acompte requis → passer en DEPOSIT (attente paiement)
    if (/acompte|lien de paiement|pour confirmer.*versez|sera confirmee des reception|paiement.*requis|deposez/.test(n)) {
        state.stage = RESTAURANT_STAGE.DEPOSIT
        return state
    }

    // Confirmation sans acompte → réinitialiser l'état
    if (/(reservation|commande).*(confirmee|confirmee|enregistree|validee)/.test(n) && !/acompte/.test(n)) {
        return cloneRestaurantState({})
    }
    if (/reservation restaurant enregistree|commande restaurant enregistree|reservation de table enregistree|checkout confirme/.test(n)) {
        return cloneRestaurantState({})
    }

    return state
}

// ═══════════════════════════════════════════════════════════════
// GUIDANCE POUR L'IA
// ═══════════════════════════════════════════════════════════════

function buildRestaurantStateGuidance(restaurantState = {}, options = {}) {
    const state = cloneRestaurantState(restaurantState)
    if (!hasRestaurantStateData(state)) return ''

    const lines = ['RESTAURANT STATE (source système, prioritaire) :']
    lines.push(`- Stage : ${state.stage}`)

    if (state.cart_items.length > 0) {
        lines.push(`- Panier : ${state.cart_items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')}`)
        const total = state.cart_items.reduce((s, i) => s + i.line_total_fcfa, 0)
        lines.push(`- Total panier : ${total.toLocaleString('fr-FR')} FCFA`)
    }

    const cf = state.customer_flow
    if (state.fulfillment_mode) lines.push(`- Mode : ${state.fulfillment_mode}`)
    if (cf.scheduled_date) lines.push(`- Date : ${cf.scheduled_date}${cf.scheduled_time ? ' à ' + cf.scheduled_time : ''}`)
    if (cf.party_size)     lines.push(`- Personnes : ${cf.party_size}`)
    if (cf.delivery_address) lines.push(`- Adresse livraison : ${cf.delivery_address}`)
    if (cf.customer_name)  lines.push(`- Nom : ${cf.customer_name}`)
    if (cf.customer_phone) lines.push(`- Téléphone : ${cf.customer_phone}`)
    if (cf.note_declined)  lines.push('- Notes : aucune (déclinées)')
    else if (cf.notes)     lines.push(`- Notes : ${cf.notes}`)

    if (state.awaiting_cf_field?.label) {
        lines.push(`- Champ en attente : ${state.awaiting_cf_field.label}`)
    }

    if (state.stage === RESTAURANT_STAGE.READY) {
        lines.push('- Le client vient de confirmer.')
        lines.push('- Appelle create_restaurant_checkout maintenant avec les données ci-dessus.')
        lines.push('- Ne pose pas de question avant l\'appel.')
    } else if (state.stage === RESTAURANT_STAGE.DEPOSIT) {
        lines.push('- STATUT : En attente de paiement d\'acompte.')
        lines.push('- Ne relance PAS le parcours de commande.')
        lines.push('- Ne recrée PAS de checkout.')
        lines.push('- Si le client dit avoir payé → réponds : "Parfait ! Votre réservation sera confirmée automatiquement dès réception du paiement."')
        lines.push('- Si le client pose une autre question → réponds-y, puis rappelle l\'attente d\'acompte.')
    } else {
        lines.push('- Ne redemande jamais les infos déjà collectées.')
    }

    if (options.questionDetected) {
        const contactRef = options.escalationPhone ? `au *${options.escalationPhone}*` : 'directement au restaurant'
        lines.push('---')
        lines.push('⚠️ QUESTION HORS-PARCOURS DÉTECTÉE :')
        lines.push('  1. Si la réponse est dans la base de connaissance → réponds précisément.')
        lines.push(`  2. Si l\'info est absente → dis : "Je n\'ai pas cette information. Contactez-nous ${contactRef}."`)
        lines.push('  3. Dans tous les cas, rappelle naturellement où on en était.')
        if (state.awaiting_cf_field?.label) {
            lines.push(`     Ex : "Pour votre commande, il me reste à confirmer : ${state.awaiting_cf_field.label}."`)
        }
        lines.push('  NE PAS inventer. NE PAS sauter au champ manquant sans répondre.')
    }

    return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════
// MERGE TOOL ARGS
// ═══════════════════════════════════════════════════════════════

function mergeRestaurantStateIntoToolArgs(functionName, args = {}, restaurantState = {}) {
    if (functionName !== 'create_restaurant_checkout') return args
    const state = cloneRestaurantState(restaurantState)
    if (!hasRestaurantStateData(state)) return args

    const cf = state.customer_flow
    const mergedItems = Array.isArray(args.items) && args.items.length > 0
        ? args.items
        : state.cart_items.map(item => ({ product_name: item.product_name, quantity: item.quantity }))

    return {
        ...args,
        fulfillment_mode:  state.fulfillment_mode || args.fulfillment_mode,
        items:             state.cart_items.length > 0 ? state.cart_items.map(item => ({ product_name: item.product_name, quantity: item.quantity })) : mergedItems,
        customer_name:     cf.customer_name    || args.customer_name,
        customer_phone:    cf.customer_phone   || args.customer_phone,
        scheduled_date:    cf.scheduled_date   || args.scheduled_date,
        scheduled_time:    cf.scheduled_time   || args.scheduled_time,
        party_size:        cf.party_size       || args.party_size,
        delivery_address:  cf.delivery_address || args.delivery_address,
        payment_method:    args.payment_method    || cf.payment_method,
        notes:             args.notes !== undefined ? args.notes : cf.notes,
    }
}

module.exports = {
    RESTAURANT_STAGE,
    buildRestaurantStateGuidance,
    clearRestaurantState,
    getRestaurantState,
    hasRestaurantStateData,
    inferRestaurantStateFromAssistantMessage,
    mergeRestaurantStateIntoToolArgs,
    setRestaurantState,
    updateRestaurantStateFromUserMessage,
}
