'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Users, Phone, Mail, Calendar, MapPin,
    Building2, Trash2, Search, RefreshCw, Bot, Download, X,
    Clock, Check, ExternalLink, Store
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

    const initials = (lead: Lead) => {
        const name = lead.lead_name?.trim()
        if (!name) return '?'
        const parts = name.split(/\s+/).filter(Boolean)
        return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
    }

    const displayName = (lead: Lead) =>
        lead.lead_name || lead.lead_phone || (!lead.customer_phone?.includes('@lid') ? lead.customer_phone : null) || 'Contact anonyme'

    // Leads sans items structurés (capturés avant le suivi total/articles, ou agent service) —
    // on découpe quand même interest en fragments pour un rendu en chips cohérent avec les
    // leads qui ont des items réels, plutôt qu'un seul gros bloc de texte.
    const splitInterest = (interest: string) =>
        interest.split(/,|\+| et /i).map(s => s.trim()).filter(Boolean)

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

            {/* Liste dense */}
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
                <div>
                    {/* En-tête colonnes */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 4px 10px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                        <div style={{ width: 32 }} />
                        <div style={{ flex: 1.6 }}>Contact</div>
                        <div style={{ flex: 2.2 }}>Articles</div>
                        <div style={{ width: 130, textAlign: 'right' }}>Total</div>
                        <div style={{ width: 90, textAlign: 'right' }}>Reçu</div>
                        <div style={{ width: 66 }} />
                    </div>

                    {filtered.map(lead => {
                        const itemChips = lead.items && lead.items.length > 0 ? lead.items : null
                        const noteDraftValue = notesDraft[lead.id] ?? lead.merchant_notes ?? ''
                        const noteDirty = notesDraft[lead.id] !== undefined && noteDraftValue !== (lead.merchant_notes ?? '')

                        return (
                            <details key={lead.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                                <summary style={{
                                    listStyle: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                                    padding: '13px 4px', opacity: lead.is_treated ? 0.55 : 1,
                                }}>
                                    <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: lead.is_treated ? 'rgba(148,163,184,0.2)' : '#10b981', flexShrink: 0 }} />
                                    <span style={{
                                        width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 12, fontWeight: 800, flexShrink: 0,
                                        background: lead.is_treated ? 'rgba(100,116,139,0.12)' : 'rgba(16,185,129,0.14)',
                                        color: lead.is_treated ? '#64748b' : '#34d399',
                                        border: `1px solid ${lead.is_treated ? 'rgba(148,163,184,0.2)' : 'rgba(16,185,129,0.22)'}`,
                                    }}>
                                        {initials(lead)}
                                    </span>

                                    <div style={{ flex: 1.6, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {displayName(lead)}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Bot size={10} /> {lead.agent_name || 'Agent supprimé'}
                                        </div>
                                    </div>

                                    <div style={{ flex: 2.2, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                                        {itemChips ? (
                                            <>
                                                {itemChips.slice(0, 2).map((it, i) => (
                                                    <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)', padding: '2px 8px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                                                        <b style={{ color: 'white', fontWeight: 700 }}>{it.quantity}×</b> {it.product_name}{it.variant ? ` ${it.variant}` : ''}
                                                    </span>
                                                ))}
                                                {itemChips.length > 2 && (
                                                    <span style={{ fontSize: 11, color: '#475569', border: '1px dashed rgba(148,163,184,0.15)', padding: '2px 8px', borderRadius: 100 }}>
                                                        +{itemChips.length - 2} article{itemChips.length - 2 > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </>
                                        ) : lead.service_requested ? (
                                            <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)', padding: '2px 8px', borderRadius: 100 }}>
                                                {lead.service_requested}
                                            </span>
                                        ) : lead.interest ? (
                                            <>
                                                {splitInterest(lead.interest).slice(0, 2).map((frag, i) => (
                                                    <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.1)', padding: '2px 8px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                                                        {frag}
                                                    </span>
                                                ))}
                                                {splitInterest(lead.interest).length > 2 && (
                                                    <span style={{ fontSize: 11, color: '#475569', border: '1px dashed rgba(148,163,184,0.15)', padding: '2px 8px', borderRadius: 100 }}>
                                                        +{splitInterest(lead.interest).length - 2} article{splitInterest(lead.interest).length - 2 > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </>
                                        ) : null}
                                    </div>

                                    <div style={{ width: 130, textAlign: 'right', flexShrink: 0 }}>
                                        {typeof lead.estimated_total === 'number' ? (
                                            <>
                                                <div style={{ fontWeight: 800, fontSize: 15, color: lead.is_treated ? '#94a3b8' : '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>
                                                    {lead.estimated_total.toLocaleString('fr-FR')}
                                                </div>
                                                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>FCFA{lead.delivery_fee ? ' · livraison incl.' : ''}</div>
                                            </>
                                        ) : (lead.preferred_date || lead.preferred_time) ? (
                                            <div style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>
                                                {[lead.preferred_date, lead.preferred_time].filter(Boolean).join(' ')}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 12, color: '#334155' }}>—</div>
                                        )}
                                    </div>

                                    <div style={{ width: 90, textAlign: 'right', fontSize: 12, color: '#475569', flexShrink: 0 }}>
                                        {formatDate(lead.created_at).split(' ').slice(-1)}
                                    </div>

                                    <div style={{ width: 66, display: 'flex', gap: 4, justifyContent: 'flex-end', flexShrink: 0 }}>
                                        <button
                                            onClick={e => { e.preventDefault(); toggleTreated(lead) }}
                                            disabled={updatingId === lead.id}
                                            title={lead.is_treated ? 'Marquer comme non traité' : 'Marquer comme traité'}
                                            style={{
                                                width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                                opacity: updatingId === lead.id ? 0.5 : 1,
                                                background: lead.is_treated ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.08)',
                                                border: lead.is_treated ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(148,163,184,0.2)',
                                                color: lead.is_treated ? '#10b981' : '#64748b',
                                            }}
                                        >
                                            <Check size={13} />
                                        </button>
                                        <button
                                            onClick={e => { e.preventDefault(); deleteLead(lead.id) }}
                                            disabled={deleting === lead.id}
                                            style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: deleting === lead.id ? 0.5 : 1 }}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </summary>

                                {/* Détail déplié */}
                                <div style={{ padding: '4px 4px 20px 49px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

                                    {/* Coordonnées */}
                                    <div style={{ background: 'rgba(30,41,59,0.45)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 11, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Coordonnées</div>
                                        {lead.lead_phone && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1', marginBottom: 5 }}>
                                                <Phone size={13} color="#64748b" style={{ flexShrink: 0 }} /> {lead.lead_phone}
                                            </div>
                                        )}
                                        {lead.customer_phone && lead.customer_phone !== lead.lead_phone && !lead.customer_phone.includes('@lid') && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1', marginBottom: 5 }}>
                                                <Phone size={13} color="#f59e0b" style={{ flexShrink: 0 }} /> {lead.customer_phone}
                                            </div>
                                        )}
                                        {lead.lead_email && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1', marginBottom: 5 }}>
                                                <Mail size={13} color="#64748b" style={{ flexShrink: 0 }} /> {lead.lead_email}
                                            </div>
                                        )}
                                        {lead.lead_company && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1', marginBottom: 5 }}>
                                                <Building2 size={13} color="#64748b" style={{ flexShrink: 0 }} /> {lead.lead_company}
                                            </div>
                                        )}
                                        {!lead.lead_address && lead.lead_location && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1', marginBottom: 5 }}>
                                                <MapPin size={13} color="#64748b" style={{ flexShrink: 0 }} /> {lead.lead_location}
                                            </div>
                                        )}
                                        {lead.lead_address && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1', marginBottom: 5 }}>
                                                {lead.lead_address.toLowerCase().includes('boutique') ? <Store size={13} color="#64748b" style={{ flexShrink: 0 }} /> : <MapPin size={13} color="#64748b" style={{ flexShrink: 0 }} />} {lead.lead_address}
                                            </div>
                                        )}
                                        {lead.location_link && (
                                            <a
                                                href={lead.location_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#38bdf8', textDecoration: 'none', wordBreak: 'break-all', marginTop: 4 }}
                                            >
                                                <ExternalLink size={12} style={{ flexShrink: 0 }} /> {lead.location_link}
                                            </a>
                                        )}
                                        {lead.custom_fields && Object.entries(lead.custom_fields).map(([key, value]) => (
                                            <div key={key} style={{ fontSize: 12, color: '#c4b5fd', marginTop: 5 }}>
                                                <span style={{ color: '#a78bfa', fontWeight: 700 }}>{key} :</span> {value}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Détail commande */}
                                    <div style={{ background: 'rgba(30,41,59,0.45)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 11, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Détail commande</div>
                                        {itemChips ? (
                                            <>
                                                {itemChips.map((it, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#cbd5e1', padding: '3px 0', borderBottom: '1px dashed rgba(148,163,184,0.1)' }}>
                                                        <span>{it.quantity} {it.product_name}{it.variant ? ` ${it.variant}` : ''}</span>
                                                        <b style={{ color: 'white', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{it.subtotal.toLocaleString('fr-FR')}</b>
                                                    </div>
                                                ))}
                                                {typeof lead.delivery_fee === 'number' && lead.delivery_fee > 0 && (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#cbd5e1', padding: '3px 0' }}>
                                                        <span>Livraison</span>
                                                        <b style={{ color: 'white', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{lead.delivery_fee.toLocaleString('fr-FR')}</b>
                                                    </div>
                                                )}
                                            </>
                                        ) : lead.interest ? (
                                            <>
                                                {splitInterest(lead.interest).map((frag, i) => (
                                                    <div key={i} style={{ fontSize: 13, color: '#cbd5e1', padding: '3px 0', borderBottom: '1px dashed rgba(148,163,184,0.1)' }}>
                                                        {frag}
                                                    </div>
                                                ))}
                                            </>
                                        ) : (
                                            <div style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>Aucun détail de commande.</div>
                                        )}
                                        {(lead.preferred_date || lead.preferred_time) && (
                                            <div style={{ marginTop: 8, fontSize: 13, color: '#cbd5e1' }}>
                                                {lead.preferred_date && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><Calendar size={13} color="#64748b" /> {lead.preferred_date}</div>}
                                                {lead.preferred_time && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={13} color="#64748b" /> {lead.preferred_time}</div>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Suivi : note client (lead_notes) distincte de la note interne (merchant_notes) */}
                                    <div style={{ background: 'rgba(30,41,59,0.45)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 11, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Suivi</div>

                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Note du client</div>
                                        {lead.lead_notes ? (
                                            <div style={{ fontSize: 13, color: '#e2e8f0', fontStyle: 'italic', marginBottom: 10 }}>"{lead.lead_notes}"</div>
                                        ) : (
                                            <div style={{ fontSize: 13, color: '#475569', fontStyle: 'italic', marginBottom: 10 }}>Aucune note spontanée.</div>
                                        )}

                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Note interne</div>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                            <textarea
                                                value={noteDraftValue}
                                                onChange={e => setNotesDraft(prev => ({ ...prev, [lead.id]: e.target.value }))}
                                                placeholder="Ex : rappelé le 8, en attente…"
                                                rows={1}
                                                style={{ flex: 1, resize: 'vertical', padding: '6px 9px', borderRadius: 7, border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(255,255,255,0.03)', color: '#e2e8f0', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                                            />
                                        </div>
                                        {noteDirty && (
                                            <button
                                                onClick={() => saveMerchantNotes(lead.id)}
                                                disabled={savingNotesId === lead.id}
                                                style={{ marginTop: 6, padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.12)', color: '#34d399', cursor: 'pointer', fontSize: 11, fontWeight: 600, opacity: savingNotesId === lead.id ? 0.5 : 1 }}
                                            >
                                                {savingNotesId === lead.id ? '...' : 'Enregistrer'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </details>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
