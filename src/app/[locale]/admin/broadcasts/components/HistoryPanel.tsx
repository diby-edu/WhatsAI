import { Clock, MessageSquare, Mail, Bell } from 'lucide-react'
import type { TabId } from '../types'

export function HistoryPanel({
    history, activeTab, activeBroadcastId = null, broadcastProgress = null
}: {
    history: any[]
    activeTab: TabId
    activeBroadcastId?: string | null
    broadcastProgress?: { total: number, sent: number, failed: number, pending: number } | null
}) {
    const filteredHistory = history.filter(b => {
        if (activeTab === 'whatsapp') return !b.message?.startsWith('[EMAIL]') && !b.message?.startsWith('[PUSH]')
        if (activeTab === 'email') return b.message?.startsWith('[EMAIL]')
        if (activeTab === 'push') return b.message?.startsWith('[PUSH]')
        return true
    })
    return (
        <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} style={{ color: '#60a5fa' }} /> Historique
            </h2>
            {filteredHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                    <MessageSquare size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                    <p>Aucun broadcast envoyé</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredHistory.slice(0, 15).map((b, i) => {
                        const isEmail = b.message?.startsWith('[EMAIL]')
                        const isPush = b.message?.startsWith('[PUSH]')
                        const isActive = b.id === activeBroadcastId && broadcastProgress !== null
                        const prog = isActive ? broadcastProgress! : null
                        const pct = prog && prog.total > 0
                            ? Math.round((prog.sent + prog.failed) / prog.total * 100)
                            : null
                        return (
                            <div key={i} style={{
                                padding: 12, borderRadius: 10,
                                background: isActive ? 'rgba(37,211,102,0.05)' : 'rgba(15, 23, 42, 0.3)',
                                border: isActive ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(148, 163, 184, 0.05)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {isEmail
                                            ? <Mail size={12} style={{ color: '#60a5fa' }} />
                                            : isPush
                                                ? <Bell size={12} style={{ color: '#f59e0b' }} />
                                                : <MessageSquare size={12} style={{ color: '#34d399' }} />}
                                        <span style={{ color: 'white', fontWeight: 500, fontSize: 12 }}>
                                            {isEmail ? b.message.replace('[EMAIL] ', '')
                                                : isPush ? b.message.replace('[PUSH] ', '')
                                                    : (b.agent_name || 'Agent')}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {/* Badge statut */}
                                        {isActive && prog!.pending > 0 && (
                                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontWeight: 600 }}>
                                                En cours
                                            </span>
                                        )}
                                        {isActive && prog!.pending === 0 && (
                                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(52,211,153,0.15)', color: '#34d399', fontWeight: 600 }}>
                                                Terminé
                                            </span>
                                        )}
                                        {!isActive && b.status === 'sending' && (
                                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontWeight: 600 }}>
                                                En cours
                                            </span>
                                        )}
                                        <span style={{ color: '#64748b', fontSize: 11 }}>
                                            {new Date(b.created_at).toLocaleDateString('fr-FR')}
                                        </span>
                                    </div>
                                </div>

                                {!isEmail && !isPush && (
                                    <p style={{ color: '#94a3b8', fontSize: 11, margin: '0 0 6px 0', lineHeight: 1.4 }}>
                                        {b.message?.substring(0, 70)}{b.message?.length > 70 ? '...' : ''}
                                    </p>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#64748b', fontSize: 11 }}>
                                        {b.recipients_count || 0} destinataires
                                    </span>
                                    {prog && (
                                        <span style={{ fontSize: 11, color: '#60a5fa' }}>
                                            {prog.sent}/{prog.total} envoyés
                                        </span>
                                    )}
                                </div>

                                {/* Mini barre de progression pour le broadcast actif */}
                                {prog && (
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ height: 4, background: 'rgba(148,163,184,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', borderRadius: 99, transition: 'width 0.5s ease',
                                                background: prog.pending === 0 ? '#34d399' : 'linear-gradient(90deg, #10b981, #60a5fa)',
                                                width: `${pct}%`,
                                            }} />
                                        </div>
                                        {prog.pending > 0 && (
                                            <span style={{ fontSize: 10, color: '#64748b', marginTop: 4, display: 'block' }}>
                                                ~{Math.ceil(prog.pending / 50 * 60)}min restantes
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
