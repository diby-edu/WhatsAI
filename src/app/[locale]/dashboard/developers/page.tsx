'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Key, Plus, Trash2, Power, Copy, Check, Eye, EyeOff,
    RefreshCw, Code2, AlertCircle, ChevronDown, ChevronUp,
    Clock, Activity, Shield
} from 'lucide-react'

interface ApiKey {
    id: string
    name: string
    key_prefix: string
    environment: 'live' | 'test'
    is_active: boolean
    rate_limit_per_minute: number
    allowed_agent_ids: string[] | null
    last_used_at: string | null
    created_at: string
    expires_at: string | null
    raw_key?: string // Affiché une seule fois
}

interface UsageLog {
    id: string
    api_key_id: string
    agent_id: string | null
    endpoint: string
    method: string
    status_code: number
    response_ms: number
    ip_address: string | null
    created_at: string
}

export default function DevelopersPage() {
    const [keys, setKeys] = useState<ApiKey[]>([])
    const [logs, setLogs] = useState<UsageLog[]>([])
    const [loading, setLoading] = useState(true)
    const [logsLoading, setLogsLoading] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [newKeyName, setNewKeyName] = useState('')
    const [newKeyEnv, setNewKeyEnv] = useState<'live' | 'test'>('live')
    const [newKeyLimit, setNewKeyLimit] = useState(60)
    const [creating, setCreating] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [revealedKey, setRevealedKey] = useState<string | null>(null)
    const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    useEffect(() => {
        fetchKeys()
    }, [])

    useEffect(() => {
        if (selectedKeyId !== undefined) {
            fetchLogs(selectedKeyId)
        }
    }, [selectedKeyId])

    const fetchKeys = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/developer/keys')
            const result = await res.json()
            setKeys(result.data || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const fetchLogs = async (keyId: string | null) => {
        setLogsLoading(true)
        try {
            const url = keyId
                ? `/api/developer/logs?key_id=${keyId}&limit=50`
                : `/api/developer/logs?limit=50`
            const res = await fetch(url)
            const result = await res.json()
            setLogs(result.data || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLogsLoading(false)
        }
    }

    const createKey = async () => {
        if (!newKeyName.trim()) return
        setCreating(true)
        try {
            const res = await fetch('/api/developer/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newKeyName.trim(),
                    environment: newKeyEnv,
                    rate_limit_per_minute: newKeyLimit,
                }),
            })
            const result = await res.json()
            if (res.ok && result.data) {
                setKeys(prev => [result.data, ...prev])
                setRevealedKey(result.data.id)
                setNewKeyName('')
                setShowForm(false)
            } else {
                alert(result.error || 'Erreur lors de la création')
            }
        } catch (e) {
            console.error(e)
        } finally {
            setCreating(false)
        }
    }

    const toggleKey = async (key: ApiKey) => {
        const res = await fetch(`/api/developer/keys/${key.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !key.is_active }),
        })
        if (res.ok) {
            const result = await res.json()
            setKeys(prev => prev.map(k => k.id === key.id ? { ...k, ...result.data } : k))
        }
    }

    const deleteKey = async (id: string) => {
        if (!confirm('Supprimer définitivement cette clé API ? Les intégrations utilisant cette clé cesseront de fonctionner.')) return
        setDeletingId(id)
        try {
            const res = await fetch(`/api/developer/keys/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setKeys(prev => prev.filter(k => k.id !== id))
                if (selectedKeyId === id) setSelectedKeyId(null)
            }
        } finally {
            setDeletingId(null)
        }
    }

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

    const statusColor = (code: number) => {
        if (code < 300) return '#22c55e'
        if (code < 400) return '#f59e0b'
        return '#ef4444'
    }

    return (
        <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary, #fff)' }}>
                        API Publique
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary, #9ca3af)' }}>
                        Intégrez Wazzap dans vos applications via notre API REST
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 18px', borderRadius: 10,
                        background: '#25d366', border: 'none', cursor: 'pointer',
                        color: '#fff', fontWeight: 600, fontSize: 14
                    }}
                >
                    <Plus size={16} />
                    Nouvelle clé
                </button>
            </div>

            {/* Formulaire création */}
            {showForm && (
                <div style={{
                    background: 'var(--card-bg, #1a1a2e)', border: '1px solid var(--border, #2a2a3e)',
                    borderRadius: 16, padding: 24, marginBottom: 24
                }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                        Créer une clé API
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'end' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary, #9ca3af)', marginBottom: 6 }}>
                                Nom de la clé
                            </label>
                            <input
                                value={newKeyName}
                                onChange={e => setNewKeyName(e.target.value)}
                                placeholder="ex: Boutique Shopify"
                                onKeyDown={e => e.key === 'Enter' && createKey()}
                                style={{
                                    width: '100%', padding: '10px 14px',
                                    background: 'var(--input-bg, #0f0f1a)', border: '1px solid var(--border, #2a2a3e)',
                                    borderRadius: 8, color: 'var(--text-primary, #fff)', fontSize: 14,
                                    outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary, #9ca3af)', marginBottom: 6 }}>
                                Environnement
                            </label>
                            <select
                                value={newKeyEnv}
                                onChange={e => setNewKeyEnv(e.target.value as 'live' | 'test')}
                                style={{
                                    padding: '10px 14px', background: 'var(--input-bg, #0f0f1a)',
                                    border: '1px solid var(--border, #2a2a3e)', borderRadius: 8,
                                    color: 'var(--text-primary, #fff)', fontSize: 14, cursor: 'pointer'
                                }}
                            >
                                <option value="live">Live</option>
                                <option value="test">Test</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary, #9ca3af)', marginBottom: 6 }}>
                                Req/min
                            </label>
                            <input
                                type="number"
                                value={newKeyLimit}
                                onChange={e => setNewKeyLimit(Number(e.target.value))}
                                min={1} max={1000}
                                style={{
                                    width: 80, padding: '10px 14px',
                                    background: 'var(--input-bg, #0f0f1a)', border: '1px solid var(--border, #2a2a3e)',
                                    borderRadius: 8, color: 'var(--text-primary, #fff)', fontSize: 14,
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button
                            onClick={createKey}
                            disabled={creating || !newKeyName.trim()}
                            style={{
                                padding: '10px 20px', background: '#25d366', border: 'none',
                                borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 14,
                                cursor: creating ? 'not-allowed' : 'pointer',
                                opacity: creating || !newKeyName.trim() ? 0.6 : 1
                            }}
                        >
                            {creating ? 'Création...' : 'Créer'}
                        </button>
                        <button
                            onClick={() => setShowForm(false)}
                            style={{
                                padding: '10px 20px', background: 'transparent',
                                border: '1px solid var(--border, #2a2a3e)', borderRadius: 8,
                                color: 'var(--text-secondary, #9ca3af)', fontSize: 14, cursor: 'pointer'
                            }}
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}

            {/* Liste des clés */}
            <div style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Key size={16} />
                    Clés API ({keys.length})
                </h2>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary, #9ca3af)' }}>
                        Chargement...
                    </div>
                ) : keys.length === 0 ? (
                    <div style={{
                        background: 'var(--card-bg, #1a1a2e)', border: '1px dashed var(--border, #2a2a3e)',
                        borderRadius: 16, padding: 48, textAlign: 'center'
                    }}>
                        <Key size={40} style={{ color: 'var(--text-secondary, #9ca3af)', margin: '0 auto 16px' }} />
                        <p style={{ margin: 0, color: 'var(--text-secondary, #9ca3af)', fontSize: 14 }}>
                            Aucune clé API. Créez votre première clé pour commencer.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {keys.map(key => (
                            <div
                                key={key.id}
                                style={{
                                    background: 'var(--card-bg, #1a1a2e)',
                                    border: `1px solid ${selectedKeyId === key.id ? '#25d366' : 'var(--border, #2a2a3e)'}`,
                                    borderRadius: 14, padding: '16px 20px',
                                    opacity: key.is_active ? 1 : 0.6,
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSelectedKeyId(selectedKeyId === key.id ? null : key.id)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {/* Env badge */}
                                    <span style={{
                                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                        background: key.environment === 'live' ? 'rgba(37,211,102,0.15)' : 'rgba(245,158,11,0.15)',
                                        color: key.environment === 'live' ? '#25d366' : '#f59e0b',
                                        textTransform: 'uppercase', flexShrink: 0
                                    }}>
                                        {key.environment}
                                    </span>

                                    {/* Nom */}
                                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary, #fff)', flex: 1 }}>
                                        {key.name}
                                    </span>

                                    {/* Préfixe clé */}
                                    <div
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            background: 'var(--input-bg, #0f0f1a)', border: '1px solid var(--border, #2a2a3e)',
                                            borderRadius: 8, padding: '4px 10px', fontSize: 13,
                                            fontFamily: 'monospace', color: 'var(--text-secondary, #9ca3af)'
                                        }}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        {revealedKey === key.id && key.raw_key ? (
                                            <>
                                                <span style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {key.raw_key}
                                                </span>
                                                <button
                                                    onClick={() => copyToClipboard(key.raw_key!, key.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
                                                >
                                                    {copiedId === key.id ? <Check size={13} color="#25d366" /> : <Copy size={13} />}
                                                </button>
                                            </>
                                        ) : (
                                            <span>{key.key_prefix}••••••••••••</span>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => toggleKey(key)}
                                            title={key.is_active ? 'Désactiver' : 'Activer'}
                                            style={{
                                                padding: '6px 8px', borderRadius: 7,
                                                background: key.is_active ? 'rgba(37,211,102,0.1)' : 'rgba(239,68,68,0.1)',
                                                border: 'none', cursor: 'pointer',
                                                color: key.is_active ? '#25d366' : '#ef4444'
                                            }}
                                        >
                                            <Power size={14} />
                                        </button>
                                        <button
                                            onClick={() => deleteKey(key.id)}
                                            disabled={deletingId === key.id}
                                            title="Supprimer"
                                            style={{
                                                padding: '6px 8px', borderRadius: 7,
                                                background: 'rgba(239,68,68,0.1)',
                                                border: 'none', cursor: 'pointer', color: '#ef4444'
                                            }}
                                        >
                                            {deletingId === key.id ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Métadonnées */}
                                <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Shield size={11} />
                                        {key.rate_limit_per_minute} req/min
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Clock size={11} />
                                        Créée {formatDate(key.created_at)}
                                    </span>
                                    {key.last_used_at && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Activity size={11} />
                                            Utilisée {formatTime(key.last_used_at)}
                                        </span>
                                    )}
                                    {!key.is_active && (
                                        <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <AlertCircle size={11} />
                                            Désactivée
                                        </span>
                                    )}
                                </div>

                                {/* Alerte clé one-shot */}
                                {revealedKey === key.id && key.raw_key && (
                                    <div style={{
                                        marginTop: 12, padding: '10px 14px',
                                        background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                                        borderRadius: 8, fontSize: 13, color: '#f59e0b',
                                        display: 'flex', alignItems: 'center', gap: 8
                                    }}>
                                        <AlertCircle size={14} />
                                        Copiez cette clé maintenant. Elle ne sera plus jamais affichée.
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Section Docs rapides */}
            <div style={{
                background: 'var(--card-bg, #1a1a2e)', border: '1px solid var(--border, #2a2a3e)',
                borderRadius: 16, padding: 24, marginBottom: 40
            }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Code2 size={16} />
                    Démarrage rapide
                </h2>

                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary, #9ca3af)' }}>
                    Endpoint — <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>POST https://votre-domaine.com/api/public/v1/send</code>
                </p>

                <pre style={{
                    background: 'var(--input-bg, #0f0f1a)', border: '1px solid var(--border, #2a2a3e)',
                    borderRadius: 10, padding: '14px 18px', fontSize: 12, overflowX: 'auto',
                    color: '#a5f3fc', margin: 0, lineHeight: 1.6
                }}>
{`curl -X POST https://votre-domaine.com/api/public/v1/send \\
  -H "Authorization: Bearer sk_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "uuid-de-votre-agent",
    "to": "+22507000000",
    "message": "Bonjour ! Votre panier vous attend."
  }'`}
                </pre>

                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    {[
                        { label: 'Réponse succès', color: '#22c55e', code: '200 OK' },
                        { label: 'Non autorisé', color: '#ef4444', code: '401 UNAUTHORIZED' },
                        { label: 'Rate limit', color: '#f59e0b', code: '429 RATE_LIMIT' },
                    ].map(item => (
                        <div key={item.code} style={{
                            padding: '10px 14px', borderRadius: 8,
                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border, #2a2a3e)'
                        }}>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)', marginBottom: 4 }}>{item.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: item.color, fontFamily: 'monospace' }}>{item.code}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Logs d'usage */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Activity size={16} />
                        Logs d'usage
                        {selectedKeyId && (
                            <span style={{ fontSize: 12, color: '#25d366', fontWeight: 400 }}>
                                — filtrés par clé sélectionnée
                            </span>
                        )}
                    </h2>
                    <button
                        onClick={() => fetchLogs(selectedKeyId)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 12px', borderRadius: 8,
                            background: 'transparent', border: '1px solid var(--border, #2a2a3e)',
                            color: 'var(--text-secondary, #9ca3af)', cursor: 'pointer', fontSize: 13
                        }}
                    >
                        <RefreshCw size={13} style={logsLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
                        Rafraîchir
                    </button>
                </div>

                {logsLoading ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary, #9ca3af)' }}>Chargement...</div>
                ) : logs.length === 0 ? (
                    <div style={{
                        background: 'var(--card-bg, #1a1a2e)', border: '1px dashed var(--border, #2a2a3e)',
                        borderRadius: 14, padding: 32, textAlign: 'center',
                        color: 'var(--text-secondary, #9ca3af)', fontSize: 14
                    }}>
                        Aucun appel API enregistré.
                        {selectedKeyId && (
                            <button
                                onClick={() => setSelectedKeyId(null)}
                                style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: '#25d366', cursor: 'pointer', fontSize: 13 }}
                            >
                                Voir tous les logs
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{
                        background: 'var(--card-bg, #1a1a2e)', border: '1px solid var(--border, #2a2a3e)',
                        borderRadius: 14, overflow: 'hidden'
                    }}>
                        <div style={{
                            display: 'grid', gridTemplateColumns: '80px 1fr 80px 80px auto',
                            padding: '10px 16px', borderBottom: '1px solid var(--border, #2a2a3e)',
                            fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #9ca3af)',
                            textTransform: 'uppercase', letterSpacing: '0.05em'
                        }}>
                            <span>Statut</span>
                            <span>Endpoint</span>
                            <span>Méthode</span>
                            <span>Latence</span>
                            <span>Date</span>
                        </div>
                        {logs.map(log => (
                            <div
                                key={log.id}
                                style={{
                                    display: 'grid', gridTemplateColumns: '80px 1fr 80px 80px auto',
                                    padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    fontSize: 13, alignItems: 'center'
                                }}
                            >
                                <span style={{
                                    fontWeight: 700, fontFamily: 'monospace',
                                    color: statusColor(log.status_code)
                                }}>
                                    {log.status_code}
                                </span>
                                <span style={{ color: 'var(--text-primary, #fff)', fontFamily: 'monospace', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {log.endpoint}
                                </span>
                                <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 12 }}>
                                    {log.method}
                                </span>
                                <span style={{ color: log.response_ms > 2000 ? '#f59e0b' : 'var(--text-secondary, #9ca3af)', fontSize: 12 }}>
                                    {log.response_ms}ms
                                </span>
                                <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 11, whiteSpace: 'nowrap' }}>
                                    {formatTime(log.created_at)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
