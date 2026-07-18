import type { CSSProperties, RefObject } from 'react'
import { Send, Users, Loader2, AlertTriangle, Search, SpellCheck, Bold, Italic, Link2 } from 'lucide-react'
import { HistoryPanel } from './HistoryPanel'
import { SEGMENT_OPTIONS, PLAN_COLORS, isAgentStatusSegment, getSegmentHint } from '../constants'
import type { UserOption } from '../types'

interface EmailTabProps {
    emailPlan: string
    setEmailPlan: (value: string) => void
    selectedEmails: Set<string>
    setSelectedEmails: (value: Set<string>) => void
    filteredUsers: UserOption[]
    userSearch: string
    setUserSearch: (value: string) => void
    loadingUsers: boolean
    toggleUser: (email: string) => void
    effectiveRecipientCount: number
    emailSubject: string
    setEmailSubject: (value: string) => void
    spellCheck: (field: string, text: string, setter: (v: string) => void) => void
    spellChecking: string | null
    emailMessage: string
    setEmailMessage: (value: string) => void
    insertFormat: (format: 'bold' | 'italic' | 'link') => void
    emailBodyRef: RefObject<HTMLTextAreaElement | null>
    emailResult: { sent: number; failed: number; total: number } | null
    emailError: string | null
    sendDisabled: boolean
    sendEmailBroadcast: () => void
    emailSending: boolean
    inputStyle: CSSProperties
    history: any[]
}

