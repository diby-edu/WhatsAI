'use client'

import { useEffect } from 'react'
import { RefreshCw, Home, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log error to Sentry or monitoring service
        console.error('Application error:', error)
    }, [error])

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
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 32
            }}>
                <AlertTriangle style={{ width: 48, height: 48, color: '#f59e0b' }} />
            </div>

            <h1 style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'white',
                marginBottom: 12
            }}>
                Une erreur est survenue
            </h1>

            <p style={{
                fontSize: 14,
                color: '#94a3b8',
                marginBottom: 8,
                maxWidth: 400
            }}>
                Nous nous excusons pour la gêne occasionnée. Notre équipe a été notifiée.
            </p>

            {error.digest && (
                <p style={{
                    fontSize: 12,
                    color: '#64748b',
                    marginBottom: 32,
                    fontFamily: 'monospace'
                }}>
                    Code erreur: {error.digest}
                </p>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button
                    onClick={reset}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 12,
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 600
                    }}
                >
                    <RefreshCw style={{ width: 18, height: 18 }} />
                    Réessayer
                </button>

                <Link
                    href="/dashboard"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 24px',
                        background: 'rgba(148, 163, 184, 0.1)',
                        color: '#94a3b8',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: 12,
                        textDecoration: 'none',
                        fontSize: 14,
                        fontWeight: 500
                    }}
                >
                    <Home style={{ width: 18, height: 18 }} />
                    Accueil
                </Link>
            </div>
        </div>
    )
}
