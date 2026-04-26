'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
    Users, Bot, MessageSquare, CreditCard, TrendingUp, DollarSign,
    Activity, AlertTriangle, CheckCircle2, Clock, Zap, Loader2, RefreshCw,
    ShoppingCart, UserPlus, BarChart3, Wallet, Phone,
    Wrench, Power, Timer, Snowflake, FlaskConical, Target,
    ArrowUpRight, ArrowDownRight, Minus, PenLine, Cpu, Star, Flame
} from 'lucide-react'

interface DashboardStats {
    // Utilisateurs
    totalUsers: number
    newUsersToday: number
    newUsersYesterday: number
    activeUsers: number
    userGrowth: number
    // Abonnés & lifecycle
    activeSubscribers: number
    inGracePeriod: number
    expiringIn7Days: number
    trialAccounts: number
    // MRR & finances
    mrr: number
    mrrLastMonth: number
    mrrGrowth: number
    newMrr: number
    churnedMrr: number
    platformRevenue: number
    revenueAutomatic: number
    revenueManual: number
    merchantRevenue: number
    // Métriques SaaS
    arpu: number
    ltv: number
    churnRate: number
    churnedCount: number
    trialToPaidRate: number
    conversionRate: number
    newPaidThisMonth: number
    // Agents
    totalAgents: number
    connectedAgents: number
    activeAgents: number
    agentActivationRate: number
    // Engagement
    totalMessages: number
    messagesToday: number
    totalConversations: number
    conversationsToday: number
    leadsThisMonth: number
    totalCreditsUsed: number
    avgMessagesPerAgent: number
    // Commandes
    totalOrders: number
    pendingOrders: number
}

const EMPTY_STATS: DashboardStats = {
    totalUsers: 0, newUsersToday: 0, newUsersYesterday: 0, activeUsers: 0, userGrowth: 0,
    activeSubscribers: 0, inGracePeriod: 0, expiringIn7Days: 0, trialAccounts: 0,
    mrr: 0, mrrLastMonth: 0, mrrGrowth: 0, newMrr: 0, churnedMrr: 0,
    platformRevenue: 0, revenueAutomatic: 0, revenueManual: 0, merchantRevenue: 0,
    arpu: 0, ltv: 0, churnRate: 0, churnedCount: 0, trialToPaidRate: 0, conversionRate: 0, newPaidThisMonth: 0,
    totalAgents: 0, connectedAgents: 0, activeAgents: 0, agentActivationRate: 0,
    totalMessages: 0, messagesToday: 0, totalConversations: 0, conversationsToday: 0,
    leadsThisMonth: 0, totalCreditsUsed: 0, avgMessagesPerAgent: 0,
    totalOrders: 0, pendingOrders: 0,
}

const fcfa = (v: number) => v.toLocaleString('fr-FR') + ' F'
const pct = (v: number) => `${v}%`

function TrendBadge({ value, suffix = '%', inverse = false }: { value: number, suffix?: string, inverse?: boolean }) {
    if (value === 0) return <span style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 2 }}><Minus size={10} />0{suffix}</span>
    const positive = inverse ? value < 0 : value > 0
    return (
        <span style={{ fontSize: 11, fontWeight: 700, color: positive ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: 2 }}>
            {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {value > 0 ? '+' : ''}{value}{suffix}
        </span>
    )
}

function SectionLabel({ children }: { children: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569' }}>{children}</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(71,85,105,0.3)' }} />
        </div>
    )
}

// Card KPI standard
function KPI({ icon: Icon, label, value, sub, color, trend, trendInverse = false }: {
    icon: any, label: string, value: string, sub?: string, color: string, trend?: number, trendInverse?: boolean
}) {
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '14px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={14} style={{ color }} />
                </div>
                {trend !== undefined && <TrendBadge value={trend} inverse={trendInverse} />}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>{value}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{label}</div>
            {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{sub}</div>}
        </motion.div>
    )
}

