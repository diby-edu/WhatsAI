'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Package,
    Plus,
    Edit3,
    Trash2,
    Save,
    X,
    Loader2,
    AlertCircle,
    CheckCircle2
} from 'lucide-react'

interface CreditPack {
    id: string
    name: string
    credits: number
    price: number
    savings: number
    is_active: boolean
    display_order: number
}

export default function AdminCreditPacksPage() {
    const [packs, setPacks] = useState<CreditPack[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editData, setEditData] = useState<Partial<CreditPack>>({})
    const [isAdding, setIsAdding] = useState(false)
    const [newPack, setNewPack] = useState({
        name: '',
        credits: 0,
        price: 0,
        savings: 0,
        is_active: true,
        display_order: 0
    })
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        fetchPacks()
    }, [])

    const fetchPacks = async () => {
        try {
            const res = await fetch('/api/admin/credit-packs')
            const data = await res.json()
            setPacks(data.packs || [])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text })
        setTimeout(() => setMessage(null), 3000)
    }

    const handleAdd = async () => {
        try {
            const res = await fetch('/api/admin/credit-packs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPack)
            })
            if (res.ok) {
                showMessage('success', 'Pack créé avec succès')
                setIsAdding(false)
                setNewPack({ name: '', credits: 0, price: 0, savings: 0, is_active: true, display_order: 0 })
                fetchPacks()
            } else {
                showMessage('error', 'Erreur lors de la création')
            }
        } catch (err) {
            showMessage('error', 'Erreur lors de la création')
        }
    }

    const handleUpdate = async (id: string) => {
        try {
            const res = await fetch('/api/admin/credit-packs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...editData })
            })
            if (res.ok) {
                showMessage('success', 'Pack mis à jour')
                setEditingId(null)
                fetchPacks()
            } else {
                showMessage('error', 'Erreur lors de la mise à jour')
            }
        } catch (err) {
            showMessage('error', 'Erreur lors de la mise à jour')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce pack ?')) return
        try {
            const res = await fetch(`/api/admin/credit-packs?id=${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                showMessage('success', 'Pack supprimé')
                fetchPacks()
            } else {
                showMessage('error', 'Erreur lors de la suppression')
            }
        } catch (err) {
            showMessage('error', 'Erreur lors de la suppression')
        }
    }

    const startEdit = (pack: CreditPack) => {
        setEditingId(pack.id)
        setEditData({ ...pack })
    }

    const cardStyle = {
        padding: '24px',
        borderRadius: '16px',
        background: 'rgba(30, 41, 59, 0.5)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
    }

    const inputStyle = {
        width: '100%',
        padding: '10px 14px',
        borderRadius: '8px',
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        color: 'white',
        fontSize: '14px',
    }

    const btnPrimary = {
        padding: '10px 20px',
        borderRadius: '8px',
        border: 'none',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: 'white',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    }

    const btnSecondary = {
        padding: '8px 16px',
        borderRadius: '8px',
        border: '1px solid rgba(148, 163, 184, 0.3)',
        background: 'transparent',
        color: '#94a3b8',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Package style={{ width: 32, height: 32, color: '#34d399' }} />
                        Gestion des Packs de Crédits
                    </h1>
                    <p style={{ color: '#94a3b8' }}>Ajoutez, modifiez ou supprimez les packs de crédits disponibles à l&apos;achat</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    style={btnPrimary as React.CSSProperties}
                >
                    <Plus style={{ width: 18, height: 18 }} />
                    Ajouter un pack
                </button>
            </div>

            {/* Message */}
            {message && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        padding: '16px',
                        borderRadius: '12px',
                        marginBottom: '24px',
                        background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        color: message.type === 'success' ? '#34d399' : '#f87171'
                    }}
                >
                    {message.type === 'success' ? <CheckCircle2 style={{ width: 20, height: 20 }} /> : <AlertCircle style={{ width: 20, height: 20 }} />}
                    {message.text}
                </motion.div>
            )}

            {/* Add New Pack Form */}
            {isAdding && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{ ...cardStyle, marginBottom: '24px' }}
                >
                    <h3 style={{ color: 'white', fontWeight: 600, marginBottom: '16px' }}>Nouveau Pack de Crédits</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>Nom</label>
                            <input
                                type="text"
                                value={newPack.name}
                                onChange={(e) => setNewPack({ ...newPack, name: e.target.value })}
                                placeholder="Pack 500"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>Crédits</label>
                            <input
                                type="number"
                                value={newPack.credits}
                                onChange={(e) => setNewPack({ ...newPack, credits: parseInt(e.target.value) || 0 })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>Prix (FCFA)</label>
                            <input
                                type="number"
                                value={newPack.price}
                                onChange={(e) => setNewPack({ ...newPack, price: parseInt(e.target.value) || 0 })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>Réduction (%)</label>
                            <input
                                type="number"
                                value={newPack.savings}
                                onChange={(e) => setNewPack({ ...newPack, savings: parseInt(e.target.value) || 0 })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>Ordre</label>
                            <input
                                type="number"
                                value={newPack.display_order}
                                onChange={(e) => setNewPack({ ...newPack, display_order: parseInt(e.target.value) || 0 })}
                                style={inputStyle}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={handleAdd} style={btnPrimary as React.CSSProperties}>
                            <Save style={{ width: 16, height: 16 }} />
                            Enregistrer
                        </button>
                        <button onClick={() => setIsAdding(false)} style={btnSecondary as React.CSSProperties}>
                            <X style={{ width: 16, height: 16 }} />
                            Annuler
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Packs List */}
            <div style={cardStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                            <th style={{ textAlign: 'left', padding: '12px', color: '#94a3b8', fontWeight: 500 }}>Nom</th>
                            <th style={{ textAlign: 'left', padding: '12px', color: '#94a3b8', fontWeight: 500 }}>Crédits</th>
                            <th style={{ textAlign: 'left', padding: '12px', color: '#94a3b8', fontWeight: 500 }}>Prix (FCFA)</th>
                            <th style={{ textAlign: 'left', padding: '12px', color: '#94a3b8', fontWeight: 500 }}>Réduction</th>
                            <th style={{ textAlign: 'left', padding: '12px', color: '#94a3b8', fontWeight: 500 }}>Statut</th>
                            <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontWeight: 500 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {packs.map((pack) => (
                            <tr key={pack.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                {editingId === pack.id ? (
                                    <>
                                        <td style={{ padding: '12px' }}>
                                            <input
                                                type="text"
                                                value={editData.name || ''}
                                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                                style={{ ...inputStyle, width: '120px' }}
                                            />
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <input
                                                type="number"
                                                value={editData.credits || 0}
                                                onChange={(e) => setEditData({ ...editData, credits: parseInt(e.target.value) || 0 })}
                                                style={{ ...inputStyle, width: '80px' }}
                                            />
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <input
                                                type="number"
                                                value={editData.price || 0}
                                                onChange={(e) => setEditData({ ...editData, price: parseInt(e.target.value) || 0 })}
                                                style={{ ...inputStyle, width: '100px' }}
                                            />
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <input
                                                type="number"
                                                value={editData.savings || 0}
                                                onChange={(e) => setEditData({ ...editData, savings: parseInt(e.target.value) || 0 })}
                                                style={{ ...inputStyle, width: '60px' }}
                                            />
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <select
                                                value={editData.is_active ? 'true' : 'false'}
                                                onChange={(e) => setEditData({ ...editData, is_active: e.target.value === 'true' })}
                                                style={{ ...inputStyle, width: '90px' }}
                                            >
                                                <option value="true">Actif</option>
                                                <option value="false">Inactif</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                <button onClick={() => handleUpdate(pack.id)} style={{ ...btnSecondary, background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' } as React.CSSProperties}>
                                                    <Save style={{ width: 14, height: 14 }} />
                                                </button>
                                                <button onClick={() => setEditingId(null)} style={btnSecondary as React.CSSProperties}>
                                                    <X style={{ width: 14, height: 14 }} />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td style={{ padding: '12px', color: 'white', fontWeight: 500 }}>{pack.name}</td>
                                        <td style={{ padding: '12px', color: '#34d399', fontWeight: 600 }}>{pack.credits.toLocaleString()}</td>
                                        <td style={{ padding: '12px', color: 'white' }}>{pack.price.toLocaleString()} FCFA</td>
                                        <td style={{ padding: '12px' }}>
                                            {pack.savings > 0 ? (
                                                <span style={{ padding: '4px 8px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', fontSize: '12px' }}>
                                                    -{pack.savings}%
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                fontSize: '12px',
                                                background: pack.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                color: pack.is_active ? '#34d399' : '#f87171'
                                            }}>
                                                {pack.is_active ? 'Actif' : 'Inactif'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                <button onClick={() => startEdit(pack)} style={btnSecondary as React.CSSProperties}>
                                                    <Edit3 style={{ width: 14, height: 14 }} />
                                                </button>
                                                <button onClick={() => handleDelete(pack.id)} style={{ ...btnSecondary, color: '#f87171' } as React.CSSProperties}>
                                                    <Trash2 style={{ width: 14, height: 14 }} />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {packs.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                        <Package style={{ width: 48, height: 48, marginBottom: '16px', opacity: 0.5 }} />
                        <p>Aucun pack de crédits. Cliquez sur &quot;Ajouter un pack&quot; pour commencer.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
