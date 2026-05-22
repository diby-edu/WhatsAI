export type PlatformSyncProvider = 'woocommerce' | 'shopify' | 'chariow'

export interface WooCredentials {
    store_url: string
    consumer_key: string
    consumer_secret: string
}

export interface ShopifyCredentials {
    shop_domain: string
    admin_api_token: string
    api_version: string
}

export interface ChariowCredentials {
    api_key: string
}

export type PlatformSyncCredentials = WooCredentials | ShopifyCredentials | ChariowCredentials

export interface SyncProductRecord {
    external_id: string
    data: Record<string, unknown>
}

export interface TestProviderResult {
    ok: boolean
    statusCode: number
    summary: string
}

export interface FetchProductsResult {
    products: SyncProductRecord[]
    fetched: number
    hasMore: boolean
}

function asString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const next = value.trim()
    return next.length > 0 ? next : null
}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function stripHtml(value: string | null | undefined): string {
    const input = String(value || '')
    return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeBaseUrl(value: string): string | null {
    const raw = value.trim()
    if (!raw) return null
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    try {
        const parsed = new URL(withProtocol)
        return parsed.origin.replace(/\/+$/, '')
    } catch {
        return null
    }
}

function normalizeShopDomain(value: string): string | null {
    const raw = value.trim().toLowerCase()
    if (!raw) return null

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    try {
        const parsed = new URL(withProtocol)
        const domain = parsed.hostname.trim().toLowerCase()
        if (!domain || !domain.includes('.')) return null
        return domain
    } catch {
        return null
    }
}

function normalizeApiVersion(value: string | null | undefined): string {
    const next = String(value || '').trim()
    return next || '2024-10'
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
    } finally {
        clearTimeout(timer)
    }
}

function parseNextLink(linkHeader: string | null): string | null {
    if (!linkHeader) return null
    const match = linkHeader
        .split(',')
        .map(chunk => chunk.trim())
        .find(chunk => /rel="next"/i.test(chunk))
    if (!match) return null
    const urlMatch = match.match(/<([^>]+)>/)
    return urlMatch ? urlMatch[1] : null
}

export function validatePlatformSyncCredentials(
    provider: PlatformSyncProvider,
    input: unknown
): { ok: true; credentials: PlatformSyncCredentials; hint: Record<string, unknown> } | { ok: false; error: string } {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return { ok: false, error: 'credentials must be an object' }
    }
    const body = input as Record<string, unknown>

    if (provider === 'woocommerce') {
        const storeUrl = normalizeBaseUrl(asString(body.store_url) || '')
        const consumerKey = asString(body.consumer_key)
        const consumerSecret = asString(body.consumer_secret)
        if (!storeUrl || !consumerKey || !consumerSecret) {
            return { ok: false, error: 'WooCommerce credentials require store_url, consumer_key and consumer_secret' }
        }

        return {
            ok: true,
            credentials: {
                store_url: storeUrl,
                consumer_key: consumerKey,
                consumer_secret: consumerSecret,
            },
            hint: {
                store_url_origin: storeUrl,
            },
        }
    }

    if (provider === 'chariow') {
        const apiKey = asString(body.api_key)
        if (!apiKey) {
            return { ok: false, error: 'Chariow credentials require api_key' }
        }
        return {
            ok: true,
            credentials: { api_key: apiKey } as ChariowCredentials,
            hint: { api_key_preview: `${apiKey.slice(0, 8)}...` },
        }
    }

    const shopDomain = normalizeShopDomain(asString(body.shop_domain) || '')
    const token = asString(body.admin_api_token)
    const apiVersion = normalizeApiVersion(asString(body.api_version))
    if (!shopDomain || !token) {
        return { ok: false, error: 'Shopify credentials require shop_domain and admin_api_token' }
    }

    return {
        ok: true,
        credentials: {
            shop_domain: shopDomain,
            admin_api_token: token,
            api_version: apiVersion,
        },
        hint: {
            shop_domain: shopDomain,
            api_version: apiVersion,
        },
    }
}

