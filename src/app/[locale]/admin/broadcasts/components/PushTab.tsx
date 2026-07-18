import type { CSSProperties } from 'react'
import { Bell, Users, Loader2, AlertTriangle, Search, SpellCheck } from 'lucide-react'
import { HistoryPanel } from './HistoryPanel'
import { SEGMENT_OPTIONS, PLAN_COLORS, isAgentStatusSegment, getSegmentHint } from '../constants'
import type { UserOption } from '../types'

interface PushResult {
    sent: number
    failed: number
    total: number
    userCount?: number
    failedEmails?: string[]
}

interface PushTabProps {
    pushPlan: string
    setPushPlan: (value: string) => void
    selectedPushUserIds: Set<string>
    setSelectedPushUserIds: (value: Set<string>) => void
    filteredPushUsers: UserOption[]
    pushUserSearch: string
    setPushUserSearch: (value: string) => void
    loadingUsers: boolean
    togglePushUser: (id: string) => void
    pushDeviceCount: number
    pushUserCount: number
    pushTitle: string
    setPushTitle: (value: string) => void
    pushBody: string
    setPushBody: (value: string) => void
    spellCheck: (field: string, text: string, setter: (v: string) => void) => void
    spellChecking: string | null
    pushResult: PushResult | null
    setPushResult: (value: PushResult | null) => void
    pushError: string | null
    sendPushBroadcast: () => void
    pushSending: boolean
    allUsers: UserOption[]
    fetchAllUsers: () => void
    inputStyle: CSSProperties
    history: any[]
}

