import { getFeexPayDefaultNetwork } from '@/lib/payments/feexpay'
import { getFeexPayNetworkOption, resolveFeexPaySelection } from '@/lib/payments/feexpay-networks'

export type FeexPaySelectionResult =
    | { ok: true; countryCode: string; networkCode: string; networkLabel: string | null }
    | { ok: false; reason: 'NETWORK_COUNTRY_MISMATCH' | 'INCOMPLETE_SELECTION' }

export function resolveAndValidateFeexPaySelection(params: {
    country?: string
    network?: string
    phone: string
}): FeexPaySelectionResult {
    const selection = resolveFeexPaySelection({
        country: params.country,
        network: params.network,
        phone: params.phone,
        defaultNetwork: getFeexPayDefaultNetwork(),
    })

    if (selection.error === 'NETWORK_COUNTRY_MISMATCH') {
        return { ok: false, reason: 'NETWORK_COUNTRY_MISMATCH' }
    }

    if (!selection.networkCode || !selection.countryCode) {
        return { ok: false, reason: 'INCOMPLETE_SELECTION' }
    }

    const networkOption = getFeexPayNetworkOption(selection.networkCode)
    return {
        ok: true,
        countryCode: selection.countryCode,
        networkCode: selection.networkCode,
        networkLabel: networkOption?.label || selection.networkCode,
    }
}

export function buildSubscriptionPaymentDetails(
    plan: { name: string; price_fcfa: number; credits_included: number },
    planId: string,
    userId: string
) {
    return {
        amount: plan.price_fcfa,
        description: `Abonnement WazzapAI - ${plan.name}`,
        metadata: {
            type: 'subscription' as const,
            plan_id: planId,
            plan_name: plan.name,
            user_id: userId,
            credits: plan.credits_included,
        },
    }
}

const DEFAULT_CREDIT_PACKS = [
    { id: 'boost_mini', credits: 200, price: 3000 },
    { id: 'boost_s', credits: 400, price: 7000 },
    { id: 'boost_m', credits: 1800, price: 25000 },
    { id: 'boost_l', credits: 4500, price: 55000 },
    { id: 'boost_xl', credits: 11000, price: 110000 },
]

// pack === null means "not found or DB error" — caller decides that upstream,
// this function only handles the fallback-to-defaults branching.
export function resolveCreditPackPaymentDetails(
    pack: { credits: number; price: number } | null,
    packId: string,
    userId: string
): { amount: number; description: string; metadata: Record<string, any> } | null {
    if (pack) {
        return {
            amount: pack.price,
            description: `Pack de ${pack.credits} crédits WazzapAI`,
            metadata: {
                type: 'credits' as const,
                pack_id: packId,
                user_id: userId,
                credits: pack.credits,
            },
        }
    }

    const fallbackPack = DEFAULT_CREDIT_PACKS.find(p => p.id === packId)
    if (!fallbackPack) return null

    return {
        amount: fallbackPack.price,
        description: `Pack de ${fallbackPack.credits} crédits WazzapAI`,
        metadata: {
            type: 'credits' as const,
            pack_id: packId,
            user_id: userId,
            credits: fallbackPack.credits,
        },
    }
}