// Card KPI avec alerte visuelle
function AlertKPI({ icon: Icon, label, value, sub, level }: {
    icon: any, label: string, value: string, sub?: string, level: 'ok' | 'warn' | 'danger'
}) {
    const colors = { ok: '#4ade80', warn: '#fbbf24', danger: '#f87171' }
    const bgs = { ok: 'rgba(74,222,128,0.08)', warn: 'rgba(251,191,36,0.08)', danger: 'rgba(248,113,113,0.08)' }
    const borders = { ok: 'rgba(74,222,128,0.15)', warn: 'rgba(251,191,36,0.2)', danger: 'rgba(248,113,113,0.25)' }
    const c = colors[level]
    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '14px 16px', background: bgs[level], border: `1px solid ${borders[level]}`, borderRadius: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${c}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Icon size={14} style={{ color: c }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>{value}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{label}</div>
            {sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{sub}</div>}
        </motion.div>
    )
}

export default function AdminDashboard() {
    const [s, setS] = useState<DashboardStats>(EMPTY_STATS)
    const [recentUsers, setRecentUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [systemStatus, setSystemStatus] = useState<{ name: string; status: string; latency?: string }[]>([])
    const [checkingSystem, setCheckingSystem] = useState(false)
    const [maintenance, setMaintenance] = useState(false)
    const [maintenancePausedCount, setMaintenancePausedCount] = useState(0)
    const [maintenanceLoading, setMaintenanceLoading] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    useEffect(() => {
        fetchAll()
        checkSystem()
        fetchMaintenance()
    }, [])

    const fetchAll = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/dashboard')
            const data = await res.json()
            if (data.data?.stats) setS(data.data.stats)
            if (data.data?.recentUsers) setRecentUsers(data.data.recentUsers.slice(0, 6))
            setLastUpdated(new Date())
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const checkSystem = async () => {
        setCheckingSystem(true)
        const svcs: { name: string; status: string; latency?: string }[] = []
        try { const t = Date.now(); const r = await fetch('/api/health'); svcs.push({ name: 'API', status: r.ok ? 'operational' : 'down', latency: `${Date.now() - t}ms` }) } catch { svcs.push({ name: 'API', status: 'down' }) }
        try { const r = await fetch('/api/admin/diagnostics/database'); const d = await r.json(); svcs.push({ name: 'DB', status: d.success ? 'operational' : 'down', latency: d.latency ? `${d.latency}ms` : undefined }) } catch { svcs.push({ name: 'DB', status: 'down' }) }
        try { const r = await fetch('/api/admin/diagnostics/openai'); const d = await r.json(); svcs.push({ name: 'OpenAI', status: d.success ? 'operational' : 'degraded' }) } catch { svcs.push({ name: 'OpenAI', status: 'degraded' }) }
        setSystemStatus(svcs)
        setCheckingSystem(false)
    }

    const fetchMaintenance = async () => {
        try { const r = await fetch('/api/admin/maintenance'); const d = await r.json(); if (r.ok && d.data) { setMaintenance(d.data.maintenance); setMaintenancePausedCount(d.data.pausedCount) } } catch { }
    }

    const toggleMaintenance = async () => {
        const action = maintenance ? 'deactivate' : 'activate'
        if (!confirm(maintenance ? `Désactiver la maintenance et restaurer ${maintenancePausedCount} agent(s) ?` : `Activer la maintenance ? Tous les agents actifs seront mis en pause.`)) return
        setMaintenanceLoading(true)
        try {
            const r = await fetch('/api/admin/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
            const d = await r.json()
            if (r.ok && d.data) { const m = !maintenance; setMaintenance(m); setMaintenancePausedCount(m ? (d.data.pausedCount ?? 0) : 0) }
        } catch { } finally { setMaintenanceLoading(false) }
    }

    // Alertes calculées
    const churnAlert: 'ok' | 'warn' | 'danger' = s.churnRate === 0 ? 'ok' : s.churnRate < 10 ? 'warn' : 'danger'
    const expiryAlert: 'ok' | 'warn' | 'danger' = s.expiringIn7Days === 0 ? 'ok' : s.expiringIn7Days < 3 ? 'warn' : 'danger'
    const graceAlert: 'ok' | 'warn' | 'danger' = s.inGracePeriod === 0 ? 'ok' : 'warn'
    const conversionAlert: 'ok' | 'warn' | 'danger' = s.trialToPaidRate >= 20 ? 'ok' : s.trialToPaidRate >= 10 ? 'warn' : 'danger'

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12 }}>
            <Loader2 style={{ width: 28, height: 28, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: '#475569', fontSize: 13 }}>Chargement des métriques…</span>
        </div>
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 2 }}>Vue d'ensemble</h1>
                    {lastUpdated && <p style={{ color: '#475569', fontSize: 12 }}>Mis à jour {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Système */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'rgba(15,23,42,0.6)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.1)' }}>
                        {systemStatus.map((sv, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 5, height: 5, borderRadius: '50%', background: sv.status === 'operational' ? '#4ade80' : sv.status === 'degraded' ? '#fbbf24' : '#f87171' }} />
                                <span style={{ fontSize: 10, color: '#64748b' }}>{sv.name}</span>
                            </div>
                        ))}
                        <button onClick={checkSystem} disabled={checkingSystem} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                            <RefreshCw style={{ width: 11, height: 11, color: '#475569', animation: checkingSystem ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                    </div>
                    <button onClick={fetchAll} style={{ padding: '7px 12px', borderRadius: 10, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw size={12} /> Actualiser
                    </button>
                </div>
            </div>

            {/* Maintenance */}
            <div style={{ background: maintenance ? 'rgba(239,68,68,0.06)' : 'rgba(15,23,42,0.4)', border: `1px solid ${maintenance ? 'rgba(239,68,68,0.25)' : 'rgba(148,163,184,0.08)'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Wrench size={16} style={{ color: maintenance ? '#ef4444' : '#475569' }} />
                    <div>
                        <div style={{ color: 'white', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                            Mode Maintenance
                            {maintenance && <span style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 6, padding: '1px 8px', fontSize: 10 }}>ACTIF — {maintenancePausedCount} agent{maintenancePausedCount !== 1 ? 's' : ''} en pause</span>}
                        </div>
                        <div style={{ color: '#475569', fontSize: 12, marginTop: 1 }}>{maintenance ? 'Agents restaurés à la désactivation.' : 'Pause tous les agents actifs instantanément.'}</div>
                    </div>
                </div>
                <button onClick={toggleMaintenance} disabled={maintenanceLoading} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: maintenance ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: maintenance ? '#f87171' : '#34d399', cursor: maintenanceLoading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: maintenanceLoading ? 0.6 : 1 }}>
                    {maintenanceLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Power size={12} />}
                    {maintenance ? 'Désactiver' : 'Activer'}
                </button>
            </div>

            {/* ── SECTION 1 : MRR HERO ────────────────────────────────── */}
            <SectionLabel>Santé financière · MRR</SectionLabel>

            {/* Hero MRR */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(15,23,42,0.6) 60%)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#34d399', marginBottom: 6 }}>Monthly Recurring Revenue</div>
                        <div style={{ fontSize: 36, fontWeight: 800, color: 'white', lineHeight: 1 }}>{fcfa(s.mrr)}</div>
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <TrendBadge value={s.mrrGrowth} />
                            <span style={{ fontSize: 11, color: '#475569' }}>vs mois précédent ({fcfa(s.mrrLastMonth)})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            <Cpu size={10} style={{ color: '#34d399' }} />
                            <span style={{ fontSize: 10, color: '#34d399' }}>{fcfa(s.revenueAutomatic)} auto</span>
                            <span style={{ color: '#334155', fontSize: 10 }}>·</span>
                            <PenLine size={10} style={{ color: '#fbbf24' }} />
                            <span style={{ fontSize: 10, color: '#fbbf24' }}>{fcfa(s.revenueManual)} manuel</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>New MRR</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>+{fcfa(s.newMrr)}</div>
                            <div style={{ fontSize: 10, color: '#475569' }}>{s.newPaidThisMonth} nouveau{s.newPaidThisMonth !== 1 ? 'x' : ''}</div>
                        </div>
                        <div style={{ width: 1, background: 'rgba(148,163,184,0.1)' }} />
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Churned MRR</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: s.churnedMrr > 0 ? '#f87171' : '#475569' }}>{s.churnedMrr > 0 ? `-${fcfa(s.churnedMrr)}` : '—'}</div>
                            <div style={{ fontSize: 10, color: '#475569' }}>{s.churnedCount} perdu{s.churnedCount !== 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ width: 1, background: 'rgba(148,163,184,0.1)' }} />
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>À reverser</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: s.merchantRevenue > 0 ? '#fb923c' : '#475569' }}>{s.merchantRevenue > 0 ? fcfa(s.merchantRevenue) : '—'}</div>
                            <div style={{ fontSize: 10, color: '#475569' }}>marchands</div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Métriques SaaS clés */}
            <div className="kpi-grid">
                <KPI icon={Users} label="Abonnés actifs" value={String(s.activeSubscribers)} sub={`+${s.newPaidThisMonth} ce mois`} color="#10b981" trend={s.newPaidThisMonth} />
                <KPI icon={BarChart3} label="ARPU mensuel" value={fcfa(s.arpu)} sub="par abonné actif" color="#8b5cf6" />
                <KPI icon={Star} label="LTV estimé" value={fcfa(s.ltv)} sub={s.churnRate > 0 ? `base churn ${s.churnRate}%` : 'base 12 mois'} color="#f59e0b" />
                <KPI icon={Wallet} label="ARR projeté" value={fcfa(s.mrr * 12)} sub="MRR × 12" color="#6366f1" />
            </div>

            {/* ── SECTION 2 : SANTÉ CLIENTS ───────────────────────────── */}
            <SectionLabel>Santé clients · alertes</SectionLabel>
            <div className="kpi-grid">
                <AlertKPI icon={TrendingUp} label="Churn rate mensuel" value={pct(s.churnRate)} sub={`${s.churnedCount} perdu${s.churnedCount !== 1 ? 's' : ''} ce mois`} level={churnAlert} />
                <AlertKPI icon={Timer} label="Expire dans 7 jours" value={String(s.expiringIn7Days)} sub="abonnements à risque" level={expiryAlert} />
                <AlertKPI icon={Snowflake} label="En période de grâce" value={String(s.inGracePeriod)} sub="à récupérer avant suppression" level={graceAlert} />
                <AlertKPI icon={Target} label="Trial → Payant" value={pct(s.trialToPaidRate)} sub={`cible : 20%`} level={conversionAlert} />
            </div>

            {/* ── SECTION 3 : FUNNEL D'ACQUISITION ────────────────────── */}
            <SectionLabel>Funnel d'acquisition</SectionLabel>
            <div className="kpi-grid">
                <KPI icon={UserPlus} label="Total inscrits" value={String(s.totalUsers)} sub={`+${s.newUsersToday} aujourd'hui`} color="#3b82f6" trend={s.userGrowth} />
                <KPI icon={FlaskConical} label="Comptes test actifs" value={String(s.trialAccounts)} sub="non qualifiés" color="#a78bfa" />
                <KPI icon={CreditCard} label="Nouveaux payants" value={String(s.newPaidThisMonth)} sub="abonnements ce mois" color="#34d399" />
                <KPI icon={Flame} label="Rétention estimée" value={s.churnRate > 0 ? `${Math.round(1 / (s.churnRate / 100))} mois` : '12+ mois'} sub="durée moyenne client" color="#f97316" />
            </div>

            {/* ── SECTION 4 : ENGAGEMENT PRODUIT ──────────────────────── */}
            <SectionLabel>Engagement produit</SectionLabel>
            <div className="kpi-grid">
                <KPI icon={Bot} label="Agents connectés" value={`${s.connectedAgents}/${s.totalAgents}`} sub={`${s.activeAgents} actifs (7j)`} color="#8b5cf6" />
                <KPI icon={Activity} label="Taux d'activation" value={pct(s.agentActivationRate)} sub="payants avec 1 agent live" color="#06b6d4" />
                <KPI icon={MessageSquare} label="Messages" value={s.totalMessages.toLocaleString('fr-FR')} sub={`+${s.messagesToday} aujourd'hui`} color="#0ea5e9" />
                <KPI icon={Phone} label="Leads captés" value={String(s.leadsThisMonth)} sub="ce mois" color="#ec4899" />
            </div>

            {/* ── SECTION 5 : OPÉRATIONNEL ────────────────────────────── */}
            <SectionLabel>Opérationnel</SectionLabel>
            <div className="kpi-grid">
                <KPI icon={ShoppingCart} label="Commandes" value={String(s.totalOrders)} sub={`${s.pendingOrders} en attente`} color="#14b8a6" />
                <KPI icon={Zap} label="Crédits utilisés" value={s.totalCreditsUsed.toLocaleString('fr-FR')} sub="ce mois" color="#f43f5e" />
                <KPI icon={MessageSquare} label="Conversations" value={s.totalConversations.toLocaleString('fr-FR')} sub={`+${s.conversationsToday} aujourd'hui`} color="#84cc16" />
                <KPI icon={BarChart3} label="Msg/Agent" value={String(s.avgMessagesPerAgent)} sub="moyenne" color="#fbbf24" />
            </div>

            {/* ── SECTION 6 : DERNIERS INSCRITS + SYSTÈME ─────────────── */}
            <div className="two-col-grid">
                {/* Derniers inscrits */}
                <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(51,65,85,0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Dernières inscriptions</h2>
                        <Link href="/admin/users" style={{ fontSize: 11, color: '#34d399', textDecoration: 'none' }}>Voir tout →</Link>
                    </div>
                    <div>
                        {recentUsers.length === 0 ? (
                            <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 13 }}>Aucun utilisateur</div>
                        ) : recentUsers.map((u, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < recentUsers.length - 1 ? '1px solid rgba(51,65,85,0.3)' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                                        {(u.full_name || u.email || 'U')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 500, color: 'white', fontSize: 12 }}>{u.full_name || 'Utilisateur'}</div>
                                        <div style={{ fontSize: 10, color: '#475569' }}>{u.email}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ padding: '2px 8px', fontSize: 9, fontWeight: 700, borderRadius: 100, background: u.plan && u.plan !== 'free' ? 'rgba(16,185,129,0.15)' : 'rgba(51,65,85,0.5)', color: u.plan && u.plan !== 'free' ? '#34d399' : '#64748b' }}>
                                        {u.plan ? u.plan.charAt(0).toUpperCase() + u.plan.slice(1) : 'Free'}
                                    </span>
                                    <span style={{ fontSize: 10, color: '#475569' }}>{new Date(u.created_at).toLocaleDateString('fr-FR')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Santé système + Actions rapides */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 14, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Santé système</h2>
                            <span style={{ padding: '3px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600, background: systemStatus.every(s => s.status === 'operational') ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: systemStatus.every(s => s.status === 'operational') ? '#4ade80' : '#fbbf24' }}>
                                {systemStatus.filter(s => s.status === 'operational').length}/{systemStatus.length} OK
                            </span>
                        </div>
                        {systemStatus.map((sv, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < systemStatus.length - 1 ? 8 : 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {sv.status === 'operational' ? <CheckCircle2 size={13} style={{ color: '#4ade80' }} /> : <AlertTriangle size={13} style={{ color: sv.status === 'degraded' ? '#fbbf24' : '#f87171' }} />}
                                    <span style={{ color: '#e2e8f0', fontSize: 12 }}>{sv.name}</span>
                                </div>
                                {sv.latency && <span style={{ fontSize: 10, color: '#475569' }}>{sv.latency}</span>}
                            </div>
                        ))}
                    </div>
                    <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 14, padding: 16 }}>
                        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 12 }}>Actions rapides</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {[
                                { label: 'Gérer utilisateurs', href: '/admin/users' },
                                { label: 'Historique paiements', href: '/admin/payments' },
                                { label: 'Gérer les plans', href: '/admin/plans' },
                                { label: 'Diagnostics', href: '/admin/diagnostics' },
                            ].map((a, i) => (
                                <a key={i} href={a.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'rgba(15,23,42,0.4)', textDecoration: 'none', border: '1px solid rgba(148,163,184,0.05)' }}>
                                    <span style={{ color: 'white', fontSize: 12 }}>{a.label}</span>
                                    <span style={{ color: '#334155', fontSize: 12 }}>→</span>
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
