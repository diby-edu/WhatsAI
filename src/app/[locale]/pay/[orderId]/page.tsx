'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2, CheckCircle, CreditCard, ShoppingBag } from 'lucide-react'
import { motion } from 'framer-motion'

export default function OrderPaymentPage() {
    const params = useParams()
    const [loading, setLoading] = useState(true)
    const [order, setOrder] = useState<any>(null)
    const [items, setItems] = useState<any[]>([])
    const [status, setStatus] = useState<'pending' | 'processing' | 'success' | 'error'>('pending')
    const [error, setError] = useState('')

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    useEffect(() => {
        fetchOrder()
    }, [params.orderId])

    const fetchOrder = async () => {
        try {
            const { data: order, error } = await supabase
                .from('orders')
                .select('*')
                .eq('id', params.orderId)
                .single()

            if (error) throw error

            const { data: items } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', order.id)

            setOrder(order)
            setItems(items || [])
            if (order.status === 'paid') setStatus('success')

        } catch (err) {
            console.error('Error fetching order:', err)
            setError('Commande introuvable')
        } finally {
            setLoading(false)
        }
    }

    const handlePayment = async () => {
        setStatus('processing')

        // MOCK PAYMENT PROCESS
        // In real world, we would redirect to CinetPay/Stripe here
        try {
            await new Promise(r => setTimeout(r, 2000)) // Simulate network delay

            const { error } = await supabase
                .from('orders')
                .update({ status: 'paid' })
                .eq('id', order.id)

            if (error) throw error
            setStatus('success')
        } catch (err) {
            console.error('Payment failed:', err)
            setStatus('error')
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    if (error || !order) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white p-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">Oups !</h1>
                    <p className="text-slate-400">{error || 'Erreur inconnue'}</p>
                </div>
            </div>
        )
    }

    if (status === 'success') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white p-4">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center"
                >
                    <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
                    <h1 className="text-2xl font-bold mb-2">Paiement Réussi !</h1>
                    <p className="text-slate-400 mb-6">Merci pour votre commande.</p>
                    <div className="bg-slate-950/50 rounded-xl p-4 mb-6 text-left">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">Commande</span>
                            <span className="font-mono">#{order.id.substring(0, 8)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span className="text-emerald-400">{order.total_fcfa?.toLocaleString('fr-FR')} FCFA</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 flex items-center justify-center">
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-md"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ShoppingBag className="w-8 h-8 text-blue-500" />
                    </div>
                    <h1 className="text-2xl font-bold">Résumé de la commande</h1>
                    <p className="text-slate-400">Total à payer</p>
                    <div className="text-4xl font-bold text-white mt-2">
                        {order.total_fcfa?.toLocaleString('fr-FR')} <span className="text-lg text-slate-500">FCFA</span>
                    </div>
                </div>

                {/* List */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-6">
                    <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                        <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">Articles</h3>
                    </div>
                    <div className="divide-y divide-slate-800">
                        {items.map((item: any, i: number) => (
                            <div key={i} className="p-4 flex justify-between items-center">
                                <div>
                                    <div className="font-medium">{item.product_name}</div>
                                    <div className="text-sm text-slate-500">Quantité: {item.quantity}</div>
                                </div>
                                <div className="text-right">
                                    {(item.unit_price_fcfa * item.quantity).toLocaleString('fr-FR')} FCFA
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Delivery */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-8">
                    <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-2">Livraison</h3>
                    <p>{order.delivery_address || 'Pas d\'adresse spécifiée'}</p>
                </div>

                {/* Button */}
                <button
                    onClick={handlePayment}
                    disabled={status === 'processing'}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {status === 'processing' ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>
                            <CreditCard className="w-6 h-6" />
                            Payer Maintenant
                        </>
                    )}
                </button>
            </motion.div>
        </div>
    )
}
