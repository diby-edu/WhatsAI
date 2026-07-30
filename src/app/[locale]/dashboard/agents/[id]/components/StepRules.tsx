import type { Dispatch, SetStateAction } from 'react'
import { motion } from 'framer-motion'
import type { AgentFormData } from '../types'

interface StepRulesProps {
    formData: AgentFormData
    setFormData: Dispatch<SetStateAction<AgentFormData>>
    isSupportClient: boolean
    conflictStatus: 'idle' | 'checking' | 'safe' | 'conflict' | 'error'
    setConflictStatus: Dispatch<SetStateAction<'idle' | 'checking' | 'safe' | 'conflict' | 'error'>>
    conflictReason: string
    checkConflict: () => void
}

export function StepRules({ formData, setFormData, isSupportClient, conflictStatus, setConflictStatus, conflictReason, checkConflict }: StepRulesProps) {
    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {isSupportClient && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 10, fontSize: 13, color: '#a5b4fc' }}>
                    <span>ℹ️</span>
                    <span>En mode Support Client, les règles s'activent automatiquement si vous ajoutez des produits à cet agent.</span>
                </div>
            )}
            <p style={{ fontSize: 14, color: '#94a3b8' }}>
                Ajoutez ici TOUTES vos règles spécifiques que le bot doit respecter absolument.
                {isSupportClient
                    ? <><br />Périmètre d&apos;intervention, Procédures, Restrictions, Escalade...</>
                    : <><br />Politique de retour, Promotions, Conditions spéciales... (livraison et paiement ont leurs propres étapes)</>
                }
            </p>

            <textarea
                value={formData.custom_rules}
                onChange={e => {
                    setFormData({ ...formData, custom_rules: e.target.value })
                    setConflictStatus('idle')
                }}
                placeholder={isSupportClient ? `Exemples de règles que l'IA doit respecter:

🔍 PÉRIMÈTRE:
- Répondre uniquement aux questions liées à nos véhicules/produits/services
- Ne pas donner d'avis personnel sur la concurrence

📋 PROCÉDURES:
- Pour un essai: demander nom, téléphone et disponibilité
- Pour un devis: orienter vers notre formulaire en ligne

🚫 RESTRICTIONS:
- Ne pas promettre de prix sans validation du responsable
- Ne pas communiquer les stocks exacts

📞 ESCALADE:
- Renvoyer vers le conseiller au +225 07 XX XX XX XX pour toute demande complexe` : `Exemples de règles que l'IA doit respecter:

🚫 RESTRICTIONS:
- Pas de remboursement sur articles soldés
- Échange uniquement dans les 48h

🎁 PROMOTIONS:
- Réduction de 10% dès 3 articles achetés

📞 ESCALADE:
- Renvoyer vers le support si problème complexe

ℹ️ La livraison et le paiement sont déjà configurés dans leurs propres étapes — inutile de les répéter ici.`}
                style={{
                    width: '100%',
                    padding: 16,
                    borderRadius: 12,
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    background: 'rgba(30, 41, 59, 0.5)',
                    color: 'white',
                    outline: 'none',
                    height: 240,
                    resize: 'vertical',
                    fontFamily: 'inherit'
                }}
            />

            {/* AI Conflict Detector */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                    {conflictStatus === 'checking' && <div style={{ color: '#10b981', fontSize: 14, animation: 'pulse 2s infinite' }}>Analyse IA en cours...</div>}
                    {conflictStatus === 'safe' && <div style={{ color: '#10b981', fontSize: 14 }}>✅ Aucune contradiction détectée.</div>}
                    {conflictStatus === 'conflict' && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', padding: 12, borderRadius: 8, color: '#fca5a5', fontSize: 14 }}>
                            <div style={{ fontWeight: 600 }}>⚠️ Conflit Détecté</div>
                            {conflictReason}
                        </div>
                    )}
                </div>
                <button
                    onClick={checkConflict}
                    style={{
                        background: 'rgba(71, 85, 105, 0.5)',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: 8,
                        fontSize: 14,
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    🛡️ Vérifier la cohérence
                </button>
            </div>
        </motion.div>
    )
}
