'use client'

import { useState, useEffect, use, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, FileText, Loader2, Upload, Link2, AlignLeft, Eye, X, ChevronDown, ChevronUp, ImageIcon, Pencil, QrCode, Images } from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

interface Document {
    id: string
    title: string
    created_at: string
    source_id: string | null
    chunk_index?: number
    chunks_count?: number
    image_url?: string | null
    extra_image_urls?: (string | { url: string; label: string })[]
}

interface ExtraImage {
    url: string
    label: string
}

interface Segment {
    id: string
    chunk_index: number
    content: string
    title: string
}

type ImportMode = 'text' | 'pdf' | 'url'

const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#1e293b',
    border: '1px solid #334155',
    padding: 12,
    borderRadius: 12,
    color: 'white',
    outline: 'none',
    fontSize: 14
}

export default function AgentKnowledgePage({ params, searchParams }: { params: Promise<{ id: string, locale: string }>, searchParams?: Promise<{ from?: string }> }) {
    const { id, locale } = use(params)
    const sp = searchParams ? use(searchParams) : {}
    const backHref = sp?.from === 'whatsapp'
        ? `/${locale}/dashboard/agents/${id}?tab=whatsapp`
        : `/${locale}/dashboard/agents/${id}`

    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [importMode, setImportMode] = useState<ImportMode>('text')
    const [submitting, setSubmitting] = useState(false)
    const [importError, setImportError] = useState<string | null>(null)

    const MAX_EXTRA_IMAGES = 10

    // Text mode (add)
    const [newDoc, setNewDoc] = useState({ title: '', content: '' })

    // Edit mode
    const [editingDoc, setEditingDoc] = useState<Document | null>(null)
    const [editData, setEditData] = useState({ title: '', content: '' })

    // Images modal
    const [imageModalDoc, setImageModalDoc] = useState<Document | null>(null)
    const [imageModalData, setImageModalData] = useState({ image_url: '', image_label: '', extra_image_urls: [] as ExtraImage[] })
    const [imageModalSaving, setImageModalSaving] = useState(false)
    const [imageModalUploading, setImageModalUploading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [editSubmitting, setEditSubmitting] = useState(false)
    const [editError, setEditError] = useState<string | null>(null)

    // PDF mode
    const [pdfFile, setPdfFile] = useState<File | null>(null)
    const [pdfTitle, setPdfTitle] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Image upload
    const [imageUploading] = useState(false)
    const imageModalMainRef = useRef<HTMLInputElement>(null)
    const imageModalExtraRef = useRef<HTMLInputElement>(null)

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']

    const uploadImage = async (file: File): Promise<string | null> => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.name.toLowerCase().endsWith('.webp')) {
            alert('Format non supporté. Utilisez JPG, PNG ou GIF uniquement (pas de WebP).')
            return null
        }
        const ext = file.name.split('.').pop()
        const path = `agents/${id}/${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('images').upload(path, file, { upsert: true })
        if (error) { console.error('Image upload error:', error); return null }
        const { data } = supabase.storage.from('images').getPublicUrl(path)
        return data.publicUrl
    }

    const uploadImageModalMain = async (file: File) => {
        setImageModalUploading(true)
        const url = await uploadImage(file)
        if (url) setImageModalData(prev => ({ ...prev, image_url: url }))
        setImageModalUploading(false)
    }

    const uploadImageModalExtra = async (file: File) => {
        setImageModalUploading(true)
        const url = await uploadImage(file)
        if (url) setImageModalData(prev => ({ ...prev, extra_image_urls: [...prev.extra_image_urls, { url, label: '' }] }))
        setImageModalUploading(false)
    }

    const handleOpenImagesModal = (doc: Document) => {
        setImageModalDoc(doc)
        setImageModalData({
            image_url: doc.image_url || '',
            image_label: (doc as any).image_label || '',
            extra_image_urls: Array.isArray(doc.extra_image_urls)
                ? doc.extra_image_urls.map((item: string | { url: string; label: string }) =>
                    typeof item === 'string' ? { url: item, label: '' } : item
                )
                : []
        })
    }

    const handleSaveImages = async () => {
        if (!imageModalDoc) return
        setImageModalSaving(true)
        try {
            await fetch(`/api/knowledge/${imageModalDoc.source_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_url: imageModalData.image_url || null,
                    image_label: imageModalData.image_label || null,
                    extra_image_urls: imageModalData.extra_image_urls.length > 0 ? imageModalData.extra_image_urls : []
                })
            })
            // Mettre à jour le document dans la liste locale
            setDocuments(prev => prev.map(d => d.source_id === imageModalDoc.source_id
                ? { ...d, image_url: imageModalData.image_url || null, extra_image_urls: imageModalData.extra_image_urls }
                : d
            ))
            setImageModalDoc(null)
        } finally {
            setImageModalSaving(false)
        }
    }

    // URL mode
    const [urlInput, setUrlInput] = useState('')
    const [urlTitle, setUrlTitle] = useState('')

    // View segments modal
    const [viewingDoc, setViewingDoc] = useState<Document | null>(null)
    const [segments, setSegments] = useState<Segment[]>([])
    const [loadingSegments, setLoadingSegments] = useState(false)
    const [expandedSegment, setExpandedSegment] = useState<number | null>(null)

    useEffect(() => { fetchDocuments() }, [id])

    const fetchDocuments = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/knowledge?agentId=${id}`)
            const data = await res.json()
            if (res.ok) setDocuments(data.data.documents || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const resetModal = () => {
        setIsAdding(false)
        setImportMode('text')
        setNewDoc({ title: '', content: '' })
        setPdfFile(null)
        setPdfTitle('')
        setUrlInput('')
        setUrlTitle('')
        setImportError(null)
    }

    // Import texte
    const handleAddText = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        setImportError(null)
        try {
            const res = await fetch('/api/knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: id,
                    title: newDoc.title,
                    content: newDoc.content
                })
            })
            const data = await res.json()
            if (res.ok) { resetModal(); fetchDocuments() }
            else setImportError(data.error || 'Erreur lors de l\'import')
        } catch (e) {
            setImportError('Erreur réseau')
        } finally {
            setSubmitting(false)
        }
    }

    // Import PDF
    const handleAddPdf = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!pdfFile || !pdfTitle.trim()) return
        setSubmitting(true)
        setImportError(null)
        try {
            const form = new FormData()
            form.append('file', pdfFile)
            form.append('agentId', id)
            form.append('title', pdfTitle)
            const res = await fetch('/api/knowledge/import/pdf', { method: 'POST', body: form })
            const data = await res.json()
            if (res.ok) { resetModal(); fetchDocuments() }
            else setImportError(data.error || 'Erreur lors de l\'import du document')
        } catch (e) {
            setImportError('Erreur réseau')
        } finally {
            setSubmitting(false)
        }
    }

    // Import URL
    const handleAddUrl = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!urlInput.trim() || !urlTitle.trim()) return
        setSubmitting(true)
        setImportError(null)
        try {
            const res = await fetch('/api/knowledge/import/url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: id, url: urlInput.trim(), title: urlTitle.trim() })
            })
            const data = await res.json()
            if (res.ok) { resetModal(); fetchDocuments() }
            else setImportError(data.error || 'Erreur lors de l\'import URL')
        } catch (e) {
            setImportError('Erreur réseau')
        } finally {
            setSubmitting(false)
        }
    }

    // Ouvrir l'edition — charger tout le document source (tous les segments)
    const handleOpenEdit = async (doc: Document) => {
        setEditingDoc(doc)
        setEditError(null)
        setLoadingEdit(true)
        try {
            const sourceId = doc.source_id || doc.id
            const res = await fetch(`/api/knowledge/${sourceId}`)
            const data = await res.json()
            const orderedSegments = (data.data?.segments || [])
                .slice()
                .sort((a: Segment, b: Segment) => (a.chunk_index || 0) - (b.chunk_index || 0))
            const mergedContent = orderedSegments
                .map((segment: Segment) => String(segment.content || '').trim())
                .filter(Boolean)
                .join('\n\n')
            setEditData({ title: doc.title, content: mergedContent })
        } catch (e) {
            setEditError('Impossible de charger le document')
        } finally {
            setLoadingEdit(false)
        }
    }

    // Sauvegarder l'édition
    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingDoc) return
        setEditSubmitting(true)
        setEditError(null)
        try {
            const sourceId = editingDoc.source_id || editingDoc.id
            const res = await fetch(`/api/knowledge/${sourceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editData.title,
                    content: editData.content
                })
            })
            if (res.ok) {
                setEditingDoc(null)
                fetchDocuments()
            } else {
                setEditError('Erreur lors de la sauvegarde')
            }
        } catch (e) {
            setEditError('Erreur réseau')
        } finally {
            setEditSubmitting(false)
        }
    }

    const handleViewSegments = async (doc: Document) => {
        setViewingDoc(doc)
        setExpandedSegment(null)
        setLoadingSegments(true)
        try {
            const sourceId = doc.source_id || doc.id
            const res = await fetch(`/api/knowledge/${sourceId}`)
            const data = await res.json()
            if (res.ok) setSegments(data.data.segments || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingSegments(false)
        }
    }

    const handleDelete = async (doc: Document) => {
        if (!confirm('Supprimer ce document ?')) return
        const deleteId = doc.source_id || doc.id
        try {
            const res = await fetch(`/api/knowledge/${deleteId}`, { method: 'DELETE' })
            if (res.ok) setDocuments(documents.filter(d => (d.source_id || d.id) !== deleteId))
        } catch (e) {
            console.error(e)
        }
    }

    const modeTab = (mode: ImportMode, icon: React.ReactNode, label: string) => (
        <button
            type="button"
            onClick={() => setImportMode(mode)}
            style={{
                flex: 1, padding: '10px 16px', borderRadius: 10,
                border: importMode === mode ? '2px solid #10b981' : '1px solid #334155',
                background: importMode === mode ? 'rgba(16,185,129,0.1)' : 'transparent',
                color: importMode === mode ? '#34d399' : '#94a3b8',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 13, fontWeight: 600
            }}
        >
            {icon} {label}
        </button>
    )


    return (
        <div style={{ padding: 40, maxWidth: 1200, margin: '0 auto', minHeight: '100vh', background: '#0f172a' }}>
            {/* Header */}
            <div style={{ marginBottom: 40 }}>
                <Link href={backHref} style={{ display: 'inline-flex', alignItems: 'center', color: '#94a3b8', marginBottom: 16, textDecoration: 'none' }}>
                    <ArrowLeft style={{ width: 16, height: 16, marginRight: 8 }} />
                    Retour à l'agent
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: 32, fontWeight: 700, color: 'white', marginBottom: 8 }}>Base de Connaissances</h1>
                        <p style={{ color: '#94a3b8' }}>Apprenez à votre agent tout ce qu'il doit savoir — texte, PDF, ou page web.</p>
                    </div>
                    <button onClick={() => setIsAdding(true)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 600, display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                        <Plus size={20} />
                        Ajouter un document
                    </button>
                </div>
            </div>

            {/* Liste */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                    <Loader2 style={{ color: '#10b981', animation: 'spin 1s linear infinite' }} />
                </div>
            ) : documents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, background: '#1e293b', borderRadius: 20, border: '1px dashed #334155' }}>
                    <FileText size={48} style={{ color: '#334155', marginBottom: 16 }} />
                    <h3 style={{ color: 'white', fontSize: 18, marginBottom: 8 }}>Le cerveau est vide</h3>
                    <p style={{ color: '#64748b' }}>Commencez par ajouter votre premier document.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
                    {documents.map(doc => (
                        <motion.div key={doc.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            style={{ background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div style={{ width: 40, height: 40, background: 'rgba(16,185,129,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={20} style={{ color: '#10b981' }} />
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => handleViewSegments(doc)} title="Consulter"
                                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                        <Eye size={18} />
                                    </button>
                                    <button onClick={() => handleOpenEdit(doc)} title="Modifier"
                                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                        <Pencil size={18} />
                                    </button>
                                    <button onClick={() => handleOpenImagesModal(doc)} title="Images"
                                        style={{ background: 'transparent', border: 'none', color: doc.image_url ? '#10b981' : '#64748b', cursor: 'pointer' }}>
                                        <Images size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(doc)}
                                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 8 }}>{doc.title}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                                <p style={{ color: '#64748b', fontSize: 13 }}>{new Date(doc.created_at).toLocaleDateString()}</p>
                                {doc.chunks_count && doc.chunks_count > 1 && (
                                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                                        {doc.chunks_count} segments
                                    </span>
                                )}
                                {doc.image_url && (
                                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                                        <ImageIcon size={10} />
                                        {(doc.extra_image_urls?.length || 0) > 0 ? `${1 + doc.extra_image_urls!.length} images` : 'image'}
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Modal Consultation */}
            {viewingDoc && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ background: '#0f172a', width: '100%', maxWidth: 700, borderRadius: 24, border: '1px solid #334155', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '24px 28px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div>
                                <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{viewingDoc.title}</h2>
                                <p style={{ color: '#64748b', fontSize: 13 }}>{new Date(viewingDoc.created_at).toLocaleDateString()} — {viewingDoc.chunks_count} segment{(viewingDoc.chunks_count || 1) > 1 ? 's' : ''}</p>
                            </div>
                            <button onClick={() => { setViewingDoc(null); setSegments([]) }}
                                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 8 }}>
                                <X size={22} />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', padding: '20px 28px', flex: 1 }}>
                            {loadingSegments ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                                    <Loader2 style={{ color: '#10b981', animation: 'spin 1s linear infinite' }} />
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {segments.map(seg => (
                                        <div key={seg.id} style={{ background: '#1e293b', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' }}>
                                            <button onClick={() => setExpandedSegment(expandedSegment === seg.chunk_index ? null : seg.chunk_index)}
                                                style={{ width: '100%', background: 'transparent', border: 'none', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: 'white' }}>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>
                                                    Segment {seg.chunk_index + 1}
                                                    <span style={{ marginLeft: 10, fontWeight: 400, color: '#475569', fontSize: 12 }}>{seg.content.length} car.</span>
                                                </span>
                                                {expandedSegment === seg.chunk_index ? <ChevronUp size={16} style={{ color: '#64748b', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: '#64748b', flexShrink: 0 }} />}
                                            </button>
                                            {expandedSegment === seg.chunk_index && (
                                                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #334155', paddingTop: 12 }}>
                                                    <pre style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit' }}>
                                                        {seg.content}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CTA Connecter WhatsApp (flux depuis wizard) */}
            {sp?.from === 'whatsapp' && !loading && documents.length > 0 && (
                <div style={{ marginTop: 40, padding: 24, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <h3 style={{ color: 'white', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Base de connaissances prête</h3>
                        <p style={{ color: '#94a3b8', fontSize: 14 }}>Connectez maintenant votre numéro WhatsApp pour activer l&apos;agent.</p>
                    </div>
                    <Link href={backHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#10b981', color: 'white', padding: '12px 24px', borderRadius: 12, fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
                        <QrCode size={18} />
                        Connecter WhatsApp
                    </Link>
                </div>
            )}

            {/* Modal Édition */}
            {editingDoc && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ background: '#0f172a', width: '100%', maxWidth: 860, borderRadius: 24, padding: 28, border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>Modifier le document</h2>
                            <button onClick={() => setEditingDoc(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={22} /></button>
                        </div>
                        {loadingEdit ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                                <Loader2 style={{ color: '#10b981', animation: 'spin 1s linear infinite' }} />
                            </div>
                        ) : (
                            <form onSubmit={handleSaveEdit}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div>
                                        <label style={{ display: 'block', color: '#94a3b8', marginBottom: 6, fontSize: 13 }}>Titre *</label>
                                        <input type="text" required value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', color: '#94a3b8', marginBottom: 6, fontSize: 13 }}>Contenu</label>
                                        <textarea value={editData.content} onChange={e => setEditData({ ...editData, content: e.target.value })}
                                            style={{ ...inputStyle, height: 260, resize: 'vertical' }} />
                                        <p style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{editData.content.length} caractères</p>
                                    </div>
                                </div>
                                {editError && <p style={{ color: '#f87171', fontSize: 13, marginTop: 10 }}>{editError}</p>}
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                                    <button type="button" onClick={() => setEditingDoc(null)} style={{ background: 'transparent', color: 'white', border: '1px solid #334155', padding: '11px 22px', borderRadius: 12, cursor: 'pointer' }}>Annuler</button>
                                    <button type="submit" disabled={editSubmitting} style={{ background: '#10b981', color: 'white', border: 'none', padding: '11px 22px', borderRadius: 12, fontWeight: 600, cursor: editSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {editSubmitting && <Loader2 size={16} className="animate-spin" />}
                                        Sauvegarder
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Ajout */}
            {isAdding && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ background: '#0f172a', width: '100%', maxWidth: 860, borderRadius: 24, padding: 28, border: '1px solid #334155', maxHeight: '92vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>Nouveau Document</h2>
                            <button type="button" onClick={resetModal} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={22} /></button>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                            {modeTab('text', <AlignLeft size={14} />, 'Texte')}
                            {modeTab('pdf', <Upload size={14} />, 'Document')}
                            {modeTab('url', <Link2 size={14} />, 'URL')}
                        </div>

                        {importMode === 'text' && (
                            <form onSubmit={handleAddText}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div>
                                        <label style={{ display: 'block', color: '#94a3b8', marginBottom: 6, fontSize: 13 }}>Titre *</label>
                                        <input type="text" required value={newDoc.title} onChange={e => setNewDoc({ ...newDoc, title: e.target.value })}
                                            style={inputStyle} placeholder="Ex: Guide commandes et paiements" />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', color: '#94a3b8', marginBottom: 6, fontSize: 13 }}>Contenu *</label>
                                        <textarea required value={newDoc.content} onChange={e => setNewDoc({ ...newDoc, content: e.target.value })}
                                            style={{ ...inputStyle, height: 260, resize: 'none' }}
                                            placeholder="Sujet : Commandes et paiement&#10;Horaires support : Lun-Sam 8h-18h&#10;Delai de livraison : 24-48h&#10;Politique de retour : 7 jours&#10;..." />
                                        <p style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
                                            {newDoc.content.length} caractères
                                            {newDoc.content.length > 2000 ? ` — sera découpé en ~${Math.ceil(newDoc.content.length / 1800)} segments` : ''}
                                        </p>
                                    </div>
                                </div>
                                {importError && <p style={{ color: '#f87171', fontSize: 13, marginTop: 10 }}>{importError}</p>}
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                                    <button type="button" onClick={resetModal} style={{ background: 'transparent', color: 'white', border: '1px solid #334155', padding: '11px 22px', borderRadius: 12, cursor: 'pointer' }}>Annuler</button>
                                    <button type="submit" disabled={submitting} style={{ background: '#10b981', color: 'white', border: 'none', padding: '11px 22px', borderRadius: 12, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {submitting && <Loader2 size={16} className="animate-spin" />}
                                        Apprendre
                                    </button>
                                </div>
                            </form>
                        )}

                        {importMode === 'pdf' && (
                            <form onSubmit={handleAddPdf}>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 14 }}>Titre *</label>
                                    <input type="text" required value={pdfTitle} onChange={e => setPdfTitle(e.target.value)}
                                        style={inputStyle} placeholder="Ex: FAQ Service Client 2026" />
                                </div>
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 14 }}>Fichier *</label>
                                    <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc"
                                        onChange={e => setPdfFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                                    <div onClick={() => !pdfFile && fileInputRef.current?.click()}
                                        style={{ border: '2px dashed #334155', borderRadius: 12, padding: 32, textAlign: 'center', cursor: pdfFile ? 'default' : 'pointer', background: pdfFile ? 'rgba(16,185,129,0.05)' : 'transparent', borderColor: pdfFile ? '#10b981' : '#334155', position: 'relative' }}>
                                        {pdfFile ? (
                                            <div>
                                                <button type="button" onClick={e => { e.stopPropagation(); setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                                                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#f87171' }}>
                                                    <X size={14} />
                                                </button>
                                                <FileText size={32} style={{ color: '#10b981', marginBottom: 8, margin: '0 auto 8px' }} />
                                                <p style={{ color: '#34d399', fontWeight: 600 }}>{pdfFile.name}</p>
                                                <p style={{ color: '#64748b', fontSize: 12 }}>{(pdfFile.size / 1024).toFixed(0)} Ko</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <Upload size={32} style={{ color: '#334155', marginBottom: 8, margin: '0 auto 8px' }} />
                                                <p style={{ color: '#94a3b8' }}>Cliquez pour sélectionner un fichier</p>
                                                <p style={{ color: '#64748b', fontSize: 12 }}>PDF, DOCX, DOC — Max 10 Mo</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {importError && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{importError}</p>}
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={resetModal} style={{ background: 'transparent', color: 'white', border: '1px solid #334155', padding: '12px 24px', borderRadius: 12, cursor: 'pointer' }}>Annuler</button>
                                    <button type="submit" disabled={submitting || !pdfFile} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 600, cursor: (submitting || !pdfFile) ? 'not-allowed' : 'pointer', opacity: (submitting || !pdfFile) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {submitting && <Loader2 size={16} className="animate-spin" />}
                                        {submitting ? 'Extraction en cours...' : 'Importer le document'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {importMode === 'url' && (
                            <form onSubmit={handleAddUrl}>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 14 }}>Titre *</label>
                                    <input type="text" required value={urlTitle} onChange={e => setUrlTitle(e.target.value)}
                                        style={inputStyle} placeholder="Ex: Centre d'aide officiel" />
                                </div>
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 14 }}>URL *</label>
                                    <input type="url" required value={urlInput} onChange={e => setUrlInput(e.target.value)}
                                        style={inputStyle} placeholder="https://exemple.com/faq" />
                                    <div style={{ marginTop: 8, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <p style={{ color: '#34d399' }}>✅ Fonctionne : pages web publiques, articles de blog, WordPress, Wix, Google Sites, fichiers PDF ou Word hébergés publiquement</p>
                                        <p style={{ color: '#f87171' }}>❌ Ne fonctionne pas : pages privées (connexion requise), Google Drive, Notion, Dropbox, applications web dynamiques (React, Angular…)</p>
                                        <p style={{ color: '#f59e0b' }}>⚠️ Seuls les 50 000 premiers caractères sont traités</p>
                                    </div>
                                </div>
                                {importError && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{importError}</p>}
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={resetModal} style={{ background: 'transparent', color: 'white', border: '1px solid #334155', padding: '12px 24px', borderRadius: 12, cursor: 'pointer' }}>Annuler</button>
                                    <button type="submit" disabled={submitting} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {submitting && <Loader2 size={16} className="animate-spin" />}
                                        {submitting ? 'Récupération en cours...' : 'Importer l\'URL'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Images */}
            {imageModalDoc && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ background: '#0f172a', width: '100%', maxWidth: 540, borderRadius: 24, padding: 28, border: '1px solid #334155', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div>
                                <h2 style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Images</h2>
                                <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{imageModalDoc.title}</p>
                            </div>
                            <button onClick={() => setImageModalDoc(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={22} /></button>
                        </div>

                        {/* Image principale */}
                        <div style={{ marginBottom: 20 }}>
                            <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Image principale</p>
                            {imageModalData.image_url ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <img src={imageModalData.image_url} alt="Principale" style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: '1px solid #334155' }}
                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                        <button type="button" onClick={() => setImageModalData(prev => ({ ...prev, image_url: '', image_label: '' }))}
                                            style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                            <X size={11} />
                                        </button>
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <input type="text" placeholder='Label (ex: "Robe Rouge")' value={imageModalData.image_label}
                                            onChange={e => setImageModalData(prev => ({ ...prev, image_label: e.target.value }))}
                                            style={{ ...inputStyle, padding: '8px 12px', fontSize: 13 }} />
                                        <button type="button" onClick={() => imageModalMainRef.current?.click()} disabled={imageModalUploading}
                                            style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>
                                            Changer l'image
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button type="button" onClick={() => imageModalMainRef.current?.click()} disabled={imageModalUploading}
                                    style={{ width: 80, height: 80, border: '2px dashed #334155', borderRadius: 10, background: 'transparent', color: '#475569', cursor: imageModalUploading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11 }}>
                                    {imageModalUploading ? <Loader2 size={18} className="animate-spin" color="#10b981" /> : <><ImageIcon size={18} color="#475569" /><span>Upload</span></>}
                                </button>
                            )}
                            <input ref={imageModalMainRef} type="file" accept="image/jpeg,image/png,image/gif" style={{ display: 'none' }}
                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImageModalMain(f); if (e.target) e.target.value = '' }} />
                        </div>

                        {/* Images supplémentaires avec labels */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
                                    Images supplémentaires
                                    <span style={{ color: '#475569', fontSize: 11, fontWeight: 400, marginLeft: 6 }}>({imageModalData.extra_image_urls.length}/{MAX_EXTRA_IMAGES})</span>
                                </p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {imageModalData.extra_image_urls.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 8 }}>
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <img src={item.url} alt={item.label || `Extra ${idx + 1}`} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid #334155' }}
                                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                            <button type="button" onClick={() => setImageModalData(prev => ({ ...prev, extra_image_urls: prev.extra_image_urls.filter((_, i) => i !== idx) }))}
                                                style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                                <X size={10} />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder='Label (ex: "Ford Focus Rouge")'
                                            value={item.label}
                                            onChange={e => setImageModalData(prev => ({ ...prev, extra_image_urls: prev.extra_image_urls.map((it, i) => i === idx ? { ...it, label: e.target.value } : it) }))}
                                            style={{ ...inputStyle, flex: 1, padding: '8px 12px', fontSize: 13 }}
                                        />
                                    </div>
                                ))}
                                {imageModalData.extra_image_urls.length < MAX_EXTRA_IMAGES ? (
                                    <button type="button" onClick={() => imageModalExtraRef.current?.click()} disabled={imageModalUploading}
                                        style={{ width: '100%', padding: '10px', border: '2px dashed #334155', borderRadius: 8, background: 'transparent', color: '#475569', cursor: imageModalUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}>
                                        {imageModalUploading ? <Loader2 size={16} className="animate-spin" color="#10b981" /> : <><Plus size={16} color="#475569" />Ajouter une image</>}
                                    </button>
                                ) : (
                                    <p style={{ color: '#f59e0b', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
                                        Limite atteinte ({MAX_EXTRA_IMAGES}/{MAX_EXTRA_IMAGES}). Créez un nouveau document pour plus d'images.
                                    </p>
                                )}
                                <input ref={imageModalExtraRef} type="file" accept="image/jpeg,image/png,image/gif" style={{ display: 'none' }}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadImageModalExtra(f); if (e.target) e.target.value = '' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                            <button type="button" onClick={() => setImageModalDoc(null)} style={{ background: 'transparent', color: 'white', border: '1px solid #334155', padding: '11px 22px', borderRadius: 12, cursor: 'pointer' }}>Annuler</button>
                            <button type="button" onClick={handleSaveImages} disabled={imageModalSaving}
                                style={{ background: '#10b981', color: 'white', border: 'none', padding: '11px 22px', borderRadius: 12, fontWeight: 600, cursor: imageModalSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {imageModalSaving && <Loader2 size={16} className="animate-spin" />}
                                Sauvegarder
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
