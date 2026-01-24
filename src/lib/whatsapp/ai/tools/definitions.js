
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
                    customer_phone: { type: 'string', description: 'Numéro de téléphone' },
                    delivery_address: { type: 'string', description: 'Adresse de livraison complète' },
                    email: { type: 'string', description: 'Email (requis pour produits numériques)' },
                    payment_method: { type: 'string', enum: ['online', 'cod'], description: 'Mode de paiement' },
                    notes: { type: 'string', description: 'Instructions spéciales' }
                },
                required: ['items', 'customer_name', 'customer_phone']
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
            description: 'Créer une réservation pour un service (hôtel, restaurant, salon, consulting, etc.).',
            parameters: {
                type: 'object',
                properties: {
                    booking_type: { type: 'string', description: 'Type de réservation: "stay" (hôtel), "table" (restaurant), "slot" (rdv), "rental" (location)' },
                    service_name: { type: 'string', description: 'Nom du service/produit dans le catalogue (ex: "Chambres", "Menu Gourmet")' },
                    selected_variant: { type: 'string', description: 'Variante choisie (ex: "Suite", "VIP", "Menu Découverte") - OBLIGATOIRE si le service a des variantes' },
                    customer_phone: { type: 'string', description: 'Téléphone du client (avec indicatif)' },
                    customer_name: { type: 'string', description: 'Nom du client' },
                    preferred_date: { type: 'string', description: 'Date de début (YYYY-MM-DD)' },
                    preferred_time: { type: 'string', description: 'Heure (HH:MM) - pour table/slot' },
                    end_date: { type: 'string', description: 'Date de fin (YYYY-MM-DD) - pour stay/rental' },
                    party_size: { type: 'number', description: 'Nombre de personnes/couverts' },
                    selected_supplements: { type: 'object', description: 'Suppléments choisis (ex: {"Petit déjeuner": true, "Deuxième lit": true})' },
                    notes: { type: 'string', description: 'Demandes spéciales (allergies, préférences, etc.)' }
                },
                required: ['booking_type', 'service_name', 'customer_phone', 'customer_name', 'preferred_date']
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
                    phone_number: { type: 'string', description: 'Numéro de téléphone du client' }
                },
                required: ['phone_number']
            }
        }
    }
]

module.exports = { TOOLS }
