import type { useTranslations } from 'next-intl'
import type { useToast } from '@/components/ui/Toast'
import { motion } from 'framer-motion'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface DangerTabProps {
    t: ReturnType<typeof useTranslations>
    toast: ReturnType<typeof useToast>
}

export function DangerTab({ t, toast }: DangerTabProps) {
    return (
        <motion.div
            key="danger"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
        >
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#f87171', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle style={{ width: 24, height: 24 }} />
                {t('Danger.title')}
            </h2>
            <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 12,
                padding: 24
            }}>
                <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 8 }}>{t('Danger.deleteAccount.title')}</h3>
                <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
                    {t('Danger.deleteAccount.description')}
                </p>
                <button
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 20px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: 10,
                        color: '#f87171',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onClick={async () => {
                        const ok = await toast.confirm({ title: t('Danger.deleteAccount.confirm'), confirmLabel: 'Supprimer', danger: true })
                        if (ok) toast.info(t('Danger.deleteAccount.support'))
                    }}
                >
                    <Trash2 style={{ width: 18, height: 18 }} />
                    {t('Danger.deleteAccount.button')}
                </button>
            </div>
        </motion.div>
    )
}