export function EmailTab({
    emailPlan,
    setEmailPlan,
    selectedEmails,
    setSelectedEmails,
    filteredUsers,
    userSearch,
    setUserSearch,
    loadingUsers,
    toggleUser,
    effectiveRecipientCount,
    emailSubject,
    setEmailSubject,
    spellCheck,
    spellChecking,
    emailMessage,
    setEmailMessage,
    insertFormat,
    emailBodyRef,
    emailResult,
    emailError,
    sendDisabled,
    sendEmailBroadcast,
    emailSending,
    inputStyle,
    history,
}: EmailTabProps) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, padding: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Send size={18} style={{ color: '#60a5fa' }} /> Nouvelle Campagne Email
                </h2>

                {/* Segment */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Segment cible</label>
                    <select value={emailPlan} onChange={(e) => setEmailPlan(e.target.value)} style={inputStyle}>
                        {SEGMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {isAgentStatusSegment(emailPlan) && (
                        <div style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>
                            {getSegmentHint(emailPlan)}
                        </div>
                    )}
                </div>

                {/* Individual user picker */}
                {emailPlan === 'individual' && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <label style={{ color: '#94a3b8', fontSize: 13 }}>
                                Choisir les destinataires
                                {selectedEmails.size > 0 && (
                                    <span style={{ marginLeft: 8, color: '#60a5fa', fontWeight: 600 }}>
                                        ({selectedEmails.size} sélectionné{selectedEmails.size === 1 ? '' : 's'})
                                    </span>
                                )}
                            </label>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    onClick={() => setSelectedEmails(new Set(filteredUsers.map(u => u.email)))}
                                    style={{ background: 'none', border: '1px solid rgba(96, 165, 250, 0.3)', borderRadius: 6, color: '#60a5fa', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                    Tous
                                </button>
                                <button
                                    onClick={() => setSelectedEmails(new Set())}
                                    style={{ background: 'none', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 6, color: '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                    Aucun
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div style={{ position: 'relative', marginBottom: 8 }}>
                            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                            <input
                                type="text"
                                value={userSearch}
                                onChange={e => setUserSearch(e.target.value)}
                                placeholder="Rechercher par nom ou email..."
                                style={{ ...inputStyle, paddingLeft: 34 }}
                            />
                        </div>

                        {/* User list */}
                        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: 10, background: 'rgba(15, 23, 42, 0.4)' }}>
                            {loadingUsers ? (
                                <div style={{ padding: 24, textAlign: 'center', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Chargement...
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Aucun utilisateur trouvé</div>
                            ) : filteredUsers.map((u, idx) => {
                                const isSelected = selectedEmails.has(u.email)
                                const pc = PLAN_COLORS[u.plan] || PLAN_COLORS.free
                                const rowBorder = idx < filteredUsers.length - 1 ? '1px solid rgba(148, 163, 184, 0.06)' : 'none'
                                return (
                                    <div
                                        key={u.email}
                                        role="checkbox"
                                        aria-checked={isSelected}
                                        tabIndex={0}
                                        onClick={() => toggleUser(u.email)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleUser(u.email) } }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '9px 12px', cursor: 'pointer',
                                            borderBottom: rowBorder,
                                            background: isSelected ? 'rgba(96, 165, 250, 0.08)' : 'transparent',
                                            transition: 'background 0.15s'
                                        }}>
                                        {/* Checkbox */}
                                        <div style={{
                                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                            border: isSelected ? '2px solid #60a5fa' : '2px solid rgba(148, 163, 184, 0.3)',
                                            background: isSelected ? '#60a5fa' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.15s'
                                        }}>
                                            {isSelected && <span style={{ color: 'white', fontSize: 10, lineHeight: 1, fontWeight: 700 }}>âœ“</span>}
                                        </div>
                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ color: 'white', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {u.name || u.email.split('@')[0]}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {u.email}
                                            </div>
                                        </div>
                                        {/* Plan badge */}
                                        <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: pc.bg, color: pc.color, flexShrink: 0 }}>
                                            {u.plan || 'free'}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Selected emails chips */}
                {emailPlan === 'individual' && selectedEmails.size > 0 && (
                    <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(96, 165, 250, 0.06)', border: '1px solid rgba(96, 165, 250, 0.15)', borderRadius: 10 }}>
                        <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
                            {selectedEmails.size} destinataire{selectedEmails.size !== 1 ? 's' : ''} sélectionné{selectedEmails.size !== 1 ? 's' : ''} :
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {[...selectedEmails].map(email => (
                                <span
                                    key={email}
                                    onClick={() => toggleUser(email)}
                                    title="Cliquer pour retirer"
                                    style={{ padding: '2px 8px', background: 'rgba(96, 165, 250, 0.12)', border: '1px solid rgba(96, 165, 250, 0.25)', borderRadius: 5, color: '#93c5fd', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    {email} <span style={{ opacity: 0.6 }}>×</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recipients preview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 16, background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.2)', borderRadius: 10 }}>
                    <Users size={16} style={{ color: '#60a5fa' }} />
                    <span style={{ color: '#60a5fa', fontSize: 13 }}>
                        {effectiveRecipientCount} destinataire{effectiveRecipientCount === 1 ? '' : 's'} recevront cet email
                    </span>
                </div>

                {/* Subject */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ color: '#94a3b8', fontSize: 13 }}>Sujet</label>
                        <button onClick={() => spellCheck('emailSubject', emailSubject, setEmailSubject)}
                            disabled={!emailSubject.trim() || spellChecking === 'emailSubject'}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: spellChecking === 'emailSubject' ? '#64748b' : '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                            {spellChecking === 'emailSubject' ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <SpellCheck size={11} />} Corriger
                        </button>
                    </div>
                    <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Ex: Nouveauté WazzapAI — À ne pas manquer !" style={inputStyle} />
                </div>

                {/* Body */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ color: '#94a3b8', fontSize: 13 }}>Corps du message</label>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => insertFormat('bold')} title="Gras"
                                style={{ display: 'flex', alignItems: 'center', background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                                <Bold size={11} />
                            </button>
                            <button onClick={() => insertFormat('italic')} title="Italique"
                                style={{ display: 'flex', alignItems: 'center', background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontStyle: 'italic' }}>
                                <Italic size={11} />
                            </button>
                            <button onClick={() => insertFormat('link')} title="Lien"
                                style={{ display: 'flex', alignItems: 'center', background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                <Link2 size={11} />
                            </button>
                            <button onClick={() => spellCheck('emailBody', emailMessage, setEmailMessage)}
                                disabled={!emailMessage.trim() || spellChecking === 'emailBody'}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: spellChecking === 'emailBody' ? '#64748b' : '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                {spellChecking === 'emailBody' ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <SpellCheck size={11} />} Corriger
                            </button>
                        </div>
                    </div>
                    <textarea ref={emailBodyRef} value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)}
                        placeholder={'Voici notre annonce...\n\nCordialement,\nL\'équipe WazzapAI'}
                        rows={8} style={{ ...inputStyle, resize: 'vertical' }} />
                    <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
                        "Bonjour [Nom]" est ajouté automatiquement. **texte** = gras · _texte_ = italique
                    </div>
                </div>

                {/* Warning */}
                <div style={{ display: 'flex', gap: 8, padding: '10px 14px', marginBottom: 16, background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 10 }}>
                    <AlertTriangle size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ color: '#fbbf24', fontSize: 12 }}>Hostinger â‰ˆ 500 emails/h. Pour &gt;500 utilisateurs, préférez Brevo ou Mailchimp.</span>
                </div>

                {/* Result */}
                {emailResult && (
                    <div style={{ padding: '12px 14px', marginBottom: 16, background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 10 }}>
                        <div style={{ color: '#4ade80', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>✅ Campagne envoyée</div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>
                            {emailResult.sent} envoyé{emailResult.sent !== 1 ? 's' : ''}
                            {emailResult.failed > 0 && ` · ${emailResult.failed} échec${emailResult.failed !== 1 ? 's' : ''}`}
                            {' / '}{emailResult.total} total
                        </div>
                    </div>
                )}
                {emailError && (
                    <div style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>
                        {emailError}
                    </div>
                )}

                {/* Send button */}
                <button onClick={sendEmailBroadcast}
                    disabled={sendDisabled}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        padding: '13px 20px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                        opacity: sendDisabled ? 0.5 : 1
                    }}>
                    {emailSending
                        ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Envoi en cours ({effectiveRecipientCount})...</>
                        : <><Send size={16} />Envoyer la Campagne Email</>}
                </button>
            </div>

            <HistoryPanel history={history} activeTab="email" />
        </div>
    )
}
