export type SupportedPlatformProvider =
    | 'shopify'
    | 'woocommerce'
    | 'chariow'
    | 'maketou'
    | 'generic'

export type NormalizedCustomer = {
    name?: string
    phone?: string
    email?: string
}

export type NormalizedOrder = {
    id?: string
    reference?: string
    total?: number
    status?: string
    tracking_url?: string
}

export type NormalizedCartItem = {
    name: string
    variant?: string
    qty?: number
    price?: number
}

export type NormalizedCart = {
    id?: string
    items?: NormalizedCartItem[]
    total?: number
    currency?: string
}

export type NormalizedWebhookEvent = {
    provider: SupportedPlatformProvider
    providerEvent: string
    triggerEvent: string
    customer: NormalizedCustomer
    order?: NormalizedOrder
    cart?: NormalizedCart
    data?: Record<string, string | number | boolean>
    idempotencyHint?: string
    mediaUrl?: string
    mediaType?: 'document' | 'image'
}

function asObject(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    return value as Record<string, unknown>
}

function asString(value: unknown): string | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (typeof value !== 'string') return undefined
    const next = value.trim()
    return next.length > 0 ? next : undefined
}

function asNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return undefined
}

function toPrimitiveData(payload: Record<string, unknown>): Record<string, string | number | boolean> {
    const out: Record<string, string | number | boolean> = {}
    for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            out[key] = value
        }
    }
    return out
}

function normalizeShopify(topic: string, payload: Record<string, unknown>): NormalizedWebhookEvent {
    const customer = asObject(payload.customer)
    const billingAddress = asObject(payload.billing_address)
    const shippingAddress = asObject(payload.shipping_address)
    const lineItems = Array.isArray(payload.line_items) ? payload.line_items : []

    const phone =
        asString(customer.phone)
        || asString(payload.phone)
        || asString(billingAddress.phone)
        || asString(shippingAddress.phone)

    const customerName =
        asString(customer.first_name) && asString(customer.last_name)
            ? `${asString(customer.first_name)} ${asString(customer.last_name)}`
            : asString(customer.first_name)
                || asString(shippingAddress.name)
                || asString(billingAddress.name)

    const items: NormalizedCartItem[] = lineItems
        .map((itemRaw) => {
            const item = asObject(itemRaw)
            const name = asString(item.name)
            if (!name) return null
            return {
                name,
                variant: asString(item.variant_title),
                qty: asNumber(item.quantity),
                price: asNumber(item.price),
            } as NormalizedCartItem
        })
        .filter((item): item is NormalizedCartItem => item !== null)

    let triggerEvent = 'custom'
    if (topic === 'orders/create') triggerEvent = 'order_created'
    else if (topic === 'orders/paid') triggerEvent = 'order_created'
    else if (topic === 'orders/fulfilled') triggerEvent = 'order_shipped'
    else if (topic === 'orders/updated') triggerEvent = 'order_created'
    else if (topic === 'checkouts/update' || topic === 'carts/update') triggerEvent = 'cart_abandoned'

    return {
        provider: 'shopify',
        providerEvent: topic,
        triggerEvent,
        customer: {
            name: customerName,
            phone,
            email: asString(customer.email) || asString(payload.email),
        },
        order: {
            id: asString(payload.id),
            reference: asString(payload.name) || asString(payload.order_number),
            total: asNumber(payload.total_price),
            status: asString(payload.financial_status) || asString(payload.fulfillment_status),
            tracking_url: asString(payload.order_status_url),
        },
        cart: {
            id: asString(payload.cart_token) || asString(payload.token),
            items,
            total: asNumber(payload.total_price),
            currency: asString(payload.currency),
        },
        data: toPrimitiveData(payload),
        idempotencyHint: asString(payload.id) || asString(payload.admin_graphql_api_id),
    }
}

function normalizeWooCommerce(topic: string, payload: Record<string, unknown>): NormalizedWebhookEvent {
    const billing = asObject(payload.billing)
    const shipping = asObject(payload.shipping)
    const lineItems = Array.isArray(payload.line_items) ? payload.line_items : []

    const phone = asString(billing.phone) || asString(shipping.phone)
    const name =
        asString(billing.first_name) && asString(billing.last_name)
            ? `${asString(billing.first_name)} ${asString(billing.last_name)}`
            : asString(billing.first_name)
                || asString(shipping.first_name)

    const items: NormalizedCartItem[] = lineItems
        .map((itemRaw) => {
            const item = asObject(itemRaw)
            const name = asString(item.name)
            if (!name) return null
            return {
                name,
                variant: asString(item.variation) || asString(item.sku),
                qty: asNumber(item.quantity),
                price: asNumber(item.price) || asNumber(item.total),
            } as NormalizedCartItem
        })
        .filter((item): item is NormalizedCartItem => item !== null)

    let triggerEvent = 'custom'
    if (topic === 'order.created' || topic === 'order.updated') triggerEvent = 'order_created'
    else if (topic === 'order.deleted') triggerEvent = 'custom'
    else if (topic === 'order.failed' || topic === 'order.pending') triggerEvent = 'payment_failed'

    return {
        provider: 'woocommerce',
        providerEvent: topic,
        triggerEvent,
        customer: {
            name,
            phone,
            email: asString(billing.email),
        },
        order: {
            id: asString(payload.id),
            reference: asString(payload.number),
            total: asNumber(payload.total),
            status: asString(payload.status),
        },
        cart: {
            id: asString(payload.cart_hash),
            items,
            total: asNumber(payload.total),
            currency: asString(payload.currency),
        },
        data: toPrimitiveData(payload),
        idempotencyHint: asString(payload.id),
    }
}

