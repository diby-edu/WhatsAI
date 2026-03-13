/**
 * Digital Product Auto-Delivery
 *
 * After payment confirmation, automatically delivers digital products to the customer via WhatsApp.
 * Supports two modes:
 * - Cas 1 (fixed_content): Same URL/text sent to all buyers
 * - Option A (license_keys): Unique key per order, drawn from a pre-loaded pool
 */

interface LicenseKey {
    key: string
    used: boolean
    order_id: string | null
}

/**
 * Delivers digital products for a given order.
 * Called after payment is confirmed (CinetPay webhook or manual Mobile Money validation).
 * Non-blocking — errors are caught and logged.
 */
export async function deliverDigitalProducts(orderId: string, supabase: any): Promise<void> {
    try {
        // Get order info
        const { data: order } = await supabase
            .from('orders')
            .select('id, agent_id, customer_phone')
            .eq('id', orderId)
            .single()

        if (!order?.customer_phone || !order?.agent_id) return

        // Get order items
        const { data: items } = await supabase
            .from('order_items')
            .select('product_name')
            .eq('order_id', orderId)

        if (!items || items.length === 0) return

        // Get all digital products for this agent
        const { data: products } = await supabase
            .from('products')
            .select('id, name, product_type, digital_content, license_keys')
            .eq('agent_id', order.agent_id)
            .eq('product_type', 'digital')

        if (!products || products.length === 0) return

        const { sendWhatsAppMessage } = await import('@/lib/whatsapp/baileys')

        for (const item of items) {
            // Strip variant info from item name: "T-Shirt (Rouge)" → "T-Shirt"
            const baseName = item.product_name.replace(/\s*\(.*\)\s*$/, '').trim()

            // Match product by name (fuzzy)
            const product = products.find((p: any) => {
                const pName = p.name.toLowerCase()
                const iName = baseName.toLowerCase()
                return pName === iName || iName.includes(pName) || pName.includes(iName)
            })

            if (!product) continue

            let deliveryContent: string | null = null

            if (product.license_keys && Array.isArray(product.license_keys) && product.license_keys.length > 0) {
                // Option A: License key pool — pick first unused key
                const keys = product.license_keys as LicenseKey[]
                const unusedIndex = keys.findIndex(k => !k.used)

                if (unusedIndex >= 0) {
                    deliveryContent = keys[unusedIndex].key
                    // Mark key as used
                    keys[unusedIndex].used = true
                    keys[unusedIndex].order_id = orderId
                    // Persist updated keys
                    await supabase
                        .from('products')
                        .update({ license_keys: keys })
                        .eq('id', product.id)
                } else {
                    console.warn(`[Digital Delivery] No unused keys left for product: ${product.name}`)
                    deliveryContent = `Votre commande a été reçue mais le stock de clés est épuisé. Veuillez contacter le support pour recevoir votre clé.`
                }
            } else if (product.digital_content) {
                // Cas 1: Fixed content for all buyers
                deliveryContent = product.digital_content
            }

            if (deliveryContent) {
                const message = `🎉 *Votre produit numérique est disponible !*\n\n*${product.name}* :\n${deliveryContent}\n\nMerci pour votre achat ! 🙏`
                try {
                    await sendWhatsAppMessage(order.agent_id, order.customer_phone, message)
                    console.log(`[Digital Delivery] Delivered to ${order.customer_phone} — product: ${product.name}`)
                } catch (sendErr) {
                    console.error('[Digital Delivery] Failed to send WhatsApp:', sendErr)
                }
            }
        }
    } catch (err) {
        console.error('[Digital Delivery] Error:', err)
    }
}
