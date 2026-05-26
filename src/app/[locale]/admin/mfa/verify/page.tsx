'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MfaVerifyPage() {
    const router = useRouter()
    const [code, setCode] = useState('')
    const [factorId, setFactorId] = useState<string | null>(null)
    const [challengeId, setChallengeId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const supabase = createClient()
        async function init() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.replace('/login'); return }

            const { data: factors } = await supabase.auth.mfa.listFactors()
            const totp = factors?.totp?.[0]
            if (!totp) { router.replace('/admin'); return }

            const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: totp.id })
            if (challengeErr || !challenge) {
                setError('Impossible de créer le défi MFA. Réessayez.')
                setLoading(false)
                return
            }

            setFactorId(totp.id)
            setChallengeId(challenge.id)
            setLoading(false)
            setTimeout(() => inputRef.current?.focus(), 100)
        }
        init()
    }, [router])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!factorId || !challengeId || code.length !== 6) return
        setSubmitting(true)
        setError(null)

        const supabase = createClient()
        const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code })
        if (error) {
            setError('Code incorrect. Vérifiez votre application et réessayez.')
            setSubmitting(false)
            setCode('')
            return
        }
        router.replace('/admin')
    }

    async function handleLogout() {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.replace('/login')
    }

    if (loading) {
        return (
            <div style={pageStyle}>
                <p style={{ color: '#9ca3af' }}>Initialisation...</p>
            </div>
        )
    }

    return (
        <div style={pageStyle}>
            <div style={{ textAlign: 'center', maxWidth: 400, width: '100%' }}>
                <div style={{ fontSize: 56, marginBottom: 20 }}>🔐</div>
                <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
                    Vérification 2FA
                </h1>
                <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
                    Ouvrez Google Authenticator et entrez le code à 6 chiffres pour votre compte WazzapAI Admin.
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000 000"
                        style={{
                            background: '#1f2937',
                            border: `1px solid ${error ? '#ef4444' : '#374151'}`,
                            borderRadius: 10,
                            color: '#fff',
                            fontSize: 28,
                            fontWeight: 700,
                            letterSpacing: 12,
                            padding: '14px 20px',
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
                            background: code.length === 6 && !submitting ? '#25d366' : '#374151',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '13px',
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: code.length === 6 && !submitting ? 'pointer' : 'not-allowed',
                        }}
                    >
                        {submitting ? 'Vérification...' : 'Confirmer'}
                    </button>
                </form>

                <button
                    onClick={handleLogout}
                    style={{
                        marginTop: 24,
                        background: 'transparent',
                        color: '#6b7280',
                        border: 'none',
                        fontSize: 13,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                    }}
                >
                    Se déconnecter
                </button>
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
    padding: '0 24px',
}
