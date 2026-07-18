const RESTAURANT_SECTION_ORDER = ['starters', 'mains', 'extras', 'desserts', 'drinks']

function sortRestaurantProducts(products = []) {
    const sectionIndex = new Map(RESTAURANT_SECTION_ORDER.map((slug, index) => [slug, index]))
    return [...products].sort((a, b) => {
        const aSection = sectionIndex.has(a.menu_section_slug) ? sectionIndex.get(a.menu_section_slug) : Number.MAX_SAFE_INTEGER
        const bSection = sectionIndex.has(b.menu_section_slug) ? sectionIndex.get(b.menu_section_slug) : Number.MAX_SAFE_INTEGER
        if (aSection !== bSection) return aSection - bSection

        const aSort = Number.isFinite(Number(a.menu_sort_order)) ? Number(a.menu_sort_order) : Number.MAX_SAFE_INTEGER
        const bSort = Number.isFinite(Number(b.menu_sort_order)) ? Number(b.menu_sort_order) : Number.MAX_SAFE_INTEGER
        if (aSort !== bSort) return aSort - bSort

        return String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' })
    })
}

function hasCartStateData(cartState = {}) {
    return Boolean(
        cartState?.draft_item ||
        (Array.isArray(cartState?.cart_items) && cartState.cart_items.length > 0)
    )
}

function hasCheckoutStateData(checkoutState = {}) {
    return checkoutState?.stage && checkoutState.stage !== 'idle' ||
        (Array.isArray(checkoutState?.pending_fields) && checkoutState.pending_fields.length > 0) ||
        Boolean(checkoutState?.awaiting_field) ||
        checkoutState?.note_declined === true ||
        checkoutState?.customer_recap_confirmed === true ||
        Object.values(checkoutState?.collected || {}).some(value => value !== null && value !== '')
}

function formatDirectToolResponse(parsedResult) {
    const parts = []

    if (parsedResult.items) parts.push(parsedResult.items)
    if (parsedResult.message) parts.push(parsedResult.message)
    if (parts.length === 0 && parsedResult.error) parts.push(parsedResult.error)

    return parts.filter(Boolean).join('\n\n')
}

function buildRecentCustomerProfile(orders = []) {
    const profile = {
        customer_name: null,
        customer_phone: null,
        email: null,
        delivery_address: null,
        payment_method: null,
    }

    for (const order of orders || []) {
        if (!profile.customer_name && order?.customer_name) profile.customer_name = order.customer_name
        if (!profile.customer_phone && order?.customer_phone) profile.customer_phone = order.customer_phone
        if (!profile.email && order?.customer_email) profile.email = order.customer_email
        if (!profile.delivery_address && order?.delivery_address) profile.delivery_address = order.delivery_address
        if (!profile.payment_method && order?.payment_method) profile.payment_method = order.payment_method
    }

    return Object.values(profile).some(Boolean) ? profile : null
}

function resetTransactionalCycleMetadata(metadata = {}) {
    return {
        ...(metadata || {}),
        cart: null,
        checkout: null,
        booking: null,
        restaurant: null,
        external_context: null,
        session_anchor_at: new Date().toISOString(),
        last_cycle_closed_at: null,
        last_cycle_reason: null,
    }
}

module.exports = {
    sortRestaurantProducts,
    hasCartStateData,
    hasCheckoutStateData,
    formatDirectToolResponse,
    buildRecentCustomerProfile,
    resetTransactionalCycleMetadata,
}