function normalizeChariow(topic: string, payload: Record<string, unknown>): NormalizedWebhookEvent {
    // Chariow Pulse real payload structure (confirmed via debug):
    // {
    //   event: "successful.sale",
    //   customer: { name, first_name, last_name, email, phone: "2250554585927", country },
    //   product: { id, name, url, price: { value, currency } },
    //   sale: { id, amount: { value, currency }, status, custom_fields: [{name, value}] }
    // }

    // LOG TEMPORAIRE — à retirer après debug abandoned/failed payload
    const rawEvent = (topic || asString(payload.event) || '').toLowerCase().trim()
    if (['abandoned.sale', 'sale.abandoned', 'failed.sale', 'sale.failed', 'failed.payment'].includes(rawEvent)) {
        console.log('[CHARIOW DEBUG] raw payload:', JSON.stringify(payload, null, 2))
    }

    const customer = asObject(payload.customer)
    const product = asObject(payload.product)
    const sale = asObject(payload.sale)
    const saleAmount = asObject(sale.amount)
    const productPrice = asObject(product.price)

    const phone =
        asString(customer.phone)
        || asString(payload.phone)

    const customerName =
        asString(customer.name)
        || [asString(customer.first_name), asString(customer.last_name)].filter(Boolean).join(' ')
        || asString(payload.customer_name)

    const email =
        asString(customer.email)
        || asString(payload.email)

    const productName = asString(product.name)

    // Chariow has no direct download URL in payload — customer accesses via portal
    const downloadUrl = undefined

    // Look for license_key in sale.custom_fields
    const customFields = Array.isArray(sale.custom_fields) ? sale.custom_fields as Array<Record<string, unknown>> : []
    const licenseField = customFields.find(f => asString(f.name)?.toLowerCase().includes('license') || asString(f.name)?.toLowerCase().includes('licence'))
    const licenseKey = licenseField ? asString(licenseField.value) : undefined

    // Event mapping — exact Chariow event names (confirmed via debug)
    const rawEvent = (topic || asString(payload.event) || '').toLowerCase().trim()
    let triggerEvent = 'custom'
    if (['successful.sale', 'sale.success'].includes(rawEvent)) {
        triggerEvent = 'payment_confirmed'
    } else if (['abandoned.sale', 'sale.abandoned'].includes(rawEvent)) {
        triggerEvent = 'cart_abandoned'
    } else if (['failed.sale', 'sale.failed', 'failed.payment'].includes(rawEvent)) {
        triggerEvent = 'payment_failed'
    } else if (rawEvent === 'license.activated') {
        triggerEvent = 'license_activated'
    } else if (rawEvent === 'license.expired') {
        triggerEvent = 'license_expired'
    } else if (rawEvent === 'license.issued') {
        triggerEvent = 'license_issued'
    } else if (rawEvent === 'license.revoked') {
        triggerEvent = 'license_revoked'
    } else if (rawEvent === 'affiliate.joined') {
        triggerEvent = 'affiliate_joined'
    }

    const extraData: Record<string, string | number | boolean> = {}
    if (licenseKey) extraData.license_key = licenseKey
    if (productName) extraData.product_name = productName
    extraData.portal_url = 'https://portal.chariow.com'

    const saleId = asString(sale.id) || asString(payload.id)
    const amount = asNumber(saleAmount.value) || asNumber(productPrice.value)
    const currency = asString(saleAmount.currency) || asString(productPrice.currency)

    return {
        provider: 'chariow',
        providerEvent: topic,
        triggerEvent,
        customer: { name: customerName, phone, email },
        order: {
            id: saleId,
            reference: saleId,
            total: amount,
            status: triggerEvent === 'payment_confirmed' ? 'paid' : 'failed',
        },
        cart: {
            total: amount,
            currency: currency ?? 'XOF',
        },
        data: { ...toPrimitiveData(payload), ...extraData },
        idempotencyHint: saleId,
    }
}

