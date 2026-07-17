'use strict'

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

module.exports = {
    RESTAURANT_STAGE,
    SECTION_ORDER_CANONICAL,
    normalizeText,
    cloneCartItems,
    cloneCustomerFlow,
    cloneRestaurantState,
    getRestaurantState,
    setRestaurantState,
    clearRestaurantState,
    hasRestaurantStateData,
}
