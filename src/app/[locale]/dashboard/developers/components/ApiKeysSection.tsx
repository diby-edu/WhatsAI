import type { Dispatch, SetStateAction } from 'react'
import { Activity, AlertCircle, Check, Clock, Copy, Eye, EyeOff, Key, Power, RefreshCw, Shield, Trash2 } from 'lucide-react'
import { sectionStyle, secondaryButtonStyle, primaryButtonStyle } from '../styles'
import type { ApiKey, AgentSummary, TabId } from '../types'

interface ApiKeysSectionProps {
    keys: ApiKey[]
    keysLoading: boolean
    fetchKeys: () => Promise<void>
    expandedKeyId: string | null
    setExpandedKeyId: Dispatch<SetStateAction<string | null>>
    editingKeyId: string | null
    revealedKeyId: string | null
    setRevealedKeyId: Dispatch<SetStateAction<string | null>>
    copiedId: string | null
    copyToClipboard: (text: string, id: string) => Promise<void>
    describeAgentScope: (allowedAgentIds: string[] | null) => string
    setLogKeyFilterId: Dispatch<SetStateAction<string>>
    setActiveTab: Dispatch<SetStateAction<TabId>>
    startEditKeyScope: (key: ApiKey) => void
    toggleKey: (key: ApiKey) => Promise<void>
    deleteKey: (id: string) => Promise<void>
    deletingKeyId: string | null
    formatDate: (iso: string) => string
    formatTime: (iso: string) => string
    agentNameById: Map<string, string>
    activeAgents: AgentSummary[]
    editingKeyAllowedAgentIds: string[]
    setEditingKeyAllowedAgentIds: Dispatch<SetStateAction<string[]>>
    toggleAgentSelection: (currentIds: string[], agentId: string, setter: (value: string[]) => void) => void
    saveKeyScope: () => Promise<void>
    savingKeyScope: boolean
    cancelEditKeyScope: () => void
}

