'use client'

import { useEffect, useState } from 'react'
import { Bot, BookOpen, ArrowRight, FileText } from 'lucide-react'
import Link from 'next/link'
import { useLocale } from 'next-intl'

interface Agent {
    id: string
    name: string
    source_id: string
    kb_count?: number
}

export default function KnowledgePage() {
    const locale = useLocale()
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/agents')
            .then(r => r.json())
            .then(async d => {
                const list: Agent[] = d.data?.agents || d.agents || []
                // Charger le nombre de documents KB pour chaque agent
                const withCounts = await Promise.all(
                    list.map(async (agent) => {
                        try {
                            const r = await fetch(`/api/knowledge?agentId=${agent.id}`)
                            const j = await r.json()
                            return { ...agent, kb_count: (j.data?.documents || j.documents || []).length }
                        } catch {
                            return { ...agent, kb_count: 0 }
                        }
                    })
                )
                setAgents(withCounts)
            })
            .catch(() => setAgents([]))
            .finally(() => setLoading(false))
    }, [])

    return (
        <div style={{ padding: 'clamp(16px, 4vw, 32px)', maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 14,
                        background: 'rgba(16, 185, 129, 0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <BookOpen style={{ width: 22, height: 22, color: '#34d399' }} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, color: 'white', fontSize: 22, fontWeight: 700 }}>
                            Base de connaissances
                        </h1>
                        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
                            Gérez les connaissances de chaque agent
                        </p>
                    </div>
                </div>
            </div>

            {/* Agents list */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{
                            height: 88, borderRadius: 16,
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.08)',
                            animation: 'pulse 1.5s ease-in-out infinite'
                        }} />
                    ))}
                </div>
            ) : agents.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '64px 24px',
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(148, 163, 184, 0.08)',
                    borderRadius: 20,
                }}>
                    <Bot style={{ width: 48, height: 48, color: '#334155', margin: '0 auto 16px' }} />
                    <p style={{ color: '#64748b', margin: 0, fontSize: 15 }}>
                        Aucun agent. Créez un agent d&apos;abord.
                    </p>
                    <Link href={`/${locale}/dashboard/agents`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        marginTop: 16, padding: '10px 20px', borderRadius: 10,
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white', fontWeight: 600, fontSize: 14, textDecoration: 'none'
                    }}>
                        Créer un agent <ArrowRight style={{ width: 14, height: 14 }} />
                    </Link>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {agents.map(agent => (
                        <Link
                            key={agent.id}
                            href={`/${locale}/dashboard/agents/${agent.id}/knowledge`}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 16,
                                padding: '20px 24px', borderRadius: 16, textDecoration: 'none',
                                background: 'rgba(30, 41, 59, 0.6)',
                                border: '1px solid rgba(148, 163, 184, 0.08)',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(52, 211, 153, 0.3)'
                                ;(e.currentTarget as HTMLElement).style.background = 'rgba(16, 185, 129, 0.06)'
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(148, 163, 184, 0.08)'
                                ;(e.currentTarget as HTMLElement).style.background = 'rgba(30, 41, 59, 0.6)'
                            }}
                        >
                            {/* Avatar */}
                            <div style={{
                                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                                background: 'rgba(59, 130, 246, 0.12)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Bot style={{ width: 24, height: 24, color: '#60a5fa' }} />
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: 'white', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                                    {agent.name}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
                                    <FileText style={{ width: 13, height: 13 }} />
                                    <span>{agent.kb_count ?? 0} document{(agent.kb_count ?? 0) !== 1 ? 's' : ''}</span>
                                </div>
                            </div>

                            {/* CTA */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                color: '#34d399', fontSize: 13, fontWeight: 600, flexShrink: 0
                            }}>
                                Gérer <ArrowRight style={{ width: 14, height: 14 }} />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
