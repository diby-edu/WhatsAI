'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MfaEnrollPage() {
    const router = useRouter()
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [secret, setSecret] = useState<string | null>(null)
    const [factorId, setFactorId] = useState<string | null>(null)
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [enrolled, setEnrolled] = useState(false)

    useEffect(() => {
        const supabase = createClient()
        async function init() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.replace('/login'); return }

            // Check if already enrolled
            const { data: factors } = await supabase.auth.mfa.listFactors()
            if (factors?.totp && factors.totp.length > 0) {
                setEnrolled(true)
                setLoading(false)
                return
            }

            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: 'WazzapAI Admin',
            })
            if (error || !data) {
                setError('Impossible de démarrer l\'enrollment MFA : ' + error?.message)
                setLoading(false)
                return
            }
            setQrCode(data.totp.qr_code)
            setSecret(data.totp.secret)
            setFactorId(data.id)
            setLoading(false)
        }
        init()
    }, [router])

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault()
        if (!factorId || code.length !== 6) return
        setSubmitting(true)
        setError(null)

        const supabase = createClient()
        const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId })
        if (chalErr || !challenge) {
            setError('Erreur lors de la création du défi.')
            setSubmitting(false)
            return
        }

        const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
        if (error) {
            setError('Code incorrect. Vérifiez votre application et réessayez.')
            setSubmitting(false)
            setCode('')
            return
        }

        router.replace('/admin')
    }

    if (loading) {
        return <div style={pageStyle}><p style={{ color: '#9ca3af' }}>Chargement...</p></div>
    }

    if (enrolled) {
        return (
            <div style={pageStyle}>
                <div style={{ textAlign: 'center', maxWidth: 400 }}>
                    <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
                    <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
                        2FA déjà activé
                    </h1>
                    <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 28 }}>
                        L'authentification à deux facteurs est déjà configurée sur ce compte.
                    </p>
                    <button onClick={() => router.replace('/admin')} style={btnStyle}>
                        Retour au panel admin
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div style={pageStyle}>
            <div style={{ textAlign: 'center', maxWidth: 440, width: '100%' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🔑</div>
                <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
                    Activer l'authentification 2FA
                </h1>
                <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                    Scannez ce QR code avec <strong style={{ color: '#d1d5db' }}>Google Authenticator</strong> ou <strong style={{ color: '#d1d5db' }}>Authy</strong>.
                </p>

                {qrCode && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                        <img
                            src={`data:image/svg+xml;base64,${btoa(qrCode)}`}
                            alt="QR Code 2FA"
                            style={{ width: 180, height: 180, background: '#fff', padding: 8, borderRadius: 10 }}
                            onError={(e) => {
                                // Fallback: display as PNG
                                (e.target as HTMLImageElement).src = `data:image/png;base64,${qrCode}`
                            }}
                        />
                    </div>
                )}

                {secret && (
                    <div style={{
                        background: '#1f2937',
                        borderRadius: 8,
                        padding: '10px 16px',
                        marginBottom: 24,
                        fontSize: 13,
                    }}>
                        <p style={{ color: '#6b7280', marginBottom: 4, fontSize: 11 }}>Clé manuelle (si QR ne fonctionne pas)</p>
                        <code style={{ color: '#d1d5db', letterSpacing: 2, fontFamily: 'monospace' }}>{secret}</code>
                    </div>
                )}

                <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
                    Après avoir scanné, entrez le code à 6 chiffres :
                </p>

                <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        style={{
                            background: '#1f2937',
                            border: `1px solid ${error ? '#ef4444' : '#374151'}`,
                            borderRadius: 10,
                            color: '#fff',
                            fontSize: 26,
                            fontWeight: 700,
                            letterSpacing: 10,
                            padding: '12px 20px',
                            textAlign: 'center',
                            outline: 'none',
                            width: '100%',
                            boxSizing: 'border-box',
                        }}
                        autoComplete="one-time-code"
                    />

                    {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}

                    <button
                        type="submit"
                        disabled={submitting || code.length !== 6}
                        style={{
                            ...btnStyle,
                            background: code.length === 6 && !submitting ? '#25d366' : '#374151',
                            cursor: code.length === 6 && !submitting ? 'pointer' : 'not-allowed',
                        }}
                    >
                        {submitting ? 'Activation...' : 'Activer la 2FA'}
                    </button>
                </form>
            </div>
        </div>
    )
}

const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, sans-serif',
    padding: '24px',
}

const btnStyle: React.CSSProperties = {
    background: '#25d366',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '13px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
}
