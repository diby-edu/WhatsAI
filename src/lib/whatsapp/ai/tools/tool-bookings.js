
const { normalizePhoneNumber, findMatchingOption } = require('./tool-helpers')

async function handleCreateBooking(args, agentId, products, conversationId, supabase) {
    try {
        console.log('🛠️ Executing tool: create_booking')
        const {
            booking_type,
            service_name,
            selected_variant,
            selected_supplements,
            customer_phone,
            customer_name,
            preferred_date,
            preferred_time,
            end_date,
            party_size,
            notes
        } = args

        console.log(`🏨 create_booking: service="${service_name}", variant="${selected_variant}"`)

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

        // Calculer le prix basé sur la variante sélectionnée
        let finalPrice = service.price_fcfa || 0
        let variantDetails = null

        if (selected_variant && service.variants && service.variants.length > 0) {
            // Chercher la variante dans les variantes FIXED
            for (const variant of service.variants) {
                if (variant.type === 'fixed' && variant.options) {
                    const matchedOption = findMatchingOption(variant, selected_variant)
                    if (matchedOption) {
                        const optPrice = (typeof matchedOption === 'object') ? (matchedOption.price || 0) : 0
                        if (optPrice > 0) {
                            finalPrice = optPrice
                            variantDetails = {
                                name: variant.name,
                                value: (typeof matchedOption === 'object') ? (matchedOption.value || matchedOption.name) : matchedOption
                            }
                            console.log(`✅ Variante trouvée: ${variantDetails.name}=${variantDetails.value} @ ${finalPrice} FCFA`)
                        }
                        break
                    }
                }
            }
        }

        // Calculer les suppléments additifs
        let supplementsTotal = 0
        let supplementsList = []
        if (selected_supplements && service.variants) {
            for (const variant of service.variants) {
                if (variant.type === 'additive' && variant.options) {
                    for (const opt of variant.options) {
                        const optName = (typeof opt === 'object') ? (opt.value || opt.name) : opt
                        const optPrice = (typeof opt === 'object') ? (opt.price || 0) : 0
                        if (selected_supplements[optName] === true) {
                            supplementsTotal += optPrice
                            supplementsList.push({ name: optName, price: optPrice })
                            console.log(`➕ Supplément: ${optName} +${optPrice} FCFA`)
                        }
                    }
                }
            }
        }

        finalPrice += supplementsTotal

        // Calculer start_time
        const start_time = preferred_date && preferred_time
            ? new Date(`${preferred_date}T${preferred_time}:00`).toISOString()
            : new Date(`${preferred_date}T09:00:00`).toISOString()

        const { data: booking, error } = await supabase
            .from('bookings')
            .insert({
                user_id: agent.user_id,
                agent_id: agentId,
                booking_type: booking_type || 'slot',
                start_time: start_time,
                customer_phone: normalizePhoneNumber(customer_phone),
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
                status: 'confirmed',
                conversation_id: conversationId
            })
            .select()
            .single()

        if (error) throw error

        let confirmMsg = `📅 Réservation confirmée ! ${service.name} le ${preferred_date}`
        if (preferred_time) confirmMsg += ` à ${preferred_time}`
        if (end_date) confirmMsg += ` jusqu'au ${end_date}`
        if (party_size && party_size > 1) confirmMsg += ` pour ${party_size} personne(s)`
        confirmMsg += '.'

        if (agent.escalation_phone) {
            confirmMsg += `\n\n📞 En cas de besoin, contactez le service client au ${agent.escalation_phone}.`
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
            price_fcfa: service.price_fcfa,
            message: confirmMsg
        })

    } catch (error) {
        console.error('❌ Booking Error:', error)
        return JSON.stringify({ success: false, error: error.message || 'Erreur lors de la réservation' })
    }
}

module.exports = { handleCreateBooking }
