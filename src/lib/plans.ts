// Subscription plans configuration
export const PLANS = {
    free: {
        id: 'free',
        name: 'Gratuit',
        price: 0,
        credits: 100,
        agents: 1,
        whatsapp_connections: 1,
        features: [
            '100 messages/mois',
            '1 agent IA',
            '1 numéro WhatsApp',
            'Réponses automatiques basiques',
            'Support email',
        ],
        model: 'gpt-4o-mini',
    },
    starter: {
        id: 'starter',
        name: 'Starter',
        price: 15000, // FCFA
        credits: 2000,
        agents: 1,
        whatsapp_connections: 1,
        features: [
            '2 000 messages/mois',
            '1 agent IA',
            '1 numéro WhatsApp',
            'Qualification de leads',
            'Historique illimité',
            'Support prioritaire',
        ],
        model: 'gpt-4o-mini',
        popular: false,
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 35000, // FCFA
        credits: 5000,
        agents: 2,
        whatsapp_connections: 2,
        features: [
            '5 000 messages/mois',
            '2 agents IA',
            '2 numéros WhatsApp',
            'GPT-4 disponible',
            'Base de connaissances',
            'Analytics avancés',
            'Support prioritaire',
        ],
        model: 'gpt-4o',
        popular: true,
    },
    business: {
        id: 'business',
        name: 'Business',
        price: 85000, // FCFA
        credits: 30000,
        agents: 4,
        whatsapp_connections: 4,
        features: [
            '30 000 messages/mois',
            '4 agents IA',
            '4 numéros WhatsApp',
            'GPT-4 Turbo',
            'API personnalisée',
            'Webhooks',
            'Intégrations CRM',
            'Account manager dédié',
        ],
        model: 'gpt-4-turbo',
        popular: false,
    },
}

// Credit packs for additional purchases
export const CREDIT_PACKS = [
    { id: 'pack_500', credits: 500, price: 5000, savings: 0 },
    { id: 'pack_1000', credits: 1000, price: 9000, savings: 10 },
    { id: 'pack_2500', credits: 2500, price: 20000, savings: 20 },
    { id: 'pack_5000', credits: 5000, price: 35000, savings: 30 },
]

export type PlanId = keyof typeof PLANS
export type Plan = typeof PLANS[PlanId]
export type CreditPack = typeof CREDIT_PACKS[number]
