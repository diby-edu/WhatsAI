import { motion } from 'framer-motion'
import { Loader2, Gift, Check, Copy, Star } from 'lucide-react'

interface ReferralData {
    referral_code: string | null
    total_referrals: number
    confirmed: number
    pending: number
    credits_earned: number
}

interface ReferralTabProps {
    referralLoading: boolean
    referralData: ReferralData | null
    handleCopyReferralLink: () => void
    copiedRef: boolean
}

export function ReferralTab({ referralLoading, referralData, handleCopyReferralLink, copiedRef }: ReferralTabProps) {
    return (
        <motion.div
            key="referral"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
        >
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 24 }}>Parrainage</h2>

            {referralLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                    <Loader2 style={{ width: 24, height: 24, color: '#34d399' }} className="animate-spin" />
                </div>
            ) : referralData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Bonus info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -4 }}>
                        <Gift style={{ width: 20, height: 20, color: '#34d399' }} />
                        <h3 style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                            Programme de parrainage
                        </h3>
                    </div>
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: 12,
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12
                    }}>
                        <div>
                            <p style={{ color: '#6ee7b7', fontWeight: 500, fontSize: 14, margin: 0, marginBottom: 4 }}>+10 crédits pour vous et votre filleul</p>
                            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Les crédits sont offerts après le premier paiement validé de votre filleul.</p>
                        </div>
                    </div>

                    {/* Referral link */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -4 }}>
                        <h3 style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                            Votre lien de parrainage
                        </h3>
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{
                                flex: 1,
                                background: 'rgba(15, 23, 42, 0.8)',
                                border: '1px solid rgba(148, 163, 184, 0.15)',
                                borderRadius: 8,
                                padding: '10px 12px',
                                fontSize: 13,
                                color: '#cbd5e1',
                                fontFamily: 'monospace',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {`${typeof window !== 'undefined' ? window.location.origin : ''}/fr/register?ref=${referralData.referral_code}`}
                            </div>
                            <button
                                onClick={handleCopyReferralLink}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '10px 16px',
                                    background: copiedRef ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                                    border: `1px solid ${copiedRef ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
                                    borderRadius: 8,
                                    color: copiedRef ? '#34d399' : '#94a3b8',
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {copiedRef ? <Check style={{ width: 16, height: 16 }} /> : <Copy style={{ width: 16, height: 16 }} />}
                                {copiedRef ? 'Copié' : 'Copier'}
                            </button>
                        </div>
                        <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>
                            Code : <span style={{ color: '#cbd5e1', fontFamily: 'monospace', fontWeight: 600 }}>{referralData.referral_code}</span>
                        </p>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -4 }}>
                        <h3 style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                            Statistiques
                        </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                        <div style={{
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 12,
                            padding: 16,
                            textAlign: 'center'
                        }}>
                            <p style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 4 }}>{referralData.total_referrals}</p>
                            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Filleuls invités</p>
                        </div>
                        <div style={{
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 12,
                            padding: 16,
                            textAlign: 'center'
                        }}>
                            <p style={{ fontSize: 28, fontWeight: 700, color: '#34d399', marginBottom: 4 }}>{referralData.confirmed}</p>
                            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Confirmés</p>
                        </div>
                        <div style={{
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 12,
                            padding: 16,
                            textAlign: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                                <Star style={{ width: 16, height: 16, color: '#fbbf24' }} />
                                <p style={{ fontSize: 28, fontWeight: 700, color: '#fbbf24', margin: 0 }}>{referralData.credits_earned}</p>
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Crédits gagnés</p>
                        </div>
                    </div>

                    {referralData.pending > 0 && (
                        <p style={{ color: '#64748b', fontSize: 12, textAlign: 'center', margin: 0 }}>
                            {referralData.pending} parrainage{referralData.pending > 1 ? 's' : ''} en attente de premier paiement
                        </p>
                    )}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b', fontSize: 14 }}>
                    Impossible de charger les données de parrainage.
                </div>
            )}
        </motion.div>
    )
}
