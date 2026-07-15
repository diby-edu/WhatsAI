'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
    const t = useTranslations('NotFound')
    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center'
        }}>
            <div style={{
                width: 120,
                height: 120,
                borderRadius: 24,
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 32
            }}>
                <span style={{ fontSize: 48 }}>🔍</span>
            </div>

            <h1 style={{
                fontSize: 72,
                fontWeight: 800,
                color: 'white',
                marginBottom: 8,
                letterSpacing: -2
            }}>
                404
            </h1>

            <h2 style={{
                fontSize: 24,
                fontWeight: 600,
                color: 'white',
                marginBottom: 12
            }}>
                {t('title')}
            </h2>

            <p style={{
                fontSize: 14,
                color: '#94a3b8',
                marginBottom: 32,
                maxWidth: 400
            }}>
                {t('description')}
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
                <Link
                    href="/dashboard"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white',
                        borderRadius: 12,
                        textDecoration: 'none',
                        fontSize: 14,
                        fontWeight: 600
                    }}
                >
                    <Home style={{ width: 18, height: 18 }} />
                    {t('dashboardButton')}
                </Link>

                <button
                    onClick={() => window.history.back()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 24px',
                        background: 'rgba(148, 163, 184, 0.1)',
                        color: '#94a3b8',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: 12,
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 500
                    }}
                >
                    <ArrowLeft style={{ width: 18, height: 18 }} />
                    {t('backButton')}
                </button>
            </div>
        </div>
    )
}
