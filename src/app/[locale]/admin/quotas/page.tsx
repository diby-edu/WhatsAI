'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Gauge, Search, AlertTriangle, CheckCircle, XCircle, RefreshCw, Bot, CreditCard, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PLANS, type PlanId } from '@/lib/plans'

interface UserQuota {
    id: string
    full_name: string | null
    email: string
    plan: string
    credits_balance: number
    credits_used_this_month: number | null
    account_lifecycle_status: string
    agents: { count: number }[]
}

interface QuotaRow {
    id: string
    name: string
    email: string
    plan: string
    planLabel: string
    agentsUsed: number
    agentsMax: number
    creditsBalance: number
    creditsIncluded: number
    creditsUsedMonth: number
    status: string
    agentsPct: number
    creditsPct: number
    alertLevel: 'ok' | 'warning' | 'critical'
}

const PLAN_COLORS: Record<string, string> = {
    free: '#64748b',
    starter: '#10b981',
    pro: '#3b82f6',
    business: '#8b5cf6',
    scale: '#f59e0b',
}

function usagePct(used: number, max: number): number {
    if (max <= 0) return 0 // illimité
    return Math.min(100, Math.round((used / max) * 100))
}

function ProgressBar({ pct, unlimited }: { pct: number; unlimited?: boolean }) {
    if (unlimited) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(148, 163, 184, 0.1)' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #10b981, #059669)', opacity: 0.4 }} />
                </div>
                <span style={{ fontSize: 11, color: '#10b981', whiteSpace: 'nowrap' }}>∞</span>
            </div>
        )
    }
    const color = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f97316' : '#10b981'
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(148, 163, 184, 0.1)', overflow: 'hidden' }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{ height: '100%', borderRadius: 3, background: color }}
                />
            </div>
            <span style={{ fontSize: 11, color, whiteSpace: 'nowrap', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
        </div>
    )
}

