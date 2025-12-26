'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Activity, CheckCircle, XCircle, AlertTriangle, Loader2,
    Database, Server, Bot, MessageSquare, Users, CreditCard,
    Wifi, WifiOff, RefreshCw, Clock, Zap, HardDrive
} from 'lucide-react'

interface DiagnosticResult {
    name: string
    status: 'ok' | 'warning' | 'error' | 'loading'
    message: string
    details?: string
    value?: string | number
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

    const runDiagnostics = async () => {
        setLoading(true)
        setDiagnostics([])

        const results: DiagnosticResult[] = []

        // 1. Database Connection
        results.push({ name: 'Base de données', status: 'loading', message: 'Vérification...' })
        setDiagnostics([...results])
        try {
            const res = await fetch('/api/admin/diagnostics/database')
            const data = await res.json()
            results[results.length - 1] = {
                name: 'Base de données',
                status: data.success ? 'ok' : 'error',
                message: data.success ? 'Connexion établie' : data.error,
                details: data.latency ? `Latence: ${data.latency}ms` : undefined
            }
        } catch {
            results[results.length - 1] = { name: 'Base de données', status: 'error', message: 'Connexion échouée' }
        }
        setDiagnostics([...results])

        // 2. API Health
        results.push({ name: 'API Backend', status: 'loading', message: 'Vérification...' })
        setDiagnostics([...results])
        try {
            const start = Date.now()
            const res = await fetch('/api/health')
            const latency = Date.now() - start
            results[results.length - 1] = {
                name: 'API Backend',
                status: res.ok ? 'ok' : 'error',
                message: res.ok ? 'Opérationnelle' : 'Erreur',
                details: `Latence: ${latency}ms`
            }
        } catch {
            results[results.length - 1] = { name: 'API Backend', status: 'error', message: 'Inaccessible' }
        }
        setDiagnostics([...results])

        // 3. Authentication
        results.push({ name: 'Authentification', status: 'loading', message: 'Vérification...' })
        setDiagnostics([...results])
        try {
            const res = await fetch('/api/auth/session')
            const data = await res.json()
            results[results.length - 1] = {
                name: 'Authentification',
                status: data.user ? 'ok' : 'warning',
                message: data.user ? 'Session active' : 'Pas de session',
                details: data.user?.email
            }
        } catch {
            results[results.length - 1] = { name: 'Authentification', status: 'warning', message: 'Non vérifiable' }
        }
        setDiagnostics([...results])

        // 4. WhatsApp Sessions
        results.push({ name: 'Sessions WhatsApp', status: 'loading', message: 'Vérification...' })
        setDiagnostics([...results])
        try {
            const res = await fetch('/api/admin/diagnostics/whatsapp')
            const data = await res.json()
            results[results.length - 1] = {
                name: 'Sessions WhatsApp',
                status: data.connected > 0 ? 'ok' : 'warning',
                message: `${data.connected}/${data.total} agents connectés`,
                details: data.connected === 0 ? 'Aucune session active' : undefined
            }
        } catch {
            results[results.length - 1] = { name: 'Sessions WhatsApp', status: 'warning', message: 'Statut inconnu' }
        }
        setDiagnostics([...results])

        // 5. Storage
        results.push({ name: 'Stockage (Supabase)', status: 'loading', message: 'Vérification...' })
        setDiagnostics([...results])
        try {
            const res = await fetch('/api/admin/diagnostics/storage')
            const data = await res.json()
            results[results.length - 1] = {
                name: 'Stockage (Supabase)',
                status: data.success ? 'ok' : 'error',
                message: data.success ? 'Bucket accessible' : data.error,
                details: data.buckets ? `${data.buckets} buckets` : undefined
            }
        } catch {
            results[results.length - 1] = { name: 'Stockage (Supabase)', status: 'error', message: 'Inaccessible' }
        }
        setDiagnostics([...results])

        // 6. OpenAI API
        results.push({ name: 'API OpenAI', status: 'loading', message: 'Vérification...' })
        setDiagnostics([...results])
        try {
            const res = await fetch('/api/admin/diagnostics/openai')
            const data = await res.json()
            results[results.length - 1] = {
                name: 'API OpenAI',
                status: data.success ? 'ok' : 'error',
                message: data.success ? 'Clé API valide' : data.error || 'Erreur de connexion'
            }
        } catch {
            results[results.length - 1] = { name: 'API OpenAI', status: 'error', message: 'Non configurée' }
        }
        setDiagnostics([...results])

        // 7. Environment Variables
        results.push({ name: 'Variables d\'environnement', status: 'loading', message: 'Vérification...' })
        setDiagnostics([...results])
        try {
            const res = await fetch('/api/admin/diagnostics/env')
            const data = await res.json()
            const missing = data.missing || []
            results[results.length - 1] = {
                name: 'Variables d\'environnement',
                status: missing.length === 0 ? 'ok' : 'warning',
                message: missing.length === 0 ? 'Toutes configurées' : `${missing.length} manquante(s)`,
                details: missing.length > 0 ? missing.join(', ') : undefined
            }
        } catch {
            results[results.length - 1] = { name: 'Variables d\'environnement', status: 'warning', message: 'Non vérifiable' }
        }
        setDiagnostics([...results])

        // Fetch stats
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

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'ok': return <CheckCircle style={{ color: '#34d399' }} size={20} />
            case 'warning': return <AlertTriangle style={{ color: '#f59e0b' }} size={20} />
            case 'error': return <XCircle style={{ color: '#f87171' }} size={20} />
            default: return <Loader2 style={{ color: '#94a3b8', animation: 'spin 1s linear infinite' }} size={20} />
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ok': return '#34d399'
            case 'warning': return '#f59e0b'
            case 'error': return '#f87171'
            default: return '#94a3b8'
        }
    }

    const overallStatus = diagnostics.every(d => d.status === 'ok') ? 'ok' :
        diagnostics.some(d => d.status === 'error') ? 'error' : 'warning'

    return (
        <div style={{ padding: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                        Diagnostic Système
                    </h1>
                    <p style={{ color: '#94a3b8' }}>
                        Analyse exhaustive de l'état de l'application
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {lastCheck && (
                        <span style={{ color: '#64748b', fontSize: 14 }}>
                            <Clock size={14} style={{ marginRight: 6, display: 'inline' }} />
                            Dernière vérification: {lastCheck.toLocaleTimeString('fr-FR')}
                        </span>
                    )}
                    <button
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
                    </button>
                </div>
            </div>

            {/* Overall Status */}
            {!loading && diagnostics.length > 0 && (
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
                        <div>
                            <h2 style={{ fontSize: 22, fontWeight: 600, color: getStatusColor(overallStatus) }}>
                                {overallStatus === 'ok' ? 'Système opérationnel' :
                                    overallStatus === 'error' ? 'Problèmes détectés' : 'Attention requise'}
                            </h2>
                            <p style={{ color: '#94a3b8' }}>
                                {diagnostics.filter(d => d.status === 'ok').length}/{diagnostics.length} services fonctionnels
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Diagnostics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16, marginBottom: 32 }}>
                {diagnostics.map((diag, i) => (
                    <motion.div
                        key={diag.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        style={{
                            padding: 20,
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 12
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {getStatusIcon(diag.status)}
                                <div>
                                    <div style={{ fontWeight: 600, color: 'white' }}>{diag.name}</div>
                                    <div style={{ fontSize: 14, color: getStatusColor(diag.status) }}>{diag.message}</div>
                                </div>
                            </div>
                        </div>
                        {diag.details && (
                            <div style={{
                                marginTop: 12,
                                padding: '8px 12px',
                                background: 'rgba(15, 23, 42, 0.5)',
                                borderRadius: 8,
                                fontSize: 13,
                                color: '#94a3b8'
                            }}>
                                {diag.details}
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

            {/* System Stats */}
            {stats && (
                <>
                    <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 16 }}>
                        Statistiques Système
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                        <StatCard icon={Users} label="Utilisateurs" value={stats.totalUsers} subValue={`${stats.activeUsers} actifs`} color="#3b82f6" />
                        <StatCard icon={Bot} label="Agents" value={stats.totalAgents} subValue={`${stats.connectedAgents} connectés`} color="#8b5cf6" />
                        <StatCard icon={MessageSquare} label="Messages" value={stats.totalMessages} subValue={`${stats.totalConversations} conversations`} color="#10b981" />
                        <StatCard icon={Zap} label="Crédits utilisés" value={stats.totalCreditsUsed} color="#f59e0b" />
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
            padding: 20,
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: 12
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: `${color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Icon size={20} style={{ color }} />
                </div>
                <span style={{ color: '#94a3b8', fontSize: 14 }}>{label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>
                {value.toLocaleString('fr-FR')}
            </div>
            {subValue && (
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{subValue}</div>
            )}
        </div>
    )
}
