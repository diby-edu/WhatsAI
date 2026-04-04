
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'create_order',
            description: `Créer une commande pour un client.

IMPORTANT - VARIANTES :
- Si un produit a des variantes (taille, couleur, etc.), tu DOIS les spécifier dans 'selected_variants'
- Collecte TOUTES les variantes AVANT d'appeler cette fonction
- Exemple: selected_variants: {"Taille": "Petite", "Couleur": "Bleu"}
- Les noms courts suffisent: "Petite" matchera "Petite (50g)"`,
            parameters: {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                product_name: {
                                    type: 'string',
                                    description: 'Nom du produit (sans les variantes)'
                                },
                                quantity: {
                                    type: 'integer',
                                    description: 'Quantité'
                                },
                                selected_variants: {
                                    type: 'object',
                                    description: 'Variantes sélectionnées. Ex: {"Taille": "Petite", "Couleur": "Rouge"}',
                                    additionalProperties: { type: 'string' }
                                }
                            },
                            required: ['product_name', 'quantity']
                        }
                    },
                    customer_name: { type: 'string', description: 'Nom complet du client' },
                    customer_phone: {
                        type: 'string',
                        description: 'Numéro de téléphone avec indicatif pays obligatoire. Exemples valides : 2250701020304, +2250701020304, 002250701020304. Ne jamais utiliser le format local sans indicatif (ex: 0701020304).'
                    },
                    delivery_address: { type: 'string', description: 'Adresse de livraison complète (obligatoire pour les produits physiques)' },
                    email: { type: 'string', description: 'Email (requis pour produits numériques)' },
                    payment_method: { type: 'string', enum: ['online', 'cod'], description: 'Mode de paiement. Obligatoire avant create_order.' },
                    notes: { type: 'string', description: 'Instructions spéciales' }
                },
                required: ['items', 'customer_name', 'customer_phone', 'payment_method']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'check_payment_status',
            description: 'Vérifier le statut d\'une commande.',
            parameters: {
                type: 'object',
                properties: {
                    order_id: { type: 'string', description: 'ID de la commande (UUID)' }
                },
                required: ['order_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'send_image',
            description: 'Envoyer l\'image d\'un produit au client.',
            parameters: {
                type: 'object',
                properties: {
                    product_name: { type: 'string', description: 'Nom du produit' },
                    selected_variants: {
                        type: 'object',
                        description: 'Variantes sélectionnées. Ex: {"Couleur": "Rouge"}',
                        additionalProperties: { type: 'string' }
                    },
                    variant_value: { type: 'string', description: 'OBSOLÈTE (Utiliser selected_variants)' }
                },
                required: ['product_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_booking',
            description: 'Créer une réservation pour un service (hôtel, restaurant, salon, consulting, formation, etc.).',
            parameters: {
                type: 'object',
                properties: {
                    booking_type: { type: 'string', description: 'Type de réservation: "stay" (hôtel), "table" (restaurant), "slot" (rdv), "rental" (location), "inscription" (formation/atelier sans date fixe)' },
                    service_name: { type: 'string', description: 'Nom du service/produit dans le catalogue (ex: "Chambres", "Menu Gourmet")' },
                    selected_variant: { type: 'string', description: 'Champ legacy: variante principale choisie si une seule variante fixe est necessaire.' },
                    selected_variants: {
                        type: 'object',
                        description: 'Variantes fixes selectionnees pour le service. Ex: {"Type de chambre": "Suite", "Vue": "Mer"}',
                        additionalProperties: { type: 'string' }
                    },
                    customer_phone: {
                        type: 'string',
                        description: 'Téléphone du client avec indicatif pays obligatoire. Exemples valides : 2250701020304, +2250701020304, 002250701020304. Ne jamais utiliser le format local sans indicatif (ex: 0701020304).'
                    },
                    customer_name: { type: 'string', description: 'Nom du client' },
                    preferred_date: { type: 'string', description: 'Date de début (YYYY-MM-DD)' },
                    preferred_time: { type: 'string', description: 'Heure (HH:MM) - pour table/slot' },
                    end_date: { type: 'string', description: 'Date de fin (YYYY-MM-DD) - pour stay/rental' },
                    party_size: { type: 'number', description: 'Nombre de personnes/couverts' },
                    payment_method: {
                        type: 'string',
                        enum: ['online', 'onsite'],
                        description: 'Mode de paiement pour les réservations qui le demandent. Utiliser "online" pour paiement en ligne, "onsite" pour paiement sur place / à l arrivée / au retrait.'
                    },
                    selected_supplements: { type: 'object', description: 'Suppléments choisis (ex: {"Petit déjeuner": true, "Deuxième lit": true})' },
                    notes: { type: 'string', description: 'Demandes spéciales (allergies, préférences, etc.)' }
                },
                required: ['booking_type', 'service_name', 'customer_phone', 'customer_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'find_order',
            description: 'Trouver les dernières commandes d\'un client par son numéro de téléphone.',
            parameters: {
                type: 'object',
                properties: {
                    phone_number: {
                        type: 'string',
                        description: 'Numéro de téléphone du client avec indicatif pays obligatoire. Exemples valides : 2250701020304, +2250701020304, 002250701020304. Ne jamais utiliser le format local sans indicatif (ex: 0701020304).'
                    }
                },
                required: ['phone_number']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_restaurant_checkout',
            description: 'Créer un checkout restaurant unifié. Utiliser ce tool pour sur place, réservation simple, emporté ou livraison. Ne jamais appeler create_order ou create_booking depuis un flow restaurant.',
            parameters: {
                type: 'object',
                properties: {
                    fulfillment_mode: {
                        type: 'string',
                        enum: ['dine_in', 'booking_only', 'takeaway', 'delivery'],
                        description: 'Mode restaurant : dine_in, booking_only, takeaway ou delivery.'
                    },
                    items: {
                        type: 'array',
                        description: 'Articles restaurant. Obligatoire pour takeaway/delivery, optionnel pour dine_in, vide pour booking_only.',
                        items: {
                            type: 'object',
                            properties: {
                                product_name: { type: 'string', description: 'Nom du plat ou de la boisson dans le catalogue restaurant.' },
                                quantity: { type: 'integer', description: 'Quantité demandée.' }
                            },
                            required: ['product_name', 'quantity']
                        }
                    },
                    customer_name: { type: 'string', description: 'Nom complet du client.' },
                    customer_phone: {
                        type: 'string',
                        description: 'Téléphone du client avec indicatif pays obligatoire.'
                    },
                    scheduled_date: { type: 'string', description: 'Date souhaitée (YYYY-MM-DD). Requise pour dine_in et booking_only.' },
                    scheduled_time: { type: 'string', description: 'Heure souhaitée (HH:MM). Requise pour dine_in et booking_only.' },
                    party_size: { type: 'integer', description: 'Nombre de personnes. Requis pour dine_in et booking_only.' },
                    delivery_address: { type: 'string', description: 'Adresse de livraison. Requise pour delivery.' },
                    payment_method: {
                        type: 'string',
                        enum: ['online', 'onsite'],
                        description: 'Mode de paiement. Pour takeaway: online ou onsite (= au retrait). Pour delivery: online ou onsite (= a la livraison). Pour dine_in/booking_only: online ou onsite (= sur place).'
                    },
                    notes: { type: 'string', description: 'Notes ou demandes particulières.' }
                },
                required: ['fulfillment_mode', 'customer_name', 'customer_phone', 'payment_method']
            }
        }
    }
    ,
    {
        type: 'function',
        function: {
            name: 'capture_lead',
            description: `Enregistrer les coordonnées d'un client intéressé (lead) pour un suivi commercial.
Utiliser UNIQUEMENT en mode Support Client quand lead_collection_enabled est actif.
Appeler APRÈS avoir collecté les informations demandées, une question à la fois.
Ne jamais inventer des informations — collecter uniquement ce que le client a fourni.
Ne pas appeler si le client pose juste une question simple sans intention d'achat/inscription.`,
            parameters: {
                type: 'object',
                properties: {
                    lead_name: {
                        type: 'string',
                        description: 'Prénom ou nom complet du client'
                    },
                    lead_phone: {
                        type: 'string',
                        description: 'Numéro de téléphone du client avec indicatif pays'
                    },
                    lead_email: {
                        type: 'string',
                        description: 'Adresse email du client'
                    },
                    interest: {
                        type: 'string',
                        description: 'Ce que le client recherche — résumé court (ex: "Formation Excel", "Villa Cocody 4 chambres")'
                    }
                },
                required: []
            }
        }
    }
]

module.exports = { TOOLS }
