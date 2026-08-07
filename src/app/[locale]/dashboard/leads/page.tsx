'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Users, Phone, Mail, Tag, Calendar, MapPin,
    Building2, Trash2, Search, RefreshCw, Bot, Download, X,
    Clock, Scissors, FileText, Check
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface LeadItem {
    product_name: string
    variant: string | null
    quantity: number
    unit_price: number
    subtotal: number
}

interface Lead {
    id: string
    agent_id: string | null
    agent_name: string | null
    customer_phone: string | null
    lead_name: string | null
    lead_phone: string | null
    lead_email: string | null
    lead_location: string | null
    lead_address: string | null
    lead_company: string | null
    interest: string | null
    preferred_date: string | null
    preferred_time: string | null
    service_requested: string | null
    lead_notes: string | null
    custom_fields: Record<string, string> | null
    is_treated: boolean
    created_at: string
    conversation_id: string | null
    estimated_total: number | null
    delivery_fee: number | null
    items: LeadItem[] | null
    treated_at: string | null
    merchant_notes: string | null
    location_link: string | null
}

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [agentFilter, setAgentFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState<'all' | 'untreated' | 'treated'>('all')
    const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent')
    const [deleting, setDeleting] = useState<string | null>(null)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})
    const [savingNotesId, setSavingNotesId] = useState<string | null>(null)
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

    const toggleTreated = async (lead: Lead) => {
        const nextValue = !lead.is_treated
        setUpdatingId(lead.id)
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, is_treated: nextValue } : l))
        try {
            const res = await fetch(`/api/leads?id=${lead.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_treated: nextValue }),
            })
            if (!res.ok) throw new Error('failed')
        } catch {
            setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, is_treated: !nextValue } : l))
            toast.error('Erreur lors de la mise à jour.')
        } finally {
            setUpdatingId(null)
        }
    }

    const saveMerchantNotes = async (leadId: string) => {
        const value = notesDraft[leadId] ?? ''
        setSavingNotesId(leadId)
        try {
            const res = await fetch(`/api/leads?id=${leadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ merchant_notes: value }),
            })
            if (!res.ok) throw new Error('failed')
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, merchant_notes: value.trim() || null } : l))
            toast.success('Note enregistrée.')
        } catch {
            toast.error('Erreur lors de l\'enregistrement de la note.')
        } finally {
            setSavingNotesId(null)
        }
    }

    const formatFCFA = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

    const agentOptions = Array.from(
        new Map(leads.filter(l => l.agent_id).map(l => [l.agent_id, l.agent_name])).entries()
    ).map(([id, name]) => ({ id, name }))

    const untreatedCount = leads.filter(l => !l.is_treated).length

    const filtered = leads
        .filter(lead => {
            const matchAgent = agentFilter === 'all' || lead.agent_id === agentFilter
            const matchStatus = statusFilter === 'all'
                || (statusFilter === 'untreated' && !lead.is_treated)
                || (statusFilter === 'treated' && lead.is_treated)
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
                (lead.merchant_notes || '').toLowerCase().includes(q) ||
                customStr.includes(q)
            return matchAgent && matchStatus && matchSearch
        })
        .sort((a, b) => {
            const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            return sortOrder === 'recent' ? -diff : diff
        })

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    const exportCSV = () => {
        // Collect all custom field keys across all leads
        const allCustomKeys = Array.from(
            new Set(leads.flatMap(l => l.custom_fields ? Object.keys(l.custom_fields) : []))
        )
        const headers = ['Nom', 'Téléphone', 'Email', 'Entreprise', 'Localisation', 'Adresse', 'Lien localisation', 'Intérêt', 'Total estimé', 'Frais de livraison', 'Service demandé', 'Date souhaitée', 'Heure souhaitée', 'Notes client', 'Notes marchand', ...allCustomKeys, 'Agent', 'Traité', 'Date']
        const rows = [
            headers,
            ...filtered.map(l => [
                l.lead_name || '',
                l.lead_phone || l.customer_phone || '',
                l.lead_email || '',
                l.lead_company || '',
                l.lead_location || '',
                l.lead_address || '',
                l.location_link || '',
                l.interest || '',
                typeof l.estimated_total === 'number' ? l.estimated_total : '',
                typeof l.delivery_fee === 'number' ? l.delivery_fee : '',
                l.service_requested || '',
                l.preferred_date || '',
                l.preferred_time || '',
                l.lead_notes || '',
                l.merchant_notes || '',
                ...allCustomKeys.map(k => l.custom_fields?.[k] || ''),
                l.agent_name,
                l.is_treated ? 'Oui' : 'Non',
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
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px' }}>

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
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {([
                    { key: 'all', label: 'Tous' },
                    { key: 'untreated', label: `Non traités${untreatedCount > 0 ? ` (${untreatedCount})` : ''}` },
                    { key: 'treated', label: 'Traités' },
                ] as const).map(opt => (
                    <button
                        key={opt.key}
                        onClick={() => setStatusFilter(opt.key)}
                        style={{
                            padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            border: statusFilter === opt.key ? '1px solid #10b981' : '1px solid rgba(148,163,184,0.15)',
                            background: statusFilter === opt.key ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                            color: statusFilter === opt.key ? '#34d399' : '#94a3b8',
                        }}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

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
                {agentOptions.length >= 1 && (
                    <select
                        value={agentFilter}
                        onChange={e => setAgentFilter(e.target.value)}
                        style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(15,23,42,0.8)', color: '#e2e8f0', fontSize: 13, outline: 'none', minWidth: 180 }}
                    >
                        <option value="all">Tous les agents</option>
                        {agentOptions.map(a => <option key={a.id ?? ''} value={a.id ?? ''}>{a.name ?? ''}</option>)}
                    </select>
                )}
                <select
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value as 'recent' | 'oldest')}
                    style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(15,23,42,0.8)', color: '#e2e8f0', fontSize: 13, outline: 'none', minWidth: 160 }}
                >
                    <option value="recent">Plus récents</option>
                    <option value="oldest">Plus anciens</option>
                </select>
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
                    {filtered.map(lead => {
                        const hasExtra = !!(lead.custom_fields && Object.keys(lead.custom_fields).length > 0) || !!lead.lead_notes
                        const hasDemande = !!(lead.service_requested || lead.preferred_date || lead.preferred_time || lead.interest)
                        const cols = hasExtra ? '1fr 1fr 1fr' : hasDemande ? '1fr 1fr' : '1fr'

                        return (
                            <div key={lead.id} style={{ background: 'rgba(15,23,42,0.85)', border: `1px solid ${lead.is_treated ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.1)'}`, borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 0.2s', opacity: lead.is_treated ? 0.6 : 1 }}>

                                {/* Ligne 1 : nom + agent + date + traite + supprimer */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Users size={16} color="#10b981" />
                                    </div>
                                    <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>
                                        {lead.lead_name || lead.lead_phone || (!lead.customer_phone?.includes('@lid') ? lead.customer_phone : null) || 'Contact anonyme'}
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, background: lead.agent_id ? 'rgba(139,92,246,0.15)' : 'rgba(100,116,139,0.15)', border: `1px solid ${lead.agent_id ? 'rgba(139,92,246,0.3)' : 'rgba(100,116,139,0.3)'}`, color: lead.agent_id ? '#a78bfa' : '#64748b', fontSize: 12, fontWeight: 500 }}>
                                        <Bot size={10} /> {lead.agent_name || 'Agent supprimé'}
                                    </span>
                                    {typeof lead.estimated_total === 'number' && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>
                                            💰 {formatFCFA(lead.estimated_total)}
                                        </span>
                                    )}
                                    <div style={{ flex: 1 }} />
                                    <span style={{ color: '#475569', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Calendar size={11} /> {formatDate(lead.created_at)}
                                    </span>
                                    <button
                                        onClick={() => toggleTreated(lead)}
                                        disabled={updatingId === lead.id}
                                        title={lead.is_treated ? 'Marquer comme non traité' : 'Marquer comme traité'}
                                        style={{
                                            width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                                            opacity: updatingId === lead.id ? 0.5 : 1,
                                            background: lead.is_treated ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.08)',
                                            border: lead.is_treated ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(148,163,184,0.2)',
                                            color: lead.is_treated ? '#10b981' : '#64748b',
                                        }}
                                    >
                                        <Check size={14} />
                                    </button>
                                    <button
                                        onClick={() => deleteLead(lead.id)}
                                        disabled={deleting === lead.id}
                                        style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: deleting === lead.id ? 0.5 : 1, flexShrink: 0 }}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>

                                {/* Grille colonnes */}
                                <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10 }}>

                                    {/* Col 1 : Contact */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '12px 14px', background: 'rgba(30,41,59,0.35)', borderRadius: 11, border: '1px solid rgba(148,163,184,0.06)' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>Contact</div>
                                        {lead.lead_phone && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
                                                <Phone size={13} color="#64748b" style={{ flexShrink: 0 }} /> {lead.lead_phone}
                                            </span>
                                        )}
                                        {lead.customer_phone && lead.customer_phone !== lead.lead_phone && !lead.customer_phone.includes('@lid') && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
                                                <Phone size={13} color="#f59e0b" style={{ flexShrink: 0 }} /> {lead.customer_phone}
                                            </span>
                                        )}
                                        {lead.lead_email && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
                                                <Mail size={13} color="#64748b" style={{ flexShrink: 0 }} /> {lead.lead_email}
                                            </span>
                                        )}
                                        {lead.lead_company && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
                                                <Building2 size={13} color="#64748b" style={{ flexShrink: 0 }} /> {lead.lead_company}
                                            </span>
                                        )}
                                        {lead.lead_location && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
                                                <MapPin size={13} color="#64748b" style={{ flexShrink: 0 }} /> {lead.lead_location}
                                            </span>
                                        )}
                                        {lead.location_link && (
                                            <a
                                                href={lead.location_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#38bdf8', textDecoration: 'none' }}
                                            >
                                                <MapPin size={13} color="#38bdf8" style={{ flexShrink: 0 }} /> Voir sur la carte
                                            </a>
                                        )}
                                    </div>

                                    {/* Col 2 : Demande (si données) */}
                                    {hasDemande && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '12px 14px', background: 'rgba(30,41,59,0.35)', borderRadius: 11, border: '1px solid rgba(148,163,184,0.06)' }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>Demande</div>
                                            {(lead.service_requested || lead.interest) && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 100, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399', fontSize: 12, fontWeight: 500, width: 'fit-content' }}>
                                                    {lead.service_requested || lead.interest}
                                                </span>
                                            )}
                                            {lead.preferred_date && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
                                                    <Calendar size={13} color="#64748b" style={{ flexShrink: 0 }} /> {lead.preferred_date}
                                                </span>
                                            )}
                                            {lead.preferred_time && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1' }}>
                                                    <Clock size={13} color="#64748b" style={{ flexShrink: 0 }} /> {lead.preferred_time}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Col 3 : Infos supplémentaires (si données) */}
                                    {hasExtra && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '12px 14px', background: 'rgba(30,41,59,0.35)', borderRadius: 11, border: '1px solid rgba(148,163,184,0.06)' }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>Infos supplémentaires</div>
                                            {lead.custom_fields && Object.entries(lead.custom_fields).map(([key, value]) => (
                                                <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#c4b5fd', fontSize: 12, width: 'fit-content' }}>
                                                    <span style={{ color: '#a78bfa', fontWeight: 700 }}>{key} :</span> {value}
                                                </span>
                                            ))}
                                            {lead.lead_notes && (
                                                <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, lineHeight: 1.5 }}>
                                                    "{lead.lead_notes}"
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Notes marchand : suivi interne, distinct de lead_notes (rempli par le client) */}
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <textarea
                                        value={notesDraft[lead.id] ?? lead.merchant_notes ?? ''}
                                        onChange={e => setNotesDraft(prev => ({ ...prev, [lead.id]: e.target.value }))}
                                        placeholder="Note de suivi interne (ex : rappelé le 8, en attente de réponse…)"
                                        rows={1}
                                        style={{ flex: 1, resize: 'vertical', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(30,41,59,0.35)', color: '#e2e8f0', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                                    />
                                    {(notesDraft[lead.id] ?? '') !== (lead.merchant_notes ?? '') && notesDraft[lead.id] !== undefined && (
                                        <button
                                            onClick={() => saveMerchantNotes(lead.id)}
                                            disabled={savingNotesId === lead.id}
                                            style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.12)', color: '#34d399', cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: savingNotesId === lead.id ? 0.5 : 1, whiteSpace: 'nowrap' }}
                                        >
                                            {savingNotesId === lead.id ? '...' : 'Enregistrer'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
