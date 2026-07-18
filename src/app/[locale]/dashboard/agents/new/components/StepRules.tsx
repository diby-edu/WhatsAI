import type { CSSProperties } from 'react'
import { Loader2, Shield } from 'lucide-react'
import type { NewAgentFormData } from '../types'

interface StepRulesProps {
    formData: NewAgentFormData
    updateFormData: (field: string, value: any) => void
    isSupportClient: boolean
    isExternalSync: boolean
    inputStyle: CSSProperties
    conflictStatus: 'idle' | 'checking' | 'safe' | 'conflict' | 'error'
    conflictReason: string
    checkConflict: () => void
    buttonSecondaryStyle: CSSProperties
}

export function StepRules({ formData, updateFormData, isSupportClient, isExternalSync, inputStyle, conflictStatus, conflictReason, checkConflict, buttonSecondaryStyle }: StepRulesProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                    Règles spécifiques
                </label>
                <textarea
                    value={formData.custom_rules}
                    onChange={(e) => updateFormData('custom_rules', e.target.value)}
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
- Renvoyer vers le conseiller au +225 07 XX XX XX XX pour toute demande complexe` : isExternalSync ? `Exemples de règles pour une boutique connectée à une plateforme externe:

🌐 PLATEFORME:
- Toutes les commandes et paiements se font sur notre site/plateforme
- Ne jamais ouvrir un panier WazzapAI ni proposer le checkout interne

📦 PRODUITS:
- Ne présenter que les produits disponibles dans le catalogue synchronisé
- Ne jamais inventer un prix, un stock ou une référence produit
- En cas de doute sur la disponibilité, demander de vérifier sur le site

📥 PRODUITS NUMÉRIQUES:
- Après paiement confirmé, le fichier/lien est envoyé automatiquement
- En cas de problème de téléchargement, orienter vers le SAV

📞 ESCALADE:
- Renvoyer vers le support au +225 07 XX XX XX XX pour toute réclamation` : `Exemples de règles que l'IA doit respecter:

📦 LIVRAISON:
- Livraison gratuite à partir de 50.000 FCFA
- Zones de livraison: Abidjan uniquement
- Délai de livraison: 24-48h

💳 PAIEMENT:
- Paiement à la livraison accepté
- Mobile Money préféré (Orange, MTN, Wave)
- Pas de carte bancaire

🚫 RESTRICTIONS:
- Pas de remboursement sur articles soldés
- Échange uniquement dans les 48h
- Quantité max par commande: 5 articles

📞 ESCALADE:
- Renvoyer vers le support au +225 07 XX XX XX XX si problème complexe`}
                    rows={10}
                    style={{ ...inputStyle, resize: 'none', fontFamily: 'monospace' }}
                />
            </div>

            <div style={{
                padding: 16,
                background: conflictStatus === 'conflict' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.05)',
                border: `1px solid ${conflictStatus === 'conflict' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div>
                    <h4 style={{ color: conflictStatus === 'conflict' ? '#fca5a5' : '#6ee7b7', fontWeight: 600, marginBottom: 4 }}>
                        {conflictStatus === 'conflict' ? '⚠️ Conflit Détecté' : '🛡️ Vérification de cohérence'}
                    </h4>
                    <p style={{ fontSize: 13, color: '#94a3b8' }}>
                        {conflictStatus === 'conflict' ? conflictReason : "L'IA analyse si vos règles sont cohérentes avec les horaires, l'adresse et les autres paramètres du wizard."}
                    </p>
                </div>
                <button
                    onClick={checkConflict}
                    disabled={(formData.custom_rules || '').length < 3 || conflictStatus === 'checking'}
                    style={{
                        ...buttonSecondaryStyle,
                        background: 'rgba(30, 41, 59, 0.8)',
                        opacity: (formData.custom_rules || '').length < 3 ? 0.5 : 1,
                        cursor: (formData.custom_rules || '').length < 3 ? 'not-allowed' : 'pointer'
                    }}
                >
                    {conflictStatus === 'checking' ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                    Vérifier
                </button>
            </div>
        </div>
    )
}
