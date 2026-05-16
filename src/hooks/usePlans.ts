'use client'

import { useState, useEffect } from 'react'

export interface Plan {
    id: string
    name: string
    price_fcfa: number
    credits: number
    max_agents: number
    max_whatsapp_numbers: number
    is_popular: boolean
    description: string
}

export const FALLBACK_PLANS: Plan[] = [
    { id: 'free', name: 'Gratuit', price_fcfa: 0, credits: 10, max_agents: 1, max_whatsapp_numbers: 1, is_popular: false, description: 'Pour tester la plateforme' },
    { id: 'starter', name: 'Starter', price_fcfa: 6900, credits: 500, max_agents: 1, max_whatsapp_numbers: 1, is_popular: false, description: '500 crédits · 1 agent' },
    { id: 'pro', name: 'Pro', price_fcfa: 19900, credits: 2500, max_agents: 3, max_whatsapp_numbers: 3, is_popular: true, description: '2 500 crédits · 3 agents' },
    { id: 'business', name: 'Business', price_fcfa: 54900, credits: 8000, max_agents: 6, max_whatsapp_numbers: 6, is_popular: false, description: '8 000 crédits · 6 agents' },
    { id: 'scale', name: 'Scale', price_fcfa: 129900, credits: 20000, max_agents: -1, max_whatsapp_numbers: -1, is_popular: false, description: '20 000 crédits · Agents illimités' },
]

export function usePlans(): Plan[] {
    const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS)

    useEffect(() => {
        fetch('/api/plans')
            .then(res => res.json())
            .then(data => {
                if (data.plans && data.plans.length > 0) {
                    const formatted: Plan[] = data.plans.map((p: Record<string, unknown>) => ({
                        id: (p.id as string) || 'unknown',
                        name: (p.name as string) || 'Plan',
                        price_fcfa: typeof p.price === 'number' ? p.price : ((p.price_fcfa as number) || 0),
                        credits: (p.credits_included as number) || (p.credits as number) || 0,
                        max_agents: (p.max_agents as number) ?? 1,
                        max_whatsapp_numbers: (p.max_whatsapp_numbers as number) ?? 1,
                        is_popular: (p.is_popular as boolean) || false,
                        description: (p.description as string) || '',
                    }))

                    const hasFree = formatted.some(p => p.price_fcfa === 0 || p.id === 'free' || p.name.toLowerCase().includes('gratuit') || p.name.toLowerCase().includes('free'))
                    if (!hasFree) {
                        const fallbackFree = FALLBACK_PLANS.find(p => p.id === 'free')
                        if (fallbackFree) formatted.unshift(fallbackFree)
                    }

                    const hasScale = formatted.some(p => p.name.toLowerCase().includes('scale'))
                    if (!hasScale) {
                        const fallbackScale = FALLBACK_PLANS.find(p => p.id === 'scale')
                        if (fallbackScale) formatted.push(fallbackScale)
                    }

                    setPlans(formatted)
                }
            })
            .catch(() => { })
    }, [])

    return plans
}
