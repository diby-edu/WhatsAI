'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfirmEmailPage() {
    const router = useRouter()
    const [email, setEmail] = useState<string | null>(null)
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) { router.replace('/login'); return }
            if (user.email_confirmed_at) { router.replace('/dashboard'); return }
            setEmail(user.email ?? null)
        })
    }, [router])

    async function handleResend() {
        if (!email) return
        setSending(true)
        setError(null)
        const supabase = createClient()
        const { error } = await supabase.auth.resend({ type: 'signup', email })
        setSending(false)
        if (error) { setError(error.message); return }
        setSent(true)
    }

    async function handleLogout() {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.replace('/login')
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, sans-serif',
            padding: '0 24px',
        }}>
            <div style={{ textAlign: 'center', maxWidth: 480 }}>
                <div style={{ fontSize: 64, marginBottom: 24 }}>📧</div>
                <h1 style={{ color: '#ffffff', fontSize: 26, fontWeight: 700, marginBottom: 12 }}>
                    Confirmez votre email
                </h1>
                {email && (
                    <p style={{ color: '#9ca3af', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
                        Un lien de confirmation a été envoyé à <strong style={{ color: '#d1d5db' }}>{email}</strong>.
                        <br />Cliquez sur ce lien pour activer votre compte.
                    </p>
                )}

                {sent && (
                    <p style={{ color: '#22c55e', fontSize: 14, marginBottom: 20 }}>
                        Email renvoyé avec succès. Vérifiez votre boîte mail.
                    </p>
                )}
                {error && (
                    <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 20 }}>{error}</p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                    <button
                        onClick={handleResend}
                        disabled={sending || sent}
                        style={{
                            background: sending || sent ? '#374151' : '#25d366',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '12px 28px',
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: sending || sent ? 'not-allowed' : 'pointer',
                            width: 220,
                        }}
                    >
                        {sending ? 'Envoi...' : sent ? 'Email envoyé' : 'Renvoyer le lien'}
                    </button>
                    <button
                        onClick={handleLogout}
                        style={{
                            background: 'transparent',
                            color: '#6b7280',
                            border: 'none',
                            fontSize: 14,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                        }}
                    >
                        Se déconnecter
                    </button>
                </div>
            </div>
        </div>
    )
}