export async function testProviderConnection(
    provider: PlatformSyncProvider,
    credentials: PlatformSyncCredentials
): Promise<TestProviderResult> {
    if (provider === 'woocommerce') {
        const woo = credentials as WooCredentials
        const endpoint = new URL('/wp-json/wc/v3/products', woo.store_url)
        endpoint.searchParams.set('per_page', '1')
        endpoint.searchParams.set('consumer_key', woo.consumer_key)
        endpoint.searchParams.set('consumer_secret', woo.consumer_secret)

        const res = await fetchWithTimeout(endpoint.toString(), {
            headers: { Accept: 'application/json' },
            method: 'GET',
        }, 12000)

        if (!res.ok) {
            const text = await res.text()
            return {
                ok: false,
                statusCode: res.status,
                summary: `WooCommerce auth failed (${res.status}): ${text.slice(0, 220)}`,
            }
        }

        return { ok: true, statusCode: 200, summary: 'WooCommerce credentials are valid' }
    }

    if (provider === 'chariow') {
        const chariow = credentials as ChariowCredentials
        const res = await fetchWithTimeout('https://api.chariow.com/v1/products?limit=1', {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${chariow.api_key}`,
            },
        }, 12000)

        if (!res.ok) {
            const text = await res.text()
            return {
                ok: false,
                statusCode: res.status,
                summary: `Chariow auth failed (${res.status}): ${text.slice(0, 220)}`,
            }
        }

        return { ok: true, statusCode: 200, summary: 'Chariow credentials are valid' }
    }

    const shop = credentials as ShopifyCredentials
    const url = `https://${shop.shop_domain}/admin/api/${shop.api_version}/shop.json`
    const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'X-Shopify-Access-Token': shop.admin_api_token,
        },
    }, 12000)

    if (!res.ok) {
        const text = await res.text()
        return {
            ok: false,
            statusCode: res.status,
            summary: `Shopify auth failed (${res.status}): ${text.slice(0, 220)}`,
        }
    }

    const payload = await res.json().catch(() => ({}))
    const shopName = asString(payload?.shop?.name) || shop.shop_domain
    return { ok: true, statusCode: 200, summary: `Shopify credentials are valid (${shopName})` }
}

function mapWooProduct(item: any): SyncProductRecord {
    const firstImage = Array.isArray(item?.images) ? item.images.find((img: any) => asString(img?.src)) : null
    const categories = Array.isArray(item?.categories)
        ? item.categories.map((cat: any) => asString(cat?.name)).filter(Boolean)
        : []

    const price = toNumber(item?.price ?? item?.regular_price ?? item?.sale_price)
    const stock = toNumber(item?.stock_quantity)
    const stockStatus = asString(item?.stock_status) || (stock != null ? (stock > 0 ? 'in_stock' : 'out_of_stock') : null)

    return {
        external_id: String(item?.id),
        data: {
            name: asString(item?.name),
            description: stripHtml(item?.description || item?.short_description || ''),
            price,
            stock,
            availability: stockStatus,
            sku: asString(item?.sku),
            url: asString(item?.permalink),
            image_url: asString(firstImage?.src),
            categories,
            provider: 'woocommerce',
            raw_status: asString(item?.status),
            updated_at: asString(item?.date_modified_gmt) || asString(item?.date_modified),
        },
    }
}

function mapChariowProduct(item: any): SyncProductRecord {
    // TODO: remove after inspecting raw Chariow API response
    console.log('[CHARIOW_RAW]', JSON.stringify(item, null, 2))

    // Chariow API: price is nested under item.pricing.current_price
    const pricing = item?.pricing || {}
    const currentPrice = pricing.current_price || pricing.price || {}
    const price = toNumber(currentPrice.value)
    const currency = asString(currentPrice.currency) || 'XOF'

    // Sale price if applicable
    const salePrice = pricing.sale_price ? toNumber(pricing.sale_price?.value) : null
    const priceOff = asString(pricing.price_off)

    const categories = item?.category?.value
        ? [asString(item.category.label) || asString(item.category.value)].filter(Boolean) as string[]
        : []

    const pictures = item?.pictures || {}
    const imageUrl = asString(pictures.cover) || asString(pictures.thumbnail)

    // Collect all available images
    const allImages: string[] = []
    if (pictures.cover) allImages.push(asString(pictures.cover)!)
    if (pictures.thumbnail && pictures.thumbnail !== pictures.cover) allImages.push(asString(pictures.thumbnail)!)
    if (Array.isArray(pictures.gallery)) {
        for (const img of pictures.gallery) {
            const src = asString(img?.url || img)
            if (src && !allImages.includes(src)) allImages.push(src)
        }
    }

    const slug = asString(item?.slug)
    const url = slug ? `https://chariow.com/products/${slug}` : null

    // Variants (options)
    const rawOptions = Array.isArray(item?.options) ? item.options : []
    const variants = rawOptions.length > 0
        ? rawOptions.map((opt: any) => ({ name: asString(opt?.name || opt?.label || opt), value: asString(opt?.value) })).filter((v: any) => v.name)
        : null

    // Stock
    const stock = item?.stock_quantity != null ? toNumber(item.stock_quantity)
        : item?.stock != null ? toNumber(item.stock)
        : null

    return {
        external_id: String(item?.id),
        data: {
            name: asString(item?.name),
            description: stripHtml(item?.description || ''),
            price: salePrice ?? price,
            original_price: salePrice ? price : null,
            price_off: priceOff,
            currency,
            availability: stock != null ? (stock > 0 ? 'in_stock' : 'out_of_stock') : 'in_stock',
            url,
            image_url: imageUrl,
            images: allImages.length > 0 ? allImages : null,
            categories,
            category: categories[0] || null,
            type: asString(item?.type),
            sku: asString(item?.reference) || asString(item?.sku) || null,
            brand: asString(item?.brand) || null,
            stock,
            weight: item?.weight != null ? toNumber(item.weight) : null,
            tags: Array.isArray(item?.tags) ? item.tags.map((t: any) => asString(t)).filter(Boolean) : null,
            variants,
            provider: 'chariow',
            raw_status: asString(item?.status),
            updated_at: asString(item?.updated_at),
        },
    }
}

