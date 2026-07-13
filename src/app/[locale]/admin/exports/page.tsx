'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    Download, FileText, Users, CreditCard, History,
    Bot, Calendar, Package, ChevronRight, Loader2, CheckCircle2
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function AdminExportsPage() {
    const toast = useToast()
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

    const handleExportPDF = async (id: string, label: string) => {
        setExporting(id)
        try {
            const apiMap: Record<string, string> = {
                'users': '/api/admin/users?pageSize=10000',
                'payments': '/api/admin/payments',
                'payouts': '/api/admin/payouts?view=history',
                'agents': '/api/admin/agents',
                'audit-logs': '/api/admin/audit-logs?pageSize=10000',
                'orders': '/api/admin/orders'
            }
            const res = await fetch(apiMap[id] || apiMap['users'])
            const json = await res.json()
            let data: any[] = []
            switch (id) {
                case 'users': case 'audit-logs': data = json.data || []; break
                case 'agents': data = json.data?.agents || []; break
                case 'orders': data = json.data?.orders || []; break
                case 'payouts': data = json.data?.payouts || []; break
                case 'payments': data = json.data?.payments || []; break
                default: data = Array.isArray(json.data) ? json.data : []
            }
            if (!data || data.length === 0) { toast.warning('Aucune donnée à exporter'); setExporting(null); return }

            const headers = Object.keys(data[0]).filter(h => typeof data[0][h] !== 'object' || data[0][h] === null)
            const rows = data.map(row => headers.map(h => {
                const v = row[h]; if (v === null || v === undefined) return ''
                if (typeof v === 'object') return JSON.stringify(v)
                return String(v)
            }))

            const printWin = window.open('', '_blank')
            if (!printWin) { toast.warning('Autorisez les popups pour exporter en PDF'); setExporting(null); return }
            const date = new Date().toLocaleDateString('fr-FR')
            printWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Export ${label} — ${date}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  p { color: #666; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e293b; color: white; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  tr:nth-child(even) td { background: #f8fafc; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>Export — ${label}</h1>
<p>Généré le ${date} — ${data.length} entrées</p>
<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.map(v => `<td title="${v.replace(/"/g, '')}">${v}</td>`).join('')}</tr>`).join('')}</tbody>
</table></body></html>`)
            printWin.document.close()
            printWin.onload = () => { printWin.print() }
            setDone(id); setTimeout(() => setDone(null), 3000)
        } catch (err) {
            console.error('PDF export failed:', err); toast.error('Erreur lors de l\'export PDF')
        } finally { setExporting(null) }
    }

    const handleExport = async (id: string, format: 'csv' | 'json') => {
        setExporting(id)
        try {
            // Mapping collections to API endpoints with high page sizes for full export
            const apiMap: Record<string, string> = {
                'users': '/api/admin/users?pageSize=10000',
                'payments': '/api/admin/payments',
                'payouts': '/api/admin/payouts?view=history',
                'agents': '/api/admin/agents',
                'audit-logs': '/api/admin/audit-logs?pageSize=10000',
                'orders': '/api/admin/orders'
            }

            const res = await fetch(apiMap[id] || apiMap['users'])
            const json = await res.json()

            // Extract data based on endpoint structure
            let data: any[] = []
            switch (id) {
                case 'users':
                case 'audit-logs':
                    data = json.data || [] // Paginated response returns data array directly
                    break
                case 'agents':
                    data = json.data?.agents || []
                    break
                case 'orders':
                    data = json.data?.orders || []
                    break
                case 'payouts':
                    data = json.data?.payouts || []
                    break
                case 'payments':
                    data = json.data?.payments || []
                    break
                default:
                    data = Array.isArray(json.data) ? json.data : []
            }

            if (!data || data.length === 0) {
                toast.warning('Aucune donnée à exporter')
                setExporting(null)
                return
            }

            if (format === 'json') {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `export-${id}-${new Date().toISOString().split('T')[0]}.json`
                a.click()
                URL.revokeObjectURL(url)
            } else {
                // CSV conversion with proper handling of nested objects and null values
                const headers = Object.keys(data[0]).filter(h => typeof data[0][h] !== 'object' || data[0][h] === null)
                const csvRows = [
                    headers.join(','),
                    ...data.map((row: any) => headers.map(header => {
                        const val = row[header]
                        if (val === null || val === undefined) return ''
                        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`
                        if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`
                        return val
                    }).join(','))
                ]
                const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `export-${id}-${new Date().toISOString().split('T')[0]}.csv`
                a.click()
                URL.revokeObjectURL(url)
            }

            setDone(id)
            setTimeout(() => setDone(null), 3000)
        } catch (err) {
            console.error('Export failed:', err)
            toast.error('Erreur lors de l\'export')
        } finally {
            setExporting(null)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

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

                        <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                            <button
                                onClick={() => handleExport(coll.id, 'csv')}
                                disabled={!!exporting}
                                style={{
                                    flex: 1, padding: '11px 8px', borderRadius: 12,
                                    background: 'rgba(148, 163, 184, 0.1)', color: 'white',
                                    border: '1px solid rgba(148, 163, 184, 0.1)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: 6, fontSize: 13, fontWeight: 600
                                }}
                            >
                                {exporting === coll.id ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : done === coll.id ? <CheckCircle2 size={16} color="#34d399" /> : <Download size={16} />}
                                CSV
                            </button>
                            <button
                                onClick={() => handleExport(coll.id, 'json')}
                                disabled={!!exporting}
                                style={{
                                    flex: 1, padding: '11px 8px', borderRadius: 12,
                                    background: 'rgba(148, 163, 184, 0.05)', color: '#94a3b8',
                                    border: '1px solid rgba(148, 163, 184, 0.05)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: 6, fontSize: 13, fontWeight: 600
                                }}
                            >
                                <FileText size={16} />
                                JSON
                            </button>
                            <button
                                onClick={() => handleExportPDF(coll.id, coll.label)}
                                disabled={!!exporting}
                                title="Exporter en PDF (impression)"
                                style={{
                                    flex: 1, padding: '11px 8px', borderRadius: 12,
                                    background: 'rgba(239, 68, 68, 0.08)', color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.15)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: 6, fontSize: 13, fontWeight: 600
                                }}
                            >
                                <FileText size={16} />
                                PDF
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
