import { queueOutboundWhatsAppMessage } from '@/lib/whatsapp/outbound'
const { ConversationService } = require('@/lib/whatsapp/services/conversation.service')

interface LicenseKey {
    key: string
    used: boolean
    order_id: string | null
}

interface DeliverDigitalProductsOptions {
    announcePreparation?: boolean
    preparationMessage?: string
}

/**
 * Delivers digital products for a given order.
 * Called after payment is confirmed.
 *
 * Delivery is now queued through outbound_messages so the production bot stack
 * sends it consistently, even if the session reconnects a few seconds later.
 */
export async function deliverDigitalProducts(
    orderId: string,
    supabase: any,
    options: DeliverDigitalProductsOptions = {}
): Promise<void> {
    try {
        const { data: order } = await supabase
            .from('orders')
            .select('id, agent_id, customer_phone, conversation_id')
            .eq('id', orderId)
            .single()

        if (!order?.customer_phone || !order?.agent_id) return

        let recipient = order.customer_phone.replace(/^\+/, '')

        if (order.conversation_id) {
            const { data: conversation } = await supabase
                .from('conversations')
                .select('contact_jid, contact_phone')
                .eq('id', order.conversation_id)
                .single()

            const conversationRecipient = String(
                conversation?.contact_jid || conversation?.contact_phone || ''
            ).trim()

            if (conversationRecipient) {
                recipient = conversationRecipient
            }
        }

        const { data: items } = await supabase
            .from('order_items')
            .select('product_name, quantity')
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

        let preparationAnnounced = false
        let deliverableItems = 0
        let queuedDeliveries = 0

        for (const item of items) {
            const baseName = item.product_name.replace(/\s*\(.*\)\s*$/, '').trim()
            const requestedQuantity = Math.max(1, Number(item.quantity || 1))

            const product = products.find((candidate: any) => {
                const productName = String(candidate.name || '').toLowerCase()
                const itemName = baseName.toLowerCase()
                return productName === itemName || itemName.includes(productName) || productName.includes(itemName)
            })

            if (!product) continue

            let deliveryContent: string | null = null

            if (product.license_keys && Array.isArray(product.license_keys) && product.license_keys.length > 0) {
                const keys = product.license_keys as LicenseKey[]
                const grantedKeys: string[] = []

                for (let index = 0; index < requestedQuantity; index += 1) {
                    const unusedIndex = keys.findIndex((key) => !key.used)
                    if (unusedIndex < 0) break

                    grantedKeys.push(keys[unusedIndex].key)
                    keys[unusedIndex].used = true
                    keys[unusedIndex].order_id = orderId
                }

                if (grantedKeys.length > 0) {
                    await supabase
                        .from('products')
                        .update({ license_keys: keys })
                        .eq('id', product.id)

                    deliveryContent = grantedKeys.length === 1
                        ? grantedKeys[0]
                        : grantedKeys.map((key, index) => `${index + 1}. ${key}`).join('\n')
                } else {
                    console.warn(`[Digital Delivery] No unused keys left for product: ${product.name}`)
                    deliveryContent = "Votre commande a ete recue mais le stock de cles est epuise. Veuillez contacter le support pour recevoir votre cle."
                }
            } else if (product.digital_content) {
                deliveryContent = product.digital_content
            }

            if (!deliveryContent) continue

            deliverableItems += 1

            const isFileUrl = deliveryContent.includes('/storage/v1/object/public/digital-content/')
            const formattedDeliveryContent = requestedQuantity > 1 && !isFileUrl
                ? `Voici vos ${requestedQuantity} cles d'activation :\n${deliveryContent}`
                : deliveryContent
            const message = isFileUrl
                ? `🎉 *Votre produit numerique est disponible !*\n\n*${product.name}*\n\nMerci pour votre achat ! 🙏`
                : `🎉 *Votre produit numerique est disponible !*\n\n*${product.name}* :\n${formattedDeliveryContent}\n\nMerci pour votre achat ! 🙏`

            try {
                if (options.announcePreparation && !preparationAnnounced) {
                    const preparationResult = await queueOutboundWhatsAppMessage(supabase, {
                        agentId: order.agent_id,
                        to: recipient,
                        message: options.preparationMessage || 'Votre commande numerique est en preparation. Elle va vous etre envoyee ici sur WhatsApp dans quelques instants.',
                    })

                    if (preparationResult.queued) {
                        preparationAnnounced = true
                    }
                }

                const result = await queueOutboundWhatsAppMessage(supabase, {
                    agentId: order.agent_id,
                    to: recipient,
                    message,
                    ...(isFileUrl ? {
                        mediaUrl: deliveryContent,
                        mediaType: 'document' as const,
                    } : {}),
                })

                if (result.queued) {
                    queuedDeliveries += 1
                    console.log(`[Digital Delivery] Queued for ${order.customer_phone} - product: ${product.name}`)
                }
            } catch (sendErr) {
                console.error('[Digital Delivery] Failed to queue WhatsApp delivery:', sendErr)
            }
        }

        if (deliverableItems > 0 && queuedDeliveries === deliverableItems) {
            const { error: completionError } = await supabase
                .from('orders')
                .update({
                    status: 'completed',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', order.id)

            if (completionError) {
                console.error('[Digital Delivery] Failed to mark order as completed:', completionError)
            } else if (order.conversation_id) {
                await ConversationService.closeCompletedCycle(
                    supabase,
                    order.conversation_id,
                    'digital_delivery_completed'
                )
            }
        }
    } catch (err) {
        console.error('[Digital Delivery] Error:', err)
    }
}
