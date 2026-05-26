'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Package, Plus, Search, Edit2, Trash2, Loader2,
    ImageIcon, CheckSquare, Square, X
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations, useFormatter } from 'next-intl'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useToast } from '@/components/ui/Toast'

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
    product_type: string | null
    created_at: string
}

interface Agent {
    id: string
    name: string
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
    product: 'Physique',
    digital: 'Numérique',
    service: 'Service',
}

export default function ProductsPage() {
    const t = useTranslations('Products.List')
    const format = useFormatter()
    const router = useRouter()
    const toast = useToast()
    const { formatFromFcfa } = useCurrency()
    const [products, setProducts] = useState<Product[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [agentFilter, setAgentFilter] = useState<string>('all')
    const [typeFilter, setTypeFilter] = useState<string[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [selectionMode, setSelectionMode] = useState(false)
    const [deletingSelected, setDeletingSelected] = useState(false)

    useEffect(() => {
        fetchProducts()
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
        const ok = await toast.confirm({ title: t('delete_confirm'), confirmLabel: 'Supprimer', danger: true })
        if (!ok) return
        try {
            await fetch(`/api/products/${id}`, { method: 'DELETE' })
            setProducts(products.filter(p => p.id !== id))
        } catch (err) {
            console.error('Error deleting product:', err)
        }
    }

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return
        const ok = await toast.confirm({ title: `Supprimer ${selectedIds.size} produit(s) ?`, confirmLabel: 'Supprimer', danger: true })
        if (!ok) return
        setDeletingSelected(true)
        try {
            await Promise.all(
                Array.from(selectedIds).map(id =>
                    fetch(`/api/products/${id}`, { method: 'DELETE' })
                )
            )
            setProducts(products.filter(p => !selectedIds.has(p.id)))
            setSelectedIds(new Set())
            setSelectionMode(false)
        } catch (err) {
            console.error('Error deleting selected products:', err)
        } finally {
            setDeletingSelected(false)
        }
    }

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredProducts.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredProducts.map(p => p.id)))
        }
    }

    const toggleTypeFilter = (type: string) => {
        setTypeFilter(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        )
    }

    const exitSelectionMode = () => {
        setSelectionMode(false)
        setSelectedIds(new Set())
    }

    const availableTypes = [...new Set(products.map(p => p.product_type || 'product'))].filter(Boolean)

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.category?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesAgent = agentFilter === 'all' || p.agent_id === agentFilter
        const matchesType = typeFilter.length === 0 || typeFilter.includes(p.product_type || 'product')
        return matchesSearch && matchesAgent && matchesType
    })

    const formatPrice = formatFromFcfa

    const getDisplayPrice = (product: Product): { minPrice: number; maxPrice: number; hasVariants: boolean } => {
        const variants = product.variants || []
        const fixedVariant = variants.find(v => v.type === 'fixed')
        if (fixedVariant && fixedVariant.options.length > 0) {
            const prices = fixedVariant.options.map(o => o.price).filter(p => p > 0)
            if (prices.length > 0) {
                return { minPrice: Math.min(...prices), maxPrice: Math.max(...prices), hasVariants: true }
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
                    <h1 style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 700, color: 'white', marginBottom: 8 }}>{t('title')}</h1>
                    <p style={{ color: '#94a3b8' }}>{t('count', { count: products.length })}</p>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
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

                    {/* Selection mode button */}
                    {!selectionMode ? (
                        <button
                            onClick={() => setSelectionMode(true)}
                            style={{
                                padding: '12px 16px',
                                borderRadius: 12,
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 500,
                                fontSize: 14,
                            }}
                        >
                            <CheckSquare size={16} />
                            Sélectionner
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                                onClick={toggleSelectAll}
                                style={{
                                    padding: '12px 16px',
                                    borderRadius: 12,
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.2)',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: 500,
                                }}
                            >
                                {selectedIds.size === filteredProducts.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                            </button>
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={deleteSelected}
                                    disabled={deletingSelected}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: 12,
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        color: '#f87171',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        fontWeight: 600,
                                        fontSize: 14,
                                    }}
                                >
                                    {deletingSelected
                                        ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                        : <Trash2 size={16} />
                                    }
                                    Supprimer ({selectedIds.size})
                                </button>
                            )}
                            <button
                                onClick={exitSelectionMode}
                                style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 10,
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
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

            {/* Type filter pills */}
            {availableTypes.length > 1 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {availableTypes.map(type => {
                        const active = typeFilter.includes(type)
                        const colorMap: Record<string, { bg: string; color: string; border: string }> = {
                            product:  { bg: 'rgba(99,102,241,0.15)',  color: '#a5b4fc', border: 'rgba(99,102,241,0.4)' },
                            digital:  { bg: 'rgba(16,185,129,0.15)',  color: '#6ee7b7', border: 'rgba(16,185,129,0.4)' },
                            service:  { bg: 'rgba(251,191,36,0.15)',  color: '#fcd34d', border: 'rgba(251,191,36,0.4)' },
                        }
                        const colors = colorMap[type] || { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' }
                        return (
                            <button
                                key={type}
                                onClick={() => toggleTypeFilter(type)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 20,
                                    border: `1px solid ${active ? colors.border : 'rgba(148,163,184,0.15)'}`,
                                    background: active ? colors.bg : 'rgba(30,41,59,0.4)',
                                    color: active ? colors.color : '#64748b',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.15s',
                                }}
                            >
                                {active
                                    ? <CheckSquare size={14} />
                                    : <Square size={14} />
                                }
                                {PRODUCT_TYPE_LABELS[type] || type}
                            </button>
                        )
                    })}
                    {typeFilter.length > 0 && (
                        <button
                            onClick={() => setTypeFilter([])}
                            style={{
                                padding: '8px 12px',
                                borderRadius: 20,
                                border: '1px solid rgba(148,163,184,0.1)',
                                background: 'transparent',
                                color: '#64748b',
                                cursor: 'pointer',
                                fontSize: 13,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            <X size={12} /> Tout afficher
                        </button>
                    )}
                </div>
            )}

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
                    {filteredProducts.map((product, i) => {
                        const isSelected = selectedIds.has(product.id)
                        return (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={selectionMode ? () => toggleSelect(product.id) : undefined}
                                style={{
                                    background: isSelected ? 'rgba(239,68,68,0.08)' : 'rgba(30, 41, 59, 0.5)',
                                    border: isSelected ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 16,
                                    overflow: 'hidden',
                                    cursor: selectionMode ? 'pointer' : 'default',
                                    position: 'relative',
                                    transition: 'border-color 0.15s, background 0.15s',
                                }}
                            >
                                {/* Selection checkbox overlay */}
                                {selectionMode && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 12,
                                        left: 12,
                                        zIndex: 10,
                                        width: 24,
                                        height: 24,
                                        borderRadius: 6,
                                        background: isSelected ? '#ef4444' : 'rgba(15,23,42,0.7)',
                                        border: `2px solid ${isSelected ? '#ef4444' : 'rgba(148,163,184,0.4)'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        {isSelected && <CheckSquare size={14} color="white" />}
                                    </div>
                                )}

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

                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                                        {product.category && (
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '4px 10px',
                                                borderRadius: 6,
                                                fontSize: 12,
                                                background: 'rgba(168, 85, 247, 0.15)',
                                                color: '#c084fc',
                                            }}>
                                                {product.category}
                                            </span>
                                        )}
                                        {product.product_type && (
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '4px 10px',
                                                borderRadius: 6,
                                                fontSize: 12,
                                                background: product.product_type === 'digital'
                                                    ? 'rgba(16,185,129,0.12)'
                                                    : product.product_type === 'service'
                                                    ? 'rgba(251,191,36,0.12)'
                                                    : 'rgba(99,102,241,0.12)',
                                                color: product.product_type === 'digital'
                                                    ? '#6ee7b7'
                                                    : product.product_type === 'service'
                                                    ? '#fcd34d'
                                                    : '#a5b4fc',
                                                fontWeight: 500
                                            }}>
                                                {PRODUCT_TYPE_LABELS[product.product_type] || product.product_type}
                                            </span>
                                        )}
                                        {(() => {
                                            const assignedAgent = agents.find(a => a.id === product.agent_id)
                                            return (
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '4px 10px',
                                                    borderRadius: 6,
                                                    fontSize: 12,
                                                    background: assignedAgent ? 'rgba(59, 130, 246, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                                                    color: assignedAgent ? '#93c5fd' : '#fbbf24',
                                                    fontWeight: 500
                                                }}>
                                                    {assignedAgent ? `🤖 ${assignedAgent.name}` : '🌐 Tous les agents'}
                                                </span>
                                            )
                                        })()}
                                    </div>

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
                                        {!selectionMode && (
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
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
