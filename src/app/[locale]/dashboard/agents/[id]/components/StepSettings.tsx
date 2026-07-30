import type { Dispatch, SetStateAction } from 'react'
import { motion } from 'framer-motion'
import type { AgentFormData } from '../types'

interface StepSettingsProps {
    formData: AgentFormData
    setFormData: Dispatch<SetStateAction<AgentFormData>>
    isSupportClient: boolean
    isExternalSync: boolean
    isPhysicalProduct: boolean
}

const DEFAULT_ABIDJAN_COMMUNES = [
    'Cocody', 'Yopougon', 'Plateau', 'Marcory', 'Treichville', 'Koumassi',
    'Port-Bouët', 'Abobo', 'Adjamé', 'Attécoubé', 'Bingerville', 'Songon',
]

export function StepSettings({ formData, setFormData, isSupportClient, isExternalSync, isPhysicalProduct }: StepSettingsProps) {
    const selectStyle = {
        width: '100%',
        padding: 12,
        borderRadius: 12,
        border: '1px solid rgba(148, 163, 184, 0.1)',
        background: 'rgba(30, 41, 59, 0.5)',
        color: 'white',
        outline: 'none'
    }

    if (isExternalSync) {
        return (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.2)', borderRadius: 10, fontSize: 13, color: '#bae6fd' }}>
                    <span>ℹ️</span>
                    <span>Ce canal ne génère pas de réponses IA. Configurez ici le message envoyé automatiquement quand un client répond à vos notifications.</span>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                        Message de redirection *
                    </label>
                    <textarea
                        value={formData.external_sync_reply_message}
                        onChange={e => setFormData({ ...formData, external_sync_reply_message: e.target.value })}
                        placeholder={`Ex: Bonjour ! Pour toute question, contactez notre équipe au {{escalation_phone}}.`}
                        rows={4}
                        style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(148, 163, 184, 0.1)', background: 'rgba(30, 41, 59, 0.5)', color: 'white', outline: 'none', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                    />
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                        Utilisez <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}>{'{{escalation_phone}}'}</code> pour insérer automatiquement le numéro d&apos;escalade configuré dans l&apos;onglet Identité.
                    </p>
                </div>
            </motion.div>
        )
    }

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Settings - Only Temperature and Language */}
            <div className="agent-grid-2">
                <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>Température: {formData.temperature}</label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.temperature}
                        onChange={e => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                        style={{ width: '100%', accentColor: '#10b981' }}
                    />
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Plus élevé = réponses plus créatives</p>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>Langue</label>
                    <select
                        value={formData.language}
                        onChange={e => setFormData({ ...formData, language: e.target.value })}
                        style={selectStyle}
                    >
                        <option value="fr">Français</option>
                        <option value="en">Anglais</option>
                    </select>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                    padding: 16,
                    borderRadius: 12,
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    background: formData.restaurant_deposit_enabled
                        ? 'rgba(16, 185, 129, 0.08)'
                        : 'rgba(15, 23, 42, 0.3)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                        <div>
                            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                                Acompte reservations restaurant
                            </h3>
                            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                                Utilise uniquement pour les reservations restaurant avec precommande.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, restaurant_deposit_enabled: !formData.restaurant_deposit_enabled })}
                            style={{
                                width: 48,
                                height: 28,
                                borderRadius: 14,
                                background: formData.restaurant_deposit_enabled ? '#10b981' : '#334155',
                                border: 'none',
                                cursor: 'pointer',
                                position: 'relative',
                                flexShrink: 0
                            }}
                        >
                            <div style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: 'white',
                                position: 'absolute',
                                top: 3,
                                left: formData.restaurant_deposit_enabled ? 23 : 3,
                                transition: 'left 0.2s'
                            }} />
                        </button>
                    </div>

                    {formData.restaurant_deposit_enabled && (
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Type d&apos;acompte
                                </label>
                                <div className="agent-grid-2" style={{ gap: 12 }}>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, restaurant_deposit_mode: 'percentage' })}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: 10,
                                            border: formData.restaurant_deposit_mode === 'percentage' ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.15)',
                                            background: formData.restaurant_deposit_mode === 'percentage' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.35)',
                                            color: formData.restaurant_deposit_mode === 'percentage' ? '#d1fae5' : '#cbd5e1',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Pourcentage
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, restaurant_deposit_mode: 'fixed' })}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: 10,
                                            border: formData.restaurant_deposit_mode === 'fixed' ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.15)',
                                            background: formData.restaurant_deposit_mode === 'fixed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.35)',
                                            color: formData.restaurant_deposit_mode === 'fixed' ? '#d1fae5' : '#cbd5e1',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Montant fixe
                                    </button>
                                </div>
                            </div>
                            {formData.restaurant_deposit_mode === 'percentage' ? (
                                <>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                            Pourcentage d&apos;acompte: {formData.restaurant_deposit_percentage}%
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="5"
                                            value={formData.restaurant_deposit_percentage}
                                            onChange={e => setFormData({ ...formData, restaurant_deposit_percentage: parseInt(e.target.value) })}
                                            style={{ width: '100%', accentColor: '#10b981' }}
                                        />
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={formData.restaurant_deposit_percentage}
                                        onChange={e => setFormData({ ...formData, restaurant_deposit_percentage: Math.max(0, Math.min(100, parseInt(e.target.value || '0'))) })}
                                        style={selectStyle}
                                    />
                                    <p style={{ fontSize: 12, color: '#94a3b8' }}>
                                        Exemple: 30% demande un acompte de 30% avant confirmation finale de la reservation.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                            Montant fixe de l&apos;acompte (FCFA)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="500"
                                            value={formData.restaurant_deposit_fixed_amount_fcfa}
                                            onChange={e => setFormData({ ...formData, restaurant_deposit_fixed_amount_fcfa: Math.max(0, parseInt(e.target.value || '0')) })}
                                            style={selectStyle}
                                        />
                                    </div>
                                    <p style={{ fontSize: 12, color: '#94a3b8' }}>
                                        Exemple: 5000 demande toujours 5 000 FCFA d&apos;acompte. Si le total est inferieur, l&apos;acompte sera plafonne au total.
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Section Collecte de Leads (support client + services) */}
                {isSupportClient && (
                    <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 24, marginTop: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <label style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                                Collecte de leads
                            </label>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Recommandé
                            </span>
                        </div>

                        {!formData.lead_collection_enabled && (
                            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                                <p style={{ color: '#f87171', fontWeight: 600, fontSize: 13, margin: '0 0 4px 0' }}>Les leads sont désactivés — vous perdez des prospects.</p>
                                <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Chaque client qui contacte votre agent est un prospect. Sans collecte, vous ne saurez jamais qui a écrit.</p>
                            </div>
                        )}

                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: 16, border: `1px solid ${formData.lead_collection_enabled ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.1)'}`, borderRadius: 12, background: formData.lead_collection_enabled ? 'rgba(16,185,129,0.06)' : 'rgba(30,41,59,0.5)', marginBottom: 16
                        }}>
                            <div>
                                <div style={{ fontWeight: 600, color: 'white', fontSize: 14 }}>Activer la collecte de leads</div>
                                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                                    L'agent récupère automatiquement le contact de chaque client intéressé
                                </div>
                            </div>
                            <button type="button"
                                onClick={() => setFormData({ ...formData, lead_collection_enabled: !formData.lead_collection_enabled })}
                                style={{ width: 48, height: 28, borderRadius: 14, background: formData.lead_collection_enabled ? '#10b981' : '#334155', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
                            >
                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: formData.lead_collection_enabled ? 23 : 3, transition: 'left 0.2s' }} />
                            </button>
                        </div>

                        {formData.lead_collection_enabled && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                        Informations à collecter
                                    </label>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                                        {[
                                            { key: 'name', label: 'Prénom/Nom' },
                                            { key: 'phone', label: 'Téléphone' },
                                            { key: 'email', label: 'Email' },
                                            { key: 'location', label: 'Localisation' },
                                            { key: 'company', label: 'Entreprise' },
                                            { key: 'preferred_date', label: 'Date souhaitée' },
                                            { key: 'preferred_time', label: 'Heure souhaitée' },
                                            { key: 'service_requested', label: 'Service demandé' },
                                            { key: 'notes', label: 'Notes libres' },
                                        ].map(f => (
                                            <button key={f.key} type="button"
                                                onClick={() => {
                                                    const cur = formData.lead_collect_fields
                                                    setFormData({ ...formData, lead_collect_fields: cur.includes(f.key) ? cur.filter((x: string) => x !== f.key) : [...cur, f.key] })
                                                }}
                                                style={{
                                                    padding: '8px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: 'none',
                                                    background: formData.lead_collect_fields.includes(f.key) ? '#10b981' : 'rgba(30,41,59,0.8)',
                                                    color: formData.lead_collect_fields.includes(f.key) ? 'white' : '#94a3b8'
                                                }}
                                            >{f.label}</button>
                                        ))}
                                    </div>

                                    {/* Champs personnalisés */}
                                    <div style={{ borderTop: '1px solid rgba(148,163,184,0.08)', paddingTop: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <label style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8' }}>
                                                Champs personnalisés
                                            </label>
                                            <button type="button"
                                                onClick={() => {
                                                    const val = window.prompt('Nom du champ personnalisé (ex: budget, taille, symptômes)')
                                                    if (val?.trim()) {
                                                        const key = val.trim().toLowerCase().replace(/\s+/g, '_')
                                                        if (!formData.lead_custom_fields.includes(key)) {
                                                            setFormData({ ...formData, lead_custom_fields: [...formData.lead_custom_fields, key] })
                                                        }
                                                    }
                                                }}
                                                style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px dashed rgba(148,163,184,0.3)', background: 'transparent', color: '#64748b' }}
                                            >+ Ajouter un champ</button>
                                        </div>
                                        {formData.lead_custom_fields.length > 0 ? (
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {formData.lead_custom_fields.map((cf: string) => (
                                                    <span key={cf} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#c4b5fd', fontSize: 12 }}>
                                                        {cf}
                                                        <button type="button"
                                                            onClick={() => setFormData({ ...formData, lead_custom_fields: formData.lead_custom_fields.filter((x: string) => x !== cf) })}
                                                            style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 14 }}
                                                        >×</button>
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                                                Ex: budget, taille, type_véhicule, symptômes…
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                        Message après enregistrement du lead
                                    </label>
                                    <input type="text" value={formData.lead_redirect_message}
                                        onChange={e => setFormData({ ...formData, lead_redirect_message: e.target.value })}
                                        placeholder="Ex: Merci ! Nos équipes vous recontacteront sous 24h."
                                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 14 }}
                                    />
                                </div>
                            </div>
                        )}

                        {!formData.lead_collection_enabled && (
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Message de redirection (optionnel)
                                </label>
                                <input type="text" value={formData.lead_redirect_message}
                                    onChange={e => setFormData({ ...formData, lead_redirect_message: e.target.value })}
                                    placeholder="Ex: Pour nous contacter, appelez le +225 07 00 00 00"
                                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 14 }}
                                />
                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                    Ce message sera affiché si un client exprime un intérêt commercial.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isPhysicalProduct && (
                <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 24, marginTop: 8 }}>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>
                        Frais de livraison
                    </label>
                    <div className="agent-grid-3" style={{ gap: 12, marginBottom: 8 }}>
                        {[
                            { key: 'zones', label: 'Payante' },
                            { key: 'free', label: 'Gratuite' },
                            { key: 'none', label: 'Aucun' },
                        ].map(opt => (
                            <button key={opt.key} type="button"
                                onClick={() => {
                                    if (opt.key === 'zones' && formData.delivery_zones.communes.length === 0) {
                                        setFormData({
                                            ...formData,
                                            delivery_fee_mode: 'zones',
                                            delivery_zones: {
                                                ...formData.delivery_zones,
                                                communes: DEFAULT_ABIDJAN_COMMUNES.map(name => ({ name, fee: 0 }))
                                            }
                                        })
                                    } else {
                                        setFormData({ ...formData, delivery_fee_mode: opt.key as 'none' | 'free' | 'zones' })
                                    }
                                }}
                                style={{
                                    padding: '12px 14px', borderRadius: 10,
                                    border: formData.delivery_fee_mode === opt.key ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.15)',
                                    background: formData.delivery_fee_mode === opt.key ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.35)',
                                    color: formData.delivery_fee_mode === opt.key ? '#d1fae5' : '#cbd5e1',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {formData.delivery_fee_mode !== 'zones' && (
                        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                            {formData.delivery_fee_mode === 'none' && "L'agent ne mentionne pas la livraison — à réserver aux cas où vous préférez en discuter vous-même avec le client après la commande (tarif variable, livraison gérée au cas par cas). Si le prix inclut déjà la livraison, choisissez plutôt \"Gratuite\" : c'est un argument de vente que le client appréciera."}
                            {formData.delivery_fee_mode === 'free' && "L'agent annonce explicitement au client que la livraison est gratuite."}
                        </p>
                    )}

                    {formData.delivery_fee_mode === 'zones' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94a3b8', marginBottom: 8 }}>
                                    Tarif par commune (FCFA)
                                </label>
                                <div className="agent-grid-3" style={{ gap: 8 }}>
                                    {formData.delivery_zones.communes.map((commune, idx) => {
                                        const allowsQuartiers = commune.name === 'Cocody' || commune.name === 'Yopougon'
                                        return (
                                            <div key={commune.name} style={{ padding: 10, borderRadius: 9, border: '1px solid rgba(148,163,184,0.1)', background: 'rgba(15,23,42,0.35)', minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ flex: 1, minWidth: 0, color: 'white', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commune.name}</span>
                                                    <input type="number" className="no-spinner" min={0} step={100} value={commune.fee}
                                                        onChange={e => {
                                                            const fee = Math.max(0, parseInt(e.target.value || '0'))
                                                            const communes = [...formData.delivery_zones.communes]
                                                            communes[idx] = { ...communes[idx], fee }
                                                            setFormData({ ...formData, delivery_zones: { ...formData.delivery_zones, communes } })
                                                        }}
                                                        style={{ width: 72, background: '#1e293b', border: '1px solid #334155', padding: '6px 8px', borderRadius: 7, color: 'white', outline: 'none', fontSize: 12 }}
                                                    />
                                                    <span style={{ fontSize: 10.5, color: '#64748b' }}>F</span>
                                                </div>

                                                {allowsQuartiers && (
                                                    <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: '2px solid rgba(148,163,184,0.1)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {(commune.quartiers || []).map((q, qIdx) => (
                                                            <div key={q.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.name}</span>
                                                                <input type="number" className="no-spinner" min={0} step={100} value={q.fee}
                                                                    onChange={e => {
                                                                        const fee = Math.max(0, parseInt(e.target.value || '0'))
                                                                        const communes = [...formData.delivery_zones.communes]
                                                                        const quartiers = [...(communes[idx].quartiers || [])]
                                                                        quartiers[qIdx] = { ...quartiers[qIdx], fee }
                                                                        communes[idx] = { ...communes[idx], quartiers }
                                                                        setFormData({ ...formData, delivery_zones: { ...formData.delivery_zones, communes } })
                                                                    }}
                                                                    style={{ width: 62, background: '#1e293b', border: '1px solid #334155', padding: '5px 6px', borderRadius: 6, color: 'white', outline: 'none', fontSize: 11 }}
                                                                />
                                                                <button type="button"
                                                                    onClick={() => {
                                                                        const communes = [...formData.delivery_zones.communes]
                                                                        communes[idx] = { ...communes[idx], quartiers: (communes[idx].quartiers || []).filter(x => x.name !== q.name) }
                                                                        setFormData({ ...formData, delivery_zones: { ...formData.delivery_zones, communes } })
                                                                    }}
                                                                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                                                                >×</button>
                                                            </div>
                                                        ))}
                                                        <button type="button"
                                                            onClick={() => {
                                                                const val = window.prompt(`Nom du quartier (${commune.name})`)
                                                                if (!val?.trim()) return
                                                                const communes = [...formData.delivery_zones.communes]
                                                                communes[idx] = { ...communes[idx], quartiers: [...(communes[idx].quartiers || []), { name: val.trim(), fee: commune.fee }] }
                                                                setFormData({ ...formData, delivery_zones: { ...formData.delivery_zones, communes } })
                                                            }}
                                                            style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', padding: '4px 8px', borderRadius: 7, fontSize: 11, cursor: 'pointer', border: '1px dashed rgba(148,163,184,0.3)', background: 'transparent', color: '#64748b' }}
                                                        >+ Ajouter un quartier</button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="agent-grid-2" style={{ gap: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94a3b8', marginBottom: 8 }}>
                                        Hors Abidjan (autres villes)
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {formData.delivery_zones.hors_abidjan.map((city, idx) => (
                                            <div key={city.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{city.name}</span>
                                                <input type="number" className="no-spinner" min={0} step={100} value={city.fee}
                                                    onChange={e => {
                                                        const fee = Math.max(0, parseInt(e.target.value || '0'))
                                                        const hors_abidjan = [...formData.delivery_zones.hors_abidjan]
                                                        hors_abidjan[idx] = { ...hors_abidjan[idx], fee }
                                                        setFormData({ ...formData, delivery_zones: { ...formData.delivery_zones, hors_abidjan } })
                                                    }}
                                                    style={{ width: 72, background: '#1e293b', border: '1px solid #334155', padding: '6px 8px', borderRadius: 7, color: 'white', outline: 'none', fontSize: 12 }}
                                                />
                                                <span style={{ fontSize: 10.5, color: '#64748b' }}>F</span>
                                                <button type="button"
                                                    onClick={() => {
                                                        const hors_abidjan = formData.delivery_zones.hors_abidjan.filter(x => x.name !== city.name)
                                                        setFormData({ ...formData, delivery_zones: { ...formData.delivery_zones, hors_abidjan } })
                                                    }}
                                                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                                                >×</button>
                                            </div>
                                        ))}
                                        <button type="button"
                                            onClick={() => {
                                                const val = window.prompt('Nom de la ville')
                                                if (!val?.trim()) return
                                                setFormData({ ...formData, delivery_zones: { ...formData.delivery_zones, hors_abidjan: [...formData.delivery_zones.hors_abidjan, { name: val.trim(), fee: 0 }] } })
                                            }}
                                            style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(148,163,184,0.25)', background: 'rgba(16,185,129,0.08)', color: '#6ee7b7', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                        >➕ Ajouter une ville</button>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94a3b8', marginBottom: 8 }}>
                                        International (autres pays)
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {formData.delivery_zones.international.map((country, idx) => (
                                            <div key={country.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{country.name}</span>
                                                <input type="number" className="no-spinner" min={0} step={100} value={country.fee}
                                                    onChange={e => {
                                                        const fee = Math.max(0, parseInt(e.target.value || '0'))
                                                        const international = [...formData.delivery_zones.international]
                                                        international[idx] = { ...international[idx], fee }
                                                        setFormData({ ...formData, delivery_zones: { ...formData.delivery_zones, international } })
                                                    }}
                                                    style={{ width: 72, background: '#1e293b', border: '1px solid #334155', padding: '6px 8px', borderRadius: 7, color: 'white', outline: 'none', fontSize: 12 }}
                                                />
                                                <span style={{ fontSize: 10.5, color: '#64748b' }}>F</span>
                                                <button type="button"
                                                    onClick={() => {
                                                        const international = formData.delivery_zones.international.filter(x => x.name !== country.name)
                                                        setFormData({ ...formData, delivery_zones: { ...formData.delivery_zones, international } })
                                                    }}
                                                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                                                >×</button>
                                            </div>
                                        ))}
                                        <button type="button"
                                            onClick={() => {
                                                const val = window.prompt('Nom du pays')
                                                if (!val?.trim()) return
                                                setFormData({ ...formData, delivery_zones: { ...formData.delivery_zones, international: [...formData.delivery_zones.international, { name: val.trim(), fee: 0 }] } })
                                            }}
                                            style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(148,163,184,0.25)', background: 'rgba(16,185,129,0.08)', color: '#6ee7b7', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                        >➕ Ajouter un pays</button>
                                    </div>
                                </div>
                            </div>

                            <p style={{ fontSize: 12, color: '#64748b' }}>
                                L&apos;agent demande la commune (ou ville/pays) du client et ajoute automatiquement le bon tarif au total. Si le client mentionne un lieu non reconnu, l&apos;agent lui demande de préciser plutôt que de deviner.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Live Query API — section avancée (bientôt) */}
            <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 24, opacity: 0.4, pointerEvents: 'none', userSelect: 'none' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                    Live Query URL <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>(Avancé — API)</span>
                </label>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                    URL appelée en temps réel pour récupérer des données dynamiques (stock, statut commande...). Réponse attendue : <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}>{`{ "answer": "..." }`}</code>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                        type="url"
                        value={formData.live_query_url}
                        onChange={e => setFormData({ ...formData, live_query_url: e.target.value })}
                        placeholder="https://monsite.com/wazzap-live-query"
                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 13, boxSizing: 'border-box' as const }}
                    />
                    <input
                        type="text"
                        value={formData.live_query_secret}
                        onChange={e => setFormData({ ...formData, live_query_secret: e.target.value })}
                        placeholder="Secret HMAC (optionnel) — pour vérifier la signature X-Wazzap-Signature"
                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 13, boxSizing: 'border-box' as const }}
                    />
                </div>
            </div>
        </motion.div>
    )
}
