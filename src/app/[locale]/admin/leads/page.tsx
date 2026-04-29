'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Target, Search, Download, RefreshCw, Loader2, X,
    Phone, Mail, MapPin, Building2, Bot, User, Calendar,
    ChevronLeft, ChevronRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
    agent_name?: string
    owner_email?: string
}

const PAGE_SIZE = 20

export default function AdminLeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
        return () => clearTimeout(t)
    }, [search])

    useEffect(() => { fetchLeads() }, [page, debouncedSearch])

    const fetchLeads = async () => {
        setLoading(true)
        try {
            const supabase = createClient()
            const from = (page - 1) * PAGE_SIZE
            const to = from + PAGE_SIZE - 1

            let query = supabase
                .from('leads')
                .select(`
                    id, agent_id, user_id, customer_phone,
                    lead_name, lead_phone, lead_email, interest,
                    lead_location, lead_company, created_at,
                    agents(name),
                    profiles(email)
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to)

            if (debouncedSearch) {
                query = query.or(
                    `lead_name.ilike.%${debouncedSearch}%,lead_email.ilike.%${debouncedSearch}%,lead_phone.ilike.%${debouncedSearch}%,interest.ilike.%${debouncedSearch}%,lead_company.ilike.%${debouncedSearch}%`
                )
            }

            const { data, count } = await query
            setLeads((data || []).map((l: any) => ({
                ...l,
                agent_name: l.agents?.name || null,
                owner_email: l.profiles?.email || null,
            })))
            setTotal(count || 0)
        } catch (err) {
            console.error('Error fetching leads:', err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const handleRefresh = () => { setRefreshing(true); fetchLeads() }

    const exportCSV = () => {
        const rows = [
            ['Nom', 'Téléphone', 'Email', 'Intérêt', 'Entreprise', 'Localisation', 'Agent', 'Propriétaire', 'Date'],
            ...leads.map(l => [
                l.lead_name || '',
                l.lead_phone || l.customer_phone || '',
                l.lead_email || '',
                l.interest || '',
                l.lead_company || '',
                l.lead_location || '',
                l.agent_name || '',
                l.owner_email || '',
                new Date(l.created_at).toLocaleDateString('fr-FR')
            ])
        ]
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const totalPages = Math.ceil(total / PAGE_SIZE)

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
                            {total} lead{total !== 1 ? 's' : ''} capturé{total !== 1 ? 's' : ''} par les agents IA
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

            {/* Table */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                {['Lead', 'Contact', 'Intérêt', 'Entreprise / Lieu', 'Agent', 'Propriétaire', 'Date'].map(h => (
                                    <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center' }}>
                                    <Loader2 style={{ width: 24, height: 24, color: '#34d399', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                                </td></tr>
                            ) : leads.length === 0 ? (
                                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#475569' }}>
                                    <Target style={{ width: 32, height: 32, opacity: 0.3, display: 'block', margin: '0 auto 10px' }} />
                                    {debouncedSearch ? 'Aucun lead correspondant' : 'Aucun lead capturé pour le moment'}
                                </td></tr>
                            ) : leads.map((lead, i) => (
                                <tr key={lead.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.04)', transition: 'background 0.15s' }}>
                                    {/* Lead identity */}
                                    <td style={{ padding: '13px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{
                                                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'white', fontWeight: 700, fontSize: 13
                                            }}>
                                                {lead.lead_name ? lead.lead_name[0].toUpperCase() : '?'}
                                            </div>
                                            <span style={{ fontWeight: 500, color: 'white', fontSize: 13 }}>
                                                {lead.lead_name || <span style={{ color: '#475569', fontStyle: 'italic' }}>Sans nom</span>}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Contact */}
                                    <td style={{ padding: '13px 16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                            {(lead.lead_phone || lead.customer_phone) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94a3b8' }}>
                                                    <Phone style={{ width: 11, height: 11, color: '#64748b' }} />
                                                    {lead.lead_phone || lead.customer_phone}
                                                </div>
                                            )}
                                            {lead.lead_email && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94a3b8' }}>
                                                    <Mail style={{ width: 11, height: 11, color: '#64748b' }} />
                                                    {lead.lead_email}
                                                </div>
                                            )}
                                            {!lead.lead_phone && !lead.customer_phone && !lead.lead_email && (
                                                <span style={{ fontSize: 12, color: '#475569' }}>—</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Intérêt */}
                                    <td style={{ padding: '13px 16px', maxWidth: 180 }}>
                                        {lead.interest ? (
                                            <span style={{
                                                fontSize: 12, padding: '3px 10px', borderRadius: 20,
                                                background: 'rgba(99, 102, 241, 0.12)', color: '#a5b4fc',
                                                display: 'inline-block', maxWidth: '100%',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                            }} title={lead.interest}>
                                                {lead.interest}
                                            </span>
                                        ) : <span style={{ fontSize: 12, color: '#475569' }}>—</span>}
                                    </td>

                                    {/* Entreprise / Lieu */}
                                    <td style={{ padding: '13px 16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                            {lead.lead_company && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94a3b8' }}>
                                                    <Building2 style={{ width: 11, height: 11, color: '#64748b' }} />
                                                    {lead.lead_company}
                                                </div>
                                            )}
                                            {lead.lead_location && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94a3b8' }}>
                                                    <MapPin style={{ width: 11, height: 11, color: '#64748b' }} />
                                                    {lead.lead_location}
                                                </div>
                                            )}
                                            {!lead.lead_company && !lead.lead_location && (
                                                <span style={{ fontSize: 12, color: '#475569' }}>—</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Agent */}
                                    <td style={{ padding: '13px 16px' }}>
                                        {lead.agent_name ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94a3b8' }}>
                                                <Bot style={{ width: 12, height: 12, color: '#a78bfa' }} />
                                                {lead.agent_name}
                                            </div>
                                        ) : <span style={{ fontSize: 12, color: '#475569' }}>—</span>}
                                    </td>

                                    {/* Propriétaire */}
                                    <td style={{ padding: '13px 16px' }}>
                                        {lead.owner_email ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b' }}>
                                                <User style={{ width: 11, height: 11 }} />
                                                {lead.owner_email}
                                            </div>
                                        ) : <span style={{ fontSize: 12, color: '#475569' }}>—</span>}
                                    </td>

                                    {/* Date */}
                                    <td style={{ padding: '13px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                                            <Calendar style={{ width: 11, height: 11 }} />
                                            {new Date(lead.created_at).toLocaleDateString('fr-FR')}
                                            <span style={{ fontSize: 10, color: '#475569' }}>
                                                {new Date(lead.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}
                        style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', color: page === 1 ? '#475569' : '#e2e8f0', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <ChevronLeft style={{ width: 15, height: 15 }} /> Précédent
                    </button>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>
                        Page <span style={{ color: 'white', fontWeight: 600 }}>{page}</span> sur {totalPages}
                        <span style={{ color: '#475569', marginLeft: 8 }}>({total} leads)</span>
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}
                        style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', color: page === totalPages ? '#475569' : '#e2e8f0', cursor: page === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        Suivant <ChevronRight style={{ width: 15, height: 15 }} />
                    </button>
                </div>
            )}
        </div>
    )
}
