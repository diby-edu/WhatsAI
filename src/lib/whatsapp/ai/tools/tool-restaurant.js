const { normalizePhoneNumber } = require('./tool-helpers')
const { notify } = require('../../../notifications/notify')

const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID
const CINETPAY_BASE_URL = 'https://api-checkout.cinetpay.com/v2/payment'

function buildRestaurantOrderPaymentLabel(paymentMethod, fulfillmentMode) {
    if (paymentMethod === 'cod') {
        return fulfillmentMode === 'delivery' ? 'Paiement a la livraison.' : 'Paiement au retrait.'
    }

    if (paymentMethod === 'mobile_money_direct') {
        return 'Paiement a finaliser via Mobile Money.'
    }

    return 'Paiement en ligne.'
}

function scoreRestaurantProductMatch(searchName, product) {
    const normalizedSearch = String(searchName || '').trim().toLowerCase()
    const productName = String(product.name || '').trim().toLowerCase()
    const productText = `${product.name || ''} ${product.description || ''} ${product.category || ''}`.toLowerCase()

    if (!normalizedSearch || !productName) return 0
    if (productName === normalizedSearch) return 100
    if (normalizedSearch.includes(productName) || productName.includes(normalizedSearch)) return 60

    const terms = normalizedSearch.split(/\s+/).filter(term => term.length > 2)
    const nameHits = terms.filter(term => productName.includes(term)).length
    const textHits = terms.filter(term => productText.includes(term)).length

    return nameHits * 12 + textHits * 3
}

function findRestaurantProductByName(products, productName) {
    let bestProduct = null
    let bestScore = 0

    for (const product of products) {
        const score = scoreRestaurantProductMatch(productName, product)
        if (score > bestScore) {
            bestProduct = product
            bestScore = score
        }
    }

    return bestScore >= 10 ? bestProduct : null
}

function normalizeRestaurantPaymentMethod(rawValue, fulfillmentMode) {
    const value = String(rawValue || '').trim().toLowerCase()

    if (!value) return null

    if (fulfillmentMode === 'dine_in' || fulfillmentMode === 'booking_only') {
        if (['online', 'en ligne', 'payer en ligne'].includes(value)) return 'online'
        if (['onsite', 'sur place', 'au retrait', 'a l arrivee', 'a l arrivee', 'on site'].includes(value)) return 'onsite'
        return null
    }

    if (['online', 'en ligne', 'payer en ligne'].includes(value)) return 'online'
    if (['onsite', 'sur place', 'au retrait', 'a la livraison', 'cod', 'cash', 'cash on delivery'].includes(value)) return 'cod'
    return null
}

function buildRestaurantItems(items, restaurantProducts) {
    const resolvedItems = []
    let total = 0

    for (const item of items || []) {
        const quantity = Number(item?.quantity || 0)
        if (!Number.isFinite(quantity) || quantity <= 0) {
            return { error: `Quantite invalide pour "${item?.product_name || 'un article'}".` }
        }

        const product = findRestaurantProductByName(restaurantProducts, item.product_name)
        if (!product) {
            return {
                error: `Produit restaurant "${item.product_name}" non trouve. Disponibles: ${restaurantProducts.map(p => p.name).join(', ')}`
            }
        }

        const unitPrice = Number(product.price_fcfa || 0)
        const lineTotal = unitPrice * quantity
        total += lineTotal
        resolvedItems.push({
            product_id: product.id,
            product_name: product.name,
            product_category: product.menu_section_slug || product.category || null,
            quantity,
            unit_price_fcfa: unitPrice,
            line_total_fcfa: lineTotal
        })
    }

    return { resolvedItems, total }
}

