'use client'

import { useEffect, useState, useCallback } from 'react'
import {
    BookOpen, Bot, Users, FileText, ArrowLeft, ArrowRight,
    Plus, Pencil, Trash2, RefreshCw, Search, X, Save,
    ChevronRight, AlertCircle, Check
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent { id: string; name: string; kb_count: number }

interface UserRow {
    id: string
    full_name?: string
    email?: string
    agents: Agent[]
}

interface Document {
    id: string
    source_id: string
    title: string
    created_at: string
    kb_count?: number
    chunks_count?: number
    image_url?: string
    image_label?: string
    extra_image_urls?: { url: string; label?: string }[]
}

interface Segment { id: string; chunk_index: number; content: string; title: string }

type View = 'users' | 'agents' | 'docs' | 'edit'

// ─── Toast minimal ─────────────────────────────────────────────────────────────

function useToast() {
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
    const show = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }, [])
    return { toast, show }
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function AdminKnowledgePage() {
    const { toast, show } = useToast()

    // Navigation
    const [view, setView] = useState<View>('users')
    const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [editDoc, setEditDoc] = useState<Document | null>(null)

    // Data
    const [users, setUsers] = useState<UserRow[]>([])
    const [docs, setDocs] = useState<Document[]>([])
    const [segments, setSegments] = useState<Segment[]>([])
    const [allAgents, setAllAgents] = useState<{ id: string; name: string; userId: string }[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    // Formulaire ajout/édition
    const [formTitle, setFormTitle] = useState('')
    const [formContent, setFormContent] = useState('')
    const [formImageUrl, setFormImageUrl] = useState('')
    const [formImageLabel, setFormImageLabel] = useState('')
    const [formSaving, setFormSaving] = useState(false)

    // Modal suppression
    const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)

    // Modal réaffectation
    const [reassignTarget, setReassignTarget] = useState<Document | null>(null)
    const [reassignAgentId, setReassignAgentId] = useState('')

    // Modal ajout
    const [showAddForm, setShowAddForm] = useState(false)

    // ─── Chargement initial ───────────────────────────────────────────────────

    const loadUsers = useCallback(async () => {
        setLoading(true)
        try {
            const r = await fetch('/api/admin/knowledge')
            const j = await r.json()
            setUsers(j.data?.users || [])
        } catch {
            show('Erreur chargement', 'error')
        } finally {
            setLoading(false)
        }
    }, [show])

    useEffect(() => { loadUsers() }, [loadUsers])

    // Charger tous les agents (pour réaffectation)
    useEffect(() => {
        fetch('/api/admin/knowledge').then(r => r.json()).then(j => {
            const list: { id: string; name: string; userId: string }[] = []
            for (const u of j.data?.users || []) {
                for (const a of u.agents || []) {
                    list.push({ id: a.id, name: a.name, userId: u.id })
                }
            }
            setAllAgents(list)
        }).catch(() => {})
    }, [])

    // ─── Chargement documents d'un agent ─────────────────────────────────────

    const loadDocs = useCallback(async (agentId: string) => {
        setLoading(true)
        try {
            const r = await fetch(`/api/admin/knowledge/agent/${agentId}`)
            const j = await r.json()
            setDocs(j.data?.documents || [])
        } catch {
            show('Erreur chargement documents', 'error')
        } finally {
            setLoading(false)
        }
    }, [show])

    // ─── Chargement segments d'un doc ────────────────────────────────────────

    const loadSegments = useCallback(async (sourceId: string) => {
        try {
            const r = await fetch(`/api/admin/knowledge/doc/${sourceId}`)
            const j = await r.json()
            setSegments(j.data?.segments || [])
        } catch {
            setSegments([])
        }
    }, [])

    // ─── Actions ──────────────────────────────────────────────────────────────

    const handleSelectUser = (u: UserRow) => {
        setSelectedUser(u)
        setView('agents')
    }

    const handleSelectAgent = (a: Agent) => {
        setSelectedAgent(a)
        loadDocs(a.id)
        setView('docs')
    }

    const handleEditDoc = async (doc: Document) => {
        setEditDoc(doc)
        setFormTitle(doc.title)
        setFormImageUrl(doc.image_url || '')
        setFormImageLabel(doc.image_label || '')
        setFormContent('')
        await loadSegments(doc.source_id)
        setView('edit')
    }

    // Populer le contenu depuis les segments une fois chargés
    useEffect(() => {
        if (view === 'edit' && segments.length > 0 && !formContent) {
            setFormContent(segments.map(s => s.content).join('\n\n---\n\n'))
        }
    }, [view, segments, formContent])

    const handleSaveEdit = async () => {
        if (!editDoc || !formTitle.trim()) return
        setFormSaving(true)
        try {
            const body: Record<string, unknown> = { title: formTitle }
            if (formContent.trim()) body.content = formContent
            if (formImageUrl !== undefined) body.image_url = formImageUrl
            if (formImageLabel !== undefined) body.image_label = formImageLabel

            const r = await fetch(`/api/admin/knowledge/doc/${editDoc.source_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            if (!r.ok) throw new Error()
            show('Document mis à jour')
            setView('docs')
            if (selectedAgent) loadDocs(selectedAgent.id)
        } catch {
            show('Erreur mise à jour', 'error')
        } finally {
            setFormSaving(false)
        }
    }

    const handleDeleteDoc = async () => {
        if (!deleteTarget) return
        try {
            const r = await fetch(`/api/admin/knowledge/doc/${deleteTarget.source_id}`, { method: 'DELETE' })
            if (!r.ok) throw new Error()
            show('Document supprimé')
            setDeleteTarget(null)
            if (selectedAgent) loadDocs(selectedAgent.id)
        } catch {
            show('Erreur suppression', 'error')
        }
    }

    const handleReassign = async () => {
        if (!reassignTarget || !reassignAgentId) return
        try {
            const r = await fetch(`/api/admin/knowledge/doc/${reassignTarget.source_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_agent_id: reassignAgentId })
            })
            if (!r.ok) throw new Error()
            show('Document réaffecté')
            setReassignTarget(null)
            setReassignAgentId('')
            if (selectedAgent) loadDocs(selectedAgent.id)
        } catch {
            show('Erreur réaffectation', 'error')
        }
    }

    const handleAddDoc = async () => {
        if (!selectedAgent || !formTitle.trim() || !formContent.trim()) return
        setFormSaving(true)
        try {
            const r = await fetch(`/api/admin/knowledge/agent/${selectedAgent.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formTitle,
                    content: formContent,
                    image_url: formImageUrl || undefined
                })
            })
            if (!r.ok) throw new Error()
            show('Document ajouté')
            setShowAddForm(false)
            setFormTitle('')
            setFormContent('')
            setFormImageUrl('')
            loadDocs(selectedAgent.id)
        } catch {
            show('Erreur ajout document', 'error')
        } finally {
            setFormSaving(false)
        }
    }

    // ─── Styles communs ───────────────────────────────────────────────────────

    const card = {
        background: 'rgba(30, 41, 59, 0.6)',
        border: '1px solid rgba(148, 163, 184, 0.08)',
        borderRadius: 16,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textDecoration: 'none',
    } as const

    const btn = (color = '#10b981') => ({
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 10, border: 'none',
        background: color === 'red'
            ? 'rgba(239, 68, 68, 0.15)'
            : color === 'blue'
                ? 'rgba(59, 130, 246, 0.15)'
                : color === 'gray'
                    ? 'rgba(148, 163, 184, 0.1)'
                    : `rgba(16, 185, 129, 0.15)`,
        color: color === 'red' ? '#f87171'
            : color === 'blue' ? '#60a5fa'
                : color === 'gray' ? '#94a3b8'
                    : '#34d399',
        fontWeight: 600, fontSize: 13, cursor: 'pointer',
    } as const)

    // ─── Breadcrumb ───────────────────────────────────────────────────────────

    const Breadcrumb = () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, fontSize: 13, color: '#64748b', flexWrap: 'wrap' }}>
            <span
                style={{ cursor: 'pointer', color: view !== 'users' ? '#34d399' : '#94a3b8' }}
                onClick={() => { setView('users'); setSelectedUser(null); setSelectedAgent(null) }}
            >
                Utilisateurs
            </span>
            {selectedUser && (
                <>
                    <ChevronRight style={{ width: 12, height: 12 }} />
                    <span
                        style={{ cursor: 'pointer', color: view !== 'agents' ? '#34d399' : '#94a3b8' }}
                        onClick={() => { setView('agents'); setSelectedAgent(null) }}
                    >
                        {selectedUser.full_name || selectedUser.email || selectedUser.id.slice(0, 8)}
                    </span>
                </>
            )}
            {selectedAgent && (
                <>
                    <ChevronRight style={{ width: 12, height: 12 }} />
                    <span
                        style={{ cursor: 'pointer', color: view !== 'docs' ? '#34d399' : '#94a3b8' }}
                        onClick={() => { setView('docs'); setEditDoc(null) }}
                    >
                        {selectedAgent.name}
                    </span>
                </>
            )}
            {view === 'edit' && editDoc && (
                <>
                    <ChevronRight style={{ width: 12, height: 12 }} />
                    <span style={{ color: '#94a3b8' }}>Édition</span>
                </>
            )}
        </div>
    )

    // ─── Filtrage search ──────────────────────────────────────────────────────

    const filteredUsers = users.filter(u =>
        !search || (u.full_name || u.email || '').toLowerCase().includes(search.toLowerCase())
    )

    const filteredDocs = docs.filter(d =>
        !search || d.title.toLowerCase().includes(search.toLowerCase())
    )

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div style={{ padding: 'clamp(16px, 4vw, 32px)', maxWidth: 960, margin: '0 auto' }}>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 9999,
                    padding: '12px 20px', borderRadius: 12, fontWeight: 600, fontSize: 14,
                    background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: toast.type === 'success' ? '#34d399' : '#f87171',
                    border: `1px solid ${toast.type === 'success' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
                    display: 'flex', alignItems: 'center', gap: 8
                }}>
                    {toast.type === 'success' ? <Check style={{ width: 16, height: 16 }} /> : <AlertCircle style={{ width: 16, height: 16 }} />}
                    {toast.msg}
                </div>
            )}

            {/* En-tête */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: 'rgba(16, 185, 129, 0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                    <BookOpen style={{ width: 22, height: 22, color: '#34d399' }} />
                </div>
                <div>
                    <h1 style={{ margin: 0, color: 'white', fontSize: 22, fontWeight: 700 }}>
                        Bases de connaissances
                    </h1>
                    <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
                        Gérer les KB de tous les agents
                    </p>
                </div>
                <button onClick={loadUsers} style={{ ...btn('gray'), marginLeft: 'auto' }}>
                    <RefreshCw style={{ width: 14, height: 14 }} />
                    Actualiser
                </button>
            </div>

            <Breadcrumb />

            {/* Barre de recherche */}
            {(view === 'users' || view === 'docs') && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 12, padding: '10px 16px', marginBottom: 20
                }}>
                    <Search style={{ width: 16, height: 16, color: '#64748b', flexShrink: 0 }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={view === 'users' ? 'Chercher un utilisateur...' : 'Chercher un document...'}
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            color: 'white', fontSize: 14
                        }}
                    />
                    {search && (
                        <X style={{ width: 14, height: 14, color: '#64748b', cursor: 'pointer' }}
                            onClick={() => setSearch('')} />
                    )}
                </div>
            )}

            {/* ── VUE : UTILISATEURS ── */}
            {view === 'users' && (
                <div>
                    {loading ? (
                        <Skeleton />
                    ) : filteredUsers.length === 0 ? (
                        <Empty icon={<Users style={{ width: 40, height: 40, color: '#334155' }} />}
                            msg="Aucun utilisateur avec des agents" />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {filteredUsers.map(u => (
                                <div key={u.id} style={card}
                                    onClick={() => handleSelectUser(u)}
                                    onMouseEnter={e => hoverOn(e)}
                                    onMouseLeave={e => hoverOff(e)}
                                >
                                    <div style={{
                                        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                                        background: 'rgba(59, 130, 246, 0.12)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Users style={{ width: 20, height: 20, color: '#60a5fa' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>
                                            {u.full_name || 'Sans nom'}
                                        </div>
                                        <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                                            {u.email} — {u.agents.length} agent{u.agents.length !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 13, fontWeight: 600 }}>
                                        Voir <ArrowRight style={{ width: 13, height: 13 }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── VUE : AGENTS D'UN USER ── */}
            {view === 'agents' && selectedUser && (
                <div>
                    <button onClick={() => { setView('users'); setSelectedUser(null) }}
                        style={{ ...btn('gray'), marginBottom: 16 }}>
                        <ArrowLeft style={{ width: 14, height: 14 }} /> Retour
                    </button>
                    {selectedUser.agents.length === 0 ? (
                        <Empty icon={<Bot style={{ width: 40, height: 40, color: '#334155' }} />}
                            msg="Cet utilisateur n'a pas d'agents" />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {selectedUser.agents.map(a => (
                                <div key={a.id} style={card}
                                    onClick={() => handleSelectAgent(a)}
                                    onMouseEnter={e => hoverOn(e)}
                                    onMouseLeave={e => hoverOff(e)}
                                >
                                    <div style={{
                                        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                                        background: 'rgba(16, 185, 129, 0.12)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Bot style={{ width: 20, height: 20, color: '#34d399' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>
                                            {a.name}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b', fontSize: 13, marginTop: 2 }}>
                                            <FileText style={{ width: 12, height: 12 }} />
                                            {a.kb_count} document{a.kb_count !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 13, fontWeight: 600 }}>
                                        Gérer <ArrowRight style={{ width: 13, height: 13 }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── VUE : DOCUMENTS D'UN AGENT ── */}
            {view === 'docs' && selectedAgent && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                        <button onClick={() => { setView('agents'); setSelectedAgent(null) }}
                            style={btn('gray')}>
                            <ArrowLeft style={{ width: 14, height: 14 }} /> Retour
                        </button>
                        <button onClick={() => {
                            setFormTitle(''); setFormContent(''); setFormImageUrl(''); setFormImageLabel('')
                            setShowAddForm(true)
                        }} style={btn()}>
                            <Plus style={{ width: 14, height: 14 }} /> Ajouter un document
                        </button>
                    </div>

                    {/* Formulaire ajout */}
                    {showAddForm && (
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.06)',
                            border: '1px solid rgba(52, 211, 153, 0.2)',
                            borderRadius: 16, padding: 20, marginBottom: 16
                        }}>
                            <h3 style={{ margin: '0 0 16px', color: 'white', fontSize: 15, fontWeight: 600 }}>
                                Nouveau document
                            </h3>
                            <FormFields
                                title={formTitle} setTitle={setFormTitle}
                                content={formContent} setContent={setFormContent}
                                imageUrl={formImageUrl} setImageUrl={setFormImageUrl}
                                imageLabel={formImageLabel} setImageLabel={setFormImageLabel}
                            />
                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                <button onClick={handleAddDoc} disabled={formSaving} style={btn()}>
                                    {formSaving ? <RefreshCw style={{ width: 13, height: 13 }} /> : <Save style={{ width: 13, height: 13 }} />}
                                    {formSaving ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                                <button onClick={() => setShowAddForm(false)} style={btn('gray')}>
                                    <X style={{ width: 13, height: 13 }} /> Annuler
                                </button>
                            </div>
                        </div>
                    )}

                    {loading ? <Skeleton /> : filteredDocs.length === 0 ? (
                        <Empty icon={<FileText style={{ width: 40, height: 40, color: '#334155' }} />}
                            msg="Aucun document dans cette base de connaissances" />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {filteredDocs.map(doc => (
                                <div key={doc.source_id} style={{
                                    ...card, cursor: 'default', flexWrap: 'wrap' as const
                                }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                                        background: 'rgba(148, 163, 184, 0.08)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <FileText style={{ width: 18, height: 18, color: '#94a3b8' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>
                                            {doc.title}
                                        </div>
                                        <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                                            {doc.chunks_count} chunk{doc.chunks_count !== 1 ? 's' : ''}
                                            {' · '}
                                            {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                        <button onClick={() => handleEditDoc(doc)} style={btn('blue')}>
                                            <Pencil style={{ width: 12, height: 12 }} />
                                            Éditer
                                        </button>
                                        <button onClick={() => {
                                            setReassignTarget(doc)
                                            setReassignAgentId('')
                                        }} style={btn('gray')}>
                                            <RefreshCw style={{ width: 12, height: 12 }} />
                                            Affecter
                                        </button>
                                        <button onClick={() => setDeleteTarget(doc)} style={btn('red')}>
                                            <Trash2 style={{ width: 12, height: 12 }} />
                                            Supprimer
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── VUE : ÉDITION DOCUMENT ── */}
            {view === 'edit' && editDoc && (
                <div>
                    <button onClick={() => { setView('docs'); setEditDoc(null) }}
                        style={{ ...btn('gray'), marginBottom: 20 }}>
                        <ArrowLeft style={{ width: 14, height: 14 }} /> Retour
                    </button>
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(148, 163, 184, 0.08)',
                        borderRadius: 16, padding: 24
                    }}>
                        <h3 style={{ margin: '0 0 20px', color: 'white', fontSize: 16, fontWeight: 700 }}>
                            Éditer : {editDoc.title}
                        </h3>
                        <FormFields
                            title={formTitle} setTitle={setFormTitle}
                            content={formContent} setContent={setFormContent}
                            imageUrl={formImageUrl} setImageUrl={setFormImageUrl}
                            imageLabel={formImageLabel} setImageLabel={setFormImageLabel}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                            <button onClick={handleSaveEdit} disabled={formSaving} style={btn()}>
                                {formSaving ? <RefreshCw style={{ width: 13, height: 13 }} /> : <Save style={{ width: 13, height: 13 }} />}
                                {formSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                            </button>
                            <button onClick={() => { setView('docs'); setEditDoc(null) }} style={btn('gray')}>
                                <X style={{ width: 13, height: 13 }} /> Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL SUPPRESSION ── */}
            {deleteTarget && (
                <Modal onClose={() => setDeleteTarget(null)}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
                        }}>
                            <Trash2 style={{ width: 22, height: 22, color: '#f87171' }} />
                        </div>
                        <h3 style={{ margin: '0 0 8px', color: 'white', fontSize: 16, fontWeight: 700 }}>
                            Supprimer ce document ?
                        </h3>
                        <p style={{ margin: '0 0 24px', color: '#94a3b8', fontSize: 14 }}>
                            &quot;{deleteTarget.title}&quot; sera définitivement supprimé avec tous ses chunks.
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                            <button onClick={handleDeleteDoc} style={{
                                padding: '10px 20px', borderRadius: 10, border: 'none',
                                background: '#ef4444', color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer'
                            }}>Supprimer</button>
                            <button onClick={() => setDeleteTarget(null)} style={btn('gray')}>Annuler</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── MODAL RÉAFFECTATION ── */}
            {reassignTarget && (
                <Modal onClose={() => setReassignTarget(null)}>
                    <h3 style={{ margin: '0 0 16px', color: 'white', fontSize: 16, fontWeight: 700 }}>
                        Affecter à un autre agent
                    </h3>
                    <p style={{ margin: '0 0 12px', color: '#94a3b8', fontSize: 14 }}>
                        Document : &quot;{reassignTarget.title}&quot;
                    </p>
                    <select
                        value={reassignAgentId}
                        onChange={e => setReassignAgentId(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 14px', borderRadius: 10,
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(148, 163, 184, 0.15)',
                            color: 'white', fontSize: 14, marginBottom: 16, outline: 'none'
                        }}
                    >
                        <option value="">-- Choisir un agent --</option>
                        {allAgents
                            .filter(a => a.id !== selectedAgent?.id)
                            .map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))
                        }
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={handleReassign}
                            disabled={!reassignAgentId}
                            style={{
                                padding: '10px 20px', borderRadius: 10, border: 'none',
                                background: reassignAgentId ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(148,163,184,0.1)',
                                color: reassignAgentId ? 'white' : '#64748b',
                                fontWeight: 600, fontSize: 14, cursor: reassignAgentId ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Affecter
                        </button>
                        <button onClick={() => setReassignTarget(null)} style={btn('gray')}>Annuler</button>
                    </div>
                </Modal>
            )}
        </div>
    )
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function FormFields({ title, setTitle, content, setContent, imageUrl, setImageUrl, imageLabel, setImageLabel }: {
    title: string; setTitle: (v: string) => void
    content: string; setContent: (v: string) => void
    imageUrl: string; setImageUrl: (v: string) => void
    imageLabel: string; setImageLabel: (v: string) => void
}) {
    const input = {
        width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box' as const,
        background: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid rgba(148, 163, 184, 0.15)',
        color: 'white', fontSize: 14, outline: 'none', marginBottom: 10
    }
    const label = { display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

    return (
        <>
            <label style={label}>Titre</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={input} placeholder="Titre du document" />

            <label style={label}>Contenu</label>
            <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={10}
                style={{ ...input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                placeholder="Contenu du document (utilisez --- pour séparer les sections FAQ)"
            />

            <label style={label}>Image principale (URL)</label>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} style={input} placeholder="https://..." />

            <label style={label}>Label image</label>
            <input value={imageLabel} onChange={e => setImageLabel(e.target.value)} style={input} placeholder="Nom affiché dans le bot" />
        </>
    )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20
        }} onClick={onClose}>
            <div style={{
                background: '#0f172a',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                borderRadius: 20, padding: 28,
                maxWidth: 440, width: '100%'
            }} onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </div>
    )
}

function Skeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
                <div key={i} style={{
                    height: 80, borderRadius: 16,
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.08)',
                    animation: 'pulse 1.5s ease-in-out infinite'
                }} />
            ))}
        </div>
    )
}

function Empty({ icon, msg }: { icon: React.ReactNode; msg: string }) {
    return (
        <div style={{
            textAlign: 'center', padding: '64px 24px',
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px solid rgba(148, 163, 184, 0.08)',
            borderRadius: 20
        }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>{icon}</div>
            <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>{msg}</p>
        </div>
    )
}

function hoverOn(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget as HTMLElement
    el.style.borderColor = 'rgba(52, 211, 153, 0.3)'
    el.style.background = 'rgba(16, 185, 129, 0.06)'
}

function hoverOff(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget as HTMLElement
    el.style.borderColor = 'rgba(148, 163, 184, 0.08)'
    el.style.background = 'rgba(30, 41, 59, 0.6)'
}