export function PushTab({
    pushPlan,
    setPushPlan,
    selectedPushUserIds,
    setSelectedPushUserIds,
    filteredPushUsers,
    pushUserSearch,
    setPushUserSearch,
    loadingUsers,
    togglePushUser,
    pushDeviceCount,
    pushUserCount,
    pushTitle,
    setPushTitle,
    pushBody,
    setPushBody,
    spellCheck,
    spellChecking,
    pushResult,
    setPushResult,
    pushError,
    sendPushBroadcast,
    pushSending,
    allUsers,
    fetchAllUsers,
    inputStyle,
    history,
}: PushTabProps) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, padding: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Bell size={18} style={{ color: '#f59e0b' }} /> Notification Push
                </h2>

                {/* Segment */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Segment cible</label>
                    <select value={pushPlan} onChange={(e) => setPushPlan(e.target.value)} style={inputStyle}>
                        {SEGMENT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    {isAgentStatusSegment(pushPlan) && (
                        <div style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>
                            {getSegmentHint(pushPlan)}
                        </div>
                    )}
                </div>

                {/* Individual user picker */}
                {pushPlan === 'individual' && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <label style={{ color: '#94a3b8', fontSize: 13 }}>
                                Choisir les destinataires
                                {selectedPushUserIds.size > 0 && (
                                    <span style={{ marginLeft: 8, color: '#f59e0b', fontWeight: 600 }}>
                                        ({selectedPushUserIds.size} sélectionné{selectedPushUserIds.size === 1 ? '' : 's'})
                                    </span>
                                )}
                            </label>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    onClick={() => setSelectedPushUserIds(new Set(filteredPushUsers.map(u => u.id!).filter(Boolean)))}
                                    style={{ background: 'none', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 6, color: '#f59e0b', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                    Tous
                                </button>
                                <button
                                    onClick={() => setSelectedPushUserIds(new Set())}
                                    style={{ background: 'none', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 6, color: '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                    Aucun
                                </button>
                            </div>
                        </div>
                        <div style={{ position: 'relative', marginBottom: 8 }}>
                            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                            <input
                                type="text"
                                value={pushUserSearch}
                                onChange={e => setPushUserSearch(e.target.value)}
                                placeholder="Rechercher par nom ou email..."
                                style={{ ...inputStyle, paddingLeft: 34 }}
                            />
                        </div>
                        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: 10, background: 'rgba(15, 23, 42, 0.4)' }}>
                            {loadingUsers ? (
                                <div style={{ padding: 24, textAlign: 'center', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Chargement...
                                </div>
                            ) : filteredPushUsers.length === 0 ? (
                                <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Aucun utilisateur trouvé</div>
                            ) : filteredPushUsers.map((u, idx) => {
                                const uid = u.id || u.email
                                const isSelected = selectedPushUserIds.has(uid)
                                const pc = PLAN_COLORS[u.plan] || PLAN_COLORS.free
                                return (
                                    <div
                                        key={uid}
                                        role="checkbox"
                                        aria-checked={isSelected}
                                        tabIndex={0}
                                        onClick={() => togglePushUser(uid)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePushUser(uid) } }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '9px 12px', cursor: 'pointer',
                                            borderBottom: idx < filteredPushUsers.length - 1 ? '1px solid rgba(148, 163, 184, 0.06)' : 'none',
                                            background: isSelected ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                                            transition: 'background 0.15s'
                                        }}>
                                        <div style={{
                                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                            border: isSelected ? '2px solid #f59e0b' : '2px solid rgba(148, 163, 184, 0.3)',
                                            background: isSelected ? '#f59e0b' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.15s'
                                        }}>
                                            {isSelected && <span style={{ color: 'white', fontSize: 10, lineHeight: 1, fontWeight: 700 }}>âœ“</span>}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ color: 'white', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {u.name || u.email.split('@')[0]}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {u.email}
                                            </div>
                                        </div>
                                        <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: pc.bg, color: pc.color, flexShrink: 0 }}>
                                            {u.plan || 'free'}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Device/user count preview */}
                {pushPlan === 'individual' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 16, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 8 }}>
                        <Users size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                        <span style={{ color: '#f59e0b', fontSize: 13 }}>
                            {selectedPushUserIds.size} utilisateur{selectedPushUserIds.size === 1 ? '' : 's'} sélectionné{selectedPushUserIds.size === 1 ? '' : 's'}
                        </span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 8 }}>
                            <Bell size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span style={{ color: '#f59e0b', fontSize: 13 }}>
                                {pushDeviceCount} appareil{pushDeviceCount === 1 ? '' : 's'} recevront la notification push
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(96, 165, 250, 0.08)', border: '1px solid rgba(96, 165, 250, 0.2)', borderRadius: 8 }}>
                            <Users size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
                            <span style={{ color: '#60a5fa', fontSize: 13 }}>
                                {pushUserCount} utilisateur{pushUserCount === 1 ? '' : 's'} verront la notification dans leur cloche
                            </span>
                        </div>
                    </div>
                )}

                {/* Title */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ color: '#94a3b8', fontSize: 13 }}>Titre</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#475569', fontSize: 11 }}>{pushTitle.length}/65</span>
                            <button onClick={() => spellCheck('pushTitle', pushTitle, setPushTitle)}
                                disabled={!pushTitle.trim() || spellChecking === 'pushTitle'}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: spellChecking === 'pushTitle' ? '#64748b' : '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                {spellChecking === 'pushTitle' ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <SpellCheck size={11} />} Corriger
                            </button>
                        </div>
                    </div>
                    <input type="text" value={pushTitle} onChange={(e) => setPushTitle(e.target.value.slice(0, 65))}
                        placeholder="Ex: Nouvelle fonctionnalité disponible !" style={inputStyle} />
                </div>

                {/* Body */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ color: '#94a3b8', fontSize: 13 }}>Message</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#475569', fontSize: 11 }}>{pushBody.length}/240</span>
                            <button onClick={() => spellCheck('pushBody', pushBody, setPushBody)}
                                disabled={!pushBody.trim() || spellChecking === 'pushBody'}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: spellChecking === 'pushBody' ? '#64748b' : '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                {spellChecking === 'pushBody' ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <SpellCheck size={11} />} Corriger
                            </button>
                        </div>
                    </div>
                    <textarea value={pushBody} onChange={(e) => setPushBody(e.target.value.slice(0, 240))}
                        placeholder="Découvrez ce qui est nouveau sur WazzapAI..." rows={4}
                        style={{ ...inputStyle, resize: 'none' }} />
                </div>

                {/* Warning bypass preferences */}
                <div style={{ display: 'flex', gap: 8, padding: '10px 14px', marginBottom: 16, background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 10 }}>
                    <AlertTriangle size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ color: '#fbbf24', fontSize: 12 }}>La cloche est alimentée pour tous les utilisateurs du segment, même ceux sans permission push.</span>
                </div>

                {/* Result */}
                {pushResult && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ padding: '12px 14px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 10 }}>
                            <div style={{ color: '#4ade80', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>✅ Notification envoyée</div>
                            <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                Push : {pushResult.sent} envoyé{pushResult.sent !== 1 ? 's' : ''}
                                {pushResult.failed > 0 && <span style={{ color: '#f87171' }}> · {pushResult.failed} échec{pushResult.failed !== 1 ? 's' : ''}</span>}
                            </div>
                            {(pushResult.userCount ?? 0) > 0 && (
                                <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                    Cloche : {pushResult.userCount} utilisateur{pushResult.userCount !== 1 ? 's' : ''} notifié{pushResult.userCount !== 1 ? 's' : ''}
                                </div>
                            )}
                        </div>
                        {pushResult.failed > 0 && (
                            <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 10 }}>
                                <div style={{ color: '#f87171', fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                                    Appareils en échec ({pushResult.failed})
                                </div>
                                {(pushResult.failedEmails ?? []).length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                        {pushResult.failedEmails!.map(email => (
                                            <span key={email} style={{ padding: '2px 8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 5, color: '#fca5a5', fontSize: 11 }}>
                                                {email}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>
                                        Tokens invalides ou expirés (appareils non enregistrés)
                                    </div>
                                )}
                                <button
                                    onClick={() => {
                                        if (pushResult.failedEmails && pushResult.failedEmails.length > 0) {
                                            const users = allUsers.filter(u => pushResult.failedEmails!.includes(u.email))
                                            setSelectedPushUserIds(new Set(users.map(u => u.id!).filter(Boolean)))
                                            setPushPlan('individual')
                                            if (allUsers.length === 0) fetchAllUsers()
                                        }
                                        setPushResult(null)
                                    }}
                                    style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 7, color: '#f87171', padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                    Relancer ces utilisateurs
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {pushError && (
                    <div style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>
                        {pushError}
                    </div>
                )}

                {/* Send button */}
                <button onClick={sendPushBroadcast}
                    disabled={!pushTitle.trim() || !pushBody.trim() || pushSending || (pushPlan === 'individual' ? selectedPushUserIds.size === 0 : pushUserCount === 0)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        padding: '13px 20px', background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                        opacity: (!pushTitle.trim() || !pushBody.trim() || pushSending || (pushPlan === 'individual' ? selectedPushUserIds.size === 0 : pushUserCount === 0)) ? 0.5 : 1
                    }}>
                    {pushSending
                        ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Envoi en cours...</>
                        : <><Bell size={16} />Envoyer la Notification</>}
                </button>
            </div>

            <HistoryPanel history={history} activeTab="push" />
        </div>
    )
}
