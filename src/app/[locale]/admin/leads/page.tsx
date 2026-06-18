'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Target, Search, Download, RefreshCw, Loader2, X,
    Phone, Mail, MapPin, Building2, Bot, User, Calendar,
    ChevronDown, ChevronRight
} from 'lucide-react'

interface Lead {
    id: string
    agent_id: string
    user_id: string
    customer_phone: string | null
    lead_name: string | null
    lead_phone: string | null
    lead_email: string | null
    interest: string | null
    lead_location: string | null
    lead_company: string | null
    created_at: string
    agent_name?: string | null
    owner_email?: string | null
}

interface UserGroup {
    user_id: string
    owner_email: string
    leads: Lead[]
    agents: string[]
    lastDate: string
}

function getInitials(email: string) {
    const parts = email.split('@')[0].split(/[._-]/)
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?'
}

const AVATAR_COLORS = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #059669, #10b981)',
    'linear-gradient(135deg, #d97706, #f59e0b)',
    'linear-gradient(135deg, #dc2626, #ef4444)',
    'linear-gradient(135deg, #0891b2, #06b6d4)',
    'linear-gradient(135deg, #7c3aed, #a78bfa)',
]

function avatarColor(userId: string) {
    let hash = 0
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function AdminLeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [refreshing, setRefreshing] = useState(false)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400)
        return () => clearTimeout(t)
    }, [search])

    useEffect(() => { fetchLeads() }, [debouncedSearch])

    const fetchLeads = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ all: 'true' })
            if (debouncedSearch) params.set('search', debouncedSearch)
            const res = await fetch(`/api/admin/leads?${params}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Erreur')
            setLeads(json.data?.leads || [])
        } catch (err) {
            console.error('Error fetching leads:', err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const handleRefresh = () => { setRefreshing(true); fetchLeads() }

    const groups = useMemo<UserGroup[]>(() => {
        const map = new Map<string, UserGroup>()
        for (const lead of leads) {
            const key = lead.user_id
            if (!map.has(key)) {
                map.set(key, {
                    user_id: key,
                    owner_email: lead.owner_email || lead.user_id.slice(0, 8) + '…',
                    leads: [],
                    agents: [],
                    lastDate: lead.created_at,
                })
            }
            const g = map.get(key)!
            g.leads.push(lead)
            if (lead.agent_name && !g.agents.includes(lead.agent_name)) g.agents.push(lead.agent_name)
            if (lead.created_at > g.lastDate) g.lastDate = lead.created_at
        }
        return Array.from(map.values()).sort((a, b) => b.leads.length - a.leads.length)
    }, [leads])

    const toggleGroup = (userId: string) => {
        setExpanded(prev => {
            const next = new Set(prev)
            next.has(userId) ? next.delete(userId) : next.add(userId)
            return next
        })
    }

    const exportCSV = () => {
        const rows = [
            ['Utilisateur', 'Nom lead', 'Téléphone', 'Email', 'Intérêt', 'Entreprise', 'Localisation', 'Agent', 'Date'],
            ...leads.map(l => [
                l.owner_email || '',
                l.lead_name || '',
                l.lead_phone || l.customer_phone || '',
                l.lead_email || '',
                l.interest || '',
                l.lead_company || '',
                l.lead_location || '',
                l.agent_name || '',
                new Date(l.created_at).toLocaleDateString('fr-FR')
            ])
        ]
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`
        a.click(); URL.revokeObjectURL(url)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                        <Target style={{ width: 20, height: 20, color: 'white' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Leads</h1>
                        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                            {leads.length} lead{leads.length !== 1 ? 's' : ''} · {groups.length} utilisateur{groups.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleRefresh} disabled={refreshing} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '9px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                        background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', color: '#94a3b8'
                    }}>
                        <RefreshCw style={{ width: 14, height: 14, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        Actualiser
                    </button>
                    <button onClick={exportCSV} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '9px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                        background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8'
                    }}>
                        <Download style={{ width: 14, height: 14 }} />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#64748b' }} />
                <input
                    type="text"
                    placeholder="Rechercher par nom, email, téléphone, intérêt, entreprise…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: '100%', padding: '12px 40px 12px 44px', borderRadius: 12,
                        background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box'
                    }}
                />
                {search && (
                    <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
                        <X style={{ width: 14, height: 14 }} />
                    </button>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <div style={{ padding: 60, textAlign: 'center' }}>
                    <Loader2 style={{ width: 28, height: 28, color: '#34d399', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                </div>
            ) : groups.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#475569' }}>
                    <Target style={{ width: 36, height: 36, opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
                    {debouncedSearch ? 'Aucun lead correspondant' : 'Aucun lead capturé pour le moment'}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {groups.map(group => {
                        const isOpen = expanded.has(group.user_id)
                        return (
                            <motion.div key={group.user_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, overflow: 'hidden' }}>

                                {/* User row header */}
                                <button
                                    onClick={() => toggleGroup(group.user_id)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                                        padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    {/* Avatar */}
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                                        background: avatarColor(group.user_id),
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 700, fontSize: 14
                                    }}>
                                        {getInitials(group.owner_email)}
                                    </div>

                                    {/* Email + agents */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <User style={{ width: 13, height: 13, color: '#64748b', flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {group.owner_email}
                                            </span>
                                        </div>
                                        {group.agents.length > 0 && (
                                            <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                                                {group.agents.map(a => (
                                                    <span key={a} style={{
                                                        fontSize: 11, padding: '2px 8px', borderRadius: 20,
                                                        background: 'rgba(167, 139, 250, 0.12)', color: '#a78bfa',
                                                        display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                                                    }}>
                                                        <Bot style={{ width: 10, height: 10 }} /> {a}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Lead count */}
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{
                                            fontSize: 20, fontWeight: 700,
                                            color: group.leads.length >= 10 ? '#34d399' : '#94a3b8'
                                        }}>
                                            {group.leads.length}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#475569' }}>lead{group.leads.length !== 1 ? 's' : ''}</div>
                                    </div>

                                    {/* Last date */}
                                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 8 }}>
                                        <div style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Calendar style={{ width: 10, height: 10 }} />
                                            {new Date(group.lastDate).toLocaleDateString('fr-FR')}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#334155' }}>
                                            {new Date(group.lastDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>

                                    {/* Expand icon */}
                                    <div style={{ marginLeft: 8, color: '#475569', flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                                        <ChevronRight style={{ width: 18, height: 18 }} />
                                    </div>
                                </button>

                                {/* Leads list (expanded) */}
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            style={{ overflow: 'hidden' }}
                                        >
                                            <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.08)', overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                                                    <thead>
                                                        <tr>
                                                            {['Lead', 'Contact', 'Intérêt', 'Entreprise / Lieu', 'Agent', 'Date'].map(h => (
                                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', background: 'rgba(15, 23, 42, 0.3)' }}>
                                                                    {h}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {group.leads.map(lead => (
                                                            <tr key={lead.id} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                                                <td style={{ padding: '11px 16px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                                                        <div style={{
                                                                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                                                                            background: 'rgba(99, 102, 241, 0.15)',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            color: '#a5b4fc', fontWeight: 700, fontSize: 11
                                                                        }}>
                                                                            {lead.lead_name ? lead.lead_name[0].toUpperCase() : '?'}
                                                                        </div>
                                                                        <span style={{ fontWeight: 500, color: 'white', fontSize: 13 }}>
                                                                            {lead.lead_name || <span style={{ color: '#475569', fontStyle: 'italic' }}>Sans nom</span>}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '11px 16px' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                        {(lead.lead_phone || lead.customer_phone) && (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                                                                                <Phone style={{ width: 10, height: 10, color: '#64748b' }} />
                                                                                {lead.lead_phone || lead.customer_phone}
                                                                            </div>
                                                                        )}
                                                                        {lead.lead_email && (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                                                                                <Mail style={{ width: 10, height: 10, color: '#64748b' }} />
                                                                                {lead.lead_email}
                                                                            </div>
                                                                        )}
                                                                        {!lead.lead_phone && !lead.customer_phone && !lead.lead_email && (
                                                                            <span style={{ fontSize: 12, color: '#475569' }}>—</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '11px 16px', maxWidth: 160 }}>
                                                                    {lead.interest ? (
                                                                        <span style={{
                                                                            fontSize: 11, padding: '2px 9px', borderRadius: 20,
                                                                            background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc',
                                                                            display: 'inline-block', maxWidth: '100%',
                                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                                        }} title={lead.interest}>
                                                                            {lead.interest}
                                                                        </span>
                                                                    ) : <span style={{ fontSize: 12, color: '#475569' }}>—</span>}
                                                                </td>
                                                                <td style={{ padding: '11px 16px' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                        {lead.lead_company && (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                                                                                <Building2 style={{ width: 10, height: 10, color: '#64748b' }} />
                                                                                {lead.lead_company}
                                                                            </div>
                                                                        )}
                                                                        {lead.lead_location && (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                                                                                <MapPin style={{ width: 10, height: 10, color: '#64748b' }} />
                                                                                {lead.lead_location}
                                                                            </div>
                                                                        )}
                                                                        {!lead.lead_company && !lead.lead_location && (
                                                                            <span style={{ fontSize: 12, color: '#475569' }}>—</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '11px 16px' }}>
                                                                    {lead.agent_name ? (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94a3b8' }}>
                                                                            <Bot style={{ width: 11, height: 11, color: '#a78bfa' }} />
                                                                            {lead.agent_name}
                                                                        </div>
                                                                    ) : <span style={{ fontSize: 12, color: '#475569' }}>—</span>}
                                                                </td>
                                                                <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                                                                    <div style={{ fontSize: 12, color: '#64748b' }}>
                                                                        {new Date(lead.created_at).toLocaleDateString('fr-FR')}
                                                                    </div>
                                                                    <div style={{ fontSize: 10, color: '#334155' }}>
                                                                        {new Date(lead.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
