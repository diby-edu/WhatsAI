'use client'

import { useState, useEffect, use } from 'react'
import { ArrowLeft, Trash2, Users, Phone, Mail, Tag, Calendar, Clock, MapPin, Building2, StickyNote, Wrench } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'

interface Lead {
    id: string
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
    created_at: string
}

export default function AgentLeadsPage({ params }: { params: Promise<{ id: string, locale: string }> }) {
    const { id, locale } = use(params)
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState<string | null>(null)
    const toast = useToast()

    useEffect(() => { fetchLeads() }, [id])

    const fetchLeads = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/leads?agentId=${id}`)
            const data = await res.json()
            if (res.ok) setLeads(data.data?.leads || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const deleteLead = async (leadId: string) => {
        const ok = await toast.confirm({ title: 'Supprimer ce lead ?', confirmLabel: 'Supprimer', danger: true })
        if (!ok) return
        setDeleting(leadId)
        try {
            await fetch(`/api/leads?id=${leadId}`, { method: 'DELETE' })
            setLeads(prev => prev.filter(l => l.id !== leadId))
            toast.success('Lead supprimé.')
        } finally {
            setDeleting(null)
        }
    }

    const formatDate = (d: string) => {
        const date = new Date(d)
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
            <div style={{ marginBottom: 32 }}>
                <Link
                    href={`/${locale}/dashboard/agents/${id}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#94a3b8', textDecoration: 'none', marginBottom: 16 }}
                >
                    <ArrowLeft size={16} />
                    Retour à l'agent
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={22} color="#10b981" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white', margin: 0 }}>Leads collectés</h1>
                        <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ color: '#94a3b8', textAlign: 'center', padding: 48 }}>Chargement...</div>
            ) : leads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
                    <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                    <p style={{ fontSize: 16, marginBottom: 8 }}>Aucun lead pour l'instant</p>
                    <p style={{ fontSize: 13 }}>Les leads apparaîtront ici quand des clients exprimeront un intérêt commercial.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {leads.map(lead => (
                        <div key={lead.id} style={{
                            background: 'rgba(15,23,42,0.8)',
                            border: '1px solid #1e293b',
                            borderRadius: 16,
                            padding: 20,
                            display: 'flex',
                            gap: 16,
                            alignItems: 'flex-start'
                        }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Users size={18} color="#10b981" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                                    <span style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>
                                        {lead.lead_name || lead.lead_phone || (!lead.customer_phone?.includes('@lid') ? lead.customer_phone : null) || 'Client anonyme'}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: '#64748b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Calendar size={12} />
                                            {formatDate(lead.created_at)}
                                        </span>
                                        <button
                                            onClick={() => deleteLead(lead.id)}
                                            disabled={deleting === lead.id}
                                            style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#f87171', cursor: 'pointer' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13 }}>
                                    {lead.lead_phone && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <Phone size={13} color="#10b981" /> {lead.lead_phone}
                                        </span>
                                    )}
                                    {lead.lead_email && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <Mail size={13} color="#6366f1" /> {lead.lead_email}
                                        </span>
                                    )}
                                    {lead.lead_location && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <MapPin size={13} color="#f59e0b" /> {lead.lead_location}
                                        </span>
                                    )}
                                    {lead.lead_address && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <MapPin size={13} color="#fb923c" /> {lead.lead_address}
                                        </span>
                                    )}
                                    {lead.lead_company && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <Building2 size={13} color="#a78bfa" /> {lead.lead_company}
                                        </span>
                                    )}
                                    {lead.customer_phone && lead.customer_phone !== lead.lead_phone && !lead.customer_phone.includes('@lid') && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <Phone size={13} color="#f59e0b" /> WhatsApp : {lead.customer_phone}
                                        </span>
                                    )}
                                    {lead.interest && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', padding: '2px 10px', borderRadius: 20 }}>
                                            <Tag size={11} /> {lead.interest}
                                        </span>
                                    )}
                                    {lead.service_requested && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <Wrench size={13} color="#38bdf8" /> {lead.service_requested}
                                        </span>
                                    )}
                                    {(lead.preferred_date || lead.preferred_time) && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <Clock size={13} color="#facc15" /> {[lead.preferred_date, lead.preferred_time].filter(Boolean).join(' — ')}
                                        </span>
                                    )}
                                    {Object.entries(lead.custom_fields || {}).map(([key, value]) => (
                                        <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(168,85,247,0.1)', color: '#c4b5fd', padding: '2px 10px', borderRadius: 20 }}>
                                            {key} : {value}
                                        </span>
                                    ))}
                                </div>
                                {lead.lead_notes && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 10, padding: '8px 12px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, fontSize: 13, color: '#cbd5e1' }}>
                                        <StickyNote size={13} color="#fbbf24" style={{ marginTop: 2, flexShrink: 0 }} />
                                        {lead.lead_notes}
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
