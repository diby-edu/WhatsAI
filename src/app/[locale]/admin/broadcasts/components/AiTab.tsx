import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { Sparkles, Loader2, CheckCircle, Send, History, Trash2 } from 'lucide-react'
import type { AiDraftEntry } from '../types'

interface AiTabProps {
    aiChannel: 'email' | 'push' | 'whatsapp'
    setAiChannel: (value: 'email' | 'push' | 'whatsapp') => void
    aiGenerated: Record<string, string> | null
    setAiGenerated: Dispatch<SetStateAction<Record<string, string> | null>>
    aiPrompt: string
    setAiPrompt: (value: string) => void
    aiError: string | null
    generateAiDraft: () => void
    aiLoading: boolean
    useAiDraft: (entry?: AiDraftEntry) => void
    aiHistory: AiDraftEntry[]
    setAiHistory: (value: AiDraftEntry[]) => void
    inputStyle: CSSProperties
}

export function AiTab({
    aiChannel,
    setAiChannel,
    aiGenerated,
    setAiGenerated,
    aiPrompt,
    setAiPrompt,
    aiError,
    generateAiDraft,
    aiLoading,
    useAiDraft,
    aiHistory,
    setAiHistory,
    inputStyle,
}: AiTabProps) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {/* Formulaire génération */}
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, padding: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={18} style={{ color: '#a78bfa' }} /> Rédiger avec l'IA
                </h2>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
                    Décrivez ce que vous voulez envoyer. L'IA rédige, vous relisez, vous envoyez.
                </p>

                {/* Canal */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Canal</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {([
                            { value: 'email', label: 'Email', color: '#60a5fa' },
                            { value: 'push', label: 'Push', color: '#f59e0b' },
                            { value: 'whatsapp', label: 'WhatsApp', color: '#34d399' },
                        ] as const).map(opt => (
                            <button key={opt.value} onClick={() => { setAiChannel(opt.value); setAiGenerated(null) }}
                                style={{
                                    flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                    border: aiChannel === opt.value ? `1px solid ${opt.color}` : '1px solid rgba(148,163,184,0.2)',
                                    background: aiChannel === opt.value ? `rgba(${opt.color === '#60a5fa' ? '96,165,250' : opt.color === '#f59e0b' ? '245,158,11' : '52,211,153'},0.1)` : 'rgba(15,23,42,0.5)',
                                    color: aiChannel === opt.value ? opt.color : '#94a3b8',
                                }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Prompt */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Votre instruction</label>
                    <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                        placeholder={
                            aiChannel === 'email'
                                ? 'Ex: informe les utilisateurs que le paiement est de nouveau fonctionnel'
                                : aiChannel === 'push'
                                ? 'Ex: annonce une nouvelle fonctionnalité de tableau de bord'
                                : 'Ex: rappelle aux utilisateurs de reconnecter leur agent WhatsApp'
                        }
                        rows={4} style={{ ...inputStyle, resize: 'none' }}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generateAiDraft() }}
                    />
                    <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>Ctrl+Entrée pour générer</div>
                </div>

                {aiError && (
                    <div style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>
                        {aiError}
                    </div>
                )}

                <button onClick={generateAiDraft} disabled={!aiPrompt.trim() || aiLoading}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        padding: '13px 20px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                        border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                        opacity: (!aiPrompt.trim() || aiLoading) ? 0.5 : 1, marginBottom: 20
                    }}>
                    {aiLoading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Génération en cours...</> : <><Sparkles size={16} />Générer</>}
                </button>

                {/* Résultat généré */}
                {aiGenerated && (
                    <div style={{ padding: 16, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 12 }}>
                        <div style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CheckCircle size={14} /> Brouillon généré
                        </div>
                        {aiGenerated.subject && (
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>SUJET</div>
                                <textarea value={aiGenerated.subject} onChange={e => setAiGenerated(prev => ({ ...prev!, subject: e.target.value }))}
                                    rows={2} style={{ ...inputStyle, fontSize: 13, resize: 'none' }} />
                            </div>
                        )}
                        {aiGenerated.title && (
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>TITRE</div>
                                <input value={aiGenerated.title} onChange={e => setAiGenerated(prev => ({ ...prev!, title: e.target.value }))}
                                    style={{ ...inputStyle, fontSize: 13 }} />
                            </div>
                        )}
                        {aiGenerated.body && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>MESSAGE</div>
                                <textarea value={aiGenerated.body} onChange={e => setAiGenerated(prev => ({ ...prev!, body: e.target.value }))}
                                    rows={6} style={{ ...inputStyle, fontSize: 13, resize: 'vertical' }} />
                            </div>
                        )}
                        <button onClick={() => useAiDraft()}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                padding: '11px 16px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                                border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600
                            }}>
                            <Send size={14} /> Utiliser ce brouillon → aller dans {aiChannel === 'email' ? 'Email' : aiChannel === 'push' ? 'Push' : 'WhatsApp'}
                        </button>
                    </div>
                )}
            </div>

            {/* Historique IA */}
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <History size={18} style={{ color: '#a78bfa' }} /> Historique IA
                    </h2>
                    {aiHistory.length > 0 && (
                        <button onClick={() => { setAiHistory([]); localStorage.removeItem('broadcast_ai_history') }}
                            style={{ background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: '#64748b', padding: '3px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Trash2 size={11} /> Vider
                        </button>
                    )}
                </div>
                {aiHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                        <Sparkles size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                        <p style={{ fontSize: 13 }}>Aucun brouillon généré</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {aiHistory.map(entry => (
                            <div key={entry.id} style={{ padding: 12, background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{
                                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
                                        background: entry.channel === 'email' ? 'rgba(96,165,250,0.15)' : entry.channel === 'push' ? 'rgba(245,158,11,0.15)' : 'rgba(52,211,153,0.15)',
                                        color: entry.channel === 'email' ? '#60a5fa' : entry.channel === 'push' ? '#f59e0b' : '#34d399'
                                    }}>
                                        {entry.channel.toUpperCase()}
                                    </span>
                                    <span style={{ color: '#475569', fontSize: 11 }}>
                                        {new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    "{entry.prompt}"
                                </p>
                                {(entry.generated.subject || entry.generated.title) && (
                                    <p style={{ color: 'white', fontSize: 12, fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {entry.generated.subject || entry.generated.title}
                                    </p>
                                )}
                                <button onClick={() => useAiDraft(entry)}
                                    style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 6, color: '#a78bfa', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                                    Réutiliser
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
