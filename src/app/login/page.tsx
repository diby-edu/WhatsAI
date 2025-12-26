'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { MessageCircle, Mail, Lock, Loader2, Eye, EyeOff, Sparkles, ArrowRight, Zap, Shield, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)


    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const supabase = createClient()
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                setError(error.message)
            } else {
                // Check if user is admin (via Metadata OR Profile)
                const { data: { user } } = await supabase.auth.getUser()

                if (user) {
                    let isAdmin = false

                    // 1. Check Metadata (Faster, no RLS issues)
                    if (user.user_metadata?.role === 'admin') {
                        isAdmin = true
                    } else {
                        // 2. Check Profile (Fallback)
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('role')
                            .eq('id', user.id)
                            .single()

                        if (profile?.role === 'admin') {
                            isAdmin = true
                        }
                    }

                    if (isAdmin) {
                        router.push('/admin')
                    } else {
                        router.push('/dashboard')
                    }
                    router.refresh()
                }
            }
        } catch (err) {
            setError('Une erreur est survenue. Veuillez réessayer.')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        const supabase = createClient()
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        })
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
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
                top: -200,
                left: -200,
                filter: 'blur(40px)'
            }} />
            <div style={{
                position: 'absolute',
                width: 500,
                height: 500,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%)',
                bottom: -200,
                right: -200,
                filter: 'blur(40px)'
            }} />

            {/* Left Side - Branding */}
            <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                style={{
                    flex: 1,
                    display: 'none',
                    padding: 60,
                    position: 'relative',
                    zIndex: 10
                }}
                className="lg-flex"
            >
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: 60
                }}>
                    {/* Features */}
                    <div style={{ marginBottom: 48 }}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 16px',
                                borderRadius: 100,
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                marginBottom: 24
                            }}
                        >
                            <Sparkles style={{ width: 16, height: 16, color: '#34d399' }} />
                            <span style={{ fontSize: 14, fontWeight: 500, color: '#34d399' }}>
                                Propulsé par GPT-4o
                            </span>
                        </motion.div>

                        <h1 style={{
                            fontSize: 48,
                            fontWeight: 700,
                            lineHeight: 1.1,
                            marginBottom: 20
                        }}>
                            <span style={{ color: 'white' }}>Automatisez</span>
                            <br />
                            <span style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>WhatsApp</span>
                            <span style={{ color: 'white' }}> avec l'</span>
                            <span style={{
                                background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>IA</span>
                        </h1>
                        <p style={{ fontSize: 18, color: '#94a3b8', lineHeight: 1.6, maxWidth: 400 }}>
                            Répondez à vos clients 24/7, qualifiez vos leads et boostez vos ventes automatiquement.
                        </p>
                    </div>

                    {/* Feature Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {[
                            { icon: Zap, title: 'Réponses instantanées', desc: 'IA répond en moins de 10 secondes' },
                            { icon: Shield, title: 'Sécurisé', desc: 'Vos données sont cryptées' },
                            { icon: Users, title: '+5000 entreprises', desc: 'Font confiance à WhatsAI' },
                        ].map((feature, i) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + i * 0.1 }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 16,
                                    padding: 16,
                                    borderRadius: 16,
                                    background: 'rgba(30, 41, 59, 0.3)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)'
                                }}
                            >
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <feature.icon style={{ width: 24, height: 24, color: '#34d399' }} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'white', marginBottom: 2 }}>{feature.title}</div>
                                    <div style={{ fontSize: 14, color: '#64748b' }}>{feature.desc}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Right Side - Login Form */}
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
                        maxWidth: 440,
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

                    <h1 style={{ fontSize: 32, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                        Bon retour ! 👋
                    </h1>
                    <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 32 }}>
                        Connectez-vous pour accéder à votre dashboard
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

                    {/* Login form */}
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                                        outline: 'none',
                                        transition: 'all 0.2s ease'
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <label style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>
                                    Mot de passe
                                </label>
                                <Link href="/forgot-password" style={{ fontSize: 13, color: '#34d399', textDecoration: 'none' }}>
                                    Mot de passe oublié ?
                                </Link>
                            </div>
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
                                        outline: 'none',
                                        transition: 'all 0.2s ease'
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
                                    Connexion...
                                </>
                            ) : (
                                <>
                                    Se connecter
                                    <ArrowRight style={{ width: 20, height: 20 }} />
                                </>
                            )}
                        </motion.button>
                    </form>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '28px 0' }}>
                        <div style={{ flex: 1, height: 1, background: 'rgba(148, 163, 184, 0.1)' }} />
                        <span style={{ fontSize: 13, color: '#64748b' }}>ou continuer avec</span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(148, 163, 184, 0.1)' }} />
                    </div>

                    {/* Google Login */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleGoogleLogin}
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
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
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

                    {/* Sign up link */}
                    <p style={{ textAlign: 'center', marginTop: 28, fontSize: 15, color: '#94a3b8' }}>
                        Pas encore de compte ?{' '}
                        <Link href="/register" style={{ color: '#34d399', fontWeight: 600, textDecoration: 'none' }}>
                            Créer un compte
                        </Link>
                    </p>
                </motion.div>
            </div>

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
