import type { Dispatch, SetStateAction } from 'react'
import { Check, Copy, Globe, Plus, Power, RefreshCw, Trash2 } from 'lucide-react'
import { sectionStyle, inputStyle, secondaryButtonStyle, primaryButtonStyle } from '../styles'
import { WEBHOOK_EVENTS } from '../constants'
import type { WebhookItem } from '../types'

interface WebhooksTabProps {
    webhooks: WebhookItem[]
    webhooksLoading: boolean
    fetchWebhooks: () => Promise<void>
    showWebhookForm: boolean
    setShowWebhookForm: Dispatch<SetStateAction<boolean>>
    newWebhookUrl: string
    setNewWebhookUrl: Dispatch<SetStateAction<string>>
    newWebhookDescription: string
    setNewWebhookDescription: Dispatch<SetStateAction<string>>
    newWebhookEvents: string[]
    setNewWebhookEvents: Dispatch<SetStateAction<string[]>>
    toggleWebhookEvent: (currentEvents: string[], eventName: string, setter: (events: string[]) => void) => void
    createWebhook: () => Promise<void>
    creatingWebhook: boolean
    resetWebhookForm: () => void
    editingWebhookId: string | null
    editingWebhookUrl: string
    setEditingWebhookUrl: Dispatch<SetStateAction<string>>
    editingWebhookDescription: string
    setEditingWebhookDescription: Dispatch<SetStateAction<string>>
    editingWebhookEvents: string[]
    setEditingWebhookEvents: Dispatch<SetStateAction<string[]>>
    startEditWebhook: (webhook: WebhookItem) => void
    saveWebhookEdit: () => Promise<void>
    savingWebhookEdit: boolean
    cancelEditWebhook: () => void
    toggleWebhook: (webhook: WebhookItem) => Promise<void>
    deleteWebhook: (id: string) => Promise<void>
    deletingWebhookId: string | null
    copyToClipboard: (text: string, id: string) => Promise<void>
    copiedId: string | null
    formatDate: (iso: string) => string
}

