'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, Search, RefreshCw, Loader2, Check, Clock, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Referral {
    id: string
    referrer_id: string
    referred_id: string
    status: 'pending' | 'confirmed'
    bonus_given: boolean
    created_at: string
    referrer_email?: string
    referrer_name?: string
    referred_email?: string
    referred_name?: string
}

interface Stats {
    total: number
    confirmed: number
    pending: number
    credits_distributed: number
}

const PAGE_SIZE = 25

export default function AdminReferralsPage() {
    const [referrals, setReferrals] = useState<Referral[]>([])
    const [stats, setStats] = useState<Stats>({ total: 0, confirmed: 0, pending: 0, credits_distributed: 0 })
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed'>('all')

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
        return () => clearTimeout(t)
    }, [search])

    useEffect(() => { fetchReferrals() }, [page, debouncedSearch, statusFilter])
    useEffect(() => { fetchStats() }, [])

    const fetchStats = async () => {
        try {
            const supabase = createClient()
            const { data } = await supabase.from('referrals').select('status, bonus_given')
            if (!data) return
            const confirmed = data.filter(r => r.status === 'confirmed').length
            const pending = data.filter(r => r.status === 'pending').length
            setStats({
                total: data.length,
                confirmed,
                pending,
                credits_distributed: confirmed * 20 // 10 parrain + 10 filleul
            })
        } catch (err) {
            console.error('Error fetching referral stats:', err)
        }
    }

    const fetchReferrals = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)

        try {
            const supabase = createClient()
            const from = (page - 1) * PAGE_SIZE
            const to = from + PAGE_SIZE - 1

            // On fetch les referrals avec les profils
            let query = supabase
                .from('referrals')
                .select(`
                    id, referrer_id, referred_id, status, bonus_given, created_at,
                    referrer:profiles!referrals_referrer_id_fkey(email, full_name),
                    referred:profiles!referrals_referred_id_fkey(email, full_name)
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to)

            if (statusFilter !== 'all') query = query.eq('status', statusFilter)

            const { data, error, count } = await query

            if (error) throw error

            const mapped: Referral[] = (data || []).map((r: any) => ({
                id: r.id,
                referrer_id: r.referrer_id,
                referred_id: r.referred_id,
                status: r.status,
                bonus_given: r.bonus_given,
                created_at: r.created_at,
                referrer_email: r.referrer?.email,
                referrer_name: r.referrer?.full_name,
                referred_email: r.referred?.email,
                referred_name: r.referred?.full_name,
            }))

            setReferrals(mapped)
            setTotal(count || 0)
        } catch (err) {
            console.error('Error fetching referrals:', err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const handleRefresh = () => fetchReferrals(true)
    const totalPages = Math.ceil(total / PAGE_SIZE)

    const filteredReferrals = debouncedSearch
        ? referrals.filter(r =>
            r.referrer_email?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            r.referred_email?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            r.referrer_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            r.referred_name?.toLowerCase().includes(debouncedSearch.toLowerCase())
        )
        : referrals

    return (
        <div style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Gift style={{ width: 20, height: 20, color: 'white' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Parrainage</h1>
                        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Suivi des parrainages et crédits distribués</p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
                {[
                    { label: 'Total parrainages', value: stats.total, color: '#94a3b8' },
                    { label: 'Confirmés', value: stats.confirmed, color: '#10b981' },
                    { label: 'En attente', value: stats.pending, color: '#f59e0b' },
                    { label: 'Crédits distribués', value: stats.credits_distributed, color: '#8b5cf6' },
                ].map(stat => (
                    <div key={stat.label} style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14, padding: '18px 20px'
                    }}>
                        <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 6px' }}>{stat.label}</p>
                        <p style={{ color: stat.color, fontSize: 26, fontWeight: 700, margin: 0 }}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Filtres */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#64748b' }} />
                    <input
                        type="text"
                        placeholder="Rechercher par email ou nom..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', paddingLeft: 38, padding: '10px 12px 10px 38px',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10, color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box'
                        }}
                    />
                </div>

                {(['all', 'pending', 'confirmed'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => { setStatusFilter(s); setPage(1) }}
                        style={{
                            padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                            background: statusFilter === s ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)',
                            color: statusFilter === s ? '#a78bfa' : '#94a3b8',
                            outline: statusFilter === s ? '1px solid rgba(139,92,246,0.4)' : 'none'
                        }}
                    >
                        {s === 'all' ? 'Tous' : s === 'pending' ? 'En attente' : 'Confirmés'}
                    </button>
                ))}

                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    style={{
                        padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: '#94a3b8'
                    }}
                >
                    <RefreshCw style={{ width: 16, height: 16 }} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Tableau */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, overflow: 'hidden'
            }}>
                {/* En-têtes */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 130px 100px 160px',
                    padding: '12px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    {['Parrain', 'Filleul', 'Statut', 'Bonus', 'Date'].map(h => (
                        <span key={h} style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                    ))}
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
                        <Loader2 style={{ width: 28, height: 28, color: '#8b5cf6' }} className="animate-spin" />
                    </div>
                ) : filteredReferrals.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
                        <Users style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
                        <p style={{ margin: 0, fontSize: 14 }}>Aucun parrainage trouvé</p>
                    </div>
                ) : (
                    filteredReferrals.map((ref, i) => (
                        <motion.div
                            key={ref.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 130px 100px 160px',
                                padding: '14px 20px',
                                borderBottom: i < filteredReferrals.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                alignItems: 'center'
                            }}
                        >
                            {/* Parrain */}
                            <div>
                                <p style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>
                                    {ref.referrer_name || '—'}
                                </p>
                                <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>{ref.referrer_email || ref.referrer_id.slice(0, 8) + '...'}</p>
                            </div>

                            {/* Filleul */}
                            <div>
                                <p style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>
                                    {ref.referred_name || '—'}
                                </p>
                                <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>{ref.referred_email || ref.referred_id.slice(0, 8) + '...'}</p>
                            </div>

                            {/* Statut */}
                            <div>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                    background: ref.status === 'confirmed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                    color: ref.status === 'confirmed' ? '#10b981' : '#f59e0b'
                                }}>
                                    {ref.status === 'confirmed'
                                        ? <><Check style={{ width: 11, height: 11 }} /> Confirmé</>
                                        : <><Clock style={{ width: 11, height: 11 }} /> En attente</>
                                    }
                                </span>
                            </div>

                            {/* Bonus */}
                            <div>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                    background: ref.bonus_given ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
                                    color: ref.bonus_given ? '#a78bfa' : '#64748b'
                                }}>
                                    {ref.bonus_given ? <><Check style={{ width: 11, height: 11 }} /> +20 crédits</> : '—'}
                                </span>
                            </div>

                            {/* Date */}
                            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                                {new Date(ref.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        style={{
                            padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)', color: page === 1 ? '#475569' : '#94a3b8', cursor: page === 1 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <ChevronLeft style={{ width: 16, height: 16 }} />
                    </button>
                    <span style={{ color: '#64748b', fontSize: 13 }}>Page {page} / {totalPages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        style={{
                            padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)', color: page === totalPages ? '#475569' : '#94a3b8', cursor: page === totalPages ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <ChevronRight style={{ width: 16, height: 16 }} />
                    </button>
                </div>
            )}
        </div>
    )
}