export function ApiKeysSection({
    keys,
    keysLoading,
    fetchKeys,
    expandedKeyId,
    setExpandedKeyId,
    editingKeyId,
    revealedKeyId,
    setRevealedKeyId,
    copiedId,
    copyToClipboard,
    describeAgentScope,
    setLogKeyFilterId,
    setActiveTab,
    startEditKeyScope,
    toggleKey,
    deleteKey,
    deletingKeyId,
    formatDate,
    formatTime,
    agentNameById,
    activeAgents,
    editingKeyAllowedAgentIds,
    setEditingKeyAllowedAgentIds,
    toggleAgentSelection,
    saveKeyScope,
    savingKeyScope,
    cancelEditKeyScope,
}: ApiKeysSectionProps) {
    return (
        <div style={{ display: 'grid', gap: 20, order: 2 }}>
            <div style={sectionStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Key size={16} />
                        Clés API ({keys.length})
                    </h2>
                    <button onClick={() => void fetchKeys()} style={secondaryButtonStyle}>
                        <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Rafraichir
                    </button>
                </div>

                {keysLoading ? (
                    <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>Chargement...</div>
                ) : keys.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>
                        Aucune cle API pour le moment.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {keys.map(key => {
                            const isExpanded = expandedKeyId === key.id
                            const isEditing = editingKeyId === key.id
                            return (
                                <div
                                    key={key.id}
                                    style={{
                                        borderRadius: 14,
                                        border: `1px solid ${isExpanded ? '#25d366' : 'var(--border, #2a2a3e)'}`,
                                        background: 'rgba(255,255,255,0.02)',
                                        padding: 16,
                                        opacity: key.is_active ? 1 : 0.72,
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: 6,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            background: key.environment === 'live' ? 'rgba(37,211,102,0.14)' : 'rgba(245,158,11,0.14)',
                                            color: key.environment === 'live' ? '#25d366' : '#f59e0b',
                                            textTransform: 'uppercase',
                                        }}>
                                            {key.environment}
                                        </span>

                                        <button
                                            onClick={() => setExpandedKeyId(isExpanded ? null : key.id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                padding: 0,
                                                color: 'var(--text-primary, #fff)',
                                                fontSize: 15,
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {key.name}
                                        </button>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '5px 10px',
                                            borderRadius: 8,
                                            background: 'var(--input-bg, #0f0f1a)',
                                            border: '1px solid var(--border, #2a2a3e)',
                                            fontSize: 12,
                                            fontFamily: 'monospace',
                                            color: 'var(--text-secondary, #9ca3af)',
                                        }}>
                                            {revealedKeyId === key.id && key.raw_key ? key.raw_key : `${key.key_prefix}************`}
                                            {key.raw_key && (
                                                <button
                                                    onClick={() => setRevealedKeyId(revealedKeyId === key.id ? null : key.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
                                                    title={revealedKeyId === key.id ? 'Masquer la cle' : 'Afficher la cle'}
                                                >
                                                    {revealedKeyId === key.id ? <EyeOff size={13} /> : <Eye size={13} />}
                                                </button>
                                            )}
                                            {revealedKeyId === key.id && key.raw_key && (
                                                <button
                                                    onClick={() => copyToClipboard(key.raw_key!, `key_${key.id}`)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
                                                >
                                                    {copiedId === `key_${key.id}` ? <Check size={13} color="#25d366" /> : <Copy size={13} />}
                                                </button>
                                            )}
                                        </div>

                                        <span style={{
                                            padding: '5px 10px',
                                            borderRadius: 999,
                                            background: 'rgba(255,255,255,0.05)',
                                            color: 'var(--text-secondary, #9ca3af)',
                                            fontSize: 12,
                                        }}>
                                            {describeAgentScope(key.allowed_agent_ids)}
                                        </span>

                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => {
                                                    setLogKeyFilterId(key.id)
                                                    setActiveTab('logs')
                                                }}
                                                style={secondaryButtonStyle}
                                            >
                                                Voir logs
                                            </button>
                                            <button
                                                onClick={() => startEditKeyScope(key)}
                                                style={secondaryButtonStyle}
                                            >
                                                Scope agent
                                            </button>
                                            <button
                                                onClick={() => toggleKey(key)}
                                                style={{
                                                    ...secondaryButtonStyle,
                                                    color: key.is_active ? '#25d366' : '#ef4444',
                                                }}
                                            >
                                                <Power size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                {key.is_active ? 'Desactiver' : 'Activer'}
                                            </button>
                                            <button
                                                onClick={() => void deleteKey(key.id)}
                                                disabled={deletingKeyId === key.id}
                                                style={{
                                                    ...secondaryButtonStyle,
                                                    color: '#ef4444',
                                                    opacity: deletingKeyId === key.id ? 0.6 : 1,
                                                }}
                                            >
                                                {deletingKeyId === key.id ? (
                                                    <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle', animation: 'spin 1s linear infinite' }} />
                                                ) : (
                                                    <Trash2 size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                )}
                                                Supprimer
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Shield size={11} />
                                            {key.rate_limit_per_minute} req/min
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Clock size={11} />
                                            Creee {formatDate(key.created_at)}
                                        </span>
                                        {key.last_used_at && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Activity size={11} />
                                                Utilisee {formatTime(key.last_used_at)}
                                            </span>
                                        )}
                                    </div>

                                    {revealedKeyId === key.id && key.raw_key && (
                                        <>
                                            <div style={{
                                                marginTop: 12,
                                                padding: '10px 12px',
                                                borderRadius: 10,
                                                border: '1px solid rgba(245,158,11,0.3)',
                                                background: 'rgba(245,158,11,0.1)',
                                                color: '#f59e0b',
                                                fontSize: 13,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                            }}>
                                                <AlertCircle size={14} />
                                                Copie cette cle maintenant. Elle ne sera plus jamais reaffichee.
                                            </div>
                                            {/* Section 1 : URLs prêtes par agent (priorité) */}
                                            <div style={{
                                                marginTop: 10,
                                                padding: '12px 14px',
                                                borderRadius: 10,
                                                border: '1px solid rgba(37,211,102,0.2)',
                                                background: 'rgba(37,211,102,0.06)',
                                                fontSize: 12,
                                                color: 'var(--text-secondary, #9ca3af)',
                                            }}>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary, #fff)', marginBottom: 4 }}>URL a coller dans Chariow (Pulse)</div>
                                                <div style={{ fontSize: 11, marginBottom: 10, opacity: 0.8 }}>
                                                    Copiez cette URL et collez-la dans le champ &quot;URL du pulse&quot; sur Chariow. C&apos;est tout.
                                                </div>
                                                {key.allowed_agent_ids && key.allowed_agent_ids.length > 0 ? (
                                                    key.allowed_agent_ids.map(agentId => {
                                                        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://wazzapai.com'
                                                        const readyUrl = `${baseUrl}/api/public/v1/platform-webhook?api_key=${key.raw_key}&agent_id=${agentId}&provider=chariow`
                                                        const urlCopyId = `ready_url_${key.id}_${agentId}`
                                                        return (
                                                            <div key={agentId} style={{ marginBottom: 8 }}>
                                                                <div style={{ fontSize: 11, color: '#25d366', marginBottom: 4, fontWeight: 600 }}>
                                                                    Agent : {agentNameById.get(agentId) || agentId}
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                                                    <code style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 6, wordBreak: 'break-all', flex: 1, lineHeight: 1.7, fontSize: 11 }}>
                                                                        {readyUrl}
                                                                    </code>
                                                                    <button
                                                                        onClick={() => copyToClipboard(readyUrl, urlCopyId)}
                                                                        style={{ ...secondaryButtonStyle, flexShrink: 0 }}
                                                                    >
                                                                        {copiedId === urlCopyId ? <Check size={13} color="#25d366" /> : <Copy size={13} />}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                ) : (
                                                    <div style={{ color: 'var(--text-secondary, #9ca3af)', fontStyle: 'italic', fontSize: 11 }}>
                                                        Selectionnez des agents autorises lors de la creation pour generer les URLs automatiquement ici.
                                                    </div>
                                                )}
                                            </div>

                                            {/* Section 2 : clé brute pour code custom */}
                                            <div style={{
                                                marginTop: 8,
                                                padding: '12px 14px',
                                                borderRadius: 10,
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                background: 'rgba(255,255,255,0.02)',
                                                fontSize: 12,
                                                color: 'var(--text-secondary, #9ca3af)',
                                            }}>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary, #fff)', marginBottom: 4 }}>Cle brute (pour vos scripts / Zapier / code)</div>
                                                <div style={{ fontSize: 11, marginBottom: 8, opacity: 0.8 }}>
                                                    A utiliser dans le header HTTP : <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>Authorization: Bearer [cle]</code>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <code style={{ background: 'rgba(255,255,255,0.06)', padding: '4px 8px', borderRadius: 6, wordBreak: 'break-all', flex: 1, fontSize: 11 }}>
                                                        {key.raw_key}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(key.raw_key!, `key_raw_${key.id}`)}
                                                        style={secondaryButtonStyle}
                                                    >
                                                        {copiedId === `key_raw_${key.id}` ? <Check size={13} color="#25d366" /> : <Copy size={13} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {isExpanded && (
                                        <div style={{
                                            marginTop: 16,
                                            paddingTop: 16,
                                            borderTop: '1px solid rgba(255,255,255,0.08)',
                                        }}>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary, #9ca3af)', marginBottom: 10 }}>
                                                Agents autorises
                                            </div>

                                            {(!key.allowed_agent_ids || key.allowed_agent_ids.length === 0) ? (
                                                <div style={{ color: 'var(--text-primary, #fff)', fontSize: 13 }}>
                                                    Cette cle peut appeler tous tes agents.
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                                                    {key.allowed_agent_ids.map(agentId => (
                                                        <span
                                                            key={agentId}
                                                            style={{
                                                                padding: '6px 10px',
                                                                borderRadius: 999,
                                                                background: 'rgba(37,211,102,0.12)',
                                                                color: '#25d366',
                                                                fontSize: 12,
                                                            }}
                                                        >
                                                            {agentNameById.get(agentId) || agentId}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {isEditing && (
                                                <div style={{
                                                    marginTop: 12,
                                                    padding: 14,
                                                    borderRadius: 12,
                                                    border: '1px solid var(--border, #2a2a3e)',
                                                    background: 'rgba(255,255,255,0.02)',
                                                }}>
                                                    <div style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)', marginBottom: 10, opacity: 0.7 }}>
                                                        Laissez tout décoché pour autoriser tous vos agents catalogue.
                                                    </div>
                                                    <div style={{ display: 'grid', gap: 8 }}>
                                                        {activeAgents.length === 0 ? (
                                                            <div style={{ color: '#f59e0b', fontSize: 13 }}>
                                                                Aucun agent en mode catalogue externe.
                                                            </div>
                                                        ) : activeAgents.map(agent => (
                                                            <label
                                                                key={agent.id}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 10,
                                                                    padding: '8px 10px',
                                                                    borderRadius: 8,
                                                                    background: 'rgba(255,255,255,0.03)',
                                                                    color: 'var(--text-primary, #fff)',
                                                                    fontSize: 13,
                                                                    cursor: 'pointer',
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={editingKeyAllowedAgentIds.includes(agent.id)}
                                                                    onChange={() => toggleAgentSelection(editingKeyAllowedAgentIds, agent.id, setEditingKeyAllowedAgentIds)}
                                                                />
                                                                <span>{agent.name}</span>
                                                            </label>
                                                        ))}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                                                        <button
                                                            onClick={saveKeyScope}
                                                            disabled={savingKeyScope}
                                                            style={{
                                                                ...primaryButtonStyle,
                                                                opacity: savingKeyScope ? 0.6 : 1,
                                                            }}
                                                        >
                                                            {savingKeyScope ? 'Enregistrement...' : 'Enregistrer le scope'}
                                                        </button>
                                                        <button onClick={cancelEditKeyScope} style={secondaryButtonStyle}>
                                                            Annuler
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
