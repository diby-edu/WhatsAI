'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    Clock,
    CreditCard,
    Cpu,
    Database,
    Globe,
    HardDrive,
    Key,
    Loader2,
    Lock,
    Mail,
    MemoryStick,
    MessageSquare,
    RefreshCw,
    Server,
    Shield,
    Smartphone,
    Users,
    Wifi,
    XCircle,
    Zap,
} from 'lucide-react'

type DiagnosticStatus = 'ok' | 'warning' | 'error'

type DiagnosticItem = {
    name: string
    category: string
    status: DiagnosticStatus
    message: string
    details?: string
    utility?: string
    icon: any
}

type StatsPayload = {
    totalUsers: number
    activeUsers: number
    totalAgents: number
    connectedAgents: number
    qrReadyAgents: number
    reconnectAgents: number
    pausedAgents: number
    totalConversations: number
    totalMessages: number
    totalCreditsUsed: number
    totalProducts: number
    totalOrders: number
    pendingOrders: number
    whatsappAtRiskAgents?: number
}

type WhatsAppRiskEntry = {
    id: string
    name: string
    severity: 'critical' | 'warning'
    reason: string
    message: string
    minutes_since_update: number
    operational_status: string
    whatsapp_status: string | null
    has_qr: boolean
}

type WhatsAppRiskReport = {
    total: number
    critical: number
    warning: number
    agents: WhatsAppRiskEntry[]
}

