'use client'

import { useEffect, useState, useMemo } from 'react'
import { Bot, BookOpen, ArrowRight, FileText, Search, ArrowUpDown } from 'lucide-react'
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
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<'name' | 'docs'>('name')

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

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        const result = q ? agents.filter(a => a.name.toLowerCase().includes(q)) : [...agents]
        return result.sort((a, b) =>
            sort === 'docs'
                ? (b.kb_count ?? 0) - (a.kb_count ?? 0)
                : a.name.localeCompare(b.name)
        )
    }, [agents, search, sort])

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

            {/* Search + Sort */}
            {!loading && agents.length > 0 && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#64748b', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Rechercher un agent..."
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                padding: '10px 14px 10px 36px',
                                background: 'rgba(30, 41, 59, 0.6)',
                                border: '1px solid rgba(148, 163, 184, 0.15)',
                                borderRadius: 10, color: 'white', fontSize: 14,
                                outline: 'none',
                            }}
                            onFocus={e => (e.target.style.borderColor = 'rgba(52, 211, 153, 0.4)')}
                            onBlur={e => (e.target.style.borderColor = 'rgba(148, 163, 184, 0.15)')}
                        />
                    </div>
                    <button
                        onClick={() => setSort(s => s === 'name' ? 'docs' : 'name')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                            background: 'rgba(30, 41, 59, 0.6)',
                            border: '1px solid rgba(148, 163, 184, 0.15)',
                            color: '#94a3b8', fontSize: 13, fontWeight: 500, flexShrink: 0
                        }}
                    >
                        <ArrowUpDown style={{ width: 14, height: 14 }} />
                        {sort === 'name' ? 'Nom A→Z' : 'Documents ↓'}
                    </button>
                </div>
            )}

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
            ) : filtered.length === 0 && search ? (
                <div style={{
                    textAlign: 'center', padding: '40px 24px',
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(148, 163, 184, 0.08)',
                    borderRadius: 16, color: '#64748b', fontSize: 14
                }}>
                    Aucun agent ne correspond à &quot;{search}&quot;
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map(agent => (
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