export default function AdminQuotasPage() {
    const [rows, setRows] = useState<QuotaRow[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterAlert, setFilterAlert] = useState<string>('all')
    const [filterPlan, setFilterPlan] = useState<string>('all')

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, plan, credits_balance, credits_used_this_month, account_lifecycle_status, agents(count)')
                .not('plan', 'is', null)
                .order('created_at', { ascending: false })
                .limit(300)

            if (error) throw error

            const mapped: QuotaRow[] = (data as UserQuota[]).map(u => {
                const planKey = (u.plan ?? 'free') as PlanId
                const planDef = PLANS[planKey] ?? PLANS.free
                const agentsUsed = u.agents?.[0]?.count ?? 0
                const agentsMax = planDef.agents // -1 = illimité
                const creditsBalance = u.credits_balance ?? 0
                const creditsIncluded = planDef.credits
                const creditsUsedMonth = u.credits_used_this_month ?? 0
                const agentsPct = usagePct(agentsUsed, agentsMax)
                const creditsPct = creditsIncluded > 0 ? usagePct(creditsUsedMonth, creditsIncluded) : 0

                let alertLevel: 'ok' | 'warning' | 'critical' = 'ok'
                if (agentsPct >= 100 || creditsPct >= 100) alertLevel = 'critical'
                else if (agentsPct >= 80 || creditsPct >= 80) alertLevel = 'warning'

                return {
                    id: u.id,
                    name: u.full_name ?? u.email?.split('@')[0] ?? '—',
                    email: u.email ?? '',
                    plan: planKey,
                    planLabel: planDef.name,
                    agentsUsed,
                    agentsMax,
                    creditsBalance,
                    creditsIncluded,
                    creditsUsedMonth,
                    status: u.account_lifecycle_status ?? 'unknown',
                    agentsPct,
                    creditsPct,
                    alertLevel,
                }
            })

            setRows(mapped)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const filtered = rows.filter(r => {
        const matchSearch = searchQuery === '' ||
            r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.email.toLowerCase().includes(searchQuery.toLowerCase())
        const matchAlert = filterAlert === 'all' || r.alertLevel === filterAlert
        const matchPlan = filterPlan === 'all' || r.plan === filterPlan
        return matchSearch && matchAlert && matchPlan
    })

    const criticalCount = rows.filter(r => r.alertLevel === 'critical').length
    const warningCount = rows.filter(r => r.alertLevel === 'warning').length
    const okCount = rows.filter(r => r.alertLevel === 'ok').length

    const AlertIcon = ({ level }: { level: 'ok' | 'warning' | 'critical' }) => {
        if (level === 'critical') return <XCircle style={{ width: 14, height: 14, color: '#ef4444' }} />
        if (level === 'warning') return <AlertTriangle style={{ width: 14, height: 14, color: '#f97316' }} />
        return <CheckCircle style={{ width: 14, height: 14, color: '#10b981' }} />
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', margin: 0 }}>
                        Quotas & Limites
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
                        Utilisation des ressources par utilisateur · {rows.length} comptes
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(148, 163, 184, 0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
                >
                    <RefreshCw style={{ width: 14, height: 14 }} />
                    Actualiser
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                    { label: 'Limite atteinte', value: criticalCount, color: '#ef4444', icon: XCircle, filter: 'critical' },
                    { label: 'Proche de la limite (>80%)', value: warningCount, color: '#f97316', icon: AlertTriangle, filter: 'warning' },
                    { label: 'Utilisation normale', value: okCount, color: '#10b981', icon: CheckCircle, filter: 'ok' },
                ].map(stat => {
                    const Icon = stat.icon
                    return (
                        <motion.button
                            key={stat.label}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setFilterAlert(filterAlert === stat.filter ? 'all' : stat.filter)}
                            style={{
                                background: filterAlert === stat.filter ? `${stat.color}15` : 'rgba(30, 41, 59, 0.4)',
                                border: `1px solid ${filterAlert === stat.filter ? `${stat.color}40` : 'rgba(148, 163, 184, 0.1)'}`,
                                borderRadius: 16,
                                padding: '20px 24px',
                                textAlign: 'left',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Icon style={{ width: 20, height: 20, color: stat.color }} />
                                <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{stat.label}</div>
                        </motion.button>
                    )
                })}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#64748b' }} />
                    <input
                        placeholder="Rechercher par nom ou email..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: 12, background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', color: 'white', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                    />
                </div>
                <select
                    value={filterPlan}
                    onChange={e => setFilterPlan(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', color: 'white', fontSize: 13, cursor: 'pointer', outline: 'none' }}
                >
                    <option value="all">Tous les plans</option>
                    {Object.values(PLANS).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 24, overflow: 'hidden' }}
            >
                {/* Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'grid', gridTemplateColumns: '1fr 100px 180px 220px 80px', gap: 16, alignItems: 'center' }}>
                    {['UTILISATEUR', 'PLAN', 'AGENTS', 'CRÉDITS CE MOIS', 'ALERTE'].map(col => (
                        <span key={col} style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col}</span>
                    ))}
                </div>

                {loading ? (
                    <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw style={{ width: 24, height: 24, margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                        Chargement...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                        <Gauge style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.3 }} />
                        Aucun résultat
                    </div>
                ) : (
                    filtered.map((row, i) => {
                        const planColor = PLAN_COLORS[row.plan] ?? '#64748b'
                        const unlimited = row.agentsMax === -1
                        return (
                            <motion.div
                                key={row.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.015 }}
                                style={{
                                    padding: '14px 24px',
                                    borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 100px 180px 220px 80px',
                                    gap: 16,
                                    alignItems: 'center',
                                    background: row.alertLevel === 'critical' ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                                }}
                            >
                                {/* Utilisateur */}
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ fontSize: 13, color: 'white', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {row.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {row.email}
                                    </div>
                                </div>

                                {/* Plan */}
                                <div>
                                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: `${planColor}20`, color: planColor, fontWeight: 600 }}>
                                        {row.planLabel}
                                    </span>
                                </div>

                                {/* Agents */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Bot style={{ width: 12, height: 12 }} />
                                            {row.agentsUsed} / {unlimited ? '∞' : row.agentsMax}
                                        </span>
                                    </div>
                                    <ProgressBar pct={row.agentsPct} unlimited={unlimited} />
                                </div>

                                {/* Crédits */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Zap style={{ width: 12, height: 12 }} />
                                            {row.creditsUsedMonth.toLocaleString()} / {row.creditsIncluded.toLocaleString()}
                                        </span>
                                        <span style={{ fontSize: 11, color: '#475569' }}>
                                            solde: {row.creditsBalance.toLocaleString()}
                                        </span>
                                    </div>
                                    <ProgressBar pct={row.creditsPct} />
                                </div>

                                {/* Alerte */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <AlertIcon level={row.alertLevel} />
                                    <span style={{
                                        fontSize: 11,
                                        color: row.alertLevel === 'critical' ? '#ef4444' : row.alertLevel === 'warning' ? '#f97316' : '#10b981'
                                    }}>
                                        {row.alertLevel === 'critical' ? 'Critique' : row.alertLevel === 'warning' ? 'Attention' : 'OK'}
                                    </span>
                                </div>
                            </motion.div>
                        )
                    })
                )}
            </motion.div>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
