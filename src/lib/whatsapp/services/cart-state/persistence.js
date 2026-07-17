const CART_STAGE = {
    IDLE: 'idle',
    COLLECTING_ITEM: 'collecting_item',
    CART_RECAP: 'cart_recap',
    CHECKOUT: 'checkout',
}

function cloneItem(item = null) {
    if (!item) return null

    return {
        product_id: item.product_id || null,
        product_name: item.product_name || null,
        quantity: item.quantity === null || item.quantity === undefined || item.quantity === ''
            ? null
            : (Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : null),
        selected_variants: { ...(item.selected_variants || {}) },
        selected_variants_by_id: { ...(item.selected_variants_by_id || {}) },
        skipped_optional_variant_ids: Array.isArray(item.skipped_optional_variant_ids)
            ? [...item.skipped_optional_variant_ids]
            : [],
    }
}

function cloneCartLine(line = null) {
    if (!line) return null

    const clonedItem = cloneItem(line)
    return {
        ...clonedItem,
        line_id: line.line_id || null,
        unit_price: Number.isFinite(Number(line.unit_price)) ? Number(line.unit_price) : null,
        line_total: Number.isFinite(Number(line.line_total)) ? Number(line.line_total) : null,
    }
}

function cloneAwaitingField(field = null) {
    if (!field) return null
    return { ...field }
}

function migrateLegacyCartItems(cart = {}) {
    if (Array.isArray(cart.cart_items) && cart.cart_items.length > 0) {
        return cart.cart_items.map(cloneCartLine).filter(Boolean)
    }

    if (!cart.current_item) return []

    if (![CART_STAGE.CART_RECAP, CART_STAGE.CHECKOUT].includes(cart.stage)) {
        return []
    }

    const migratedItem = cloneItem(cart.current_item)
    if (!migratedItem?.product_id || !migratedItem?.quantity) {
        return []
    }

    return [{
        ...migratedItem,
        line_id: 'legacy-line',
        unit_price: null,
        line_total: null,
    }]
}

function cloneCartState(cart = {}) {
    const draftItem = cloneItem(cart.draft_item || cart.current_item)

    return {
        stage: cart.stage || CART_STAGE.IDLE,
        draft_item: draftItem,
        cart_items: migrateLegacyCartItems(cart),
        awaiting_field: cloneAwaitingField(cart.awaiting_field),
        last_prompt_kind: cart.last_prompt_kind || null,
        last_prompt_text: cart.last_prompt_text || null,
        updated_at: cart.updated_at || null,
    }
}

function getCartState(metadata = {}) {
    return cloneCartState(metadata.cart || {})
}

function setCartState(metadata = {}, cartState) {
    return {
        ...(metadata || {}),
        cart: {
            ...cloneCartState(cartState),
            updated_at: new Date().toISOString(),
        }
    }
}

function clearCartState(metadata = {}) {
    return {
        ...(metadata || {}),
        cart: null
    }
}

module.exports = {
    CART_STAGE,
    cloneItem,
    cloneCartLine,
    cloneAwaitingField,
    migrateLegacyCartItems,
    cloneCartState,
    getCartState,
    setCartState,
    clearCartState,
}
