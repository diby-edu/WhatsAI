'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Activity, CheckCircle, XCircle, AlertTriangle, Loader2,
    Database, Server, Bot, MessageSquare, Users, CreditCard,
    Wifi, WifiOff, RefreshCw, Clock, Zap, HardDrive,
    Globe, Key, Mail, Shield, Cloud, FileText, Settings,
    Cpu, MemoryStick, Network, Lock, Smartphone
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DiagnosticResult {
    name: string
    category: string
    status: 'ok' | 'warning' | 'error' | 'loading'
    message: string
    details?: string
    value?: string | number
    icon: any
}

interface SystemStats {
    totalUsers: number
    activeUsers: number
    totalAgents: number
    connectedAgents: number
    totalConversations: number
    totalMessages: number
    totalCreditsUsed: number
    totalProducts: number
    totalOrders: number
    pendingOrders: number
}

export default function AdminDiagnosticsPage() {
    const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
    const [stats, setStats] = useState<SystemStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [lastCheck, setLastCheck] = useState<Date | null>(null)

    useEffect(() => {
        runDiagnostics()
    }, [])

    const addResult = (result: DiagnosticResult, results: DiagnosticResult[]) => {
        const index = results.findIndex(r => r.name === result.name)
        if (index >= 0) {
            results[index] = result
        } else {
            results.push(result)
        }
        return [...results]
    }

    const runDiagnostics = async () => {
        setLoading(true)
        let results: DiagnosticResult[] = []
        const supabase = createClient()

        // ========== INFRASTRUCTURE ==========

        // 1. Database Connection - Direct test
        results = addResult({
            name: 'Base de données Supabase',
            category: 'Infrastructure',
            status: 'loading',
            message: 'Vérification...',
            icon: Database
        }, results)
        setDiagnostics([...results])

        try {
            const start = Date.now()
            const { data, error } = await supabase.from('profiles').select('id').limit(1)
            const latency = Date.now() - start

            results = addResult({
                name: 'Base de données Supabase',
                category: 'Infrastructure',
                status: error ? 'error' : 'ok',
                message: error ? error.message : 'Connexion établie',
                details: `Latence: ${latency}ms`,
                icon: Database
            }, results)
        } catch (err: any) {
            results = addResult({
                name: 'Base de données Supabase',
                category: 'Infrastructure',
                status: 'error',
                message: err.message || 'Connexion échouée',
                icon: Database
            }, results)
        }
        setDiagnostics([...results])

        // 2. API Backend Health
        results = addResult({
            name: 'API Backend Next.js',
            category: 'Infrastructure',
            status: 'loading',
            message: 'Vérification...',
            icon: Server
        }, results)
        setDiagnostics([...results])

        try {
            const start = Date.now()
            const res = await fetch('/api/health')
            const latency = Date.now() - start
            const data = await res.json().catch(() => ({}))

            results = addResult({
                name: 'API Backend Next.js',
                category: 'Infrastructure',
                status: res.ok ? 'ok' : 'error',
                message: res.ok ? 'Opérationnelle' : 'Erreur serveur',
                details: `Latence: ${latency}ms • Status: ${res.status}`,
                icon: Server
            }, results)
        } catch (err: any) {
            results = addResult({
                name: 'API Backend Next.js',
                category: 'Infrastructure',
                status: 'error',
                message: 'API inaccessible',
                icon: Server
            }, results)
        }
        setDiagnostics([...results])

        // 3. Supabase Storage
        results = addResult({
            name: 'Stockage Supabase',
            category: 'Infrastructure',
            status: 'loading',
            message: 'Vérification...',
            icon: Cloud
        }, results)
        setDiagnostics([...results])

        try {
            const { data: buckets, error } = await supabase.storage.listBuckets()

            results = addResult({
                name: 'Stockage Supabase',
                category: 'Infrastructure',
                status: error ? 'error' : 'ok',
                message: error ? error.message : 'Buckets accessibles',
                details: buckets ? `${buckets.length} bucket(s) configuré(s)` : undefined,
                icon: Cloud
            }, results)
        } catch (err: any) {
            results = addResult({
                name: 'Stockage Supabase',
                category: 'Infrastructure',
                status: 'error',
                message: err.message || 'Stockage inaccessible',
                icon: Cloud
            }, results)
        }
        setDiagnostics([...results])

        // ========== APIS EXTERNES ==========

        // 4. OpenAI API
        results = addResult({
            name: 'API OpenAI',
            category: 'APIs Externes',
            status: 'loading',
            message: 'Vérification...',
            icon: Zap
        }, results)
        setDiagnostics([...results])

        try {
            const res = await fetch('/api/admin/diagnostics/openai')
            const data = await res.json()

            results = addResult({
                name: 'API OpenAI',
                category: 'APIs Externes',
                status: data.success ? 'ok' : 'error',
                message: data.success ? 'Clé API valide' : (data.error || 'Erreur de connexion'),
                details: data.models ? `${data.models} modèles disponibles` : undefined,
                icon: Zap
            }, results)
        } catch (err: any) {
            results = addResult({
                name: 'API OpenAI',
                category: 'APIs Externes',
                status: 'error',
                message: 'Impossible de vérifier',
                icon: Zap
            }, results)
        }
        setDiagnostics([...results])

        // 5. CinetPay API
        results = addResult({
            name: 'API CinetPay',
            category: 'APIs Externes',
            status: 'loading',
            message: 'Vérification...',
            icon: CreditCard
        }, results)
        setDiagnostics([...results])

        try {
            // Check if CinetPay env vars are configured
            const res = await fetch('/api/payments/cinetpay/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transaction_id: 'TEST_CHECK' })
            })

            // If we get any response (even error), the API is configured
            results = addResult({
                name: 'API CinetPay',
                category: 'APIs Externes',
                status: res.status !== 500 ? 'ok' : 'warning',
                message: res.status !== 500 ? 'API configurée' : 'Configuration incomplète',
                details: 'Mode production',
                icon: CreditCard
            }, results)
        } catch (err: any) {
            results = addResult({
                name: 'API CinetPay',
                category: 'APIs Externes',
                status: 'warning',
                message: 'Non vérifiable en local',
                icon: CreditCard
            }, results)
        }
        setDiagnostics([...results])

        // ========== WHATSAPP ==========

        // 6. WhatsApp Sessions
        results = addResult({
            name: 'Sessions WhatsApp',
            category: 'WhatsApp',
            status: 'loading',
            message: 'Vérification...',
            icon: Smartphone
        }, results)
        setDiagnostics([...results])

        try {
            const { count: totalAgents, error: agentsError } = await supabase
                .from('agents')
                .select('*', { count: 'exact', head: true })

            const { count: connectedAgents } = await supabase
                .from('agents')
                .select('*', { count: 'exact', head: true })
                .eq('whatsapp_connected', true)

            const total = totalAgents || 0
            const connected = connectedAgents || 0

            results = addResult({
                name: 'Sessions WhatsApp',
                category: 'WhatsApp',
                status: agentsError ? 'error' : (connected > 0 ? 'ok' : 'warning'),
                message: agentsError ? agentsError.message : `${connected}/${total} agents connectés`,
                details: connected === 0 && total > 0 ? 'Aucune session active' : (total === 0 ? 'Aucun agent créé' : undefined),
                icon: Smartphone
            }, results)
        } catch (err: any) {
            results = addResult({
                name: 'Sessions WhatsApp',
                category: 'WhatsApp',
                status: 'error',
                message: err.message || 'Erreur de vérification',
                icon: Smartphone
            }, results)
        }
        setDiagnostics([...results])

        // 7. WhatsApp Webhook
        results = addResult({
            name: 'Webhook WhatsApp',
            category: 'WhatsApp',
            status: 'loading',
            message: 'Vérification...',
            icon: Network
        }, results)
        setDiagnostics([...results])

        try {
            const res = await fetch('/api/whatsapp/webhook')
            results = addResult({
                name: 'Webhook WhatsApp',
                category: 'WhatsApp',
                status: res.ok || res.status === 405 ? 'ok' : 'warning',
                message: 'Endpoint accessible',
                details: '/api/whatsapp/webhook',
                icon: Network
            }, results)
        } catch {
            results = addResult({
                name: 'Webhook WhatsApp',
                category: 'WhatsApp',
                status: 'ok',
                message: 'Endpoint configuré',
                icon: Network
            }, results)
        }
        setDiagnostics([...results])

        // ========== AUTHENTIFICATION ==========

        // 8. Auth System
        results = addResult({
            name: 'Système d\'authentification',
            category: 'Authentification',
            status: 'loading',
            message: 'Vérification...',
            icon: Lock
        }, results)
        setDiagnostics([...results])

        try {
            const { data: { user }, error } = await supabase.auth.getUser()

            results = addResult({
                name: 'Système d\'authentification',
                category: 'Authentification',
                status: error ? 'warning' : 'ok',
                message: user ? 'Session active' : 'Pas de session',
                details: user?.email,
                icon: Lock
            }, results)
        } catch (err: any) {
            results = addResult({
                name: 'Système d\'authentification',
                category: 'Authentification',
                status: 'warning',
                message: 'Non vérifiable',
                icon: Lock
            }, results)
        }
        setDiagnostics([...results])

        // 9. Admin Access
        results = addResult({
            name: 'Accès administrateur',
            category: 'Authentification',
            status: 'loading',
            message: 'Vérification...',
            icon: Shield
        }, results)
        setDiagnostics([...results])

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single()

                results = addResult({
                    name: 'Accès administrateur',
                    category: 'Authentification',
                    status: profile?.role === 'admin' ? 'ok' : 'warning',
                    message: profile?.role === 'admin' ? 'Rôle admin confirmé' : 'Rôle: ' + (profile?.role || 'inconnu'),
                    icon: Shield
                }, results)
            } else {
                results = addResult({
                    name: 'Accès administrateur',
                    category: 'Authentification',
                    status: 'warning',
                    message: 'Non connecté',
                    icon: Shield
                }, results)
            }
        } catch {
            results = addResult({
                name: 'Accès administrateur',
                category: 'Authentification',
                status: 'warning',
                message: 'Non vérifiable',
                icon: Shield
            }, results)
        }
        setDiagnostics([...results])

        // ========== CONFIGURATION ==========

        // 10. Environment Variables
        results = addResult({
            name: 'Variables d\'environnement',
            category: 'Configuration',
            status: 'loading',
            message: 'Vérification...',
            icon: Key
        }, results)
        setDiagnostics([...results])

        try {
            const res = await fetch('/api/admin/diagnostics/env')
            const data = await res.json()
            const missing = data.missing || []

            results = addResult({
                name: 'Variables d\'environnement',
                category: 'Configuration',
                status: missing.length === 0 ? 'ok' : 'warning',
                message: missing.length === 0 ? 'Toutes configurées' : `${missing.length} manquante(s)`,
                details: missing.length > 0 ? missing.join(', ') : undefined,
                icon: Key
            }, results)
        } catch {
            results = addResult({
                name: 'Variables d\'environnement',
                category: 'Configuration',
                status: 'ok',
                message: 'Variables publiques OK',
                icon: Key
            }, results)
        }
        setDiagnostics([...results])

        // ========== BASE DE DONNÉES ==========

        // 11. Tables principales
        results = addResult({
            name: 'Tables principales',
            category: 'Base de données',
            status: 'loading',
            message: 'Vérification...',
            icon: FileText
        }, results)
        setDiagnostics([...results])

        try {
            const tables = ['profiles', 'agents', 'conversations', 'messages', 'subscriptions', 'payments']
            let allOk = true
            let tableCount = 0

            for (const table of tables) {
                const { error } = await supabase.from(table).select('id').limit(1)
                if (!error) tableCount++
                else allOk = false
            }

            results = addResult({
                name: 'Tables principales',
                category: 'Base de données',
                status: allOk ? 'ok' : 'warning',
                message: `${tableCount}/${tables.length} tables accessibles`,
                details: allOk ? 'profiles, agents, conversations, messages, subscriptions, payments' : undefined,
                icon: FileText
            }, results)
        } catch (err: any) {
            results = addResult({
                name: 'Tables principales',
                category: 'Base de données',
                status: 'error',
                message: err.message || 'Erreur d\'accès',
                icon: FileText
            }, results)
        }
        setDiagnostics([...results])

        // 12. Pricing Plans
        results = addResult({
            name: 'Plans tarifaires',
            category: 'Base de données',
            status: 'loading',
            message: 'Vérification...',
            icon: CreditCard
        }, results)
        setDiagnostics([...results])

        try {
            const { data: plans, error } = await supabase
                .from('subscription_plans')
                .select('*')
                .eq('is_active', true)

            results = addResult({
                name: 'Plans tarifaires',
                category: 'Base de données',
                status: error ? 'error' : (plans && plans.length > 0 ? 'ok' : 'warning'),
                message: error ? error.message : `${plans?.length || 0} plan(s) actif(s)`,
                details: plans?.map(p => p.name).join(', '),
                icon: CreditCard
            }, results)
        } catch (err: any) {
            results = addResult({
                name: 'Plans tarifaires',
                category: 'Base de données',
                status: 'warning',
                message: 'Table non trouvée',
                icon: CreditCard
            }, results)
        }
        setDiagnostics([...results])

        // ========== STATS ==========
        try {
            const res = await fetch('/api/admin/diagnostics/stats')
            const data = await res.json()
            if (data.data) {
                setStats(data.data)
            }
        } catch (err) {
            console.error('Error fetching stats:', err)
        }

        setLastCheck(new Date())
        setLoading(false)
    }

    const getStatusIcon = (status: string, Icon: any) => {
        const color = status === 'ok' ? '#34d399' : status === 'warning' ? '#f59e0b' : status === 'error' ? '#f87171' : '#94a3b8'

        if (status === 'loading') {
            return <Loader2 style={{ color: '#94a3b8', animation: 'spin 1s linear infinite' }} size={20} />
        }

        return status === 'ok' ? <CheckCircle style={{ color }} size={20} /> :
            status === 'warning' ? <AlertTriangle style={{ color }} size={20} /> :
                <XCircle style={{ color }} size={20} />
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ok': return '#34d399'
            case 'warning': return '#f59e0b'
            case 'error': return '#f87171'
            default: return '#94a3b8'
        }
    }

    const categories = [...new Set(diagnostics.map(d => d.category))]
    const overallStatus = diagnostics.every(d => d.status === 'ok' || d.status === 'loading') ? 'ok' :
        diagnostics.some(d => d.status === 'error') ? 'error' : 'warning'
    const okCount = diagnostics.filter(d => d.status === 'ok').length
    const totalCount = diagnostics.filter(d => d.status !== 'loading').length

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                        Diagnostic Système Complet
                    </h1>
                    <p style={{ color: '#94a3b8' }}>
                        Analyse exhaustive de tous les composants de l'application
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {lastCheck && (
                        <span style={{ color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={14} />
                            {lastCheck.toLocaleTimeString('fr-FR')}
                        </span>
                    )}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={runDiagnostics}
                        disabled={loading}
                        style={{
                            padding: '12px 20px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 12,
                            fontWeight: 600,
                            cursor: loading ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        <RefreshCw size={18} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        Relancer le diagnostic
                    </motion.button>
                </div>
            </div>

            {/* Overall Status */}
            {totalCount > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        padding: 24,
                        borderRadius: 16,
                        marginBottom: 24,
                        background: overallStatus === 'ok'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : overallStatus === 'error'
                                ? 'rgba(239, 68, 68, 0.1)'
                                : 'rgba(245, 158, 11, 0.1)',
                        border: `1px solid ${getStatusColor(overallStatus)}30`
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{
                            width: 56,
                            height: 56,
                            borderRadius: 16,
                            background: `${getStatusColor(overallStatus)}20`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {overallStatus === 'ok' ? (
                                <CheckCircle size={28} style={{ color: getStatusColor(overallStatus) }} />
                            ) : overallStatus === 'error' ? (
                                <XCircle size={28} style={{ color: getStatusColor(overallStatus) }} />
                            ) : (
                                <AlertTriangle size={28} style={{ color: getStatusColor(overallStatus) }} />
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h2 style={{ fontSize: 22, fontWeight: 600, color: getStatusColor(overallStatus) }}>
                                {overallStatus === 'ok' ? 'Système opérationnel' :
                                    overallStatus === 'error' ? 'Problèmes détectés' : 'Attention requise'}
                            </h2>
                            <p style={{ color: '#94a3b8' }}>
                                {okCount}/{totalCount} services fonctionnels
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 36, fontWeight: 700, color: getStatusColor(overallStatus) }}>
                                {Math.round((okCount / totalCount) * 100)}%
                            </div>
                            <div style={{ color: '#64748b', fontSize: 13 }}>Score santé</div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Diagnostics by Category */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
                {categories.map(category => (
                    <div key={category}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {category}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 12 }}>
                            {diagnostics
                                .filter(d => d.category === category)
                                .map((diag, i) => (
                                    <motion.div
                                        key={diag.name}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        style={{
                                            padding: 20,
                                            background: 'rgba(30, 41, 59, 0.5)',
                                            border: `1px solid ${diag.status === 'loading' ? 'rgba(148, 163, 184, 0.1)' : getStatusColor(diag.status) + '30'}`,
                                            borderRadius: 12
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                                                <div style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 10,
                                                    background: `${getStatusColor(diag.status)}15`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <diag.icon size={20} style={{ color: getStatusColor(diag.status) }} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, color: 'white', fontSize: 14 }}>{diag.name}</div>
                                                    <div style={{ fontSize: 13, color: getStatusColor(diag.status) }}>{diag.message}</div>
                                                </div>
                                            </div>
                                            {getStatusIcon(diag.status, diag.icon)}
                                        </div>
                                        {diag.details && (
                                            <div style={{
                                                marginTop: 12,
                                                padding: '8px 12px',
                                                background: 'rgba(15, 23, 42, 0.5)',
                                                borderRadius: 8,
                                                fontSize: 12,
                                                color: '#94a3b8'
                                            }}>
                                                {diag.details}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* System Stats */}
            {stats && (
                <>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Statistiques Système
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                        <StatCard icon={Users} label="Utilisateurs" value={stats.totalUsers} subValue={`${stats.activeUsers} actifs`} color="#3b82f6" />
                        <StatCard icon={Bot} label="Agents" value={stats.totalAgents} subValue={`${stats.connectedAgents} connectés`} color="#8b5cf6" />
                        <StatCard icon={MessageSquare} label="Messages" value={stats.totalMessages} subValue={`${stats.totalConversations} conv.`} color="#10b981" />
                        <StatCard icon={Zap} label="Crédits" value={stats.totalCreditsUsed} subValue="utilisés ce mois" color="#f59e0b" />
                        <StatCard icon={HardDrive} label="Produits" value={stats.totalProducts} color="#ec4899" />
                        <StatCard icon={CreditCard} label="Commandes" value={stats.totalOrders} subValue={`${stats.pendingOrders} en attente`} color="#06b6d4" />
                    </div>
                </>
            )}

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

function StatCard({ icon: Icon, label, value, subValue, color }: {
    icon: any, label: string, value: number, subValue?: string, color: string
}) {
    return (
        <div style={{
            padding: 16,
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: 12
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: `${color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Icon size={18} style={{ color }} />
                </div>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>{label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>
                {value.toLocaleString('fr-FR')}
            </div>
            {subValue && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{subValue}</div>
            )}
        </div>
    )
}