function mapShopifyProduct(item: any): SyncProductRecord {
    const variants = Array.isArray(item?.variants) ? item.variants : []
    const firstVariant = variants[0] || null
    const firstImage = Array.isArray(item?.images) ? item.images.find((img: any) => asString(img?.src)) : null
    const productType = asString(item?.product_type)

    const price = toNumber(firstVariant?.price)
    const stock = toNumber(firstVariant?.inventory_quantity)
    const stockStatus = stock == null
        ? (asString(item?.status) || null)
        : (stock > 0 ? 'in_stock' : 'out_of_stock')

    const tags = asString(item?.tags)
        ?.split(',')
        .map(tag => tag.trim())
        .filter(Boolean) || []

    return {
        external_id: String(item?.id),
        data: {
            name: asString(item?.title),
            description: stripHtml(item?.body_html || ''),
            price,
            stock,
            availability: stockStatus,
            sku: asString(firstVariant?.sku),
            url: null,
            image_url: asString(firstImage?.src),
            categories: productType ? [productType] : [],
            tags,
            provider: 'shopify',
            raw_status: asString(item?.status),
            updated_at: asString(item?.updated_at),
        },
    }
}

export async function fetchProviderProducts(
    provider: PlatformSyncProvider,
    credentials: PlatformSyncCredentials,
    maxItems: number
): Promise<FetchProductsResult> {
    const cap = Math.min(Math.max(maxItems || 200, 1), 500)

    if (provider === 'woocommerce') {
        const woo = credentials as WooCredentials
        const perPage = 50
        let page = 1
        const products: SyncProductRecord[] = []
        let hasMore = false

        while (products.length < cap) {
            const endpoint = new URL('/wp-json/wc/v3/products', woo.store_url)
            endpoint.searchParams.set('per_page', String(perPage))
            endpoint.searchParams.set('page', String(page))
            endpoint.searchParams.set('status', 'publish')
            endpoint.searchParams.set('consumer_key', woo.consumer_key)
            endpoint.searchParams.set('consumer_secret', woo.consumer_secret)

            const res = await fetchWithTimeout(endpoint.toString(), {
                method: 'GET',
                headers: { Accept: 'application/json' },
            }, 20000)

            if (!res.ok) {
                const text = await res.text()
                throw new Error(`WooCommerce product sync failed (${res.status}): ${text.slice(0, 240)}`)
            }

            const batch = await res.json().catch(() => [])
            if (!Array.isArray(batch) || batch.length === 0) {
                break
            }

            for (const item of batch) {
                if (products.length >= cap) {
                    hasMore = true
                    break
                }
                if (item?.id == null) continue
                products.push(mapWooProduct(item))
            }

            if (batch.length < perPage) {
                break
            }
            page += 1
        }

        return { products, fetched: products.length, hasMore }
    }

    if (provider === 'chariow') {
        const chariow = credentials as ChariowCredentials
        const perPage = 50
        let page = 1
        const products: SyncProductRecord[] = []
        let hasMore = false

        while (products.length < cap) {
            const url = `https://api.chariow.com/v1/products?limit=${perPage}&page=${page}&status=published`
            const res = await fetchWithTimeout(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${chariow.api_key}`,
                },
            }, 20000)

            if (!res.ok) {
                const text = await res.text()
                throw new Error(`Chariow product sync failed (${res.status}): ${text.slice(0, 240)}`)
            }

            const payload = await res.json().catch(() => ({}))
            const batch = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : [])

            if (!Array.isArray(batch) || batch.length === 0) break

            for (const item of batch) {
                if (products.length >= cap) {
                    hasMore = true
                    break
                }
                if (item?.id == null) continue
                const status = asString(item?.status)
                if (status && status !== 'published') continue
                products.push(mapChariowProduct(item))
            }

            if (batch.length < perPage) break
            if (products.length >= cap) {
                hasMore = true
                break
            }
            page += 1
        }

        return { products, fetched: products.length, hasMore }
    }

    const shop = credentials as ShopifyCredentials
    let nextUrl: string | null = `https://${shop.shop_domain}/admin/api/${shop.api_version}/products.json?limit=100`
    const products: SyncProductRecord[] = []
    let hasMore = false

    while (nextUrl && products.length < cap) {
        const res = await fetchWithTimeout(nextUrl, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'X-Shopify-Access-Token': shop.admin_api_token,
            },
        }, 20000)

        if (!res.ok) {
            const text = await res.text()
            throw new Error(`Shopify product sync failed (${res.status}): ${text.slice(0, 240)}`)
        }

        const payload = await res.json().catch(() => ({}))
        const batch = Array.isArray(payload?.products) ? payload.products : []
        for (const item of batch) {
            if (products.length >= cap) {
                hasMore = true
                break
            }
            if (item?.id == null) continue
            products.push(mapShopifyProduct(item))
        }

        if (products.length >= cap) {
            hasMore = true
            break
        }

        nextUrl = parseNextLink(res.headers.get('link'))
        if (!nextUrl) break
    }

    return { products, fetched: products.length, hasMore }
}