function buildMobileMoneyDepositMessage(agent, depositAmountFcfa, depositPercentage) {
    const mmLines = []
    if (agent.mobile_money_orange) mmLines.push(`📱 Orange Money : ${agent.mobile_money_orange}`)
    if (agent.mobile_money_mtn)    mmLines.push(`📱 MTN Money : ${agent.mobile_money_mtn}`)
    if (agent.mobile_money_wave)   mmLines.push(`📱 Wave : ${agent.mobile_money_wave}`)
    if (agent.custom_payment_methods) {
        try {
            const custom = typeof agent.custom_payment_methods === 'string'
                ? JSON.parse(agent.custom_payment_methods)
                : agent.custom_payment_methods
            if (Array.isArray(custom)) {
                custom.forEach(m => mmLines.push(`📱 ${m.name || m.type} : ${m.details || m.number || ''}`))
            }
        } catch (_e) {}
    }
    if (mmLines.length === 0) return ''
    return `\nAcompte requis : *${depositAmountFcfa.toLocaleString('fr-FR')} FCFA* (${depositPercentage}%).\nVersez via :\n${mmLines.join('\n')}\nEnvoyez votre reçu pour valider.`
}

async function initiateBookingDepositPayment({
    supabase,
    agentId,
    bookingId,
    depositAmountFcfa,
    customerName,
    customerPhone
}) {
    const { initializePaymentV2, shouldUseCinetPayV2ForAgent } = await import('../../../payments/cinetpay-v2')
    const useCinetPayV2 = shouldUseCinetPayV2ForAgent(agentId)
    const attemptedProviderVersion = useCinetPayV2 ? 'v2' : 'v1'

    if (!useCinetPayV2 && (!CINETPAY_API_KEY || !CINETPAY_SITE_ID)) {
        return { success: false, error: 'CinetPay non configure', providerVersion: attemptedProviderVersion }
    }

    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, transaction_id, provider_payment_url, payment_provider_version')
        .eq('id', bookingId)
        .single()

    if (bookingError || !booking) {
        return { success: false, error: 'Reservation introuvable pour le paiement', providerVersion: attemptedProviderVersion }
    }

    if (booking.transaction_id && booking.provider_payment_url) {
        return {
            success: true,
            transactionId: booking.transaction_id,
            paymentUrl: booking.provider_payment_url,
            providerVersion: booking.payment_provider_version || attemptedProviderVersion
        }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'
    const transactionId = `BKG_${bookingId.substring(0, 8)}_${Date.now()}`
    let paymentUrl = null
    let providerTransactionId = null
    let providerNotifyToken = null
    let providerVersion = attemptedProviderVersion

    const { error: versionUpdateError } = await supabase
        .from('bookings')
        .update({
            payment_provider_version: attemptedProviderVersion,
            updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)

    if (versionUpdateError) {
        console.error('Failed to persist booking payment provider version before init:', versionUpdateError)
    }

    if (useCinetPayV2) {
        const result = await initializePaymentV2({
            amount: depositAmountFcfa,
            currency: 'XOF',
            merchantTransactionId: transactionId,
            designation: `Acompte reservation #${bookingId.substring(0, 8)}`,
            clientFullName: customerName || 'Client',
            clientPhoneNumber: customerPhone || '',
            successUrl: `${baseUrl}/payment/success?transaction_id=${transactionId}`,
            failedUrl: `${baseUrl}/payment/success?transaction_id=${transactionId}&payment=cancelled`,
            notifyUrl: `${baseUrl}/api/payments/cinetpay/webhook`
        })

        if (!result.success || !result.paymentUrl) {
            console.error('Restaurant booking deposit initiation failed:', {
                agentId,
                bookingId,
                providerVersion: attemptedProviderVersion,
                error: result.error || 'Erreur CinetPay'
            })
            return { success: false, error: result.error || 'Erreur CinetPay', providerVersion: attemptedProviderVersion }
        }

        paymentUrl = result.paymentUrl
        providerTransactionId = result.providerTransactionId || null
        providerNotifyToken = result.notifyToken || null
        providerVersion = 'v2'
    } else {
        const payload = {
            apikey: CINETPAY_API_KEY,
            site_id: CINETPAY_SITE_ID,
            transaction_id: transactionId,
            amount: depositAmountFcfa,
            currency: 'XOF',
            description: `Acompte reservation #${bookingId.substring(0, 8)}`,
            notify_url: `${baseUrl}/api/payments/cinetpay/webhook`,
            return_url: `${baseUrl}/payment/success?transaction_id=${transactionId}`,
            cancel_url: `${baseUrl}/payment/success?payment=cancelled`,
            channels: 'ALL',
            customer_id: bookingId,
            customer_name: customerName || 'Client',
            customer_surname: '',
            customer_phone_number: customerPhone || '',
            metadata: JSON.stringify({
                booking_id: bookingId,
                type: 'booking_deposit'
            })
        }

        const response = await fetch(CINETPAY_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })

        const result = await response.json()
        if (result.code !== '201' || !result.data?.payment_url) {
            console.error('Restaurant booking deposit initiation failed:', {
                agentId,
                bookingId,
                providerVersion: attemptedProviderVersion,
                error: result.message || 'Erreur CinetPay'
            })
            return { success: false, error: result.message || 'Erreur CinetPay', providerVersion: attemptedProviderVersion }
        }

        paymentUrl = result.data.payment_url
    }

    const { error: updateError } = await supabase
        .from('bookings')
        .update({
            transaction_id: transactionId,
            provider_payment_url: paymentUrl,
            provider_transaction_id: providerTransactionId,
            provider_notify_token: providerNotifyToken,
            payment_provider_version: providerVersion,
            updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)

    if (updateError) {
        return { success: false, error: updateError.message || 'Impossible de sauvegarder le lien de paiement' }
    }

    return {
        success: true,
        transactionId,
        paymentUrl,
        providerVersion
    }
}

async function handleCreateRestaurantCheckout(args, agentId, products, conversationId, supabase) {
    try {
        console.log('Executing tool: create_restaurant_checkout')

        const {
            fulfillment_mode: rawFulfillmentMode,
            items = [],
            customer_name: customerName,
            customer_phone: customerPhone,
            scheduled_date: scheduledDate,
            scheduled_time: scheduledTime,
            party_size: partySize,
            delivery_address: deliveryAddress,
            payment_method: rawPaymentMethod,
            notes
        } = args

        const fulfillmentMode = String(rawFulfillmentMode || '').trim().toLowerCase()
        if (!['dine_in', 'booking_only', 'takeaway', 'delivery'].includes(fulfillmentMode)) {
            return JSON.stringify({
                success: false,
                error: 'FULFILLMENT MODE INVALIDE. Valeurs attendues : dine_in, booking_only, takeaway, delivery.'
            })
        }

        const normalizedPhone = normalizePhoneNumber(customerPhone)
        if (!normalizedPhone) {
            return JSON.stringify({
                success: false,
                error: 'NUMERO INVALIDE OU SANS INDICATIF. Demandez le numero complet avec indicatif pays.'
            })
        }

        const restaurantProducts = (products || []).filter(
            product => product.product_type === 'service' && product.service_subtype === 'restaurant'
        )

        if (restaurantProducts.length === 0) {
            return JSON.stringify({
                success: false,
                error: 'Aucun produit restaurant configure pour cet agent.'
            })
        }

        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('user_id, name, escalation_phone, payment_mode, restaurant_deposit_enabled, restaurant_deposit_percentage, mobile_money_orange, mobile_money_mtn, mobile_money_wave, custom_payment_methods')
            .eq('id', agentId)
            .single()

        if (agentError || !agent) {
            throw new Error('Agent not found')
        }

        let paymentMethod = normalizeRestaurantPaymentMethod(rawPaymentMethod, fulfillmentMode)

        if (!paymentMethod && (fulfillmentMode === 'dine_in' || fulfillmentMode === 'booking_only')) {
            const bookingDepositEnabled = !!agent.restaurant_deposit_enabled
            const bookingDepositPercentage = bookingDepositEnabled
                ? Math.max(0, Math.min(100, Number(agent.restaurant_deposit_percentage || 0)))
                : 0

            if (bookingDepositEnabled && bookingDepositPercentage > 0) {
                paymentMethod = agent.payment_mode === 'mobile_money_direct' ? 'online' : 'online'
            } else {
                paymentMethod = 'onsite'
            }
        }

        if (!paymentMethod) {
            return JSON.stringify({
                success: false,
                error: 'MODE DE PAIEMENT MANQUANT OU INVALIDE. Utilisez online ou onsite.'
            })
        }

        if ((fulfillmentMode === 'dine_in' || fulfillmentMode === 'booking_only') && (!scheduledDate || !scheduledTime)) {
            return JSON.stringify({
                success: false,
                error: 'DATE ET HEURE MANQUANTES. Demandez la date et l heure de la reservation avant validation.'
            })
        }

        if ((fulfillmentMode === 'dine_in' || fulfillmentMode === 'booking_only') && (!Number.isFinite(Number(partySize)) || Number(partySize) < 1)) {
            return JSON.stringify({
                success: false,
                error: 'NOMBRE DE PERSONNES MANQUANT OU INVALIDE.'
            })
        }

        if (fulfillmentMode === 'delivery' && !String(deliveryAddress || '').trim()) {
            return JSON.stringify({
                success: false,
                error: 'ADRESSE DE LIVRAISON MANQUANTE.'
            })
        }

        if ((fulfillmentMode === 'takeaway' || fulfillmentMode === 'delivery') && (!Array.isArray(items) || items.length === 0)) {
            return JSON.stringify({
                success: false,
                error: 'ARTICLES MANQUANTS. Une commande takeaway ou delivery doit contenir au moins un article.'
            })
        }

        const itemResolution = buildRestaurantItems(items, restaurantProducts)
        if (itemResolution.error) {
            return JSON.stringify({
                success: false,
                error: itemResolution.error
            })
        }

        const resolvedItems = itemResolution.resolvedItems || []
        const totalFcfa = itemResolution.total || 0
        const serviceName = agent.name || 'Restaurant'

        if (fulfillmentMode === 'dine_in' || fulfillmentMode === 'booking_only') {
            const depositEnabled = !!agent.restaurant_deposit_enabled
            const depositPercentage = depositEnabled && totalFcfa > 0
                ? Math.max(0, Math.min(100, Number(agent.restaurant_deposit_percentage || 0)))
                : 0
            const depositRequired = depositEnabled && depositPercentage > 0 && totalFcfa > 0
            const depositAmountFcfa = depositRequired
                ? Math.ceil((totalFcfa * depositPercentage) / 100)
                : 0
            const usesCinetpay = !agent.payment_mode || agent.payment_mode === 'cinetpay'
            const usesMobileMoney = agent.payment_mode === 'mobile_money_direct'

            let bookingPaymentMethod = paymentMethod
            if (depositRequired && (usesCinetpay || usesMobileMoney)) {
                // A deposit always requires a remote payment step, even if the model guessed "onsite".
                bookingPaymentMethod = 'online'
            } else if (!bookingPaymentMethod) {
                bookingPaymentMethod = 'onsite'
            }

            const { data: bookingResult, error: bookingError } = await supabase.rpc('create_restaurant_booking', {
                p_agent_id: agentId,
                p_user_id: agent.user_id,
                p_conversation_id: conversationId,
                p_fulfillment_mode: fulfillmentMode,
                p_service_name: serviceName,
                p_customer_name: customerName,
                p_customer_phone: normalizedPhone,
                p_preferred_date: scheduledDate,
                p_preferred_time: scheduledTime,
                p_party_size: Number(partySize),
                p_payment_method: bookingPaymentMethod,
                p_notes: notes || null,
                p_deposit_required: depositRequired,
                p_deposit_percentage: depositPercentage,
                p_deposit_amount_fcfa: depositAmountFcfa,
                p_items: resolvedItems
            })

            if (bookingError) throw bookingError

            const bookingId = bookingResult?.booking_id
            let paymentLink = null
            let paymentMessage = ''

            if (depositRequired && usesCinetpay && bookingId) {
                try {
                    const paymentResult = await initiateBookingDepositPayment({
                        supabase,
                        agentId,
                        bookingId,
                        depositAmountFcfa,
                        customerName,
                        customerPhone: normalizedPhone
                    })

                    if (paymentResult.success) {
                        paymentLink = paymentResult.paymentUrl
                        paymentMessage = `\nAcompte requis : *${depositAmountFcfa.toLocaleString('fr-FR')} FCFA* (${depositPercentage}%).\nLien de paiement : ${paymentLink}`
                    } else {
                        paymentMessage = `\nAcompte requis : *${depositAmountFcfa.toLocaleString('fr-FR')} FCFA* (${depositPercentage}%).\nVotre reservation est bien enregistree, mais elle n'est pas encore confirmee car le lien de paiement est indisponible pour le moment.`
                    }
                } catch (paymentError) {
                    console.error('Restaurant booking deposit initiation failed:', paymentError)
                    paymentMessage = `\nAcompte requis : *${depositAmountFcfa.toLocaleString('fr-FR')} FCFA* (${depositPercentage}%).\nVotre reservation est bien enregistree, mais elle n'est pas encore confirmee car le lien de paiement est indisponible pour le moment.`
                }
            } else if (depositRequired && usesMobileMoney) {
                paymentMessage = buildMobileMoneyDepositMessage(agent, depositAmountFcfa, depositPercentage)
            }

            try {
                await notify(agent.user_id, 'new_booking', {
                    customerName: customerName || normalizedPhone,
                    serviceName,
                    bookingDate: scheduledDate,
                    bookingTime: scheduledTime
                })
            } catch (notifyError) {
                console.error('Restaurant booking notification failed:', notifyError)
            }

            const bookingLabel = fulfillmentMode === 'booking_only' ? 'Reservation de table enregistree' : 'Reservation restaurant enregistree'
            const itemsSummary = resolvedItems.length > 0
                ? `\nPrecommande : ${resolvedItems.map(item => `${item.quantity}x ${item.product_name}`).join(', ')}`
                : ''
            const totalSummary = totalFcfa > 0 ? `\nTotal : *${totalFcfa.toLocaleString('fr-FR')} FCFA*` : ''

            return JSON.stringify({
                success: true,
                record_type: 'booking',
                record_id: bookingId,
                fulfillment_mode: fulfillmentMode,
                total_fcfa: totalFcfa,
                deposit_required: depositRequired,
                deposit_amount_fcfa: depositAmountFcfa,
                deposit_status: depositRequired ? 'pending' : 'not_required',
                payment_method: bookingPaymentMethod,
                payment_link: paymentLink,
                message: `${bookingLabel} pour ${customerName || 'le client'} le ${scheduledDate} a ${scheduledTime}.${itemsSummary}${totalSummary}${paymentMessage}`
            })
        }

        // Calcul acompte (même logique que pour les bookings)
        const orderDepositEnabled = !!agent.restaurant_deposit_enabled
        const orderDepositPercentage = orderDepositEnabled && totalFcfa > 0
            ? Math.max(0, Math.min(100, Number(agent.restaurant_deposit_percentage || 0)))
            : 0
        const orderDepositRequired = orderDepositEnabled && orderDepositPercentage > 0 && totalFcfa > 0
        const orderDepositAmountFcfa = orderDepositRequired
            ? Math.ceil((totalFcfa * orderDepositPercentage) / 100)
            : 0

        const orderUsesCinetpay = paymentMethod === 'online' && (!agent.payment_mode || agent.payment_mode === 'cinetpay')
        const orderUsesMobileMoney = paymentMethod === 'online' && agent.payment_mode === 'mobile_money_direct'

        // Pour les orders, le payment_method DB reflète le mode de paiement final
        const orderPaymentMethod = paymentMethod === 'cod'
            ? 'cod'
            : (orderUsesMobileMoney ? 'mobile_money_direct' : 'online')
        const orderStatus = fulfillmentMode === 'delivery'
            ? (orderPaymentMethod === 'cod' ? 'pending_delivery' : 'pending')
            : 'pending_pickup'

        const { data: orderResult, error: orderError } = await supabase.rpc('create_restaurant_order_with_items', {
            p_user_id: agent.user_id,
            p_agent_id: agentId,
            p_conversation_id: conversationId,
            p_customer_name: customerName,
            p_customer_phone: normalizedPhone,
            p_delivery_address: fulfillmentMode === 'delivery' ? String(deliveryAddress || '').trim() : null,
            p_payment_method: orderPaymentMethod,
            p_notes: notes || null,
            p_total_fcfa: totalFcfa,
            p_status: orderStatus,
            p_items: resolvedItems,
            p_fulfillment_mode: fulfillmentMode,
            p_pickup_at: null,
            p_deposit_required: orderDepositRequired,
            p_deposit_percentage: orderDepositPercentage,
            p_deposit_amount_fcfa: orderDepositAmountFcfa,
            p_deposit_status: orderDepositRequired ? 'pending' : 'not_required'
        })

        if (orderError) throw orderError

        const orderId = orderResult?.[0]?.order_id
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'

        let orderPaymentLink = null
        let orderPaymentMessage = ''

        if (orderPaymentMethod === 'online' && orderId) {
            orderPaymentLink = `${appUrl}/pay/${orderId}`
            if (orderDepositRequired) {
                orderPaymentMessage = `\nAcompte requis : *${orderDepositAmountFcfa.toLocaleString('fr-FR')} FCFA* (${orderDepositPercentage}%).\nLien de paiement : ${orderPaymentLink}`
            } else {
                orderPaymentMessage = `\nLien de paiement : ${orderPaymentLink}`
            }
        } else if (orderPaymentMethod === 'mobile_money_direct') {
            if (orderDepositRequired) {
                orderPaymentMessage = buildMobileMoneyDepositMessage(agent, orderDepositAmountFcfa, orderDepositPercentage)
            } else {
                orderPaymentMessage = `\n${buildRestaurantOrderPaymentLabel(orderPaymentMethod, fulfillmentMode)}`
            }
        } else {
            orderPaymentMessage = `\n${buildRestaurantOrderPaymentLabel(orderPaymentMethod, fulfillmentMode)}`
        }

        try {
            await notify(agent.user_id, 'new_order', {
                orderNumber: orderId || '',
                customerName: customerName || normalizedPhone,
                totalAmount: totalFcfa
            })
        } catch (notifyError) {
            console.error('Restaurant order notification failed:', notifyError)
        }

        const modeLabel = fulfillmentMode === 'delivery' ? 'livraison' : 'retrait'

        return JSON.stringify({
            success: true,
            record_type: 'order',
            record_id: orderId,
            fulfillment_mode: fulfillmentMode,
            total_fcfa: totalFcfa,
            deposit_required: orderDepositRequired,
            deposit_amount_fcfa: orderDepositAmountFcfa,
            deposit_status: orderDepositRequired ? 'pending' : 'not_required',
            payment_method: orderPaymentMethod,
            payment_link: orderPaymentLink,
            message: `Commande restaurant enregistree pour ${modeLabel}. Total : *${totalFcfa.toLocaleString('fr-FR')} FCFA*.${orderPaymentMessage}`
        })
    } catch (error) {
        console.error('Restaurant checkout error:', error)
        return JSON.stringify({
            success: false,
            error: error.message || 'Erreur lors du checkout restaurant'
        })
    }
}

module.exports = { handleCreateRestaurantCheckout }
