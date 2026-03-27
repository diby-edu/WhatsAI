const { normalizePhoneNumber, findMatchingOption } = require('./tool-helpers')
const { notify } = require('../../../notifications/notify')
const { validateCreateBookingArgs } = require('./tool-validators')
const { calculateServiceBookingPrice, getVariantDisplayName } = require('./service-pricing')
const {
    bookingTypeNeedsEndDate,
    bookingTypeNeedsPartySize,
    bookingTypeNeedsPaymentChoice,
    bookingTypeNeedsTime,
    calculateDateRangeDays,
    formatBookingPaymentLabel,
    normalizeBookingPaymentMethod,
    normalizeBookingType,
    parseIsoDateOnly,
} = require('../../services/booking-utils')

async function handleCreateBooking(args, agentId, products, conversationId, supabase) {
    try {
        console.log('Executing tool: create_booking')

        const validationError = validateCreateBookingArgs(args)
        if (validationError) return validationError

        const {
            booking_type,
            service_name,
            selected_variant,
            selected_variants,
            selected_supplements,
            customer_phone,
            customer_name,
            preferred_date,
            preferred_time,
            end_date,
            party_size,
            payment_method,
            notes
        } = args

        console.log(`create_booking: service="${service_name}", variant="${selected_variant || JSON.stringify(selected_variants || {})}"`)

        const { data: agent } = await supabase
            .from('agents')
            .select('user_id, escalation_phone')
            .eq('id', agentId)
            .single()

        if (!agent) throw new Error('Agent not found')

        const services = products.filter(p => p.product_type === 'service')
        const service = services.find(s => s.name.toLowerCase().includes(service_name.toLowerCase()))

        if (!service) {
            return JSON.stringify({
                success: false,
                error: `Service "${service_name}" non trouve. Disponibles: ${services.map(s => s.name).join(', ') || 'Aucun'}`
            })
        }

        const resolvedBookingType = normalizeBookingType(booking_type, service.service_subtype)
        const normalizedPaymentMethod = normalizeBookingPaymentMethod(payment_method)
        const requiresTime = bookingTypeNeedsTime(resolvedBookingType)
        const requiresEndDate = bookingTypeNeedsEndDate(resolvedBookingType)
        const requiresPartySize = bookingTypeNeedsPartySize(resolvedBookingType)
        const requiresPaymentMethod = bookingTypeNeedsPaymentChoice(resolvedBookingType)

        const normalizedSelectedVariants = {
            ...(selected_variants && typeof selected_variants === 'object' ? selected_variants : {}),
        }

        if (selected_variant && Object.keys(normalizedSelectedVariants).length === 0) {
            for (const variant of service.variants || []) {
                if (variant.type !== 'fixed' || !Array.isArray(variant.options)) continue
                if (!findMatchingOption(variant, selected_variant)) continue

                normalizedSelectedVariants[getVariantDisplayName(variant)] = selected_variant
                break
            }
        }

        const isInscription = resolvedBookingType === 'inscription'
        let start_time = null
        let durationDays = null

        if (!isInscription) {
            if (!preferred_date) {
                return JSON.stringify({
                    success: false,
                    error: 'DATE MANQUANTE. Demandez la date souhaitee au client (format: AAAA-MM-JJ, ex: 2026-03-25).'
                })
            }

            if (!/^\d{4}-\d{2}-\d{2}$/.test(preferred_date) || !parseIsoDateOnly(preferred_date)) {
                return JSON.stringify({
                    success: false,
                    error: `Date invalide: "${preferred_date}". Format attendu: AAAA-MM-JJ (ex: 2026-03-25). Redemandez la date au client.`
                })
            }

            if (requiresEndDate) {
                if (!end_date) {
                    return JSON.stringify({
                        success: false,
                        error: 'DATE DE FIN MANQUANTE. Demandez la date de fin du sejour avant de creer la reservation.'
                    })
                }

                if (!/^\d{4}-\d{2}-\d{2}$/.test(end_date) || !parseIsoDateOnly(end_date)) {
                    return JSON.stringify({
                        success: false,
                        error: `Date de fin invalide: "${end_date}". Format attendu: AAAA-MM-JJ (ex: 2026-03-27). Redemandez la date de fin au client.`
                    })
                }

                const duration = calculateDateRangeDays(preferred_date, end_date)
                if (duration.error) {
                    return JSON.stringify({
                        success: false,
                        error: `${duration.error} Redemandez des dates coherentes au client.`,
                        hint: 'Exemple valide : arrivee 2026-03-25, depart 2026-03-27'
                    })
                }

                durationDays = duration.days
            }

            if (requiresTime && !preferred_time) {
                return JSON.stringify({
                    success: false,
                    error: 'HEURE MANQUANTE. Demandez l heure souhaitee au client avant de creer la reservation.',
                    hint: 'Exemples valides: "09:00", "14:30", "18:00"'
                })
            }

            if (preferred_time && !/^\d{2}:\d{2}$/.test(preferred_time)) {
                return JSON.stringify({
                    success: false,
                    error: `HEURE INVALIDE: "${preferred_time}". Format attendu: HH:MM (ex: 14:30). Redemandez l'heure au client.`,
                    hint: 'Exemples valides: "09:00", "14:30", "18:00"'
                })
            }

            const timeStr = preferred_time && /^\d{2}:\d{2}$/.test(preferred_time) ? preferred_time : '00:00'
            const parsedDate = new Date(`${preferred_date}T${timeStr}:00`)
            if (isNaN(parsedDate.getTime())) {
                return JSON.stringify({
                    success: false,
                    error: `Date invalide: "${preferred_date} ${timeStr}". Verifiez et redemandez la date au client.`
                })
            }

            start_time = parsedDate.toISOString()
        }

        const normalizedPartySize = party_size == null ? null : Number(party_size)
        if (requiresPartySize && (!Number.isFinite(normalizedPartySize) || normalizedPartySize <= 0)) {
            return JSON.stringify({
                success: false,
                error: 'NOMBRE DE PERSONNES MANQUANT OU INVALIDE. Demandez combien de personnes sont concernees avant de creer la reservation.'
            })
        }

        if (requiresPaymentMethod && !normalizedPaymentMethod) {
            return JSON.stringify({
                success: false,
                error: 'MODE DE PAIEMENT MANQUANT. Demandez si le client souhaite payer en ligne ou sur place avant de creer la reservation.',
                hint: 'Valeurs attendues : "online" ou "onsite"'
            })
        }

        const pricing = calculateServiceBookingPrice(service, {
            selectedVariantsMap: normalizedSelectedVariants,
            selectedSupplementsMap: selected_supplements || {},
            bookingType: resolvedBookingType,
            serviceSubtype: service.service_subtype,
            preferredDate: preferred_date,
            endDate: end_date,
        })

        if (pricing.error) {
            return JSON.stringify({
                success: false,
                error: pricing.error,
                hint: 'Collectez toutes les variantes fixes, dates et supplements necessaires avant de creer la reservation.'
            })
        }

        const normalizedPhone = normalizePhoneNumber(customer_phone)
        if (!normalizedPhone) {
            return JSON.stringify({
                success: false,
                error: 'NUMERO INVALIDE OU SANS INDICATIF. Demandez le numero complet avec indicatif pays avant de creer la reservation.',
                hint: 'Exemples valides : +2250701020304, 002250701020304 ou 2250701020304'
            })
        }

        const finalPrice = pricing.price
        const variantDetails = pricing.fixedSelections.length === 0
            ? null
            : (pricing.fixedSelections.length === 1
                ? {
                    name: pricing.fixedSelections[0].label,
                    value: pricing.fixedSelections[0].value,
                }
                : pricing.fixedSelections.map(item => ({
                    name: item.label,
                    value: item.value,
                })))

        const supplementsList = pricing.supplementsList.map(item => ({
            name: item.value,
            price: item.price,
        }))

        const { data: booking, error } = await supabase
            .from('bookings')
            .insert({
                user_id: agent.user_id,
                agent_id: agentId,
                booking_type: resolvedBookingType,
                start_time,
                customer_phone: normalizedPhone,
                customer_name: customer_name || null,
                service_name: service.name,
                service_id: service.id,
                selected_variant: variantDetails ? JSON.stringify(variantDetails) : null,
                selected_supplements: supplementsList.length > 0 ? JSON.stringify(supplementsList) : null,
                price_fcfa: finalPrice,
                preferred_date: preferred_date || null,
                preferred_time: preferred_time || null,
                end_date: end_date || null,
                party_size: Number.isFinite(normalizedPartySize) ? normalizedPartySize : 1,
                payment_method: normalizedPaymentMethod,
                notes: notes || null,
                status: isInscription ? 'inscription_pending' : 'confirmed',
                conversation_id: conversationId
            })
            .select()
            .single()

        if (error) throw error

        let confirmMsg = isInscription
            ? `Inscription enregistree ! Vous etes inscrit(e) a *${service.name}*.`
            : `Reservation confirmee ! ${service.name} le ${preferred_date}`

        if (!isInscription && preferred_time) confirmMsg += ` a ${preferred_time}`
        if (!isInscription && end_date) {
            confirmMsg += ` jusqu'au ${end_date}`
            if (resolvedBookingType === 'stay' && durationDays) {
                confirmMsg += ` (${durationDays} nuit${durationDays > 1 ? 's' : ''})`
            }
        }
        if (Number.isFinite(normalizedPartySize) && normalizedPartySize > 1) {
            confirmMsg += ` pour ${normalizedPartySize} personne(s)`
        }
        if (pricing.fixedSelections.length > 0) {
            confirmMsg += `\nOptions : ${pricing.fixedSelections.map(item => `${item.label} ${item.value}`).join(', ')}`
        }
        if (supplementsList.length > 0) {
            confirmMsg += `\nSupplements : ${supplementsList.map(item => item.name).join(', ')}`
        }
        if (normalizedPaymentMethod) {
            confirmMsg += `\nPaiement : ${formatBookingPaymentLabel(normalizedPaymentMethod)}`
        }
        if (finalPrice > 0) {
            confirmMsg += `\nMontant : *${finalPrice.toLocaleString('fr-FR')} FCFA*`
            if (resolvedBookingType === 'stay' && pricing.unitPrice > 0 && durationDays) {
                confirmMsg += ` (${pricing.unitPrice.toLocaleString('fr-FR')} FCFA x ${durationDays} nuit${durationDays > 1 ? 's' : ''})`
            }
        }
        confirmMsg += '.'

        if (isInscription && finalPrice > 0) {
            confirmMsg += `\nVotre inscription sera confirmee des reception du paiement.`
        }

        if (agent.escalation_phone) {
            confirmMsg += `\n\nEn cas de besoin, contactez-nous au ${agent.escalation_phone}.`
        }

        try {
            await notify(agent.user_id, 'new_booking', {
                customerName: customer_name || customer_phone,
                serviceName: service.name,
                bookingDate: preferred_date,
                bookingTime: preferred_time
            })
        } catch (notifyErr) {
            console.error('Booking push notification failed:', notifyErr)
        }

        return JSON.stringify({
            success: true,
            booking_id: booking.id,
            booking_type: resolvedBookingType,
            service_name: service.name,
            date: preferred_date,
            time: preferred_time,
            end_date,
            nights: resolvedBookingType === 'stay' ? durationDays : null,
            party_size: Number.isFinite(normalizedPartySize) ? normalizedPartySize : null,
            payment_method: normalizedPaymentMethod,
            price_fcfa: finalPrice,
            message: confirmMsg
        })

    } catch (error) {
        console.error('Booking Error:', error)
        return JSON.stringify({ success: false, error: error.message || 'Erreur lors de la reservation' })
    }
}

module.exports = { handleCreateBooking }
