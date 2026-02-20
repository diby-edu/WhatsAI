'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, MessageSquare, Package, ShoppingBag, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

interface SearchResult {
    result_id: string
    result_type: 'conversation' | 'product' | 'order'
    result_title: string
    result_subtitle: string | null
}

export function GlobalSearch() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [loading, setLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()
    const locale = useLocale()
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Debounced search
    useEffect(() => {
        if (query.length < 2) {
            setResults([])
            return
        }

        const timer = setTimeout(async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`)
                const data = await res.json()
                setResults(data.data?.results || [])
            } catch (err) {
                console.error('Search error:', err)
                setResults([])
            } finally {
                setLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    const getIcon = (type: string) => {
        switch (type) {
            case 'conversation':
                return <MessageSquare size={16} />
            case 'product':
                return <Package size={16} />
            case 'order':
                return <ShoppingBag size={16} />
            default:
                return null
        }
    }

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'conversation':
                return 'Conversation'
            case 'product':
                return 'Produit'
            case 'order':
                return 'Commande'
            default:
                return type
        }
    }

    const handleSelect = (result: SearchResult) => {
        const routes: Record<string, string> = {
            conversation: `/${locale}/dashboard/conversations/${result.result_id}`,
            product: `/${locale}/dashboard/products/${result.result_id}`,
            order: `/${locale}/dashboard/orders/${result.result_id}`
        }
        router.push(routes[result.result_type] || `/${locale}/dashboard`)
        setIsOpen(false)
        setQuery('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsOpen(false)
            inputRef.current?.blur()
        }
    }

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
            <div style={{ position: 'relative' }}>
                <Search
                    style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#64748b'
                    }}
                    size={18}
                />
                <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setIsOpen(true)
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Rechercher..."
                    style={{
                        width: '100%',
                        padding: '10px 36px',
                        background: 'rgba(30, 41, 59, 0.8)',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        borderRadius: 10,
                        color: 'white',
                        fontSize: 14,
                        outline: 'none',
                        transition: 'border-color 0.2s'
                    }}
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery('')
                            setResults([])
                        }}
                        style={{
                            position: 'absolute',
                            right: 12,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex'
                        }}
                    >
                        <X size={16} color="#64748b" />
                    </button>
                )}
            </div>

            {isOpen && query.length >= 2 && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 8,
                        background: 'rgba(15, 23, 42, 0.98)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        borderRadius: 12,
                        maxHeight: 400,
                        overflowY: 'auto',
                        zIndex: 50,
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)'
                    }}
                >
                    {loading ? (
                        <div style={{ padding: 20, textAlign: 'center' }}>
                            <Loader2
                                size={20}
                                style={{ color: '#10b981', animation: 'spin 1s linear infinite' }}
                            />
                        </div>
                    ) : results.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                            Aucun résultat pour "{query}"
                        </div>
                    ) : (
                        results.map((r, i) => (
                            <div
                                key={`${r.result_type}-${r.result_id}`}
                                onClick={() => handleSelect(r)}
                                style={{
                                    padding: '12px 16px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    borderBottom: i < results.length - 1 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
                                    transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent'
                                }}
                            >
                                <span style={{ color: '#10b981', flexShrink: 0 }}>
                                    {getIcon(r.result_type)}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        color: 'white',
                                        fontWeight: 500,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {r.result_title}
                                    </div>
                                    {r.result_subtitle && (
                                        <div style={{
                                            color: '#64748b',
                                            fontSize: 12,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {r.result_subtitle.substring(0, 60)}
                                        </div>
                                    )}
                                </div>
                                <span style={{
                                    fontSize: 11,
                                    color: '#64748b',
                                    background: 'rgba(100, 116, 139, 0.2)',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    flexShrink: 0
                                }}>
                                    {getTypeLabel(r.result_type)}
                                </span>
                            </div>
                        ))
                    )}
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