async function getJson(url: string) {
    const res = await fetch(url)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`)
    }
    return json
}

export default function AdminDiagnosticsPage() {
    const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([])
    const [stats, setStats] = useState<StatsPayload | null>(null)
    const [whatsAppRiskReport, setWhatsAppRiskReport] = useState<WhatsAppRiskReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [lastCheck, setLastCheck] = useState<Date | null>(null)

    async function runDiagnostics() {
        setLoading(true)

        try {
            const [
                database,
                apiHealth,
                storage,
                openai,
                cinetpay,
                whatsapp,
                whatsappService,
                env,
                integrity,
                serverHealth,
                security,
                smtp,
                dns,
                ratelimit,
                statsResponse,
            ] = await Promise.all([
                getJson('/api/admin/diagnostics/database'),
                getJson('/api/health'),
                getJson('/api/admin/diagnostics/storage'),
                getJson('/api/admin/diagnostics/openai'),
                getJson('/api/admin/diagnostics/cinetpay'),
                getJson('/api/admin/diagnostics/whatsapp'),
                getJson('/api/admin/diagnostics/whatsapp-service'),
                getJson('/api/admin/diagnostics/env'),
                getJson('/api/admin/diagnostics/integrity'),
                getJson('/api/admin/diagnostics/health'),
                getJson('/api/admin/diagnostics/security'),
                getJson('/api/admin/diagnostics/smtp'),
                getJson('/api/admin/diagnostics/dns'),
                getJson('/api/admin/diagnostics/ratelimit'),
                getJson('/api/admin/diagnostics/stats'),
            ])

            const riskReport: WhatsAppRiskReport | null =
                whatsapp.data?.riskReport || whatsappService.data?.riskReport || null
            const hasCriticalWhatsAppRisk = (riskReport?.critical || 0) > 0
            const hasWarningWhatsAppRisk = (riskReport?.warning || 0) > 0
            const whatsappStatus: DiagnosticStatus = hasCriticalWhatsAppRisk
                ? 'error'
                : (hasWarningWhatsAppRisk || (whatsapp.data?.reconnect_required || 0) > 0 || (whatsapp.data?.qr_ready || 0) > 0)
                    ? 'warning'
                    : (whatsapp.data?.connected || 0) > 0
                        ? 'ok'
                        : 'warning'

            const whatsappServiceStatus = ((): DiagnosticStatus => {
                const serviceStatus = whatsappService.data?.whatsappService?.status
                if (serviceStatus === 'error') return 'error'
                if (serviceStatus === 'warning') return 'warning'
                if (hasCriticalWhatsAppRisk) return 'warning'
                return 'ok'
            })()

            const results: DiagnosticItem[] = [
                {
                    name: 'Base de donnees Supabase',
                    category: 'Infrastructure',
                    status: 'ok',
                    message: database.data?.message || 'Connexion etablie',
                    details: database.data?.latency ? `Latence: ${database.data.latency}ms` : undefined,
                    utility: 'Valide l acces SQL reel et la latence de la base pour eviter les faux positifs UI.',
                    icon: Database,
                },
                {
                    name: 'API Backend Next.js',
                    category: 'Infrastructure',
                    status: apiHealth.data?.status === 'healthy' ? 'ok' : apiHealth.data?.status === 'degraded' ? 'warning' : 'error',
                    message: apiHealth.data?.status || 'Inconnu',
                    details: apiHealth.data?.services?.database?.error || undefined,
                    utility: 'Verifie si l API repond vraiment et si ses dependances critiques restent joignables.',
                    icon: Server,
                },
                {
                    name: 'Stockage Supabase',
                    category: 'Infrastructure',
                    status: 'ok',
                    message: `${storage.data?.buckets || 0} bucket(s) accessibles`,
                    details: storage.data?.bucketNames?.join(', ') || undefined,
                    utility: 'Controle l acces au stockage utilise pour medias, avatars et imports.',
                    icon: HardDrive,
                },
                {
                    name: 'API OpenAI',
                    category: 'APIs externes',
                    status: openai.data?.success ? 'ok' : 'error',
                    message: openai.data?.message || 'Connexion OpenAI',
                    details: openai.data?.models ? `${openai.data.models} modeles disponibles` : undefined,
                    utility: 'Detecte rapidement une cle invalide ou une indisponibilite IA avant impact client.',
                    icon: Zap,
                },
                {
                    name: 'API CinetPay',
                    category: 'APIs externes',
                    status: cinetpay.data?.configured ? 'ok' : 'warning',
                    message: cinetpay.data?.message || 'Configuration CinetPay',
                    details: cinetpay.data?.mode ? `Mode: ${cinetpay.data.mode}` : undefined,
                    utility: 'Verifie la configuration paiement pour eviter des commandes bloquees ou impayees.',
                    icon: CreditCard,
                },
                {
                    name: 'Sessions WhatsApp',
                    category: 'WhatsApp',
                    status: whatsappStatus,
                    message: `${whatsapp.data?.connected || 0}/${whatsapp.data?.total || 0} agents connectes`,
                    details: `A connecter: ${whatsapp.data?.qr_ready || 0} | A reconnecter: ${whatsapp.data?.reconnect_required || 0} | Pause: ${whatsapp.data?.paused || 0} | A risque: ${riskReport?.total || 0}`,
                    utility: 'Remonte les agents vraiment exploitables, a reconnecter, ou bloques en pairing avant plainte client.',
                    icon: Smartphone,
                },
                {
                    name: 'Service WhatsApp Bot',
                    category: 'WhatsApp',
                    status: whatsappServiceStatus,
                    message: whatsappService.data?.whatsappService?.message || 'Statut inconnu',
                    details: [whatsappService.data?.whatsappService?.details, whatsappService.data?.agentConnections?.details, riskReport?.critical ? `${riskReport.critical} agent(s) a risque critique` : ''].filter(Boolean).join(' | '),
                    utility: 'Valide que le process bot tourne et confronte son etat aux agents reels a risque.',
                    icon: MessageSquare,
                },
                {
                    name: 'Variables d environnement',
                    category: 'Configuration',
                    status: (env.data?.missing || []).length === 0 ? 'ok' : 'warning',
                    message: (env.data?.missing || []).length === 0 ? 'Toutes configurees' : `${env.data?.missing?.length || 0} manquante(s)`,
                    details: env.data?.missing?.join(', ') || undefined,
                    utility: 'Epargne les bugs silencieux lies a une config manquante entre local, build et prod.',
                    icon: Key,
                },
                {
                    name: 'Integrite des donnees',
                    category: 'Donnees',
                    status: integrity.data?.overallStatus === 'error' ? 'error' : integrity.data?.overallStatus === 'warning' ? 'warning' : 'ok',
                    message: integrity.data?.issues?.length ? `${integrity.data.issues.length} probleme(s)` : 'Aucun probleme detecte',
                    details: integrity.data?.issues?.map((issue: any) => issue.message).join(' | ') || undefined,
                    utility: 'Cherche les incoherences DB qui peuvent casser paiements, catalogues ou conversations.',
                    icon: Database,
                },
                {
                    name: 'Sante serveur',
                    category: 'Performance',
                    status: serverHealth.data?.overallStatus === 'critical' ? 'error' : serverHealth.data?.overallStatus === 'warning' ? 'warning' : 'ok',
                    message: serverHealth.data?.uptimeFormatted || 'Serveur actif',
                    details: `CPU ${serverHealth.data?.cpu?.['1min'] || serverHealth.data?.cpu?.loadAverage?.['1min'] || '?'} | RAM ${serverHealth.data?.memory?.percent || 0}%`,
                    utility: 'Aide a distinguer un bug applicatif d une saturation machine ou d un reboot frequent.',
                    icon: Cpu,
                },
                {
                    name: 'Certificat SSL',
                    category: 'Securite',
                    status: security.data?.ssl?.status || 'warning',
                    message: security.data?.ssl?.message || 'Inconnu',
                    details: security.data?.apiLatency?.message ? `Latence API: ${security.data.apiLatency.message}` : undefined,
                    utility: 'Evite les coupures client liees au HTTPS, au certificat ou a la latence TLS.',
                    icon: Lock,
                },
                {
                    name: 'Configuration Email',
                    category: 'Email',
                    status: smtp.data?.configured ? 'ok' : 'warning',
                    message: smtp.data?.message || 'SMTP',
                    details: smtp.data?.config?.host || undefined,
                    utility: 'Controle la chaine email utile pour recuperation de compte et notifications critiques.',
                    icon: Mail,
                },
                {
                    name: 'DNS et domaine',
                    category: 'Reseau',
                    status: dns.data?.dns?.status || 'warning',
                    message: dns.data?.dns?.message || 'Resolution DNS',
                    details: dns.data?.httpReachable ? `HTTP ${dns.data.httpStatus}` : dns.data?.httpError,
                    utility: 'Verifie qu un probleme d acces vient bien de l app et non du domaine ou du reseau.',
                    icon: Globe,
                },
                {
                    name: 'Rate limiting & Redis',
                    category: 'APIs',
                    status: ratelimit.data?.redis?.configured ? 'ok' : 'warning',
                    message: ratelimit.data?.redis?.configured ? 'Redis configure' : 'Redis non configure',
                    details: ratelimit.data?.redis?.ping || undefined,
                    utility: 'Permet de prevenir les abus, doublons et pointes de charge qui degradent l experience.',
                    icon: Activity,
                },
            ]

            setDiagnostics(results)
            setStats(statsResponse.data || null)
            setWhatsAppRiskReport(riskReport)
            setLastCheck(new Date())
        } catch (err) {
            console.error('Diagnostics run failed:', err)
            setDiagnostics([{
                name: 'Diagnostic global',
                category: 'Systeme',
                status: 'error',
                message: err instanceof Error ? err.message : 'Erreur de chargement',
                icon: AlertTriangle,
            }])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        runDiagnostics()
    }, [])

    const overallStatus = useMemo<DiagnosticStatus>(() => {
        if (diagnostics.some((item) => item.status === 'error')) return 'error'
        if (diagnostics.some((item) => item.status === 'warning')) return 'warning'
        return 'ok'
    }, [diagnostics])

    const categories = useMemo(() => [...new Set(diagnostics.map((item) => item.category))], [diagnostics])

    function getStatusIcon(status: DiagnosticStatus) {
        if (status === 'ok') return <CheckCircle style={{ color: '#34d399' }} size={20} />
        if (status === 'warning') return <AlertTriangle style={{ color: '#f59e0b' }} size={20} />
        return <XCircle style={{ color: '#f87171' }} size={20} />
    }

    function getStatusColor(status: DiagnosticStatus) {
        if (status === 'ok') return '#34d399'
        if (status === 'warning') return '#f59e0b'
        return '#f87171'
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                        Diagnostic systeme
                    </h1>
                    <p style={{ color: '#94a3b8' }}>
                        Verification backend uniquement, avec statuts reels et details exploitables.
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
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        <RefreshCw size={18} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        Relancer
                    </motion.button>
                </div>
            </div>

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
                    border: `1px solid ${getStatusColor(overallStatus)}30`,
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
                        justifyContent: 'center',
                    }}>
                        {getStatusIcon(overallStatus)}
                    </div>
                    <div>
                        <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>
                            {overallStatus === 'ok' ? 'Tous les checks critiques sont au vert' : overallStatus === 'warning' ? 'Des points de vigilance existent' : 'Des anomalies critiques sont detectees'}
                        </div>
                <div style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
                            {diagnostics.length} verifications consolidees{whatsAppRiskReport ? ` | ${whatsAppRiskReport.total} agent(s) a risque surveille(s)` : ''}
                        </div>
                    </div>
                </div>
            </motion.div>

            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 28 }}>
                        {[
                            { label: 'Utilisateurs', value: stats.totalUsers, icon: Users, color: '#60a5fa' },
                            { label: 'Agents connectes', value: stats.connectedAgents, icon: Smartphone, color: '#34d399' },
                            { label: 'A reconnecter', value: stats.reconnectAgents, icon: Wifi, color: '#f97316' },
                            { label: 'Agents a risque', value: stats.whatsappAtRiskAgents || 0, icon: AlertTriangle, color: '#fb7185' },
                            { label: 'Messages', value: stats.totalMessages, icon: MessageSquare, color: '#a78bfa' },
                            { label: 'Credits utilises', value: stats.totalCreditsUsed, icon: Zap, color: '#fbbf24' },
                            { label: 'Commandes en attente', value: stats.pendingOrders, icon: Shield, color: '#fb7185' },
                    ].map((stat) => (
                        <div key={stat.label} style={{
                            background: 'rgba(15, 23, 42, 0.55)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 18,
                            padding: 18,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <div style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: `${stat.color}20`,
                                }}>
                                    <stat.icon size={20} color={stat.color} />
                                </div>
                                <span style={{ color: '#94a3b8', fontSize: 13 }}>{stat.label}</span>
                            </div>
                            <div style={{ color: 'white', fontSize: 26, fontWeight: 700 }}>{Number(stat.value || 0).toLocaleString('fr-FR')}</div>
                        </div>
                    ))}
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                    <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {whatsAppRiskReport && whatsAppRiskReport.agents.length > 0 && (
                        <div style={{
                            padding: 20,
                            borderRadius: 18,
                            background: 'rgba(127, 29, 29, 0.18)',
                            border: '1px solid rgba(248, 113, 113, 0.25)',
                        }}>
                            <div style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                                Agents WhatsApp a risque
                            </div>
                            <div style={{ color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
                                Cette liste remonte les agents susceptibles de tomber dans un incident client avant meme qu une plainte arrive.
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                                {whatsAppRiskReport.agents.slice(0, 8).map((agent) => (
                                    <div key={agent.id} style={{
                                        padding: 14,
                                        borderRadius: 14,
                                        background: 'rgba(15, 23, 42, 0.55)',
                                        border: '1px solid rgba(248, 113, 113, 0.18)',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                                            <div style={{ color: 'white', fontWeight: 700 }}>{agent.name}</div>
                                            <div style={{ color: agent.severity === 'critical' ? '#f87171' : '#f59e0b', fontSize: 12, fontWeight: 700 }}>
                                                {agent.severity === 'critical' ? 'CRITIQUE' : 'VIGILANCE'}
                                            </div>
                                        </div>
                                        <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.5 }}>{agent.message}</div>
                                        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
                                            Statut: {agent.whatsapp_status || agent.operational_status} | Derniere maj: {agent.minutes_since_update} min | QR: {agent.has_qr ? 'oui' : 'non'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {categories.map((category) => (
                        <div key={category}>
                            <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 14 }}>{category}</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                                {diagnostics
                                    .filter((item) => item.category === category)
                                    .map((item) => (
                                        <div key={item.name} style={{
                                            padding: 18,
                                            borderRadius: 18,
                                            background: 'rgba(15, 23, 42, 0.55)',
                                            border: '1px solid rgba(148, 163, 184, 0.1)',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{
                                                        width: 42,
                                                        height: 42,
                                                        borderRadius: 12,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: `${getStatusColor(item.status)}20`,
                                                    }}>
                                                        <item.icon size={20} color={getStatusColor(item.status)} />
                                                    </div>
                                                    <div>
                                                        <div style={{ color: 'white', fontWeight: 700 }}>{item.name}</div>
                                                        <div style={{ color: getStatusColor(item.status), fontSize: 12, fontWeight: 600 }}>
                                                            {item.status === 'ok' ? 'OK' : item.status === 'warning' ? 'WARNING' : 'ERROR'}
                                                        </div>
                                                    </div>
                                                </div>
                                                {getStatusIcon(item.status)}
                                            </div>
                                            <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 500 }}>{item.message}</div>
                                            {item.utility && (
                                                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
                                                    Test utile: {item.utility}
                                                </div>
                                            )}
                                            {item.details && (
                                                <div style={{ color: '#64748b', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                                                    {item.details}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

