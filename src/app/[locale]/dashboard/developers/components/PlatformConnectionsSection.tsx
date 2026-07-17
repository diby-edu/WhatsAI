import type { Dispatch, SetStateAction } from 'react'
import { Check, Copy, Eye, EyeOff, Globe, Power, RefreshCw, Trash2 } from 'lucide-react'
import { sectionStyle, inputStyle, secondaryButtonStyle, primaryButtonStyle } from '../styles'
import { PLATFORM_PROVIDERS, PROVIDER_PLACEHOLDERS, PROVIDER_DESCRIPTIONS } from '../constants'
import type { AgentSummary, FormProvider, PlatformConnectionItem } from '../types'

interface PlatformConnectionsSectionProps {
    showPlatformConnectionForm: boolean
    setShowPlatformConnectionForm: Dispatch<SetStateAction<boolean>>
    newPlatformProvider: FormProvider
    setNewPlatformProvider: Dispatch<SetStateAction<FormProvider>>
    newPlatformConnectionName: string
    setNewPlatformConnectionName: Dispatch<SetStateAction<string>>
    enabledPlatforms: string[]
    newKeyEnv: 'live' | 'test'
    setNewKeyEnv: Dispatch<SetStateAction<'live' | 'test'>>
    newKeyLimit: number
    setNewKeyLimit: Dispatch<SetStateAction<number>>
    activeAgents: AgentSummary[]
    newPlatformAgentId: string
    setNewPlatformAgentId: Dispatch<SetStateAction<string>>
    newPlatformRateLimit: number
    setNewPlatformRateLimit: Dispatch<SetStateAction<number>>
    agentsLoading: boolean
    allActiveAgents: AgentSummary[]
    newKeyAllowedAgentIds: string[]
    setNewKeyAllowedAgentIds: Dispatch<SetStateAction<string[]>>
    toggleAgentSelection: (currentIds: string[], agentId: string, setter: (value: string[]) => void) => void
    createPlatformConnection: () => Promise<void>
    creatingPlatformConnection: boolean
    resetPlatformConnectionForm: () => void
    platformConnections: PlatformConnectionItem[]
    platformConnectionsLoading: boolean
    fetchPlatformConnections: () => Promise<void>
    revealedPlatformWebhookUrlIds: Record<string, boolean>
    setRevealedPlatformWebhookUrlIds: Dispatch<SetStateAction<Record<string, boolean>>>
    revealedPlatformSecretIds: Record<string, boolean>
    setRevealedPlatformSecretIds: Dispatch<SetStateAction<Record<string, boolean>>>
    agentNameById: Map<string, string>
    formatDate: (iso: string) => string
    formatTime: (iso: string) => string
    statusColor: (code: number) => string
    maskWebhookUrl: (url: string) => string
    maskValue: (value: string, visiblePrefix?: number, visibleSuffix?: number) => string
    toggleReveal: (id: string, setter: Dispatch<SetStateAction<Record<string, boolean>>>) => void
    copyToClipboard: (text: string, id: string) => Promise<void>
    copiedId: string | null
    togglePlatformConnection: (connection: PlatformConnectionItem) => Promise<void>
    rotatePlatformConnectionSecret: (id: string) => Promise<void>
    rotatingPlatformConnectionId: string | null
    deletePlatformConnection: (id: string) => Promise<void>
    deletingPlatformConnectionId: string | null
}

