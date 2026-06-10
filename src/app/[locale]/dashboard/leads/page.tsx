'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Users, Phone, Mail, Tag, Calendar, MapPin,
    Building2, Trash2, Search, RefreshCw, Bot, Download, X,
    Clock, Scissors, FileText
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Lead {
    id: string
    agent_id: string
    agent_name: string
    customer_phone: string | null
    lead_name: string | null
    lead_phone: string | null
    lead_email: string | null
    lead_location: string | null
    lead_company: string | null
    interest: string | null
    preferred_date: string | null
    preferred_time: string | null
    service_requested: string | null
    lead_notes: string | null
    custom_fields: Record<string, string> | null
    created_at: string
}

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [agentFilter, setAgentFilter] = useState('all')
    const [deleting, setDeleting] = useState<string | null>(null)
    const toast = useToast()

    const fetchLeads = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/leads')
            const data = await res.json()
            if (res.ok) setLeads(data.data?.leads || [])
        } catch {
            toast.error('Erreur lors du chargement des leads.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchLeads() }, [fetchLeads])

    const deleteLead = async (leadId: string) => {
        const ok = await toast.confirm({ title: 'Supprimer ce lead ?', confirmLabel: 'Supprimer', danger: true })
        if (!ok) return
        setDeleting(leadId)
        try {
            await fetch(`/api/leads?id=${leadId}`, { method: 'DELETE' })
            setLeads(prev => prev.filter(l => l.id !== leadId))
            toast.success('Lead supprimé.')
        } catch {
            toast.error('Erreur lors de la suppression.')
        } finally {
            setDeleting(null)
        }
    }

    const agentOptions = Array.from(
        new Map(leads.map(l => [l.agent_id, l.agent_name])).entries()
    ).map(([id, name]) => ({ id, name }))

    const filtered = leads.filter(lead => {
        const matchAgent = agentFilter === 'all' || lead.agent_id === agentFilter
        const q = search.toLowerCase()
        const customStr = lead.custom_fields ? Object.values(lead.custom_fields).join(' ').toLowerCase() : ''
        const matchSearch = !q ||
            (lead.lead_name || '').toLowerCase().includes(q) ||
            (lead.lead_phone || '').includes(q) ||
            (lead.lead_email || '').toLowerCase().includes(q) ||
            (lead.lead_company || '').toLowerCase().includes(q) ||
            (lead.interest || '').toLowerCase().includes(q) ||
            (lead.service_requested || '').toLowerCase().includes(q) ||
            (lead.customer_phone || '').includes(q) ||
            customStr.includes(q)
        return matchAgent && matchSearch
    })

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    const exportCSV = () => {
        // Collect all custom field keys across all leads
        const allCustomKeys = Array.from(
            new Set(leads.flatMap(l => l.custom_fields ? Object.keys(l.custom_fields) : []))
        )
        const headers = ['Nom', 'Téléphone', 'Email', 'Entreprise', 'Localisation', 'Intérêt', 'Service demandé', 'Date souhaitée', 'Heure souhaitée', 'Notes', ...allCustomKeys, 'Agent', 'Date']
        const rows = [
            headers,
            ...filtered.map(l => [
                l.lead_name || '',
                l.lead_phone || l.customer_phone || '',
                l.lead_email || '',
                l.lead_company || '',
                l.lead_location || '',
                l.interest || '',
                l.service_requested || '',
                l.preferred_date || '',
                l.preferred_time || '',
                l.lead_notes || '',
                ...allCustomKeys.map(k => l.custom_fields?.[k] || ''),
                l.agent_name,
                formatDate(l.created_at),
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

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>

            {/* En-tête */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Users size={22} color="#10b981" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Leads collectés</h1>
                        <p style={{ color: '#64748b', fontSize: 13, margin: '3px 0 0' }}>
                            {leads.length} lead{leads.length !== 1 ? 's' : ''} au total · contacts collectés par vos agents WhatsApp
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={fetchLeads}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
                    >
                        <RefreshCw size={13} />
                        Rafraîchir
                    </button>
                    {filtered.length > 0 && (
                        <button
                            onClick={exportCSV}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.08)', color: '#10b981', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                        >
                            <Download size={13} />
                            Exporter CSV
                        </button>
                    )}
                </div>
            </div>

            {/* Barre recherche + filtre */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher par nom, téléphone, email, service…"
                        style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 0 }}>
                            <X size={13} />
                        </button>
                    )}
                </div>
                {agentOptions.length > 1 && (
                    <select
                        value={agentFilter}
                        onChange={e => setAgentFilter(e.target.value)}
                        style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(15,23,42,0.8)', color: '#e2e8f0', fontSize: 13, outline: 'none', minWidth: 180 }}
                    >
                        <option value="all">Tous les agents</option>
                        {agentOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                )}
            </div>

            {(search || agentFilter !== 'all') && !loading && (
                <p style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
                    {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
                </p>
            )}

            {/* Liste */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>Chargement…</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
                    <Users size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.2 }} />
                    <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                        {leads.length === 0 ? 'Aucun lead pour l\'instant' : 'Aucun résultat'}
                    </p>
                    <p style={{ fontSize: 13 }}>
                        {leads.length === 0
                            ? 'Les leads apparaîtront ici quand vos agents collecteront des contacts WhatsApp.'
                            : 'Essayez un autre terme de recherche.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filtered.map(lead => (
                        <div
                            key={lead.id}
                            style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(30,41,59,0.8)', borderRadius: 14, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}
                        >
                            {/* Avatar */}
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Users size={17} color="#10b981" />
                            </div>

                            {/* Contenu */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Ligne titre */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>
                                            {lead.lead_name || lead.customer_phone || 'Contact anonyme'}
                                        </span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', fontSize: 11 }}>
                                            <Bot size={10} /> {lead.agent_name}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: '#475569', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Calendar size={11} />
                                            {formatDate(lead.created_at)}
                                        </span>
                                        <button
                                            onClick={() => deleteLead(lead.id)}
                                            disabled={deleting === lead.id}
                                            style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: 8, padding: '5px 9px', color: '#f87171', cursor: 'pointer', opacity: deleting === lead.id ? 0.5 : 1 }}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Infos contact */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, marginBottom: (lead.preferred_date || lead.preferred_time || lead.service_requested || lead.lead_notes || lead.custom_fields) ? 8 : 0 }}>
                                    {lead.lead_phone && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <Phone size={12} color="#10b981" /> {lead.lead_phone}
                                        </span>
                                    )}
                                    {lead.customer_phone && lead.customer_phone !== lead.lead_phone && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <Phone size={12} color="#f59e0b" /> WhatsApp : {lead.customer_phone}
                                        </span>
                                    )}
                                    {lead.lead_email && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <Mail size={12} color="#6366f1" /> {lead.lead_email}
                                        </span>
                                    )}
                                    {lead.lead_company && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <Building2 size={12} color="#a78bfa" /> {lead.lead_company}
                                        </span>
                                    )}
                                    {lead.lead_location && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <MapPin size={12} color="#f59e0b" /> {lead.lead_location}
                                        </span>
                                    )}
                                    {lead.interest && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.08)', color: '#6ee7b7', fontSize: 11 }}>
                                            <Tag size={10} /> {lead.interest}
                                        </span>
                                    )}
                                </div>

                                {/* Champs enrichis : date/heure/service/notes */}
                                {(lead.preferred_date || lead.preferred_time || lead.service_requested || lead.lead_notes) && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, marginBottom: lead.custom_fields ? 8 : 0, padding: '8px 10px', background: 'rgba(30,41,59,0.5)', borderRadius: 8 }}>
                                        {lead.service_requested && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#c4b5fd' }}>
                                                <Scissors size={11} color="#a78bfa" /> {lead.service_requested}
                                            </span>
                                        )}
                                        {lead.preferred_date && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#93c5fd' }}>
                                                <Calendar size={11} color="#60a5fa" /> {lead.preferred_date}
                                            </span>
                                        )}
                                        {lead.preferred_time && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#93c5fd' }}>
                                                <Clock size={11} color="#60a5fa" /> {lead.preferred_time}
                                            </span>
                                        )}
                                        {lead.lead_notes && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                                <FileText size={11} color="#64748b" /> {lead.lead_notes}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Champs personnalisés */}
                                {lead.custom_fields && Object.keys(lead.custom_fields).length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
                                        {Object.entries(lead.custom_fields).map(([key, value]) => (
                                            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: '#c4b5fd' }}>
                                                <span style={{ color: '#7c3aed', fontWeight: 600 }}>{key} :</span> {value}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
