'use client'

import { motion } from 'framer-motion'
import { FileText, AlertCircle, CheckCircle, Info, User, Clock } from 'lucide-react'

const logs = [
    { id: 1, type: 'info', action: 'Connexion utilisateur', user: 'Kouassi Jean', ip: '192.168.1.45', date: '2024-12-25 15:30:00' },
    { id: 2, type: 'success', action: 'Paiement reçu', user: 'Société ABC', ip: '41.207.12.34', date: '2024-12-25 15:25:12' },
    { id: 3, type: 'warning', action: 'Tentative de connexion échouée', user: 'admin@test.com', ip: '185.234.65.12', date: '2024-12-25 15:20:45' },
    { id: 4, type: 'info', action: 'Agent créé', user: 'Mohamed Traoré', ip: '192.168.2.78', date: '2024-12-25 15:15:30' },
    { id: 5, type: 'success', action: 'Abonnement activé', user: 'Aminata Diallo', ip: '41.189.45.67', date: '2024-12-25 15:10:22' },
    { id: 6, type: 'warning', action: 'Quota messages atteint', user: 'Fatou Konaté', ip: '192.168.3.34', date: '2024-12-25 15:05:18' },
    { id: 7, type: 'info', action: 'Mise à jour profil', user: 'Ibrahim Coulibaly', ip: '41.207.89.23', date: '2024-12-25 15:00:00' },
]

const getIcon = (type: string) => {
    switch (type) {
        case 'success': return <CheckCircle style={{ width: 18, height: 18, color: '#4ade80' }} />
        case 'warning': return <AlertCircle style={{ width: 18, height: 18, color: '#fbbf24' }} />
        default: return <Info style={{ width: 18, height: 18, color: '#60a5fa' }} />
    }
}

const getTypeStyle = (type: string) => {
    switch (type) {
        case 'success': return { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
        case 'warning': return { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }
        default: return { background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' }
    }
}

export default function AdminLogsPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>Logs d'audit</h1>
                    <p style={{ color: '#94a3b8' }}>Journal des activités du système</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <select style={{
                        padding: '10px 16px',
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: 12,
                        color: 'white'
                    }}>
                        <option value="all">Tous les types</option>
                        <option value="info">Info</option>
                        <option value="success">Succès</option>
                        <option value="warning">Avertissement</option>
                    </select>
                </div>
            </div>

            <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 20,
                overflow: 'hidden'
            }}>
                {logs.map((log, i) => (
                    <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: '16px 24px',
                            borderBottom: i < logs.length - 1 ? '1px solid rgba(148, 163, 184, 0.05)' : 'none'
                        }}
                    >
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            ...getTypeStyle(log.type)
                        }}>
                            {getIcon(log.type)}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, color: 'white', marginBottom: 4 }}>{log.action}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: '#64748b' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <User style={{ width: 14, height: 14 }} />
                                    {log.user}
                                </span>
                                <span>IP: {log.ip}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
                            <Clock style={{ width: 14, height: 14 }} />
                            {log.date}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
