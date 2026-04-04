import { queueOutboundWhatsAppMessage } from '@/lib/whatsapp/outbound'

interface LicenseKey {
    key: string
    used: boolean
    order_id: string | null
}

/**
 * Delivers digital products for a given order.
 * Called after payment is confirmed.
 *
 * Delivery is now queued through outbound_messages so the production bot stack
 * sends it consistently, even if the session reconnects a few seconds later.
 */
export async function deliverDigitalProducts(orderId: string, supabase: any): Promise<void> {
    try {
        const { data: order } = await supabase
            .from('orders')
            .select('id, agent_id, customer_phone')
            .eq('id', orderId)
            .single()

        if (!order?.customer_phone || !order?.agent_id) return

        const phone = order.customer_phone.replace(/^\+/, '')

        const { data: items } = await supabase
            .from('order_items')
            .select('product_name')
            .eq('order_id', orderId)

        if (!items || items.length === 0) return

        const { data: allProducts } = await supabase
            .from('products')
            .select('id, name, product_type, digital_content, license_keys')
            .eq('agent_id', order.agent_id)

        const products = (allProducts || []).filter((product: any) =>
            product.product_type === 'digital' ||
            product.digital_content ||
            (Array.isArray(product.license_keys) && product.license_keys.length > 0)
        )

        if (!products.length) return

        for (const item of items) {
            const baseName = item.product_name.replace(/\s*\(.*\)\s*$/, '').trim()

            const product = products.find((candidate: any) => {
                const productName = String(candidate.name || '').toLowerCase()
                const itemName = baseName.toLowerCase()
                return productName === itemName || itemName.includes(productName) || productName.includes(itemName)
            })

            if (!product) continue

            let deliveryContent: string | null = null

            if (product.license_keys && Array.isArray(product.license_keys) && product.license_keys.length > 0) {
                const keys = product.license_keys as LicenseKey[]
                const unusedIndex = keys.findIndex((key) => !key.used)

                if (unusedIndex >= 0) {
                    deliveryContent = keys[unusedIndex].key
                    keys[unusedIndex].used = true
                    keys[unusedIndex].order_id = orderId

                    await supabase
                        .from('products')
                        .update({ license_keys: keys })
                        .eq('id', product.id)
                } else {
                    console.warn(`[Digital Delivery] No unused keys left for product: ${product.name}`)
                    deliveryContent = "Votre commande a ete recue mais le stock de cles est epuise. Veuillez contacter le support pour recevoir votre cle."
                }
            } else if (product.digital_content) {
                deliveryContent = product.digital_content
            }

            if (!deliveryContent) continue

            const message = `🎉 *Votre produit numerique est disponible !*\n\n*${product.name}* :\n${deliveryContent}\n\nMerci pour votre achat ! 🙏`

            try {
                const result = await queueOutboundWhatsAppMessage(supabase, {
                    agentId: order.agent_id,
                    to: phone,
                    message,
                })

                if (result.queued) {
                    console.log(`[Digital Delivery] Queued for ${order.customer_phone} - product: ${product.name}`)
                    await supabase
                        .from('orders')
                        .update({ status: 'completed' })
                        .eq('id', order.id)
                }
            } catch (sendErr) {
                console.error('[Digital Delivery] Failed to queue WhatsApp delivery:', sendErr)
            }
        }
    } catch (err) {
        console.error('[Digital Delivery] Error:', err)
    }
}
