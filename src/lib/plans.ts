// Subscription plans configuration (prices in FCFA)
export const PLANS = {
    free: {
        id: 'free',
        name: 'Gratuit',
        price: 0,
        credits: 10,
        agents: 1,
        whatsapp_connections: 1,
        model: 'gpt-4o-mini',
    },
    starter: {
        id: 'starter',
        name: 'Starter',
        price: 6900, // FCFA
        credits: 500,
        agents: 1,
        whatsapp_connections: 1,
        model: 'gpt-4o-mini',
        popular: false,
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 19900, // FCFA
        credits: 2500,
        agents: 3,
        whatsapp_connections: 3,
        model: 'gpt-4o-mini',
        popular: true,
    },
    business: {
        id: 'business',
        name: 'Business',
        price: 54900, // FCFA
        credits: 8000,
        agents: 6,
        whatsapp_connections: 6,
        model: 'gpt-4o-mini',
        popular: false,
    },
    scale: {
        id: 'scale',
        name: 'Scale',
        price: 129900, // FCFA
        credits: 20000,
        agents: -1, // unlimited
        whatsapp_connections: -1, // unlimited
        model: 'gpt-4o-mini',
        popular: false,
    },
}

// Credit packs for additional purchases (prices in FCFA)
// Crédits réduits pour que l'abonnement reste toujours meilleur rapport qualité/prix
export const CREDIT_PACKS = [
    { id: 'boost_mini', name: 'Boost Mini', credits: 200,   price: 3000,   savings: 0 },
    { id: 'boost_s',    name: 'Boost S',    credits: 400,   price: 7000,   savings: 0 },
    { id: 'boost_m',    name: 'Boost M',    credits: 1800,  price: 25000,  savings: 0 },
    { id: 'boost_l',    name: 'Boost L',    credits: 4500,  price: 55000,  savings: 0 },
    { id: 'boost_xl',   name: 'Boost XL',   credits: 11000, price: 110000, savings: 0 },
]

export type PlanId = keyof typeof PLANS
export type Plan = typeof PLANS[PlanId]
export type CreditPack = typeof CREDIT_PACKS[number]
