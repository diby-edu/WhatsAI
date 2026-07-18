export function buildOrderStatusTimestamps(status: string): Record<string, any> {
    const fields: Record<string, any> = {}

    if (status === 'confirmed') fields.confirmed_at = new Date().toISOString()
    if (status === 'paid') fields.paid_at = new Date().toISOString()
    if (status === 'shipped') fields.shipped_at = new Date().toISOString()
    if (status === 'delivered') fields.delivered_at = new Date().toISOString()
    if (status === 'cancelled') fields.cancelled_at = new Date().toISOString()

    if (status === 'paid') {
        fields.payment_verification_status = 'verified'
    }

    return fields
}

export function buildOrderPaymentConfirmationMessage(orderId: string, totalAmountFcfa: number): string {
    return `✅ *Paiement confirme !*\n\nVotre paiement de ${totalAmountFcfa} FCFA a ete verifie et accepte.\n\n🎉 Commande #${orderId.substring(0, 8)} confirmee !\n\nMerci pour votre confiance. Nous allons traiter votre commande dans les plus brefs delais.`
}
