'use client'

import { useEffect } from 'react'
import { X, Zap, Bot, Check, Crown } from 'lucide-react'
import Link from 'next/link'
import { useUpgradeModal, type UpgradeReason } from '@/contexts/UpgradeModalContext'
import { FALLBACK_PLANS } from '@/hooks/usePlans'
import ManualPaymentFallbackCard from '@/components/payments/manual-payment-fallback-card'

const PAID_PLANS = FALLBACK_PLANS.filter(p => p.price_fcfa > 0)

const REASON_TITLE: Record<UpgradeReason, string> = {
    agent_limit: "Limite d'agents atteinte",
    low_credits: 'Vos crédits sont presque épuisés',
    session: 'Passez à la vitesse supérieure',
    feature_locked: 'Fonctionnalité réservée aux plans payants',
}

const REASON_SUBTITLE: Record<UpgradeReason, string> = {
    agent_limit: 'Votre plan actuel ne permet pas de créer plus d\'agents. Choisissez un plan supérieur pour débloquer.',
    low_credits: 'Vous n\'avez presque plus de crédits. Rechargez ou passez à un plan avec plus de crédits inclus.',
    session: 'Débloquez plus d\'agents, plus de crédits et des fonctionnalités avancées pour booster votre activité.',
    feature_locked: 'Cette fonctionnalité est disponible à partir du plan Starter.',
}

function PlanCard({ plan, featured, onClose }: { plan: typeof FALLBACK_PLANS[0]; featured: boolean; onClose: () => void }) {
    return (
        <div style={{
            background: featured ? 'rgba(16, 185, 129, 0.08)' : 'rgba(15, 23, 42, 0.6)',
            border: featured ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(148, 163, 184, 0.15)',
            borderRadius: 14,
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            position: 'relative',
            flex: '1 1 160px',
            minWidth: 0,
        }}>
            {featured && (
                <div style={{
                    position: 'absolute',
                    top: -10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 10px',
                    borderRadius: 20,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.05em',
                }}>
                    POPULAIRE
                </div>
            )}

            <div>
                <div style={{ color: featured ? '#10b981' : '#94a3b8', fontWeight: 700, fontSize: 15 }}>
                    {plan.name}
                </div>
                <div style={{ color: 'white', fontWeight: 800, fontSize: 20, marginTop: 4 }}>
                    {plan.price_fcfa.toLocaleString()} <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>FCFA/mois</span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                    <Zap style={{ width: 12, height: 12, color: '#f97316', flexShrink: 0 }} />
                    {plan.credits.toLocaleString()} crédits
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                    <Bot style={{ width: 12, height: 12, color: '#3b82f6', flexShrink: 0 }} />
                    {plan.max_agents === -1 ? 'Agents illimités' : `${plan.max_agents} agent${plan.max_agents > 1 ? 's' : ''}`}
                </div>
            </div>

            <Link
                href="/dashboard/billing#plans"
                onClick={onClose}
                style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: featured
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : 'rgba(51, 65, 85, 0.8)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: 13,
                    textDecoration: 'none',
                    border: featured ? 'none' : '1px solid rgba(148, 163, 184, 0.2)',
                    marginTop: 'auto',
                }}
            >
                Choisir
            </Link>
        </div>
    )
}

export default function UpgradeModal() {
    const { isOpen, reason, closeUpgradeModal } = useUpgradeModal()

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [isOpen])

    if (!isOpen || !reason) return null

    return (
        <div
            onClick={closeUpgradeModal}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(4px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'rgba(15, 23, 42, 0.98)',
                    border: '1px solid rgba(148, 163, 184, 0.15)',
                    borderRadius: 20,
                    width: '100%',
                    maxWidth: 720,
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    padding: '28px 24px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 24,
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.2))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <Crown style={{ width: 22, height: 22, color: '#10b981' }} />
                        </div>
                        <div>
                            <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>
                                {REASON_TITLE[reason]}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
                                {REASON_SUBTITLE[reason]}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={closeUpgradeModal}
                        style={{
                            background: 'rgba(51, 65, 85, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: 8,
                            padding: 8,
                            cursor: 'pointer',
                            color: '#94a3b8',
                            display: 'flex',
                            flexShrink: 0,
                        }}
                    >
                        <X style={{ width: 16, height: 16 }} />
                    </button>
                </div>

                {/* Plans */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {PAID_PLANS.map(plan => (
                        <PlanCard key={plan.id} plan={plan} featured={plan.is_popular} onClose={closeUpgradeModal} />
                    ))}
                </div>

                {/* Payment alternatives */}
                <div>
                    <div style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                        Moyens de paiement alternatifs
                    </div>
                    <ManualPaymentFallbackCard compact />
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12 }}>
                        <Check style={{ width: 14, height: 14, color: '#10b981' }} />
                        Paiement sécurisé · Activation immédiate
                    </div>
                    <Link
                        href="/dashboard/billing#plans"
                        onClick={closeUpgradeModal}
                        style={{
                            color: '#10b981',
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: 'none',
                        }}
                    >
                        Voir tous les plans →
                    </Link>
                </div>
            </div>
        </div>
    )
}
