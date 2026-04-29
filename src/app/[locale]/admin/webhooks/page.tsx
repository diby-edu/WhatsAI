'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Webhook, Search, CheckCircle, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp, ExternalLink, User, Bot } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ApiWebhook {
    id: string
    user_id: string
    agent_id: string | null
    url: string
    secret: string | null
    events: string[]
    is_active: boolean
    created_at: string
    profiles?: { full_name: string | null; email: string | null } | null
    agents?: { name: string } | null
}

interface WebhookDelivery {
    id: string
    webhook_id: string
    event: string
    status_code: number | null
    response_body: string | null
    success: boolean
    created_at: string
}

const EVENT_COLORS: Record<string, string> = {
    'lead.created':              '#10b981',
    'order.created':             '#3b82f6',
    'booking.created':           '#8b5cf6',
    'message.received':          '#64748b',
    'credits.low':               '#fbbf24',
    'credits.depleted':          '#ef4444',
    'payment.received':          '#10b981',
    'subscription.activated':    '#10b981',
    'subscription.expired':      '#ef4444',
    'agent.created':             '#3b82f6',
    'agent.updated':             '#f97316',
}

export default function AdminWebhooksPage() {
    const [webhooks, setWebhooks] = useState<ApiWebhook[]>([])
    const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [stats, setStats] = useState({ total: 0, active: 0, deliveries_24h: 0, failures_24h: 0 })

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const supabase = createClient()
            const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

            const [{ data: wh }, { data: del }] = await Promise.all([
                supabase
                    .from('api_webhooks')
                    .select('*, profiles(full_name, email), agents(name)')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('webhook_deliveries')
                    .select('*')
                    .gte('created_at', since24h)
                    .order('created_at', { ascending: false })
                    .limit(500),
            ])

            const whData = (wh || []) as ApiWebhook[]
            const delData = (del || []) as WebhookDelivery[]

            setWebhooks(whData)
            setDeliveries(delData)
            setStats({
                total: whData.length,
                active: whData.filter(w => w.is_active).length,
                deliveries_24h: delData.length,
                failures_24h: delData.filter(d => !d.success).length,
            })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const filtered = webhooks.filter(w => {
        const matchSearch = !searchQuery ||
            w.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (w.profiles?.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (w.profiles?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
        const matchStatus = filterStatus === 'all' ||
            (filterStatus === 'active' && w.is_active) ||
            (filterStatus === 'inactive' && !w.is_active)
        return matchSearch && matchStatus
    })

    const getDeliveriesForWebhook = (webhookId: string) =>
        deliveries.filter(d => d.webhook_id === webhookId).slice(0, 10)

    const formatDate = (d: string) =>
        new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

    return (
        <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Webhook style={{ width: 20, height: 20, color: '#8b5cf6' }} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>Webhooks</h1>
                        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Intégrations et notifications sortantes</p>
                    </div>
                </div>
                <button
                    onClick={fetchData}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
                >
                    <RefreshCw style={{ width: 14, height: 14 }} />
                    Actualiser
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                    { label: 'Total webhooks', value: stats.total, color: '#8b5cf6' },
                    { label: 'Actifs', value: stats.active, color: '#10b981' },
                    { label: 'Appels (24h)', value: stats.deliveries_24h, color: '#3b82f6' },
                    { label: 'Échecs (24h)', value: stats.failures_24h, color: '#ef4444' },
                ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Filtres */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#64748b' }} />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Rechercher par URL ou client..."
                        style={{ width: '100%', padding: '9px 12px 9px 36px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white', fontSize: 13, boxSizing: 'border-box' }}
                    />
                </div>
                {(['all', 'active', 'inactive'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        style={{
                            padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: 'none',
                            background: filterStatus === s ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                            color: filterStatus === s ? '#8b5cf6' : '#64748b',
                        }}
                    >
                        {s === 'all' ? 'Tous' : s === 'active' ? 'Actifs' : 'Inactifs'}
                    </button>
                ))}
            </div>

            {/* Liste webhooks */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Chargement...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
                    <Webhook style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
                    <div>Aucun webhook configuré</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filtered.map(webhook => {
                        const webhookDeliveries = getDeliveriesForWebhook(webhook.id)
                        const successRate = webhookDeliveries.length > 0
                            ? Math.round((webhookDeliveries.filter(d => d.success).length / webhookDeliveries.length) * 100)
                            : null
                        const isExpanded = expandedId === webhook.id

                        return (
                            <motion.div
                                key={webhook.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}
                            >
                                {/* Row principal */}
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', cursor: 'pointer' }}
                                    onClick={() => setExpandedId(isExpanded ? null : webhook.id)}
                                >
                                    {/* Statut */}
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: webhook.is_active ? '#10b981' : '#374151', flexShrink: 0 }} />

                                    {/* URL */}
                                    <div style={{ flex: 2, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, color: '#e2e8f0', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {webhook.url}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                            Créé le {formatDate(webhook.created_at)}
                                        </div>
                                    </div>

                                    {/* Propriétaire */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <User style={{ width: 12, height: 12, color: '#64748b' }} />
                                            <span style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {webhook.profiles?.full_name || webhook.profiles?.email || webhook.user_id.slice(0, 8)}
                                            </span>
                                        </div>
                                        {webhook.agents?.name && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                <Bot style={{ width: 12, height: 12, color: '#64748b' }} />
                                                <span style={{ fontSize: 11, color: '#64748b' }}>{webhook.agents.name}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Événements */}
                                    <div style={{ flex: 2, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {webhook.events.slice(0, 3).map(ev => (
                                            <span key={ev} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: `${EVENT_COLORS[ev] || '#64748b'}20`, color: EVENT_COLORS[ev] || '#64748b', border: `1px solid ${EVENT_COLORS[ev] || '#64748b'}40` }}>
                                                {ev}
                                            </span>
                                        ))}
                                        {webhook.events.length > 3 && (
                                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(100,116,139,0.15)', color: '#64748b' }}>
                                                +{webhook.events.length - 3}
                                            </span>
                                        )}
                                    </div>

                                    {/* Taux succès */}
                                    <div style={{ minWidth: 60, textAlign: 'right' }}>
                                        {successRate !== null ? (
                                            <span style={{ fontSize: 13, fontWeight: 600, color: successRate >= 80 ? '#10b981' : successRate >= 50 ? '#fbbf24' : '#ef4444' }}>
                                                {successRate}%
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: 12, color: '#374151' }}>—</span>
                                        )}
                                        <div style={{ fontSize: 10, color: '#64748b' }}>succès</div>
                                    </div>

                                    {/* Toggle */}
                                    <div style={{ color: '#64748b' }}>
                                        {isExpanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
                                    </div>
                                </div>

                                {/* Section dépliée — logs */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px', background: 'rgba(0,0,0,0.2)' }}>
                                        {/* Tous les événements */}
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Événements écoutés</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                {webhook.events.map(ev => (
                                                    <span key={ev} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${EVENT_COLORS[ev] || '#64748b'}20`, color: EVENT_COLORS[ev] || '#64748b', border: `1px solid ${EVENT_COLORS[ev] || '#64748b'}40` }}>
                                                        {ev}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Secret */}
                                        {webhook.secret && (
                                            <div style={{ marginBottom: 16 }}>
                                                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Signature HMAC</div>
                                                <code style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 4 }}>
                                                    {'•'.repeat(20)} (masqué)
                                                </code>
                                            </div>
                                        )}

                                        {/* Derniers appels */}
                                        <div>
                                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                Derniers appels (24h) — {webhookDeliveries.length} entrée(s)
                                            </div>
                                            {webhookDeliveries.length === 0 ? (
                                                <div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic' }}>Aucun appel enregistré</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {webhookDeliveries.map(d => (
                                                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 12 }}>
                                                            {d.success
                                                                ? <CheckCircle style={{ width: 14, height: 14, color: '#10b981', flexShrink: 0 }} />
                                                                : <XCircle style={{ width: 14, height: 14, color: '#ef4444', flexShrink: 0 }} />
                                                            }
                                                            <span style={{ color: EVENT_COLORS[d.event] || '#94a3b8', minWidth: 160 }}>{d.event}</span>
                                                            <span style={{ color: d.status_code && d.status_code < 300 ? '#10b981' : '#ef4444', minWidth: 40 }}>
                                                                {d.status_code ?? 'ERR'}
                                                            </span>
                                                            <span style={{ color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {d.response_body || '—'}
                                                            </span>
                                                            <span style={{ color: '#374151', flexShrink: 0 }}>{formatDate(d.created_at)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <a
                                            href={webhook.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 11, color: '#64748b', textDecoration: 'none' }}
                                        >
                                            <ExternalLink style={{ width: 11, height: 11 }} />
                                            Ouvrir l'URL
                                        </a>
                                    </div>
                                )}
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Légende événements */}
            <div style={{ marginTop: 32, padding: 20, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Événements disponibles</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Object.entries(EVENT_COLORS).map(([ev, color]) => (
                        <span key={ev} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${color}15`, color, border: `1px solid ${color}30` }}>
                            {ev}
                        </span>
                    ))}
                </div>
            </div>

            {/* Info SQL */}
            <div style={{ marginTop: 16, padding: 16, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 600, marginBottom: 6 }}>Table SQL requise</div>
                <code style={{ fontSize: 11, color: '#94a3b8', display: 'block', lineHeight: 1.8 }}>
                    {`CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES api_webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB,
  status_code INT,
  response_body TEXT,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);`}
                </code>
            </div>
        </div>
    )
}
