import type { CSSProperties } from 'react'
import { Send, Users, Loader2, CheckCircle, AlertTriangle, SpellCheck } from 'lucide-react'
import { HistoryPanel } from './HistoryPanel'
import type { Agent } from '../types'

interface WhatsappTabProps {
    selectedAgent: string
    waRecipientType: 'agent_conversations' | 'escalation_phones'
    setWaRecipientType: (value: 'agent_conversations' | 'escalation_phones') => void
    agents: Agent[]
    handleAgentChange: (agentId: string) => void
    recipientCount: number
    waMessage: string
    setWaMessage: (value: string) => void
    spellCheck: (field: string, text: string, setter: (v: string) => void) => void
    spellChecking: string | null
    sendWaBroadcast: () => void
    waSending: boolean
    waSent: boolean
    broadcastProgress: { total: number, sent: number, failed: number, pending: number } | null
    activeBroadcastId: string | null
    inputStyle: CSSProperties
    history: any[]
}

export function WhatsappTab({
    selectedAgent,
    waRecipientType,
    setWaRecipientType,
    agents,
    handleAgentChange,
    recipientCount,
    waMessage,
    setWaMessage,
    spellCheck,
    spellChecking,
    sendWaBroadcast,
    waSending,
    waSent,
    broadcastProgress,
    activeBroadcastId,
    inputStyle,
    history,
}: WhatsappTabProps) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, padding: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Send size={18} style={{ color: '#34d399' }} /> Nouveau Broadcast WhatsApp
                </h2>

                {/* Sélecteur type de destinataires */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Destinataires</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {([
                            { value: 'agent_conversations', label: 'Contacts agent' },
                            { value: 'escalation_phones', label: 'Numéros d\'escalade' },
                        ] as const).map(opt => (
                            <button key={opt.value} onClick={() => setWaRecipientType(opt.value)}
                                style={{
                                    flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                    border: waRecipientType === opt.value ? '1px solid #34d399' : '1px solid rgba(148,163,184,0.2)',
                                    background: waRecipientType === opt.value ? 'rgba(52,211,153,0.1)' : 'rgba(15,23,42,0.5)',
                                    color: waRecipientType === opt.value ? '#34d399' : '#94a3b8',
                                }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {waRecipientType === 'escalation_phones' && (
                        <p style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                            Envoie au numéro d'escalade configuré sur chaque agent de la plateforme.
                        </p>
                    )}
                </div>

                {/* Agent expéditeur (toujours requis pour la session WhatsApp) */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>
                        Agent expéditeur
                    </label>
                    <select value={selectedAgent} onChange={(e) => handleAgentChange(e.target.value)} style={inputStyle}>
                        <option value="">-- Choisir un agent connecté --</option>
                        {agents.map(agent => (
                            <option key={agent.id} value={agent.id}>
                                {agent.name} ({agent.total_conversations || 0} conversations)
                            </option>
                        ))}
                    </select>
                </div>

                {recipientCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 16, background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: 10 }}>
                        <Users size={16} style={{ color: '#34d399' }} />
                        <span style={{ color: '#34d399', fontSize: 13 }}>{recipientCount} destinataire{recipientCount > 1 ? 's' : ''}</span>
                        <span style={{ color: '#64748b', fontSize: 12, marginLeft: 'auto' }}>
                            ~{Math.ceil(recipientCount / 50)}h d'envoi
                        </span>
                    </div>
                )}

                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ color: '#94a3b8', fontSize: 13 }}>Message (max 500 car.)</label>
                        <button onClick={() => spellCheck('wa', waMessage, setWaMessage)}
                            disabled={!waMessage.trim() || spellChecking === 'wa'}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: spellChecking === 'wa' ? '#64748b' : '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                            {spellChecking === 'wa' ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <SpellCheck size={11} />} Corriger
                        </button>
                    </div>
                    <textarea value={waMessage} onChange={(e) => setWaMessage(e.target.value.slice(0, 500))}
                        placeholder="Votre message WhatsApp..." rows={5} style={{ ...inputStyle, resize: 'none' }} />
                    <div style={{ textAlign: 'right', color: '#64748b', fontSize: 12, marginTop: 4 }}>{waMessage.length}/500</div>
                </div>

                <div style={{ display: 'flex', gap: 8, padding: '10px 14px', marginBottom: 16, background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 10 }}>
                    <AlertTriangle size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ color: '#fbbf24', fontSize: 12 }}>Limite : 50 messages/heure par agent. L'envoi se fait progressivement.</span>
                </div>

                <button onClick={sendWaBroadcast}
                    disabled={!selectedAgent || !waMessage.trim() || waSending || recipientCount === 0}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        padding: '13px 20px',
                        background: waSent ? 'rgba(34, 197, 94, 0.2)' : 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                        opacity: (!selectedAgent || !waMessage.trim() || waSending || recipientCount === 0) ? 0.5 : 1
                    }}>
                    {(() => {
                        if (waSending) return <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Mise en file...</>
                        if (waSent) return <><CheckCircle size={16} />En cours d'envoi !</>
                        return <><Send size={16} />Envoyer le Broadcast</>
                    })()}
                </button>

                {/* Barre de progression */}
                {broadcastProgress && activeBroadcastId && (
                    <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ color: '#94a3b8', fontSize: 13 }}>Progression</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: broadcastProgress.pending === 0 ? '#34d399' : '#60a5fa' }}>
                                {broadcastProgress.sent + broadcastProgress.failed} / {broadcastProgress.total}
                            </span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(148,163,184,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: 99, transition: 'width 0.5s ease',
                                background: broadcastProgress.pending === 0 ? '#34d399' : 'linear-gradient(90deg, #10b981, #60a5fa)',
                                width: `${broadcastProgress.total > 0 ? Math.round((broadcastProgress.sent + broadcastProgress.failed) / broadcastProgress.total * 100) : 0}%`,
                            }} />
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                            <span style={{ fontSize: 11, color: '#34d399' }}>{broadcastProgress.sent} envoyés</span>
                            {broadcastProgress.failed > 0 && <span style={{ fontSize: 11, color: '#f87171' }}>{broadcastProgress.failed} échoués</span>}
                            {broadcastProgress.pending > 0 && (
                                <span style={{ fontSize: 11, color: '#64748b' }}>
                                    {broadcastProgress.pending} en attente · ~{Math.ceil(broadcastProgress.pending / 50 * 60)}min restantes
                                </span>
                            )}
                            {broadcastProgress.pending === 0 && (
                                <span style={{ fontSize: 11, color: '#34d399', marginLeft: 'auto' }}>Terminé</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <HistoryPanel history={history} activeTab="whatsapp" activeBroadcastId={activeBroadcastId} broadcastProgress={broadcastProgress} />
        </div>
    )
}
