
const { normalizePhoneNumber, findMatchingOption } = require('./tool-helpers')
const { notify } = require('../../../notifications/notify')
const { validateCreateBookingArgs } = require('./tool-validators')
const { calculateServiceBookingPrice, getVariantDisplayName } = require('./service-pricing')

async function handleCreateBooking(args, agentId, products, conversationId, supabase) {
    try {
        console.log('🛠️ Executing tool: create_booking')

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
            notes
        } = args

        console.log(`🏨 create_booking: service="${service_name}", variant="${selected_variant || JSON.stringify(selected_variants || {})}"`)

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
                error: `Service "${service_name}" non trouvé. Disponibles: ${services.map(s => s.name).join(', ') || 'Aucun'}`
            })
        }

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

        const pricing = calculateServiceBookingPrice(service, {
            selectedVariantsMap: normalizedSelectedVariants,
            selectedSupplementsMap: selected_supplements || {},
        })

        if (pricing.error) {
            return JSON.stringify({
                success: false,
                error: pricing.error,
                hint: 'Collectez toutes les variantes fixes et supplements necessaires avant de creer la reservation.'
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

        // Inscription : pas de date/heure obligatoire
        const isInscription = booking_type === 'inscription'
        let start_time = null

        if (!isInscription) {
            // Valider et construire start_time
            if (!preferred_date) {
                return JSON.stringify({
                    success: false,
                    error: 'DATE MANQUANTE. Demandez la date souhaitée au client (format: AAAA-MM-JJ, ex: 2026-03-25).'
                })
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(preferred_date)) {
                return JSON.stringify({
                    success: false,
                    error: `Date invalide: "${preferred_date}". Format attendu: AAAA-MM-JJ (ex: 2026-03-25). Redemandez la date au client.`
                })
            }
            // Heure : obligatoire pour slot/table, validée si fournie
            const requiresTime = ['slot', 'table'].includes(booking_type || 'slot')
            if (requiresTime && !preferred_time) {
                return JSON.stringify({
                    success: false,
                    error: 'HEURE MANQUANTE. Demandez l\'heure souhaitée au client avant de créer la réservation.',
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
                    error: `Date invalide: "${preferred_date} ${timeStr}". Vérifiez et redemandez la date au client.`
                })
            }
            start_time = parsedDate.toISOString()
        }

        const normalizedPhone = normalizePhoneNumber(customer_phone)
        if (!normalizedPhone) {
            return JSON.stringify({
                success: false,
                error: 'NUMÉRO INVALIDE OU SANS INDICATIF. Demandez le numéro complet avec indicatif pays avant de créer la réservation.',
                hint: 'Exemples valides : +2250701020304, 002250701020304 ou 2250701020304'
            })
        }

        const { data: booking, error } = await supabase
            .from('bookings')
            .insert({
                user_id: agent.user_id,
                agent_id: agentId,
                booking_type: booking_type || 'slot',
                start_time: start_time,
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
                party_size: party_size || 1,
                notes: notes || null,
                status: isInscription ? 'inscription_pending' : 'confirmed',
                conversation_id: conversationId
            })
            .select()
            .single()

        if (error) throw error

        let confirmMsg = isInscription
            ? `✅ Inscription enregistrée ! Vous êtes inscrit(e) à *${service.name}*.`
            : `📅 Réservation confirmée ! ${service.name} le ${preferred_date}`
        if (!isInscription && preferred_time) confirmMsg += ` à ${preferred_time}`
        if (!isInscription && end_date) confirmMsg += ` jusqu'au ${end_date}`
        if (party_size && party_size > 1) confirmMsg += ` pour ${party_size} personne(s)`
        if (pricing.fixedSelections.length > 0) {
            confirmMsg += `\n🎯 Options : ${pricing.fixedSelections.map(item => `${item.label} ${item.value}`).join(', ')}`
        }
        if (supplementsList.length > 0) {
            confirmMsg += `\n➕ Suppléments : ${supplementsList.map(item => item.name).join(', ')}`
        }
        confirmMsg += '.'

        if (isInscription && finalPrice > 0) {
            confirmMsg += `\n\n💰 Montant : *${finalPrice.toLocaleString('fr-FR')} FCFA*`
            confirmMsg += `\nVotre inscription sera confirmée dès réception du paiement.`
        }

        if (agent.escalation_phone) {
            confirmMsg += `\n\n📞 En cas de besoin, contactez-nous au ${agent.escalation_phone}.`
        }

        // Notify business owner (push notification)
        try {
            await notify(agent.user_id, 'new_booking', {
                customerName: customer_name || customer_phone,
                serviceName: service.name,
                bookingDate: preferred_date,
                bookingTime: preferred_time
            })
        } catch (notifyErr) {
            console.error('⚠️ Booking push notification failed:', notifyErr)
        }

        return JSON.stringify({
            success: true,
            booking_id: booking.id,
            booking_type: booking_type,
            service_name: service.name,
            date: preferred_date,
            time: preferred_time,
            end_date: end_date,
            party_size: party_size,
            price_fcfa: finalPrice,
            message: confirmMsg
        })

    } catch (error) {
        console.error('❌ Booking Error:', error)
        return JSON.stringify({ success: false, error: error.message || 'Erreur lors de la réservation' })
    }
}

module.exports = { handleCreateBooking }
