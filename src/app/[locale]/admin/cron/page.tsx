'use client'

import { useEffect, useState } from 'react'
import { Timer, CheckCircle2, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface CronAuditEntry {
    id: string
    user_id: string
    email: string
    deletion_reason: string
    deletion_result: 'deleted' | 'failed' | 'skipped'
    failure_message: string | null
    created_at: string
    metadata: Record<string, unknown>
}

interface CronJob {
    key: string
    label: string
    description: string
    schedule: string
    lastRun: string | null
    nextRun: string | null
    lastStatus: 'success' | 'partial' | 'failed' | 'unknown'
    successCount: number
    failedCount: number
    skippedCount: number
    recentLogs: CronAuditEntry[]
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function nextRunFrom(lastRun: string | null, scheduleHour: number) {
    const base = lastRun ? new Date(lastRun) : new Date()
    const next = new Date(base)
    next.setUTCDate(next.getUTCDate() + 1)
    next.setUTCHours(scheduleHour, 30, 0, 0)
    return next.toISOString()
}

const STATUS_COLOR: Record<string, string> = {
    success: '#10b981',
    partial: '#f59e0b',
    failed: '#ef4444',
    unknown: '#64748b',
}

const RESULT_COLOR: Record<string, string> = {
    deleted: '#10b981',
    failed: '#ef4444',
    skipped: '#64748b',
}

export default function AdminCronPage() {
    const [jobs, setJobs] = useState<CronJob[]>([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)

    const load = async () => {
        setRefreshing(true)
        const supabase = createClient()

        const { data: logs } = await supabase
            .from('system_deletion_audit_logs')
            .select('id, user_id, email, deletion_reason, deletion_result, failure_message, created_at, metadata')
            .order('created_at', { ascending: false })
            .limit(200)

        const entries: CronAuditEntry[] = logs || []

        // Groupe par batch (même seconde ~)
        const cleanupEntries = entries.filter(e => e.deletion_reason === 'expired_test_account')
        const lastRun = cleanupEntries[0]?.created_at || null
        const recentBatch = lastRun
            ? cleanupEntries.filter(e => Math.abs(new Date(e.created_at).getTime() - new Date(lastRun).getTime()) < 10000)
            : []

        const successCount = recentBatch.filter(e => e.deletion_result === 'deleted').length
        const failedCount = recentBatch.filter(e => e.deletion_result === 'failed').length
        const skippedCount = recentBatch.filter(e => e.deletion_result === 'skipped').length

        const lastStatus = failedCount > 0 && successCount === 0 ? 'failed'
            : failedCount > 0 ? 'partial'
            : successCount > 0 ? 'success'
            : cleanupEntries.length > 0 ? 'success'
            : 'unknown'

        setJobs([
            {
                key: 'test_account_cleanup',
                label: 'Nettoyage comptes test expirés',
                description: 'Supprime les comptes test dont la période de 7 jours est expirée et qui n\'ont pas souscrit.',
                schedule: 'Tous les jours à 22h30 UTC',
                lastRun,
                nextRun: nextRunFrom(lastRun, 22),
                lastStatus,
                successCount,
                failedCount,
                skippedCount,
                recentLogs: cleanupEntries.slice(0, 20),
            },
        ])
        setLoading(false)
        setRefreshing(false)
    }

    useEffect(() => { load() }, [])

    if (loading) {
        return (
            <div style={{ padding: 32, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                Chargement...
            </div>
        )
    }

    return (
        <div style={{ padding: 32, maxWidth: 900 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Timer style={{ width: 20, height: 20, color: 'white' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Tâches planifiées</h1>
                        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Statut et historique des crons système</p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={refreshing}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 8,
                        backgroundColor: 'rgba(148, 163, 184, 0.1)',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        color: '#94a3b8', fontSize: 13, cursor: 'pointer'
                    }}
                >
                    <RefreshCw style={{ width: 14, height: 14, ...(refreshing ? { animation: 'spin 1s linear infinite' } : {}) }} />
                    Actualiser
                </button>
            </div>

            {/* Jobs */}
            {jobs.map((job) => (
                <div
                    key={job.key}
                    style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 14,
                        marginBottom: 16,
                        overflow: 'hidden'
                    }}
                >
                    {/* Job header */}
                    <div style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        backgroundColor: STATUS_COLOR[job.lastStatus]
                                    }} />
                                    <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>{job.label}</span>
                                </div>
                                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px 18px' }}>{job.description}</p>

                                {/* Stats */}
                                <div style={{ display: 'flex', gap: 24, marginLeft: 18 }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>SCHEDULE</div>
                                        <div style={{ fontSize: 13, color: '#94a3b8' }}>{job.schedule}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>DERNIÈRE EXÉCUTION</div>
                                        <div style={{ fontSize: 13, color: '#94a3b8' }}>
                                            {job.lastRun ? formatDate(job.lastRun) : '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>PROCHAIN RUN</div>
                                        <div style={{ fontSize: 13, color: '#94a3b8' }}>
                                            {job.nextRun ? formatDate(job.nextRun) : '—'}
                                        </div>
                                    </div>
                                </div>

                                {/* Counts */}
                                {(job.successCount + job.failedCount + job.skippedCount) > 0 && (
                                    <div style={{ display: 'flex', gap: 12, marginTop: 12, marginLeft: 18 }}>
                                        {job.successCount > 0 && (
                                            <span style={{ fontSize: 12, color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '3px 10px', borderRadius: 20 }}>
                                                ✓ {job.successCount} supprimé{job.successCount > 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {job.failedCount > 0 && (
                                            <span style={{ fontSize: 12, color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '3px 10px', borderRadius: 20 }}>
                                                ✗ {job.failedCount} échoué{job.failedCount > 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {job.skippedCount > 0 && (
                                            <span style={{ fontSize: 12, color: '#64748b', backgroundColor: 'rgba(100, 116, 139, 0.1)', padding: '3px 10px', borderRadius: 20 }}>
                                                – {job.skippedCount} ignoré{job.skippedCount > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Expand button */}
                            <button
                                onClick={() => setExpanded(expanded === job.key ? null : job.key)}
                                style={{
                                    padding: '8px 12px', borderRadius: 8,
                                    backgroundColor: 'rgba(148, 163, 184, 0.08)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: '#64748b', fontSize: 12, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                                }}
                            >
                                Historique
                                {expanded === job.key ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                            </button>
                        </div>
                    </div>

                    {/* Logs */}
                    {expanded === job.key && (
                        <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.08)' }}>
                            {job.recentLogs.length === 0 ? (
                                <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 13 }}>
                                    Aucun log disponible
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.06)' }}>
                                            {['Utilisateur', 'Email', 'Résultat', 'Message', 'Date'].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {job.recentLogs.map((log) => (
                                            <tr key={log.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.04)' }}>
                                                <td style={{ padding: '10px 16px', fontSize: 13, color: '#94a3b8' }}>
                                                    {log.user_id.slice(0, 8)}…
                                                </td>
                                                <td style={{ padding: '10px 16px', fontSize: 13, color: '#94a3b8' }}>
                                                    {log.email}
                                                </td>
                                                <td style={{ padding: '10px 16px' }}>
                                                    <span style={{
                                                        fontSize: 12, fontWeight: 500,
                                                        color: RESULT_COLOR[log.deletion_result] || '#94a3b8',
                                                        backgroundColor: `${RESULT_COLOR[log.deletion_result]}15`,
                                                        padding: '3px 10px', borderRadius: 20
                                                    }}>
                                                        {log.deletion_result}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 16px', fontSize: 12, color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {log.failure_message
                                                        ? (() => { try { return JSON.parse(log.failure_message)?.message || log.failure_message } catch { return log.failure_message } })()
                                                        : '—'
                                                    }
                                                </td>
                                                <td style={{ padding: '10px 16px', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
                                                    {formatDate(log.created_at)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}
