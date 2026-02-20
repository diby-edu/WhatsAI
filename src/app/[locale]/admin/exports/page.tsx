'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    Download, FileText, Users, CreditCard, History,
    Bot, Calendar, Package, ChevronRight, Loader2, CheckCircle2
} from 'lucide-react'

export default function AdminExportsPage() {
    const [exporting, setExporting] = useState<string | null>(null)
    const [done, setDone] = useState<string | null>(null)

    const collections = [
        { id: 'users', label: 'Utilisateurs', icon: Users, color: '#60a5fa', description: 'Liste complète des clients, statuts et soldes.' },
        { id: 'payments', label: 'Paiements', icon: CreditCard, color: '#34d399', description: 'Historique des transactions, abonnements et crédits.' },
        { id: 'payouts', label: 'Reversements', icon: Package, color: '#f59e0b', description: 'Historique des paiements aux marchands.' },
        { id: 'agents', label: 'Agents IA', icon: Bot, color: '#a78bfa', description: 'Configuration et statistiques des agents actifs.' },
        { id: 'audit-logs', label: 'Audit Trail', icon: History, color: '#94a3b8', description: 'Logs de sécurité et actions administratives.' },
        { id: 'orders', label: 'Commandes', icon: Calendar, color: '#fb7185', description: 'Toutes les commandes produits/services.' },
    ]

    const handleExport = async (id: string, format: 'csv' | 'json') => {
        setExporting(id)
        try {
            // Mapping collections to API endpoints
            const apiMap: Record<string, string> = {
                'users': '/api/admin/users',
                'payments': '/api/admin/analytics', // We might want a more specific one for full payments
                'payouts': '/api/admin/payouts?view=history',
                'agents': '/api/admin/agents',
                'audit-logs': '/api/admin/audit-logs',
                'orders': '/api/admin/orders'
            }

            const res = await fetch(apiMap[id] || apiMap['users'])
            const json = await res.json()
            const data = json.data?.users || json.data?.payouts || json.data || []

            if (format === 'json') {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `export-${id}-${new Date().toISOString().split('T')[0]}.json`
                a.click()
            } else {
                // Simple CSV conversion
                if (data.length > 0) {
                    const headers = Object.keys(data[0])
                    const csvRows = [
                        headers.join(','),
                        ...data.map((row: any) => headers.map(header => {
                            const val = row[header]
                            return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
                        }).join(','))
                    ]
                    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `export-${id}-${new Date().toISOString().split('T')[0]}.csv`
                    a.click()
                }
            }

            setDone(id)
            setTimeout(() => setDone(null), 3000)
        } catch (err) {
            console.error('Export failed:', err)
        } finally {
            setExporting(null)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <style jsx global>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            {/* Header */}
            <div>
                <h1 style={{ fontSize: 32, fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: 8 }}>
                    Centre d'Exportation
                </h1>
                <p style={{ color: '#94a3b8', fontSize: 16 }}>Extrayez vos données pour la comptabilité, l'analyse externe ou la sauvegarde.</p>
            </div>

            {/* Export Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
                {collections.map((coll, i) => (
                    <motion.div
                        key={coll.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.4)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 24,
                            padding: 24,
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: 16,
                                background: `${coll.color}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <coll.icon style={{ width: 28, height: 28, color: coll.color }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>{coll.label}</h3>
                                <p style={{ fontSize: 13, color: '#64748b' }}>{coll.description}</p>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => handleExport(coll.id, 'csv')}
                                disabled={!!exporting}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: 12,
                                    background: 'rgba(148, 163, 184, 0.1)',
                                    color: 'white',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {exporting === coll.id ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : done === coll.id ? <CheckCircle2 size={18} color="#34d399" /> : <Download size={18} />}
                                CSV
                            </button>
                            <button
                                onClick={() => handleExport(coll.id, 'json')}
                                disabled={!!exporting}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: 12,
                                    background: 'rgba(148, 163, 184, 0.05)',
                                    color: '#94a3b8',
                                    border: '1px solid rgba(148, 163, 184, 0.05)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    fontSize: 14,
                                    fontWeight: 600
                                }}
                            >
                                <FileText size={18} />
                                JSON
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Information Box */}
            <div style={{
                background: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.1)',
                borderRadius: 20,
                padding: 24,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16
            }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                    <CheckCircle2 size={24} color="#10b981" />
                </div>
                <div>
                    <h4 style={{ color: 'white', fontWeight: 700, marginBottom: 8 }}>Données Sécurisées</h4>
                    <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
                        Les exports sont générés en temps réel à partir de la base de données.
                        Seuls les administrateurs avec les privilèges appropriés peuvent accéder à ces fonctions d'extraction massive.
                        Les formats CSV sont optimisés pour Microsoft Excel et Google Sheets.
                    </p>
                </div>
            </div>
        </div>
    )
}
