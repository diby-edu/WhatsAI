/**
 * ═══════════════════════════════════════════════════════════════
 * TOOL : capture_lead
 * Enregistre les coordonnées d'un client intéressé (mode support)
 * ═══════════════════════════════════════════════════════════════
 */

const { calculateItemPrice } = require('./pricing-logic')

/**
 * Filet de dernier recours sur le détail du lead.
 *
 * `lead_cart` n'existe que si l'IA a appelé preview_cart. Observé en production : une
 * conversation entière ("10 sacs enfant noir", retrait en boutique, nom, téléphone) s'est
 * terminée sans un seul appel à l'outil — le lead enregistré n'avait ni montant ni articles,
 * et le vendeur devait rouvrir WhatsApp pour savoir quoi facturer.
 *
 * Or le moteur d'extraction, lui, connaît les articles : ils sont dans
 * conversation.metadata.lead_state, calculés par code à chaque message. On reconstruit
 * donc le détail à partir de cette source quand le panier manque — avec calculateItemPrice,
 * exactement la même fonction de tarification que preview_cart et create_order, jamais un
 * second calcul maison.
 *
 * Ne remplace JAMAIS un lead_cart existant : celui-ci reflète ce que le client a réellement
 * vu et validé à l'écran, ce qui prime toujours sur une reconstruction.
 */
function buildItemsFromLeadState(leadState, products) {
    if (!leadState || !Array.isArray(leadState.items) || !Array.isArray(products) || products.length === 0) return null

    // ⛔ Deux situations où l'état ne reflète PLUS la commande réelle. Reconstruire un lead
    // à partir de là produirait un détail FAUX — pire qu'un lead sans détail, parce que le
    // vendeur y croirait. Les deux ont été observées sur des conversations réelles :
    //
    // 1) Le client a annulé ou modifié quelque chose ("Non je ne veux pas 10 sac enfant
    //    noir"). L'IA retire bien la ligne de la commande, le moteur la conserve — il ne
    //    devine jamais quelle ligne réduire. Reconstruire réintroduirait les 10 sacs annulés.
    // 2) Une ligne porte une variante invalide non résolue. La conversation l'a tranchée
    //    (rose → Bleu, orange → Jaune), l'état non. Reconstruire perdrait ces lignes.
    if (leadState.has_unapplied_change === true) {
        console.log('ℹ️ [capture_lead] État écarté pour la reconstruction : le client a annulé ou modifié une ligne')
        return null
    }
    if (leadState.items.some(line => line.variant_status === 'invalid')) {
        console.log('ℹ️ [capture_lead] État écarté pour la reconstruction : une variante reste non résolue')
        return null
    }

    const items = []
    for (const line of leadState.items) {
        // Uniquement les lignes exploitables : une quantité connue et, si le produit a des
        // variantes, une variante valide. Une ligne incomplète n'a pas de prix fiable.
        if (line.quantity === null || line.variant_status === 'invalid') continue
        const product = products.find(p => p.id === line.product_id)
        if (!product) continue

        const pricing = calculateItemPrice(product, {}, line.variant || product.name, line.quantity)
        const unitPrice = pricing?.price || 0
        if (!unitPrice) continue

        items.push({
            product_name: product.name,
            variant: line.variant || null,
            quantity: line.quantity,
            unit_price: unitPrice,
            subtotal: unitPrice * line.quantity,
        })
    }
    return items.length > 0 ? items : null
}

