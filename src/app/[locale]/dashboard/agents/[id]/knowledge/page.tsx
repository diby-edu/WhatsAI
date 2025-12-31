'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, FileText, Search, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Document {
    id: string
    title: string
    created_at: string
}

export default function AgentKnowledgePage({ params }: { params: Promise<{ id: string, locale: string }> }) {
    const { id, locale } = use(params)
    const router = useRouter()

    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [newDoc, setNewDoc] = useState({ title: '', content: '' })
    const [submitting, setSubmitting] = useState(false)

    // Fetch documents
    useEffect(() => {
        fetchDocuments()
    }, [id])

    const fetchDocuments = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/knowledge?agentId=${id}`)
            const data = await res.json()
            if (res.ok) {
                setDocuments(data.data.documents || [])
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    // Add document
    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
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

            if (res.ok) {
                setNewDoc({ title: '', content: '' })
                setIsAdding(false)
                fetchDocuments()
            }
        } catch (e) {
            console.error(e)
        } finally {
            setSubmitting(false)
        }
    }

    // Delete document
    const handleDelete = async (docId: string) => {
        if (!confirm('Supprimer ce document ?')) return

        try {
            const res = await fetch(`/api/knowledge/${docId}`, { method: 'DELETE' })
            if (res.ok) {
                setDocuments(documents.filter(d => d.id !== docId))
            }
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <div style={{ padding: 40, maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 40 }}>
                <Link
                    href={`/${locale}/dashboard/agents/${id}`}
                    style={{ display: 'inline-flex', alignItems: 'center', color: '#94a3b8', marginBottom: 16, textDecoration: 'none' }}
                >
                    <ArrowLeft style={{ width: 16, height: 16, marginRight: 8 }} />
                    Retour à l'agent
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: 32, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                            Base de Connaissances 🧠
                        </h1>
                        <p style={{ color: '#94a3b8' }}>
                            Apprenez à votre agent tout ce qu'il doit savoir (PDF, Procédures, Menus...)
                        </p>
                    </div>
                    <button
                        onClick={() => setIsAdding(true)}
                        style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: 12,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            gap: 8
                        }}
                    >
                        <Plus size={20} />
                        Ajouter un document
                    </button>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                    <Loader2 style={{ color: '#10b981', animation: 'spin 1s linear infinite' }} />
                </div>
            ) : documents.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: 60,
                    background: '#1e293b',
                    borderRadius: 20,
                    border: '1px dashed #334155'
                }}>
                    <FileText size={48} style={{ color: '#334155', marginBottom: 16 }} />
                    <h3 style={{ color: 'white', fontSize: 18, marginBottom: 8 }}>Le cerveau est vide</h3>
                    <p style={{ color: '#64748b' }}>Commencez par ajouter votre premier document.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
                    {documents.map(doc => (
                        <motion.div
                            key={doc.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                background: '#1e293b',
                                borderRadius: 16,
                                padding: 24,
                                border: '1px solid #334155',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div style={{
                                    width: 40, height: 40,
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    borderRadius: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <FileText size={20} style={{ color: '#10b981' }} />
                                </div>
                                <button
                                    onClick={() => handleDelete(doc.id)}
                                    style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 8 }}>{doc.title}</h3>
                            <p style={{ color: '#64748b', fontSize: 13, marginTop: 'auto' }}>
                                Appris le {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Modal Add */}
            {isAdding && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20
                }}>
                    <div style={{
                        background: '#0f172a',
                        width: '100%', maxWidth: 600,
                        borderRadius: 24,
                        padding: 32,
                        border: '1px solid #334155'
                    }}>
                        <h2 style={{ color: 'white', fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
                            Nouveau Document
                        </h2>
                        <form onSubmit={handleAdd}>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 14 }}>Titre</label>
                                <input
                                    type="text"
                                    required
                                    value={newDoc.title}
                                    onChange={e => setNewDoc({ ...newDoc, title: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        padding: 12,
                                        borderRadius: 12,
                                        color: 'white',
                                        outline: 'none'
                                    }}
                                    placeholder="Ex: Politique de Livraison"
                                />
                            </div>
                            <div style={{ marginBottom: 24 }}>
                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 14 }}>Contenu du document</label>
                                <textarea
                                    required
                                    value={newDoc.content}
                                    onChange={e => setNewDoc({ ...newDoc, content: e.target.value })}
                                    style={{
                                        width: '100%',
                                        height: 200,
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        padding: 12,
                                        borderRadius: 12,
                                        color: 'white',
                                        outline: 'none',
                                        resize: 'none'
                                    }}
                                    placeholder="Collez ici le texte que l'IA doit apprendre..."
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    style={{
                                        background: 'transparent',
                                        color: 'white',
                                        border: '1px solid #334155',
                                        padding: '12px 24px',
                                        borderRadius: 12,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        background: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        padding: '12px 24px',
                                        borderRadius: 12,
                                        fontWeight: 600,
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 8
                                    }}
                                >
                                    {submitting && <Loader2 size={16} className="animate-spin" />}
                                    Apprendre
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