function normalizeMaketou(topic: string, payload: Record<string, unknown>): NormalizedWebhookEvent {
    const customer = asObject(payload.customer)
    const order = asObject(payload.order)
    const cart = asObject(payload.cart)
    const eventKey = topic.replace('.', '_')

    let triggerEvent = 'custom'
    if (eventKey === 'order_created' || eventKey === 'order_paid') triggerEvent = 'order_created'
    else if (eventKey === 'payment_failed') triggerEvent = 'payment_failed'
    else if (eventKey === 'cart_abandoned') triggerEvent = 'cart_abandoned'

    return {
        provider: 'maketou',
        providerEvent: topic,
        triggerEvent,
        customer: {
            name: asString(customer.name) || asString(payload.customer_name),
            phone:
                asString(customer.phone)
                || asString(customer.telephone)
                || asString(payload.phone)
                || asString(payload.telephone),
            email: asString(customer.email),
        },
        order: {
            id: asString(order.id) || asString(payload.order_id),
            reference: asString(order.reference) || asString(payload.reference),
            total: asNumber(order.total) || asNumber(payload.total),
            status: asString(order.status) || asString(payload.status),
        },
        cart: {
            id: asString(cart.id) || asString(payload.cart_id),
            total: asNumber(cart.total) || asNumber(payload.total),
            currency: asString(cart.currency) || asString(payload.currency),
        },
        data: toPrimitiveData(payload),
        idempotencyHint: asString(order.id) || asString(payload.id),
    }
}

function normalizeGeneric(topic: string, payload: Record<string, unknown>): NormalizedWebhookEvent {
    const customer = asObject(payload.customer)
    const order = asObject(payload.order)
    const cart = asObject(payload.cart)

    return {
        provider: 'generic',
        providerEvent: topic,
        triggerEvent: asString(payload.event) || asString(payload.trigger_event) || 'custom',
        customer: {
            name: asString(customer.name) || asString(payload.customer_name),
            phone: asString(customer.phone) || asString(payload.phone),
            email: asString(customer.email) || asString(payload.email),
        },
        order: {
            id: asString(order.id),
            reference: asString(order.reference),
            total: asNumber(order.total),
            status: asString(order.status),
            tracking_url: asString(order.tracking_url),
        },
        cart: {
            id: asString(cart.id),
            total: asNumber(cart.total),
            currency: asString(cart.currency),
        },
        data: toPrimitiveData(payload),
        idempotencyHint: asString(payload.id) || asString(order.id),
    }
}

export function normalizeProvider(value: string | null | undefined): SupportedPlatformProvider {
    const next = String(value ?? '').trim().toLowerCase()
    if (next === 'shopify') return 'shopify'
    if (next === 'woocommerce' || next === 'woo') return 'woocommerce'
    if (next === 'chariow') return 'chariow'
    if (next === 'maketou') return 'maketou'
    return 'generic'
}

export function detectProviderFromRequest(
    headers: Headers,
    body: Record<string, unknown>
): { provider: SupportedPlatformProvider; providerEvent: string } {
    const shopifyTopic = headers.get('x-shopify-topic')
    if (shopifyTopic) {
        return { provider: 'shopify', providerEvent: shopifyTopic.trim().toLowerCase() }
    }

    const wooTopic = headers.get('x-wc-webhook-topic')
    if (wooTopic) {
        return { provider: 'woocommerce', providerEvent: wooTopic.trim().toLowerCase() }
    }

    const explicitProvider = normalizeProvider(
        asString(body.provider) || asString(body.platform) || asString(body.source)
    )
    const explicitEvent =
        asString(body.provider_event)
        || asString(body.event)
        || asString(headers.get('x-event-name'))
        || asString(headers.get('x-chariow-event'))
        || 'custom'

    return { provider: explicitProvider, providerEvent: explicitEvent.trim().toLowerCase() }
}

export function normalizeWebhookEvent(
    provider: SupportedPlatformProvider,
    providerEvent: string,
    payload: Record<string, unknown>
): NormalizedWebhookEvent {
    if (provider === 'shopify') return normalizeShopify(providerEvent, payload)
    if (provider === 'woocommerce') return normalizeWooCommerce(providerEvent, payload)
    if (provider === 'chariow') return normalizeChariow(providerEvent, payload)
    if (provider === 'maketou') return normalizeMaketou(providerEvent, payload)
    return normalizeGeneric(providerEvent, payload)
}

export function detectProviderEventForFixedProvider(
    provider: SupportedPlatformProvider,
    headers: Headers,
    body: Record<string, unknown>
): string {
    if (provider === 'shopify') {
        return asString(headers.get('x-shopify-topic'))?.toLowerCase()
            || asString(body.provider_event)?.toLowerCase()
            || asString(body.event)?.toLowerCase()
            || 'custom'
    }

    if (provider === 'woocommerce') {
        return asString(headers.get('x-wc-webhook-topic'))?.toLowerCase()
            || asString(body.provider_event)?.toLowerCase()
            || asString(body.event)?.toLowerCase()
            || 'custom'
    }

    return asString(body.provider_event)?.toLowerCase()
        || asString(body.event)?.toLowerCase()
        || asString(headers.get('x-event-name'))?.toLowerCase()
        || 'custom'
}