async function handleCaptureLead(args, agentId, customerPhone, conversationId, supabase, products = []) {
    try {
        console.log('Executing tool: capture_lead', args)
        const {
            lead_name, lead_phone, lead_email, lead_location, lead_address, lead_company,
            interest, preferred_date, preferred_time, service_requested, lead_notes, custom_fields
        } = args

        // Récupérer le user_id de l'agent
        const { data: agent, error: agentErr } = await supabase
            .from('agents')
            .select('user_id, name')
            .eq('id', agentId)
            .single()

        if (agentErr || !agent) {
            console.error('capture_lead: agent introuvable', agentErr)
            return JSON.stringify({ success: false, error: 'Agent introuvable' })
        }

        // Dernier panier calculé par preview_cart, dernier lien de localisation résolu, et
        // réponse du client à la question "Souhaitez-vous ajouter une instruction ?" — tous
        // stockés en cours de conversation (conversation.metadata), jamais reconstruits à
        // partir de ce que l'IA rapporte : garantit un total/lieu/instruction fidèles à ce
        // qui a réellement été calculé/dit, même si l'IA les omet ou les déforme.
        let leadCart = null
        let locationLink = null
        let instructionAnswer = null
        let lastSeenTotals = null
        let leadState = null
        // Début du cycle courant : borne l'idempotence du lead (voir plus bas).
        let cycleStartedAt = null
        // Adresse telle que le client l'a écrite, captée par message.js.
        let addressRaw = null
        if (conversationId) {
            const { data: conversation } = await supabase
                .from('conversations')
                .select('metadata')
                .eq('id', conversationId)
                .single()
            leadCart = conversation?.metadata?.lead_cart || null
            locationLink = conversation?.metadata?.last_location_link || null
            instructionAnswer = conversation?.metadata?.lead_instruction_answer || null
            lastSeenTotals = conversation?.metadata?.lead_last_seen_totals || null
            leadState = conversation?.metadata?.lead_state || null
            cycleStartedAt = conversation?.metadata?.session_anchor_at || null
            addressRaw = conversation?.metadata?.lead_address_raw || null
        }

        // preview_cart jamais appelé → on reconstruit depuis l'état du moteur plutôt que
        // d'enregistrer un lead sans articles ni montant (voir buildItemsFromLeadState).
        const fallbackItems = (!leadCart?.items || leadCart.items.length === 0)
            ? buildItemsFromLeadState(leadState, products)
            : null
        if (fallbackItems) {
            console.log(`ℹ️ [capture_lead] Aucun panier calculé — détail reconstruit depuis lead_state (${fallbackItems.length} ligne(s))`)
        }

        // Le TOTAL/frais de livraison réellement montrés au client (extraits du dernier
        // récap envoyé) priment sur metadata.lead_cart : lead_cart ne reflète que le
        // dernier appel à preview_cart, qui peut être périmé si l'IA a recalculé le
        // total "à la main" (ex: ajout de la livraison sans rappeler l'outil) — déjà
        // observé en prod (lead à 204 500 alors que le client avait vu/confirmé 206 500).
        const hasLastSeenTotal = lastSeenTotals && lastSeenTotals.total !== null && lastSeenTotals.total !== undefined
        const fallbackTotal = fallbackItems
            ? fallbackItems.reduce((sum, item) => sum + (item.subtotal || 0), 0)
            : null
        const estimatedTotal = hasLastSeenTotal
            ? lastSeenTotals.total
            : (leadCart?.total ?? fallbackTotal)
        // Si le dernier récap montrait un TOTAL sans répéter la ligne "Frais de livraison"
        // (ex: message de confirmation court), lastSeenTotals.deliveryFee est null — mais ça
        // ne veut pas forcément dire "plus de livraison" : retombe sur le dernier frais connu
        // de lead_cart plutôt que d'effacer silencieusement une livraison déjà confirmée.
        let deliveryFee = hasLastSeenTotal && lastSeenTotals.deliveryFee !== null
            ? lastSeenTotals.deliveryFee
            : (leadCart?.deliveryFee ?? null)

        // Livraison annoncée dans le total mais jamais sur sa propre ligne. Cas réel du
        // 12/08/2026 : l'agent écrit "TOTAL : 37 000 FCFA (incluant la livraison)" sans
        // ligne "Frais de livraison". Le lead partait alors avec le bon montant global
        // (37 000) mais delivery_fee à null — une facturation ou un export lisant ce champ
        // aurait vu zéro livraison. L'écart entre le total affiché et la somme des articles
        // EST la livraison : on la déduit plutôt que de la perdre.
        const itemsSource = leadCart?.items?.length ? leadCart.items : fallbackItems
        if (deliveryFee === null && estimatedTotal !== null && Array.isArray(itemsSource) && itemsSource.length > 0) {
            const articlesTotal = itemsSource.reduce((sum, item) => sum + (item.subtotal || 0), 0)
            const ecart = estimatedTotal - articlesTotal
            if (ecart > 0) {
                deliveryFee = ecart
                console.log(`ℹ️ [capture_lead] Frais de livraison déduits de l'écart total/articles : ${ecart} FCFA`)
            }
        }

        // Mode de récupération : capté par le moteur depuis les mots du client, jamais
        // déduit, et désormais rangé dans sa propre colonne (migration du 12/08/2026).
        // Il transitait auparavant par `interest`, un champ de texte libre que le tableau
        // de bord découpe en puces — « retrait en boutique » y apparaissait comme un
        // article commandé. `interest` redevient ce qu'il doit être : une phrase lisible.
        const fulfillmentMode = leadState?.fulfillment_mode || null
        if (fulfillmentMode) {
            console.log(`ℹ️ [capture_lead] Mode de récupération enregistré : ${fulfillmentMode}`)
        }

        // Fusionne l'instruction capturée par code dans lead_notes si l'IA ne l'y a pas
        // déjà mise (elle atterrit parfois uniquement dans "interest" à la place).
        let finalLeadNotes = lead_notes || null
        if (instructionAnswer) {
            const alreadyIncluded = finalLeadNotes?.includes(instructionAnswer)
            if (!alreadyIncluded) {
                finalLeadNotes = finalLeadNotes ? `${finalLeadNotes}; ${instructionAnswer}` : instructionAnswer
            }
        }

        // lead_location et lead_address sont deux champs DISTINCTS : le quartier/la ville
        // d'un côté, l'adresse de livraison complète de l'autre. Le prompt l'explique, mais
        // le modèle recopie régulièrement la même valeur dans les deux (observé en prod :
        // "Port Bouët" dans les deux champs). Un export ou une automatisation qui lit les
        // deux y voit alors un doublon — on ne garde la localisation que si elle apporte
        // réellement une information différente de l'adresse.
        const normalizeForCompare = value => String(value || '')
            .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[\s,.-]+/g, ' ').trim()
        const locationDuplicatesAddress = lead_location && lead_address &&
            normalizeForCompare(lead_location) === normalizeForCompare(lead_address)
        if (locationDuplicatesAddress) {
            console.log('ℹ️ [capture_lead] lead_location identique à lead_address — localisation ignorée')
        }

        // L'adresse écrite par le client fait foi, jamais la découpe du modèle.
        //
        // Observé le 13/08/2026 : « Adjame bracoddi non loin du black », dit d'un seul trait,
        // est arrivé en base coupé en deux — lead_location = "Adjamé", lead_address =
        // "Bracoddi non loin du black". Le marchand voyait donc une adresse SANS SA COMMUNE,
        // celle qui justifie pourtant les frais de livraison facturés. Le garde-fou
        // ci-dessus ne voit pas ce cas : les deux valeurs ne sont pas identiques, ce sont
        // deux moitiés complémentaires.
        //
        // On réinjecte donc la phrase brute mémorisée par message.js et on écarte la
        // localisation : elle ne peut plus rien apporter que l'adresse ne contienne déjà.
        let finalAddress = lead_address || null
        let finalLocation = locationDuplicatesAddress ? null : (lead_location || null)
        if (addressRaw) {
            if (normalizeForCompare(addressRaw) !== normalizeForCompare(lead_address)) {
                console.log(`ℹ️ [capture_lead] adresse reprise telle que donnée par le client : "${addressRaw}"`)
            }
            finalAddress = addressRaw
            finalLocation = null
        }

        // Retrait en boutique : aucune adresse de livraison n'a de sens. Sans cette remise à
        // zéro, l'adresse du cycle PRÉCÉDENT se logeait dans la localisation d'une commande à
        // retirer — constaté sur le second lead du 13/08/2026, qui portait « Adjamé Bracoddi
        // non loin du black » alors que le client avait choisi la boutique.
        if (fulfillmentMode === 'pickup') {
            if (finalAddress || finalLocation) {
                console.log('ℹ️ [capture_lead] retrait en boutique — adresse et localisation écartées')
            }
            finalAddress = null
            finalLocation = null
        }

        const leadRow = {
            agent_id:          agentId,
            user_id:           agent.user_id,
            conversation_id:   conversationId   || null,
            customer_phone:    customerPhone    || null,
            lead_name:         lead_name        || null,
            lead_phone:        lead_phone       || null,
            lead_email:        lead_email       || null,
            lead_location:     finalLocation,
            lead_address:      finalAddress,
            lead_company:      lead_company     || null,
            interest:          interest         || null,
            fulfillment_mode:  fulfillmentMode,
            preferred_date:    preferred_date   || null,
            preferred_time:    preferred_time   || null,
            service_requested: service_requested || null,
            lead_notes:        finalLeadNotes,
            custom_fields:     (custom_fields && Object.keys(custom_fields).length > 0) ? custom_fields : null,
            estimated_total:   estimatedTotal,
            delivery_fee:      deliveryFee,
            items:             leadCart?.items ?? fallbackItems ?? null,
            location_link:     locationLink     || null,
        }

        // Idempotent par CYCLE, pas par conversation. Une même conversation peut redéclencher
        // capture_lead plusieurs fois dans le même cycle (client qui corrige son numéro,
        // filet de sécurité qui rappelle l'outil) — on met alors à jour le lead existant au
        // lieu d'en créer un doublon.
        //
        // Mais après le récap final, le cycle est clos et un nouveau peut s'ouvrir : le
        // client commande autre chose. Ce doit être un lead SÉPARÉ. Sans le filtre de date
        // ci-dessous, cette seconde demande écrasait purement et simplement la première —
        // « 5 goube enfant Rouge / 47 000 » devenait « 3 sac enfant Noir / 23 000 », sans
        // trace ni alerte, et le marchand rappelait le client au sujet de la mauvaise
        // commande. session_anchor_at est reposé à chaque clôture (message.js), il borne
        // donc exactement le cycle courant.
        let isNewLead = true
        if (conversationId) {
            let existingLeadQuery = supabase
                .from('leads')
                .select('id')
                .eq('conversation_id', conversationId)
            if (cycleStartedAt) {
                existingLeadQuery = existingLeadQuery.gte('created_at', cycleStartedAt)
            }
            // Sans ancre (conversations antérieures à cette mécanique), la requête garde
            // exactement sa forme d'origine et son comportement d'origine. Si plusieurs leads
            // coexistaient malgré tout sur une telle conversation, maybeSingle ne renverrait
            // rien et on insérerait un nouveau lead — jamais on n'en écraserait un au hasard.
            const { data: existingLead } = await existingLeadQuery.maybeSingle()

            if (existingLead) {
                isNewLead = false
                const { error: updateErr } = await supabase.from('leads').update(leadRow).eq('id', existingLead.id)
                if (updateErr) {
                    console.error('capture_lead: erreur mise à jour', updateErr)
                    return JSON.stringify({ success: false, error: 'Erreur mise à jour lead' })
                }
            }
        }

        if (isNewLead) {
            const { error } = await supabase.from('leads').insert(leadRow)
            if (error) {
                console.error('capture_lead: erreur insertion', error)
                return JSON.stringify({ success: false, error: 'Erreur enregistrement lead' })
            }
        }

        // 🔔 NOTIFICATION: Nouveau lead uniquement (non-bloquant) — pas de notification
        // répétée à chaque mise à jour du même lead.
        if (isNewLead) {
            try {
                const { notify } = require('../../../notifications/notify')
                notify(agent.user_id, 'new_lead', {
                    contactName: lead_name || undefined,
                    contactPhone: lead_phone || undefined,
                    agentName: agent.name,
                })
            } catch (notifyError) {
                console.error('🔔 new_lead notification error (non-blocking):', notifyError)
            }
        }

        return JSON.stringify({
            success: true,
            action:  'capture_lead',
            message: 'Lead enregistré avec succès',
        })
    } catch (err) {
        console.error('capture_lead: erreur inattendue', err)
        return JSON.stringify({ success: false, error: 'Erreur interne' })
    }
}

module.exports = { handleCaptureLead, buildItemsFromLeadState }
