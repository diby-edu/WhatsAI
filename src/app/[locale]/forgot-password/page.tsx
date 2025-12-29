'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { MessageCircle, Mail, Loader2, ArrowLeft, Check, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const supabase = createClient()
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            })

            if (error) {
                setError(error.message)
            } else {
                setSuccess(true)
            }
        } catch (err) {
            setError('Une erreur est survenue. Veuillez réessayer.')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#020617',
                padding: 24
            }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        textAlign: 'center',
                        maxWidth: 440,
                        background: 'rgba(15, 23, 42, 0.8)',
                        backdropFilter: 'blur(40px)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 28,
                        padding: 48
                    }}
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring' }}
                        style={{
                            width: 80,
                            height: 80,
                            margin: '0 auto 24px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Check style={{ width: 40, height: 40, color: '#34d399' }} />
                    </motion.div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 12 }}>
                        Email envoyé ! 📧
                    </h1>
                    <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 8 }}>
                        Si un compte existe avec l'adresse
                    </p>
                    <p style={{ fontSize: 16, color: '#34d399', fontWeight: 600, marginBottom: 32 }}>
                        {email}
                    </p>
                    <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
                        vous recevrez un lien pour réinitialiser votre mot de passe.
                    </p>
                    <Link
                        href="/login"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            color: '#34d399',
                            fontWeight: 600,
                            textDecoration: 'none'
                        }}
                    >
                        Retour à la connexion
                        <ArrowRight style={{ width: 18, height: 18 }} />
                    </Link>
                </motion.div>
            </div>
        )
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#020617',
            padding: 24,
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Effects */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.03) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
                opacity: 0.5
            }} />
            <div style={{
                position: 'absolute',
                width: 500,
                height: 500,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
                top: -200,
                left: '50%',
                transform: 'translateX(-50%)',
                filter: 'blur(40px)'
            }} />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{
                    width: '100%',
                    maxWidth: 440,
                    background: 'rgba(15, 23, 42, 0.8)',
                    backdropFilter: 'blur(40px)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 28,
                    padding: 40,
                    position: 'relative',
                    zIndex: 10
                }}
            >
                {/* Back link */}
                <Link
                    href="/login"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        color: '#94a3b8',
                        textDecoration: 'none',
                        marginBottom: 24,
                        fontSize: 14
                    }}
                >
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    Retour à la connexion
                </Link>

                {/* Logo */}
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', marginBottom: 32 }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
                    }}>
                        <MessageCircle style={{ width: 24, height: 24, color: 'white' }} />
                    </div>
                    <div>
                        <span style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>WhatsAI</span>
                        <div style={{ fontSize: 11, color: '#34d399', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Automation</div>
                    </div>
                </Link>

                <h1 style={{ fontSize: 32, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                    Mot de passe oublié ? 🔐
                </h1>
                <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 32 }}>
                    Entrez votre email pour recevoir un lien de réinitialisation.
                </p>

                {/* Error message */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            marginBottom: 24,
                            padding: 16,
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 14,
                            color: '#f87171',
                            fontSize: 14
                        }}
                    >
                        {error}
                    </motion.div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                            Email
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail style={{
                                position: 'absolute',
                                left: 16,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 20,
                                height: 20,
                                color: '#64748b'
                            }} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="votre@email.com"
                                required
                                style={{
                                    width: '100%',
                                    padding: '16px 16px 16px 52px',
                                    fontSize: 16,
                                    color: 'white',
                                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 14,
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            padding: '18px 24px',
                            fontSize: 16,
                            fontWeight: 600,
                            color: 'white',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                            border: 'none',
                            borderRadius: 14,
                            cursor: loading ? 'wait' : 'pointer',
                            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.35)',
                            marginTop: 8
                        }}
                    >
                        {loading ? (
                            <>
                                <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} />
                                Envoi en cours...
                            </>
                        ) : (
                            <>
                                Envoyer le lien
                                <ArrowRight style={{ width: 20, height: 20 }} />
                            </>
                        )}
                    </motion.button>
                </form>
            </motion.div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
