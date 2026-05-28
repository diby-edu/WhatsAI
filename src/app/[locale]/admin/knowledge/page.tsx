'use client'

import { useEffect, useState, useCallback } from 'react'
import {
    BookOpen, Plus, Pencil, Trash2, RefreshCw, Search, X, Save,
    ChevronDown, ChevronUp, Bot, User, FileText, AlertCircle, Check, ArrowLeftRight
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KBDoc {
    id: string
    source_id: string
    title: string
    agent_id: string
    agent_name: string
    owner_email: string
    owner_name: string
    chunks_count: number
    created_at: string
    image_url?: string | null
}

interface AgentOption {
    id: string
    name: string
    owner_email: string
}

interface Segment {
    id: string
    chunk_index: number
    content: string
    title: string
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function AdminKnowledgePage() {
    const [docs, setDocs] = useState<KBDoc[]>([])
    const [agents, setAgents] = useState<AgentOption[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [agentFilter, setAgentFilter] = useState('all')

    // Toast
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
    const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }, [])

    // Formulaire création
    const [showCreate, setShowCreate] = useState(false)
    const [createAgentId, setCreateAgentId] = useState('')
    const [createTitle, setCreateTitle] = useState('')
    const [createContent, setCreateContent] = useState('')
    const [creating, setCreating] = useState(false)

    // Edition
    const [editDoc, setEditDoc] = useState<KBDoc | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const [editContent, setEditContent] = useState('')
    const [editSegments, setEditSegments] = useState<Segment[]>([])
    const [loadingSegments, setLoadingSegments] = useState(false)
    const [saving, setSaving] = useState(false)

    // Réaffectation
    const [reassignDoc, setReassignDoc] = useState<KBDoc | null>(null)
    const [reassignAgentId, setReassignAgentId] = useState('')
    const [reassigning, setReassigning] = useState(false)

    // Suppression
    const [deleteDoc, setDeleteDoc] = useState<KBDoc | null>(null)
    const [deleting, setDeleting] = useState(false)

    // Contenu développé
    const [expandedId, setExpandedId] = useState<string | null>(null)

    // ─── Fetch ────────────────────────────────────────────────────────────────

    const fetchAll = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/knowledge?mode=docs')
            const data = await res.json()
            setDocs(data.data?.documents || [])
            setAgents(data.data?.agents || [])
            if ((data.data?.agents || []).length > 0 && !createAgentId) {
                setCreateAgentId(data.data.agents[0].id)
            }
        } catch {
            showToast('Erreur chargement des bases de connaissances', 'error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    // ─── Création ─────────────────────────────────────────────────────────────

    const handleCreate = async () => {
        if (!createTitle.trim() || !createContent.trim() || !createAgentId) return
        setCreating(true)
        try {
            const res = await fetch(`/api/admin/knowledge/agent/${createAgentId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: createTitle.trim(), content: createContent.trim() }),
            })
            if (!res.ok) throw new Error((await res.json()).error || 'Erreur')
            showToast('Document créé avec succès')
            setShowCreate(false)
            setCreateTitle('')
            setCreateContent('')
            fetchAll()
        } catch (e: any) {
            showToast(e.message || 'Erreur création', 'error')
        } finally {
            setCreating(false)
        }
    }

    // ─── Edition ──────────────────────────────────────────────────────────────

    const openEdit = async (doc: KBDoc) => {
        setEditDoc(doc)
        setEditTitle(doc.title)
        setEditContent('')
        setLoadingSegments(true)
        try {
            const res = await fetch(`/api/admin/knowledge/doc/${doc.source_id}`)
            const data = await res.json()
            const segs: Segment[] = data.data?.segments || []
            setEditSegments(segs)
            setEditContent(segs.map(s => s.content).join('\n\n---\n\n'))
        } catch {
            showToast('Erreur chargement du contenu', 'error')
        } finally {
            setLoadingSegments(false)
        }
    }

    const handleSave = async () => {
        if (!editDoc || !editTitle.trim()) return
        setSaving(true)
        try {
            const body: Record<string, string> = { title: editTitle.trim() }
            if (editContent.trim()) body.content = editContent.trim()
            const res = await fetch(`/api/admin/knowledge/doc/${editDoc.source_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error((await res.json()).error || 'Erreur')
            showToast('Document mis à jour')
            setEditDoc(null)
            fetchAll()
        } catch (e: any) {
            showToast(e.message || 'Erreur sauvegarde', 'error')
        } finally {
            setSaving(false)
        }
    }

    // ─── Réaffectation ────────────────────────────────────────────────────────

    const handleReassign = async () => {
        if (!reassignDoc || !reassignAgentId || reassignAgentId === reassignDoc.agent_id) return
        setReassigning(true)
        try {
            const res = await fetch(`/api/admin/knowledge/doc/${reassignDoc.source_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_agent_id: reassignAgentId }),
            })
            if (!res.ok) throw new Error((await res.json()).error || 'Erreur')
            showToast('Document réaffecté avec succès')
            setReassignDoc(null)
            fetchAll()
        } catch (e: any) {
            showToast(e.message || 'Erreur réaffectation', 'error')
        } finally {
            setReassigning(false)
        }
    }

    // ─── Suppression ──────────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!deleteDoc) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/knowledge/doc/${deleteDoc.source_id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error((await res.json()).error || 'Erreur')
            showToast('Document supprimé')
            setDeleteDoc(null)
            fetchAll()
        } catch (e: any) {
            showToast(e.message || 'Erreur suppression', 'error')
        } finally {
            setDeleting(false)
        }
    }

    // ─── Filtrage ─────────────────────────────────────────────────────────────

    const filtered = docs.filter(doc => {
        const matchSearch = !search ||
            doc.title.toLowerCase().includes(search.toLowerCase()) ||
            doc.agent_name.toLowerCase().includes(search.toLowerCase()) ||
            doc.owner_email.toLowerCase().includes(search.toLowerCase())
        const matchAgent = agentFilter === 'all' || doc.agent_id === agentFilter
        return matchSearch && matchAgent
    })

    // ─── Styles ───────────────────────────────────────────────────────────────

    const card: React.CSSProperties = {
        background: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(148,163,184,0.1)',
        borderRadius: 14,
        padding: 20,
    }

    const btn = (color = '#60a5fa'): React.CSSProperties => ({
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: 12, fontWeight: 600, background: `${color}18`, color,
    })

    const input: React.CSSProperties = {
        width: '100%', padding: '9px 12px', borderRadius: 8,
        border: '1px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.04)',
        color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
    }

    const textarea: React.CSSProperties = {
        ...input, minHeight: 160, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto', fontFamily: 'inherit' }}>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 9999,
                    padding: '12px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13,
                    background: toast.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                    color: toast.type === 'success' ? '#4ade80' : '#f87171',
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    {toast.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                    {toast.msg}
                </div>
            )}

            {/* En-tête */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <BookOpen size={20} style={{ color: '#818cf8' }} />
                        Bases de connaissances
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                        {docs.length} document{docs.length !== 1 ? 's' : ''} au total · Créez, modifiez ou réaffectez des documents entre agents.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={fetchAll} style={btn('#94a3b8')}>
                        <RefreshCw size={13} />
                        Rafraîchir
                    </button>
                    <button
                        onClick={() => setShowCreate(v => !v)}
                        style={{
                            ...btn('#818cf8'),
                            background: 'rgba(129,140,248,0.15)',
                            border: '1px solid rgba(129,140,248,0.3)',
                            padding: '8px 16px',
                            fontSize: 13,
                        }}
                    >
                        <Plus size={14} />
                        Ajouter un document
                    </button>
                </div>
            </div>

            {/* Formulaire création */}
            {showCreate && (
                <div style={{ ...card, marginBottom: 20, border: '1px solid rgba(129,140,248,0.25)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={15} style={{ color: '#818cf8' }} />
                        Nouveau document
                    </h3>
                    <div style={{ display: 'grid', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent cible *</label>
                            <select
                                value={createAgentId}
                                onChange={e => setCreateAgentId(e.target.value)}
                                style={{ ...input }}
                            >
                                {agents.map(a => (
                                    <option key={a.id} value={a.id}>{a.name} — {a.owner_email}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Titre *</label>
                            <input value={createTitle} onChange={e => setCreateTitle(e.target.value)} placeholder="Ex : FAQ livraison, Politique retours…" style={input} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contenu *</label>
                            <p style={{ margin: '0 0 6px', fontSize: 11, color: '#475569' }}>Séparez les sections avec <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>---</code> pour créer plusieurs chunks.</p>
                            <textarea value={createContent} onChange={e => setCreateContent(e.target.value)} placeholder="Rédigez le contenu de la base de connaissance…" style={textarea} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={handleCreate}
                                disabled={creating || !createTitle.trim() || !createContent.trim() || !createAgentId}
                                style={{ ...btn('#4ade80'), padding: '8px 16px', fontSize: 13, opacity: creating || !createTitle.trim() || !createContent.trim() ? 0.5 : 1 }}
                            >
                                {creating ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                                {creating ? 'Création…' : 'Créer'}
                            </button>
                            <button onClick={() => setShowCreate(false)} style={btn('#94a3b8')}>
                                <X size={13} /> Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barre recherche + filtre */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher par titre, agent, propriétaire…"
                        style={{ ...input, paddingLeft: 30 }}
                    />
                </div>
                <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} style={{ ...input, width: 'auto', minWidth: 180 }}>
                    <option value="all">Tous les agents</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
            </div>

            {/* Contenu principal */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#475569', fontSize: 13 }}>Chargement…</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#475569', fontSize: 13 }}>
                    {docs.length === 0 ? 'Aucun document de connaissance créé.' : 'Aucun résultat pour cette recherche.'}
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                    {filtered.map(doc => {
                        const isExpanded = expandedId === doc.source_id
                        const isEditing = editDoc?.source_id === doc.source_id
                        const isReassigning = reassignDoc?.source_id === doc.source_id
                        const isDeleting = deleteDoc?.source_id === doc.source_id

                        return (
                            <div key={doc.id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                                {/* Ligne principale */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', flexWrap: 'wrap' }}>
                                    {/* Icône */}
                                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(129,140,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <FileText size={15} style={{ color: '#818cf8' }} />
                                    </div>

                                    {/* Infos */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</div>
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4, fontSize: 11, color: '#64748b' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <Bot size={10} /> {doc.agent_name}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <User size={10} /> {doc.owner_email}
                                            </span>
                                            <span>{doc.chunks_count} chunk{doc.chunks_count !== 1 ? 's' : ''}</span>
                                            <span>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : doc.source_id)}
                                            style={btn('#94a3b8')}
                                            title="Voir le contenu"
                                        >
                                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                            Contenu
                                        </button>
                                        <button onClick={() => openEdit(doc)} style={btn('#60a5fa')} title="Modifier">
                                            <Pencil size={13} /> Modifier
                                        </button>
                                        <button
                                            onClick={() => { setReassignDoc(doc); setReassignAgentId(doc.agent_id) }}
                                            style={btn('#f59e0b')}
                                            title="Réaffecter à un autre agent"
                                        >
                                            <ArrowLeftRight size={13} /> Réaffecter
                                        </button>
                                        <button onClick={() => setDeleteDoc(doc)} style={btn('#f87171')} title="Supprimer">
                                            <Trash2 size={13} /> Supprimer
                                        </button>
                                    </div>
                                </div>

                                {/* Panneau contenu (expand) */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid rgba(148,163,184,0.08)', padding: '14px 16px', background: 'rgba(0,0,0,0.2)' }}>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chunks</div>
                                        {editSegments.length === 0 ? (
                                            <button onClick={() => openEdit(doc)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 12 }}>
                                                Cliquer sur Modifier pour charger le contenu
                                            </button>
                                        ) : (
                                            <div style={{ display: 'grid', gap: 8 }}>
                                                {editSegments.map(seg => (
                                                    <div key={seg.id} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)', fontSize: 12, color: '#94a3b8', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                                        <span style={{ fontSize: 10, color: '#475569', display: 'block', marginBottom: 4 }}>Chunk {seg.chunk_index + 1}</span>
                                                        {seg.content}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Panneau édition */}
                                {isEditing && (
                                    <div style={{ borderTop: '1px solid rgba(129,140,248,0.2)', padding: '16px', background: 'rgba(129,140,248,0.04)' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#818cf8', marginBottom: 12 }}>Modifier le document</div>
                                        {loadingSegments ? (
                                            <div style={{ color: '#64748b', fontSize: 12 }}>Chargement du contenu…</div>
                                        ) : (
                                            <div style={{ display: 'grid', gap: 12 }}>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 5 }}>Titre</label>
                                                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={input} />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 5 }}>
                                                        Contenu — séparez les sections avec <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: 3 }}>---</code>
                                                    </label>
                                                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)} style={textarea} />
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button
                                                        onClick={handleSave}
                                                        disabled={saving || !editTitle.trim()}
                                                        style={{ ...btn('#4ade80'), padding: '8px 14px', fontSize: 13, opacity: saving ? 0.5 : 1 }}
                                                    >
                                                        {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                                                        {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                                                    </button>
                                                    <button onClick={() => setEditDoc(null)} style={btn('#94a3b8')}>
                                                        <X size={13} /> Annuler
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Panneau réaffectation */}
                                {isReassigning && (
                                    <div style={{ borderTop: '1px solid rgba(245,158,11,0.2)', padding: '16px', background: 'rgba(245,158,11,0.04)' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 12 }}>Réaffecter à un autre agent</div>
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <select
                                                value={reassignAgentId}
                                                onChange={e => setReassignAgentId(e.target.value)}
                                                style={{ ...input, width: 'auto', flex: 1, minWidth: 200 }}
                                            >
                                                {agents.map(a => (
                                                    <option key={a.id} value={a.id}>{a.name} — {a.owner_email}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={handleReassign}
                                                disabled={reassigning || reassignAgentId === doc.agent_id}
                                                style={{ ...btn('#f59e0b'), padding: '8px 14px', fontSize: 13, opacity: reassigning || reassignAgentId === doc.agent_id ? 0.5 : 1 }}
                                            >
                                                {reassigning ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowLeftRight size={13} />}
                                                {reassigning ? 'Réaffectation…' : 'Confirmer'}
                                            </button>
                                            <button onClick={() => setReassignDoc(null)} style={btn('#94a3b8')}>
                                                <X size={13} /> Annuler
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Panneau suppression */}
                                {isDeleting && (
                                    <div style={{ borderTop: '1px solid rgba(248,113,113,0.2)', padding: '14px 16px', background: 'rgba(248,113,113,0.05)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                        <AlertCircle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
                                        <span style={{ fontSize: 13, color: '#fca5a5', flex: 1 }}>
                                            Supprimer <strong>"{doc.title}"</strong> ? Cette action est irréversible.
                                        </span>
                                        <button
                                            onClick={handleDelete}
                                            disabled={deleting}
                                            style={{ ...btn('#f87171'), padding: '7px 14px', fontSize: 13, opacity: deleting ? 0.5 : 1 }}
                                        >
                                            {deleting ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
                                            {deleting ? 'Suppression…' : 'Supprimer définitivement'}
                                        </button>
                                        <button onClick={() => setDeleteDoc(null)} style={btn('#94a3b8')}>
                                            <X size={13} /> Annuler
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                select option { background: #1e293b; color: #e2e8f0; }
            `}</style>
        </div>
    )
}