export function WebhooksTab({
    webhooks,
    webhooksLoading,
    fetchWebhooks,
    showWebhookForm,
    setShowWebhookForm,
    newWebhookUrl,
    setNewWebhookUrl,
    newWebhookDescription,
    setNewWebhookDescription,
    newWebhookEvents,
    setNewWebhookEvents,
    toggleWebhookEvent,
    createWebhook,
    creatingWebhook,
    resetWebhookForm,
    editingWebhookId,
    editingWebhookUrl,
    setEditingWebhookUrl,
    editingWebhookDescription,
    setEditingWebhookDescription,
    editingWebhookEvents,
    setEditingWebhookEvents,
    startEditWebhook,
    saveWebhookEdit,
    savingWebhookEdit,
    cancelEditWebhook,
    toggleWebhook,
    deleteWebhook,
    deletingWebhookId,
    copyToClipboard,
    copiedId,
    formatDate,
}: WebhooksTabProps) {
    return (
        <div style={{ display: 'grid', gap: 20 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #9ca3af)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text-primary, #fff)' }}>Sorties depuis WazzapAI.</strong> Chaque fois qu'un événement se produit dans WazzapAI (message reçu, lead collecté, conversation terminée…), WazzapAI envoie automatiquement les données vers l'URL de votre choix — Google Sheets, Airtable, votre CRM, Make, Zapier ou tout autre outil capable de recevoir un POST JSON.
            </p>

            {showWebhookForm && (
                <div style={sectionStyle}>
                    <h2 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text-primary, #fff)' }}>
                        Creer un webhook
                    </h2>

                    <div style={{ display: 'grid', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                URL cible
                            </label>
                            <input
                                value={newWebhookUrl}
                                onChange={event => setNewWebhookUrl(event.target.value)}
                                placeholder="https://votre-app.com/webhooks/wazzap"
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                Description
                            </label>
                            <input
                                value={newWebhookDescription}
                                onChange={event => setNewWebhookDescription(event.target.value)}
                                placeholder="Ex: Reception des evenements CRM"
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--text-secondary, #9ca3af)' }}>
                                Evenements
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                {WEBHOOK_EVENTS.map(eventName => (
                                    <label
                                        key={eventName}
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
                                            checked={newWebhookEvents.includes(eventName)}
                                            onChange={() => toggleWebhookEvent(newWebhookEvents, eventName, setNewWebhookEvents)}
                                        />
                                        <span>{eventName}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                        <button
                            onClick={createWebhook}
                            disabled={creatingWebhook || !newWebhookUrl.trim() || newWebhookEvents.length === 0}
                            style={{
                                ...primaryButtonStyle,
                                opacity: creatingWebhook || !newWebhookUrl.trim() || newWebhookEvents.length === 0 ? 0.6 : 1,
                            }}
                        >
                            {creatingWebhook ? 'Creation...' : 'Creer le webhook'}
                        </button>
                        <button
                            onClick={() => {
                                resetWebhookForm()
                                setShowWebhookForm(false)
                            }}
                            style={secondaryButtonStyle}
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}

            <div style={sectionStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Globe size={16} />
                        Webhooks ({webhooks.length})
                    </h2>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setShowWebhookForm(value => !value)}
                            style={primaryButtonStyle}
                        >
                            <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                            Nouveau webhook
                        </button>
                        <button onClick={() => void fetchWebhooks()} style={secondaryButtonStyle}>
                            <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                            Rafraichir
                        </button>
                    </div>
                </div>

                {webhooksLoading ? (
                    <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>Chargement...</div>
                ) : webhooks.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>
                        Aucun webhook configure.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {webhooks.map(webhook => {
                            const isEditing = editingWebhookId === webhook.id
                            return (
                                <div
                                    key={webhook.id}
                                    style={{
                                        borderRadius: 14,
                                        border: '1px solid var(--border, #2a2a3e)',
                                        background: 'rgba(255,255,255,0.02)',
                                        padding: 16,
                                        opacity: webhook.is_active ? 1 : 0.72,
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)', wordBreak: 'break-all' }}>
                                                {webhook.url}
                                            </div>
                                            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                                                Cree le {formatDate(webhook.created_at)}
                                                {webhook.description ? ` - ${webhook.description}` : ''}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => toggleWebhook(webhook)}
                                                style={{
                                                    ...secondaryButtonStyle,
                                                    color: webhook.is_active ? '#25d366' : '#ef4444',
                                                }}
                                            >
                                                <Power size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                {webhook.is_active ? 'Desactiver' : 'Activer'}
                                            </button>
                                            <button
                                                onClick={() => startEditWebhook(webhook)}
                                                style={secondaryButtonStyle}
                                            >
                                                Modifier
                                            </button>
                                            <button
                                                onClick={() => void deleteWebhook(webhook.id)}
                                                disabled={deletingWebhookId === webhook.id}
                                                style={{
                                                    ...secondaryButtonStyle,
                                                    color: '#ef4444',
                                                    opacity: deletingWebhookId === webhook.id ? 0.6 : 1,
                                                }}
                                            >
                                                {deletingWebhookId === webhook.id ? (
                                                    <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle', animation: 'spin 1s linear infinite' }} />
                                                ) : (
                                                    <Trash2 size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                )}
                                                Supprimer
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                                        {webhook.events.map(eventName => (
                                            <span
                                                key={eventName}
                                                style={{
                                                    padding: '5px 10px',
                                                    borderRadius: 999,
                                                    background: 'rgba(59,130,246,0.12)',
                                                    color: '#93c5fd',
                                                    fontSize: 12,
                                                }}
                                            >
                                                {eventName}
                                            </span>
                                        ))}
                                    </div>

                                    {webhook.secret && (
                                        <div style={{
                                            marginTop: 12,
                                            padding: '10px 12px',
                                            borderRadius: 10,
                                            border: '1px solid rgba(245,158,11,0.3)',
                                            background: 'rgba(245,158,11,0.1)',
                                            color: '#f59e0b',
                                            fontSize: 13,
                                        }}>
                                            <div style={{ marginBottom: 8 }}>Copie ce secret maintenant. Il ne sera plus reaffiche.</div>
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
                                                <span style={{ flex: 1 }}>{webhook.secret}</span>
                                                <button
                                                    onClick={() => copyToClipboard(webhook.secret!, `whsec_${webhook.id}`)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                                                >
                                                    {copiedId === `whsec_${webhook.id}` ? <Check size={13} color="#25d366" /> : <Copy size={13} />}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {isEditing && (
                                        <div style={{
                                            marginTop: 16,
                                            paddingTop: 16,
                                            borderTop: '1px solid rgba(255,255,255,0.08)',
                                            display: 'grid',
                                            gap: 12,
                                        }}>
                                            <input
                                                value={editingWebhookUrl}
                                                onChange={event => setEditingWebhookUrl(event.target.value)}
                                                style={inputStyle}
                                            />
                                            <input
                                                value={editingWebhookDescription}
                                                onChange={event => setEditingWebhookDescription(event.target.value)}
                                                placeholder="Description"
                                                style={inputStyle}
                                            />
                                            <div style={{ display: 'grid', gap: 8 }}>
                                                {WEBHOOK_EVENTS.map(eventName => (
                                                    <label
                                                        key={eventName}
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
                                                            checked={editingWebhookEvents.includes(eventName)}
                                                            onChange={() => toggleWebhookEvent(editingWebhookEvents, eventName, setEditingWebhookEvents)}
                                                        />
                                                        <span>{eventName}</span>
                                                    </label>
                                                ))}
                                            </div>

                                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                <button
                                                    onClick={saveWebhookEdit}
                                                    disabled={savingWebhookEdit || !editingWebhookUrl.trim() || editingWebhookEvents.length === 0}
                                                    style={{
                                                        ...primaryButtonStyle,
                                                        opacity: savingWebhookEdit || !editingWebhookUrl.trim() || editingWebhookEvents.length === 0 ? 0.6 : 1,
                                                    }}
                                                >
                                                    {savingWebhookEdit ? 'Enregistrement...' : 'Enregistrer'}
                                                </button>
                                                <button onClick={cancelEditWebhook} style={secondaryButtonStyle}>
                                                    Annuler
                                                </button>
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
