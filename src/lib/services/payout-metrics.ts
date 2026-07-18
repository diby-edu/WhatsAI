interface PaidOrder {
    total_fcfa: number | null
    agent_id: string | null
    agents: { user_id: string | null } | null
}

interface CompletedPayout {
    user_id: string | null
    net_amount: number | null
    commission_amount: number | null
}

interface MerchantProfile {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
}

export function calculateMerchantBalances({
    paidOrders,
    completedPayouts,
    merchantProfiles,
    merchantIds,
}: {
    paidOrders: PaidOrder[] | null
    completedPayouts: CompletedPayout[] | null
    merchantProfiles: MerchantProfile[] | null | undefined
    merchantIds: (string | undefined)[]
}) {
    return merchantIds.map(userId => {
        const merchantOrders = (paidOrders || []).filter((o: any) => o.agents?.user_id === userId)

        const totalCollected = merchantOrders.reduce((sum: number, o: any) => sum + (o.total_fcfa || 0), 0)

        const totalPaidOut = (completedPayouts || [])
            .filter(p => p.user_id === userId)
            .reduce((sum, p) => sum + (p.net_amount || 0), 0)

        const totalCommission = (completedPayouts || [])
            .filter(p => p.user_id === userId)
            .reduce((sum, p) => sum + (p.commission_amount || 0), 0)

        const merchantProfile = merchantProfiles?.find(m => m.id === userId)

        return {
            user_id: userId,
            full_name: merchantProfile?.full_name || 'Inconnu',
            email: merchantProfile?.email || '',
            phone: merchantProfile?.phone || '',
            total_collected: totalCollected,
            total_paid_out: totalPaidOut,
            total_commission: totalCommission,
            balance_due: totalCollected - totalPaidOut - totalCommission,
            orders_count: merchantOrders.length
        }
    }).sort((a, b) => b.balance_due - a.balance_due)
}

export function formatPayoutHistory(payouts: any[] | null) {
    return (payouts || []).map((p: any) => ({
        ...p,
        merchant_name: p.merchant?.full_name || 'Inconnu',
        merchant_email: p.merchant?.email || '',
        processed_by_name: p.processor?.full_name || null,
        merchant: undefined,
        processor: undefined
    }))
}

export function calculateCommission(grossAmount: number, commissionRate: number) {
    const commission_amount = Math.round(grossAmount * (commissionRate / 100))
    const net_amount = grossAmount - commission_amount
    return { commission_amount, net_amount }
}