export function PlatformConnectionsSection({
    showPlatformConnectionForm,
    setShowPlatformConnectionForm,
    newPlatformProvider,
    setNewPlatformProvider,
    newPlatformConnectionName,
    setNewPlatformConnectionName,
    enabledPlatforms,
    newKeyEnv,
    setNewKeyEnv,
    newKeyLimit,
    setNewKeyLimit,
    activeAgents,
    newPlatformAgentId,
    setNewPlatformAgentId,
    newPlatformRateLimit,
    setNewPlatformRateLimit,
    agentsLoading,
    allActiveAgents,
    newKeyAllowedAgentIds,
    setNewKeyAllowedAgentIds,
    toggleAgentSelection,
    createPlatformConnection,
    creatingPlatformConnection,
    resetPlatformConnectionForm,
    platformConnections,
    platformConnectionsLoading,
    fetchPlatformConnections,
    revealedPlatformWebhookUrlIds,
    setRevealedPlatformWebhookUrlIds,
    revealedPlatformSecretIds,
    setRevealedPlatformSecretIds,
    agentNameById,
    formatDate,
    formatTime,
    statusColor,
    maskWebhookUrl,
    maskValue,
    toggleReveal,
    copyToClipboard,
    copiedId,
    togglePlatformConnection,
    rotatePlatformConnectionSecret,
    rotatingPlatformConnectionId,
    deletePlatformConnection,
    deletingPlatformConnectionId,
}: PlatformConnectionsSectionProps) {
    return (
        <div style={{ display: 'grid', gap: 20 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #9ca3af)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text-primary, #fff)' }}>Entrées vers WazzapAI.</strong> Connectez une plateforme (Shopify, WooCommerce, Chariow…) ou générez une clé API pour que votre propre code puisse envoyer des événements à WazzapAI — commande passée, paiement reçu, livraison effectuée, etc. WazzapAI répond ensuite automatiquement au client sur WhatsApp.
            </p>

            {showPlatformConnectionForm && (
                <div style={sectionStyle}>
                    <h2 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text-primary, #fff)' }}>
                        {newPlatformProvider === 'api_key' ? 'Créer une clé API' : 'Créer une connexion plateforme directe'}
                    </h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                {newPlatformProvider === 'api_key' ? 'Nom de la clé' : 'Nom de la connexion'}
                            </label>
                            <input
                                value={newPlatformConnectionName}
                                onChange={event => setNewPlatformConnectionName(event.target.value)}
                                placeholder={PROVIDER_PLACEHOLDERS[newPlatformProvider] ?? 'Ex: Ma connexion'}
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                Type de connexion
                            </label>
                            <select
                                value={newPlatformProvider}
                                onChange={event => setNewPlatformProvider(event.target.value as FormProvider)}
                                style={inputStyle}
                            >
                                <optgroup label="Plateformes e-commerce">
                                    {PLATFORM_PROVIDERS.filter(p => p.group === 'ecommerce' && enabledPlatforms.includes(p.value)).map(provider => (
                                        <option key={provider.value} value={provider.value}>{provider.label}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Avancé">
                                    {PLATFORM_PROVIDERS.filter(p => p.group === 'advanced' && enabledPlatforms.includes(p.value)).map(provider => (
                                        <option key={provider.value} value={provider.value}>{provider.label}</option>
                                    ))}
                                </optgroup>
                            </select>
                            {PROVIDER_DESCRIPTIONS[newPlatformProvider] && (
                                <div style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)', marginTop: 5, opacity: 0.8 }}>
                                    {PROVIDER_DESCRIPTIONS[newPlatformProvider]}
                                </div>
                            )}
                        </div>

                        {newPlatformProvider === 'api_key' ? (
                            <>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Environnement
                                    </label>
                                    <select
                                        value={newKeyEnv}
                                        onChange={event => setNewKeyEnv(event.target.value as 'live' | 'test')}
                                        style={inputStyle}
                                    >
                                        <option value="live">Live</option>
                                        <option value="test">Test</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Requetes par minute
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={1000}
                                        value={newKeyLimit}
                                        onChange={event => setNewKeyLimit(Number(event.target.value))}
                                        style={inputStyle}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Agent cible
                                    </label>
                                    <select
                                        value={newPlatformAgentId}
                                        onChange={event => setNewPlatformAgentId(event.target.value)}
                                        style={inputStyle}
                                    >
                                        {activeAgents.map(agent => (
                                            <option key={agent.id} value={agent.id}>{agent.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Limite req/min
                                    </label>
                                    <input
                                        type="number"
                                        min={30}
                                        max={5000}
                                        value={newPlatformRateLimit}
                                        onChange={event => setNewPlatformRateLimit(Number(event.target.value))}
                                        style={inputStyle}
                                    />
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)', marginTop: 5, opacity: 0.7 }}>
                                        60/min suffit pour la plupart des boutiques.
                                    </div>
                                </div>
                            </>
                        )}

                    </div>

                    {newPlatformProvider === 'api_key' && (
                        <div style={{ marginTop: 14 }}>
                            <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--text-secondary, #9ca3af)' }}>Agents autorisés</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)', marginBottom: 10, opacity: 0.7 }}>
                                Laissez tout décoché pour autoriser tous vos agents.
                            </div>
                            <div style={{ border: '1px solid var(--border, #2a2a3e)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
                                {agentsLoading ? (
                                    <div style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 13 }}>Chargement...</div>
                                ) : (
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {allActiveAgents.map(agent => (
                                            <label key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary, #fff)', fontSize: 13, cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={newKeyAllowedAgentIds.includes(agent.id)}
                                                    onChange={() => toggleAgentSelection(newKeyAllowedAgentIds, agent.id, setNewKeyAllowedAgentIds)}
                                                />
                                                <span>{agent.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {newPlatformProvider !== 'api_key' && agentsLoading ? (
                        <div style={{ marginTop: 12, color: 'var(--text-secondary, #9ca3af)', fontSize: 13 }}>
                            Chargement des agents...
                        </div>
                    ) : newPlatformProvider !== 'api_key' && activeAgents.length === 0 ? (
                        <div style={{ marginTop: 12, color: '#f59e0b', fontSize: 13 }}>
                            Aucun agent externe disponible. Creez un agent avec ecommerce_mode = external_sync.
                        </div>
                    ) : null}

                    <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                        <button
                            onClick={createPlatformConnection}
                            disabled={creatingPlatformConnection || !newPlatformConnectionName.trim() || !newPlatformAgentId || activeAgents.length === 0}
                            style={{
                                ...primaryButtonStyle,
                                opacity: creatingPlatformConnection || !newPlatformConnectionName.trim() || !newPlatformAgentId || activeAgents.length === 0 ? 0.6 : 1,
                            }}
                        >
                            {creatingPlatformConnection ? 'Creation...' : newPlatformProvider === 'api_key' ? 'Créer la clé' : 'Créer la connexion'}
                        </button>
                        <button
                            onClick={() => {
                                resetPlatformConnectionForm()
                                setShowPlatformConnectionForm(false)
                            }}
                            style={secondaryButtonStyle}
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}

            <div style={{ ...sectionStyle, order: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Globe size={16} />
                        Connexions plateforme directes ({platformConnections.length})
                    </h2>
                    <button onClick={() => void fetchPlatformConnections()} style={secondaryButtonStyle}>
                        <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Rafraichir
                    </button>
                </div>

                {platformConnectionsLoading ? (
                    <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>Chargement...</div>
                ) : platformConnections.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>
                        Aucune connexion plateforme configuree.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {platformConnections.map(connection => {
                            const hasFreshSecret = Boolean(connection.signing_secret)
                            const isWebhookVisible = Boolean(revealedPlatformWebhookUrlIds[connection.id])
                            const isSecretVisible = Boolean(revealedPlatformSecretIds[connection.id])
                            return (
                                <div
                                    key={connection.id}
                                    style={{
                                        borderRadius: 14,
                                        border: '1px solid var(--border, #2a2a3e)',
                                        background: 'rgba(255,255,255,0.02)',
                                        padding: 16,
                                        opacity: connection.is_active ? 1 : 0.72,
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'grid', gap: 6 }}>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                <span style={{ fontSize: 15, color: 'var(--text-primary, #fff)', fontWeight: 600 }}>
                                                    {connection.name}
                                                </span>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: 999,
                                                    background: 'rgba(37, 211, 102, 0.15)',
                                                    color: '#25d366',
                                                    fontSize: 11,
                                                    textTransform: 'uppercase',
                                                    fontWeight: 700,
                                                }}>
                                                    {connection.provider}
                                                </span>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: 999,
                                                    background: 'rgba(59,130,246,0.12)',
                                                    color: '#93c5fd',
                                                    fontSize: 11,
                                                }}>
                                                    {agentNameById.get(connection.agent_id) || connection.agent_id}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                                                <span>Creee le {formatDate(connection.created_at)}</span>
                                                <span>Limite: {connection.rate_limit_per_minute}/min</span>
                                                {connection.last_status_code != null && (
                                                    <span style={{ color: statusColor(connection.last_status_code) }}>
                                                        Dernier statut: {connection.last_status_code}
                                                    </span>
                                                )}
                                                {connection.last_received_at && (
                                                    <span>Derniere reception: {formatTime(connection.last_received_at)}</span>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <div style={{
                                                    padding: '8px 10px',
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    background: 'rgba(0,0,0,0.2)',
                                                    color: '#a5f3fc',
                                                    fontSize: 12,
                                                    fontFamily: 'monospace',
                                                    wordBreak: 'break-all',
                                                }}>
                                                    {isWebhookVisible ? connection.webhook_url : maskWebhookUrl(connection.webhook_url)}
                                                </div>
                                                <button
                                                    onClick={() => toggleReveal(connection.id, setRevealedPlatformWebhookUrlIds)}
                                                    style={secondaryButtonStyle}
                                                    title={isWebhookVisible ? 'Masquer URL' : 'Afficher URL'}
                                                >
                                                    {isWebhookVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                                                </button>
                                                <button
                                                    onClick={() => copyToClipboard(connection.webhook_url, `incoming_url_${connection.id}`)}
                                                    style={secondaryButtonStyle}
                                                >
                                                    {copiedId === `incoming_url_${connection.id}` ? 'Copiee' : 'Copier URL'}
                                                </button>
                                            </div>

                                            <div style={{
                                                marginTop: 10,
                                                padding: '10px 12px',
                                                borderRadius: 8,
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                background: 'rgba(255,255,255,0.03)',
                                                fontSize: 12,
                                                color: 'var(--text-secondary, #9ca3af)',
                                                lineHeight: 1.6,
                                            }}>
                                                {connection.provider === 'chariow' && (
                                                    <>Chariow : Tableau de bord → <strong style={{ color: 'var(--text-primary, #fff)' }}>Pulses</strong> → Nouveau pulse → coller l&apos;URL ci-dessus dans &quot;URL de destination&quot;.</>
                                                )}
                                                {connection.provider === 'shopify' && (
                                                    <>Shopify : Admin → <strong style={{ color: 'var(--text-primary, #fff)' }}>Settings → Notifications → Webhooks</strong> → Create webhook → coller l&apos;URL ci-dessus.</>
                                                )}
                                                {connection.provider === 'woocommerce' && (
                                                    <>WooCommerce : Admin → <strong style={{ color: 'var(--text-primary, #fff)' }}>WooCommerce → Settings → Advanced → Webhooks</strong> → Add webhook → coller l&apos;URL ci-dessus.</>
                                                )}
                                                {connection.provider === 'maketou' && (
                                                    <>Maketou : Tableau de bord → <strong style={{ color: 'var(--text-primary, #fff)' }}>Integrations → Webhooks</strong> → Ajouter → coller l&apos;URL ci-dessus.</>
                                                )}
                                                {connection.provider === 'generic' && (
                                                    <>Coller l&apos;URL ci-dessus dans le champ &quot;Webhook URL&quot; de votre plateforme. Envoyer les evenements en POST JSON.</>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => togglePlatformConnection(connection)}
                                                style={{
                                                    ...secondaryButtonStyle,
                                                    color: connection.is_active ? '#25d366' : '#ef4444',
                                                }}
                                            >
                                                <Power size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                {connection.is_active ? 'Desactiver' : 'Activer'}
                                            </button>
                                            <button
                                                onClick={() => void rotatePlatformConnectionSecret(connection.id)}
                                                disabled={rotatingPlatformConnectionId === connection.id}
                                                style={secondaryButtonStyle}
                                            >
                                                {rotatingPlatformConnectionId === connection.id ? 'Rotation...' : 'Regenerer secret'}
                                            </button>
                                            <button
                                                onClick={() => void deletePlatformConnection(connection.id)}
                                                disabled={deletingPlatformConnectionId === connection.id}
                                                style={{
                                                    ...secondaryButtonStyle,
                                                    color: '#ef4444',
                                                    opacity: deletingPlatformConnectionId === connection.id ? 0.6 : 1,
                                                }}
                                            >
                                                {deletingPlatformConnectionId === connection.id ? (
                                                    <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle', animation: 'spin 1s linear infinite' }} />
                                                ) : (
                                                    <Trash2 size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                )}
                                                Supprimer
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {(connection.allowed_events || []).map(eventName => (
                                            <span
                                                key={eventName}
                                                style={{
                                                    padding: '5px 10px',
                                                    borderRadius: 999,
                                                    background: 'rgba(16,185,129,0.14)',
                                                    color: '#6ee7b7',
                                                    fontSize: 12,
                                                }}
                                            >
                                                {eventName}
                                            </span>
                                        ))}
                                        {(!connection.allowed_events || connection.allowed_events.length === 0) && (
                                            <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 12 }}>
                                                Tous les evenements sont acceptes
                                            </span>
                                        )}
                                    </div>

                                    {connection.last_error && (
                                        <div style={{
                                            marginTop: 10,
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            border: '1px solid rgba(239,68,68,0.3)',
                                            background: 'rgba(239,68,68,0.08)',
                                            color: '#fca5a5',
                                            fontSize: 12,
                                        }}>
                                            Derniere erreur: {connection.last_error}
                                        </div>
                                    )}

                                    {(hasFreshSecret || connection.signing_secret_masked) && (
                                        <div style={{
                                            marginTop: 12,
                                            padding: '10px 12px',
                                            borderRadius: 10,
                                            border: '1px solid rgba(245,158,11,0.3)',
                                            background: 'rgba(245,158,11,0.1)',
                                            color: '#f59e0b',
                                            fontSize: 13,
                                        }}>
                                            <div style={{ marginBottom: 8 }}>
                                                {hasFreshSecret
                                                    ? 'Copie ce secret maintenant. Il ne sera plus reaffiche.'
                                                    : 'Secret stocke (masque). Utilise Regenerer secret pour en obtenir un nouveau.'
                                                }
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '8px 10px',
                                                borderRadius: 8,
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                background: 'rgba(0,0,0,0.2)',
                                                color: '#fde68a',
                                                fontFamily: 'monospace',
                                                wordBreak: 'break-all',
                                            }}>
                                                <span style={{ flex: 1 }}>
                                                    {hasFreshSecret
                                                        ? (isSecretVisible ? connection.signing_secret : maskValue(connection.signing_secret || ''))
                                                        : connection.signing_secret_masked}
                                                </span>
                                                {hasFreshSecret && (
                                                    <button
                                                        onClick={() => toggleReveal(connection.id, setRevealedPlatformSecretIds)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                                                        title={isSecretVisible ? 'Masquer secret' : 'Afficher secret'}
                                                    >
                                                        {isSecretVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                                                    </button>
                                                )}
                                                {hasFreshSecret && (
                                                    <button
                                                        onClick={() => copyToClipboard(connection.signing_secret!, `incoming_secret_${connection.id}`)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                                                    >
                                                        {copiedId === `incoming_secret_${connection.id}` ? <Check size={13} color="#25d366" /> : <Copy size={13} />}
                                                    </button>
                                                )}
                                            </div>
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
