import type { Dispatch, SetStateAction } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { sectionStyle, inputStyle, secondaryButtonStyle } from '../styles'
import type { ApiKey, UsageLog } from '../types'

interface LogsTabProps {
    logKeyFilterId: string
    setLogKeyFilterId: Dispatch<SetStateAction<string>>
    keys: ApiKey[]
    fetchLogs: (keyFilterId?: string) => Promise<void>
    logsLoading: boolean
    logs: UsageLog[]
    expandedLogIds: Set<string>
    setExpandedLogIds: Dispatch<SetStateAction<Set<string>>>
    statusColor: (code: number) => string
    formatTime: (iso: string) => string
}

export function LogsTab({
    logKeyFilterId,
    setLogKeyFilterId,
    keys,
    fetchLogs,
    logsLoading,
    logs,
    expandedLogIds,
    setExpandedLogIds,
    statusColor,
    formatTime,
}: LogsTabProps) {
    return (
        <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={16} />
                    Logs d usage
                </h2>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <select
                        value={logKeyFilterId}
                        onChange={event => setLogKeyFilterId(event.target.value)}
                        style={{ ...inputStyle, minWidth: 220 }}
                    >
                        <option value="all">Toutes les cles</option>
                        {keys.map(key => (
                            <option key={key.id} value={key.id}>
                                {key.name}
                            </option>
                        ))}
                    </select>
                    <button onClick={() => void fetchLogs(logKeyFilterId)} style={secondaryButtonStyle}>
                        <RefreshCw size={13} style={logsLoading ? { marginRight: 6, verticalAlign: 'middle', animation: 'spin 1s linear infinite' } : { marginRight: 6, verticalAlign: 'middle' }} />
                        Rafraichir
                    </button>
                </div>
            </div>

            {logsLoading ? (
                <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>Chargement...</div>
            ) : logs.length === 0 ? (
                <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>
                    Aucun appel API enregistre pour le filtre courant.
                </div>
            ) : (
                <div style={{
                    border: '1px solid var(--border, #2a2a3e)',
                    borderRadius: 14,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1fr 90px 90px auto',
                        minWidth: 490,
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--border, #2a2a3e)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-secondary, #9ca3af)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}>
                        <span>Statut</span>
                        <span>Endpoint</span>
                        <span>Methode</span>
                        <span>Latence</span>
                        <span>Date</span>
                    </div>
                    {logs.map(log => {
                        const isError = log.status_code >= 400
                        const isExpanded = expandedLogIds.has(log.id)
                        const toggleLog = () => {
                            if (!isError) return
                            setExpandedLogIds(prev => {
                                const next = new Set(prev)
                                if (next.has(log.id)) next.delete(log.id)
                                else next.add(log.id)
                                return next
                            })
                        }
                        return (
                            <div key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <div
                                    onClick={toggleLog}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '80px 1fr 90px 90px auto',
                                        minWidth: 490,
                                        padding: '10px 16px',
                                        fontSize: 13,
                                        alignItems: 'center',
                                        cursor: isError ? 'pointer' : 'default',
                                    }}
                                >
                                    <span style={{ color: statusColor(log.status_code), fontWeight: 700, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 5 }}>
                                        {log.status_code}
                                        {isError && <span style={{ fontSize: 10, opacity: 0.7 }}>{isExpanded ? '▲' : '▼'}</span>}
                                    </span>
                                    <span style={{ color: 'var(--text-primary, #fff)', fontFamily: 'monospace', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {log.endpoint}
                                    </span>
                                    <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 12 }}>
                                        {log.method}
                                    </span>
                                    <span style={{ color: log.response_ms > 2000 ? '#f59e0b' : 'var(--text-secondary, #9ca3af)', fontSize: 12 }}>
                                        {log.response_ms}ms
                                    </span>
                                    <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 11, whiteSpace: 'nowrap' }}>
                                        {formatTime(log.created_at)}
                                    </span>
                                </div>
                                {isError && isExpanded && (
                                    <div style={{
                                        padding: '8px 16px 12px',
                                        background: 'rgba(239,68,68,0.05)',
                                        borderTop: '1px solid rgba(239,68,68,0.15)',
                                    }}>
                                        <div style={{ fontSize: 11, color: '#fca5a5', marginBottom: 6, fontWeight: 600 }}>
                                            Payload de la requete
                                        </div>
                                        <pre style={{
                                            margin: 0,
                                            fontSize: 11,
                                            color: '#fde68a',
                                            background: 'rgba(0,0,0,0.3)',
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            overflowX: 'auto',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all',
                                            lineHeight: 1.5,
                                        }}>
                                            {log.request_body ? JSON.stringify(log.request_body, null, 2) : '(aucun payload enregistre)'}
                                        </pre>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)', marginTop: 6 }}>
                                            IP : {log.ip_address || '—'} · Agent : {log.agent_id ? log.agent_id.slice(0, 8) + '…' : '—'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
