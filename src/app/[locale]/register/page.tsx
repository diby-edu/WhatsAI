'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { MessageCircle, Mail, Lock, User, Loader2, Eye, EyeOff, Check, Sparkles, ArrowRight, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

function RegisterForm() {
    const t = useTranslations('Auth.register')
    const tAuth = useTranslations('Auth.login') // For some shared keys if needed or just use consistent keys
    const router = useRouter()
    const searchParams = useSearchParams()
    const selectedPlan = searchParams.get('plan') || 'starter'

    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const passwordRequirements = [
        { label: '8 caractères', met: password.length >= 8 },
        { label: 'Majuscule', met: /[A-Z]/.test(password) },
        { label: 'Minuscule', met: /[a-z]/.test(password) },
        { label: 'Chiffre', met: /[0-9]/.test(password) },
    ]

    const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (!passwordRequirements.every(r => r.met)) {
            setError('Le mot de passe ne respecte pas les exigences de sécurité.') // Should ideally be translated too
            setLoading(false)
            return
        }

        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas.') // Should be translated
            setLoading(false)
            return
        }

        try {
            const supabase = createClient()
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        selected_plan: selectedPlan,
                    },
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            })

            if (error) {
                setError(error.message)
            } else {
                setSuccess(true)
            }
        } catch (err) {
            console.error('Registration error:', err)
            setError(`Une erreur est survenue: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleSignup = async () => {
        const supabase = createClient()
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        })
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
                        Vérifiez votre email ! 📧
                    </h1>
                    <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 8 }}>
                        Nous avons envoyé un lien de confirmation à
                    </p>
                    <p style={{ fontSize: 16, color: '#34d399', fontWeight: 600, marginBottom: 24 }}>
                        {email}
                    </p>

                    <Link
                        href="/login"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            padding: '16px 32px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            borderRadius: 14,
                            color: 'white',
                            fontWeight: 600,
                            textDecoration: 'none',
                            marginBottom: 16,
                            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
                        }}
                    >
                        {t('loginLink')}
                        <ArrowRight style={{ width: 18, height: 18 }} />
                    </Link>

                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                        Cliquez sur le lien dans l'email pour activer votre compte
                    </p>

                    <Link
                        href="/"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            color: '#94a3b8',
                            fontSize: 14,
                            textDecoration: 'none'
                        }}
                    >
                        Retour à l'accueil
                    </Link>
                </motion.div>
            </div>
        )
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            backgroundColor: '#020617',
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
                width: 600,
                height: 600,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%)',
                top: -200,
                right: -200,
                filter: 'blur(40px)'
            }} />
            <div style={{
                position: 'absolute',
                width: 500,
                height: 500,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
                bottom: -200,
                left: -200,
                filter: 'blur(40px)'
            }} />

            {/* Left Side - Form */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                position: 'relative',
                zIndex: 10
            }}>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    style={{
                        width: '100%',
                        maxWidth: 480,
                        background: 'rgba(15, 23, 42, 0.8)',
                        backdropFilter: 'blur(40px)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 28,
                        padding: 40
                    }}
                >
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

                    <div style={{ marginBottom: 32 }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 12px',
                            borderRadius: 100,
                            background: 'rgba(168, 85, 247, 0.1)',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                            marginBottom: 16
                        }}>
                            <Sparkles style={{ width: 14, height: 14, color: '#c084fc' }} />
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#c084fc' }}>
                                Essai gratuit 14 jours
                            </span>
                        </div>
                        <h1 style={{ fontSize: 32, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                            {t('title')}
                        </h1>
                        <p style={{ fontSize: 16, color: '#94a3b8' }}>
                            {t('subtitle')}
                        </p>
                    </div>

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

                    {/* Register form */}
                    <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                {t('nameLabel')}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <User style={{
                                    position: 'absolute',
                                    left: 16,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 20,
                                    height: 20,
                                    color: '#64748b'
                                }} />
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="John Doe"
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

                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                {t('emailLabel')}
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

                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                {t('passwordLabel')}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{
                                    position: 'absolute',
                                    left: 16,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 20,
                                    height: 20,
                                    color: '#64748b'
                                }} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '16px 52px 16px 52px',
                                        fontSize: 16,
                                        color: 'white',
                                        backgroundColor: 'rgba(30, 41, 59, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        borderRadius: 14,
                                        outline: 'none'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: 16,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                >
                                    {showPassword ?
                                        <EyeOff style={{ width: 20, height: 20, color: '#64748b' }} /> :
                                        <Eye style={{ width: 20, height: 20, color: '#64748b' }} />
                                    }
                                </button>
                            </div>

                            {/* Password requirements */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                                {passwordRequirements.map((req) => (
                                    <div
                                        key={req.label}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '4px 10px',
                                            borderRadius: 100,
                                            background: req.met ? 'rgba(16, 185, 129, 0.1)' : 'rgba(51, 65, 85, 0.3)',
                                            border: `1px solid ${req.met ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.3)'}`
                                        }}
                                    >
                                        <div style={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: '50%',
                                            background: req.met ? '#10b981' : '#334155',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Check style={{ width: 10, height: 10, color: 'white' }} />
                                        </div>
                                        <span style={{
                                            fontSize: 12,
                                            fontWeight: 500,
                                            color: req.met ? '#34d399' : '#64748b'
                                        }}>
                                            {req.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Confirm Password Field */}
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Confirmer le mot de passe
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{
                                    position: 'absolute',
                                    left: 16,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 20,
                                    height: 20,
                                    color: '#64748b'
                                }} />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '16px 52px 16px 52px',
                                        fontSize: 16,
                                        color: 'white',
                                        backgroundColor: 'rgba(30, 41, 59, 0.5)',
                                        border: `1px solid ${confirmPassword.length > 0 ? (passwordsMatch ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)') : 'rgba(148, 163, 184, 0.1)'}`,
                                        borderRadius: 14,
                                        outline: 'none'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: 16,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                >
                                    {showConfirmPassword ?
                                        <EyeOff style={{ width: 20, height: 20, color: '#64748b' }} /> :
                                        <Eye style={{ width: 20, height: 20, color: '#64748b' }} />
                                    }
                                </button>
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
                                    {t('loading')}
                                </>
                            ) : (
                                <>
                                    {t('submit')}
                                    <ArrowRight style={{ width: 20, height: 20 }} />
                                </>
                            )}
                        </motion.button>
                    </form>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }}>
                        <div style={{ flex: 1, height: 1, background: 'rgba(148, 163, 184, 0.1)' }} />
                        <span style={{ fontSize: 13, color: '#64748b' }}>ou</span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(148, 163, 184, 0.1)' }} />
                    </div>

                    {/* Google Signup */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleGoogleSignup}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 12,
                            padding: '16px 24px',
                            fontSize: 15,
                            fontWeight: 500,
                            color: 'white',
                            backgroundColor: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 14,
                            cursor: 'pointer'
                        }}
                    >
                        <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continuer avec Google
                    </motion.button>

                    {/* Login link */}
                    <p style={{ textAlign: 'center', marginTop: 24, fontSize: 15, color: '#94a3b8' }}>
                        {t('hasAccount')}{' '}
                        <Link href="/login" style={{ color: '#34d399', fontWeight: 600, textDecoration: 'none' }}>
                            {t('loginLink')}
                        </Link>
                    </p>
                </motion.div>
            </div>

            {/* Right Side - Testimonials */}
            {/* Keeping testimonials hardcoded for now or use another approach if critical, but focusing on Form first */}
            <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                style={{
                    flex: 1,
                    display: 'none',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: 60,
                    position: 'relative',
                    zIndex: 10
                }}
                className="lg-flex"
            >
                <div style={{ maxWidth: 500 }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        borderRadius: 100,
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        marginBottom: 32
                    }}>
                        <Star style={{ width: 16, height: 16, fill: '#facc15', color: '#facc15' }} />
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#34d399' }}>
                            +5,000 entreprises nous font confiance
                        </span>
                    </div>

                    <h2 style={{ fontSize: 36, fontWeight: 700, color: 'white', marginBottom: 24, lineHeight: 1.2 }}>
                        Rejoignez les leaders qui automatisent leur{' '}
                        <span style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>WhatsApp</span>
                    </h2>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 40 }}>
                        {[
                            { value: '+300%', label: 'Conversions' },
                            { value: '24/7', label: 'Disponible' },
                            { value: '<10s', label: 'Réponse' },
                        ].map((stat) => (
                            <div key={stat.label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 32, fontWeight: 700, color: 'white' }}>{stat.value}</div>
                                <div style={{ fontSize: 14, color: '#64748b' }}>{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Testimonial */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.3)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 20,
                            padding: 24
                        }}
                    >
                        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Star key={i} style={{ width: 18, height: 18, fill: '#facc15', color: '#facc15' }} />
                            ))}
                        </div>
                        <p style={{ fontSize: 16, color: '#e2e8f0', lineHeight: 1.6, marginBottom: 20, fontStyle: 'italic' }}>
                            "WhatsAI a transformé notre service client. Nous répondons maintenant 24/7 et nos conversions ont augmenté de 280%."
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 16,
                                fontWeight: 700,
                                color: 'white'
                            }}>
                                AK
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, color: 'white' }}>Aminata Koné</div>
                                <div style={{ fontSize: 13, color: '#64748b' }}>CEO, TechShop CI</div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @media (min-width: 1024px) {
                    .lg-flex { display: flex !important; }
                }
            `}</style>
        </div>
    )
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#020617'
            }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        }>
            <RegisterForm />
        </Suspense>
    )
}
