export function aggregateSalesByDate(recentOrders: { created_at: string; total_fcfa: number | null }[] | null) {
    const salesByDate: Record<string, number> = {}
    recentOrders?.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        salesByDate[date] = (salesByDate[date] || 0) + (order.total_fcfa || 0)
    })

    return Object.keys(salesByDate).map(date => ({
        date,
        sales: salesByDate[date]
    }))
}

export function aggregateTopProducts(
    orderItems: { quantity: number | null; total_price: number | null; product: { name: string } | null }[] | null
) {
    if (!orderItems || orderItems.length === 0) return []

    // Aggregate by product name
    const productMap: Record<string, { quantity: number; revenue: number }> = {}
    for (const item of orderItems) {
        const name = (item.product as any)?.name || 'Produit inconnu'
        if (!productMap[name]) {
            productMap[name] = { quantity: 0, revenue: 0 }
        }
        productMap[name].quantity += item.quantity || 1
        productMap[name].revenue += item.total_price || 0
    }

    return Object.entries(productMap)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
}
