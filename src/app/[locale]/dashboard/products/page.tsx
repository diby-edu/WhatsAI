'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Package, Plus, Search, Edit2, Trash2, Loader2,
    ImageIcon, Check, X, DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations, useFormatter } from 'next-intl'

interface Variant {
    id: string
    name: string
    type: 'fixed' | 'additive'
    options: { name: string; price: number }[]
}

interface Product {
    id: string
    name: string
    description: string | null
    price_fcfa: number
    category: string | null
    image_url: string | null
    is_available: boolean
    stock_quantity: number
    variants: Variant[] | null
    agent_id: string | null
    created_at: string
}

interface Agent {
    id: string
    name: string
}

export default function ProductsPage() {
    const t = useTranslations('Products.List')
    const format = useFormatter()
    const router = useRouter()
    const [products, setProducts] = useState<Product[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [agentFilter, setAgentFilter] = useState<string>('all')

    useEffect(() => {
        fetchProducts()
    }, [])

    const [currency, setCurrency] = useState('USD')

    useEffect(() => {
        fetchProducts()
        fetchProfile()
        fetchAgents()
    }, [])

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/agents')
            const data = await res.json()
            if (data.data?.agents) {
                setAgents(data.data.agents)
            }
        } catch (e) {
            console.error('Error fetching agents', e)
        }
    }

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/profile')
            const data = await res.json()
            if (data.data?.profile?.currency) {
                setCurrency(data.data.profile.currency)
            }
        } catch (e) {
            console.error('Error fetching profile currency', e)
        }
    }

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/products')
            const data = await res.json()
            if (data.data?.products) {
                setProducts(data.data.products)
            }
        } catch (err) {
            console.error('Error fetching products:', err)
        } finally {
            setLoading(false)
        }
    }

    const deleteProduct = async (id: string) => {
        if (!confirm(t('delete_confirm'))) return

        try {
            await fetch(`/api/products/${id}`, { method: 'DELETE' })
            setProducts(products.filter(p => p.id !== id))
        } catch (err) {
            console.error('Error deleting product:', err)
        }
    }

    const filteredProducts = products.filter(p => {
        // Filter by search term
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.category?.toLowerCase().includes(searchTerm.toLowerCase())

        // Filter by agent
        const matchesAgent = agentFilter === 'all' || p.agent_id === agentFilter

        return matchesSearch && matchesAgent
    })

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: currency === 'XOF' ? 0 : 2
        }).format(price)
    }

    // Calculate display price range based on variants
    const getDisplayPrice = (product: Product): { minPrice: number; maxPrice: number; hasVariants: boolean } => {
        const variants = product.variants || []
        const fixedVariant = variants.find(v => v.type === 'fixed')

        if (fixedVariant && fixedVariant.options.length > 0) {
            const prices = fixedVariant.options.map(o => o.price).filter(p => p > 0)
            if (prices.length > 0) {
                return {
                    minPrice: Math.min(...prices),
                    maxPrice: Math.max(...prices),
                    hasVariants: true
                }
            }
        }

        return { minPrice: product.price_fcfa, maxPrice: product.price_fcfa, hasVariants: variants.length > 0 }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>{t('title')}</h1>
                    <p style={{ color: '#94a3b8' }}>{t('count', { count: products.length })}</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b' }} />
                        <input
                            placeholder={t('search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                padding: '12px 12px 12px 44px',
                                borderRadius: 12,
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: 'white',
                                width: '100%',
                                maxWidth: 200,
                                minWidth: 120
                            }}
                        />
                    </div>

                    {/* Agent Filter */}
                    {agents.length > 0 && (
                        <select
                            value={agentFilter}
                            onChange={(e) => setAgentFilter(e.target.value)}
                            style={{
                                padding: '12px 14px',
                                borderRadius: 12,
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: 'white',
                                cursor: 'pointer',
                                minWidth: 160
                            }}
                        >
                            <option value="all" style={{ background: '#1e293b' }}>Tous les agents</option>
                            {agents.map(agent => (
                                <option key={agent.id} value={agent.id} style={{ background: '#1e293b' }}>
                                    {agent.name}
                                </option>
                            ))}
                        </select>
                    )}
                    <Link
                        href="/dashboard/products/new"
                        style={{
                            padding: '12px 20px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: 'white',
                            borderRadius: 12,
                            textDecoration: 'none',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <Plus size={20} />
                        {t('add')}
                    </Link>
                </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
                <div style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 16,
                    padding: 48,
                    textAlign: 'center'
                }}>
                    <Package style={{ width: 48, height: 48, color: '#64748b', margin: '0 auto 16px' }} />
                    <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 8 }}>{t('empty.title')}</h3>
                    <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
                        {t('empty.message')}
                    </p>
                    <Link
                        href="/dashboard/products/new"
                        style={{
                            padding: '12px 24px',
                            background: '#10b981',
                            color: 'white',
                            borderRadius: 12,
                            textDecoration: 'none',
                            fontWeight: 600
                        }}
                    >
                        {t('empty.button')}
                    </Link>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 20
                }}>
                    {filteredProducts.map((product, i) => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            style={{
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                borderRadius: 16,
                                overflow: 'hidden'
                            }}
                        >
                            {/* Image */}
                            <div style={{
                                height: 160,
                                background: product.image_url
                                    ? `url(${product.image_url}) center/cover`
                                    : 'rgba(15, 23, 42, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {!product.image_url && (
                                    <ImageIcon style={{ width: 40, height: 40, color: '#475569' }} />
                                )}
                            </div>

                            {/* Content */}
                            <div style={{ padding: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>{product.name}</h3>
                                    <span style={{
                                        padding: '4px 10px',
                                        borderRadius: 100,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        background: product.is_available ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                        color: product.is_available ? '#34d399' : '#f87171'
                                    }}>
                                        {product.is_available ? t('status.available') : t('status.unavailable')}
                                    </span>
                                </div>

                                {product.category && (
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '4px 10px',
                                        borderRadius: 6,
                                        fontSize: 12,
                                        background: 'rgba(168, 85, 247, 0.15)',
                                        color: '#c084fc',
                                        marginBottom: 12
                                    }}>
                                        {product.category}
                                    </span>
                                )}

                                <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
                                    {product.description?.substring(0, 80) || t('no_description')}
                                    {product.description && product.description.length > 80 && '...'}
                                </p>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    {(() => {
                                        const { minPrice, maxPrice, hasVariants } = getDisplayPrice(product)
                                        return (
                                            <span style={{ fontSize: 18, fontWeight: 700, color: '#34d399' }}>
                                                {hasVariants && minPrice !== maxPrice ? (
                                                    <>
                                                        <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>De </span>
                                                        {formatPrice(minPrice)}
                                                        <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}> à </span>
                                                        {formatPrice(maxPrice)}
                                                    </>
                                                ) : (
                                                    formatPrice(minPrice)
                                                )}
                                            </span>
                                        )
                                    })()}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={() => router.push(`/dashboard/products/${product.id}`)}
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 10,
                                                background: 'rgba(59, 130, 246, 0.15)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Edit2 style={{ width: 16, height: 16, color: '#3b82f6' }} />
                                        </button>
                                        <button
                                            onClick={() => deleteProduct(product.id)}
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 10,
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Trash2 style={{ width: 16, height: 16, color: '#f87171' }} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
