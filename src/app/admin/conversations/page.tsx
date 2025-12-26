'use client'

import { motion } from 'framer-motion'
import { MessageSquare, Search, Filter, Eye, User, Bot } from 'lucide-react'

const conversations = [
    { id: 1, phone: '+225 07 12 34 56', user: 'Kouassi Jean', agent: 'Agent Commercial', messages: 45, lastMessage: 'Merci pour votre réponse !', date: 'Il y a 2h' },
    { id: 2, phone: '+225 05 98 76 54', user: 'Aminata Diallo', agent: 'Support Client', messages: 23, lastMessage: 'D\'accord, je vais essayer', date: 'Il y a 4h' },
    { id: 3, phone: '+225 01 23 45 67', user: 'Mohamed Traoré', agent: 'Agent Immobilier', messages: 67, lastMessage: 'Quand puis-je visiter ?', date: 'Il y a 6h' },
    { id: 4, phone: '+225 07 65 43 21', user: 'Fatou Konaté', agent: 'Bot E-commerce', messages: 12, lastMessage: 'Je veux commander le produit', date: 'Il y a 8h' },
]

export default function AdminConversationsPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
                <h1 style={{ fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>Conversations</h1>
                <p style={{ color: '#94a3b8' }}>{conversations.length} conversations actives</p>
            </div>

            <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 20,
                overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {['Contact', 'Agent', 'Messages', 'Dernier message', 'Date', 'Actions'].map(h => (
                                <th key={h} style={{
                                    padding: '16px 24px',
                                    textAlign: 'left',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: '#64748b',
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {conversations.map((conv) => (
                            <tr key={conv.id}>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 12,
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <User style={{ width: 20, height: 20, color: 'white' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 500, color: 'white' }}>{conv.phone}</div>
                                            <div style={{ fontSize: 12, color: '#64748b' }}>{conv.user}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Bot style={{ width: 16, height: 16, color: '#a855f7' }} />
                                        <span style={{ color: '#e2e8f0' }}>{conv.agent}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: 'white', fontWeight: 500 }}>
                                    {conv.messages}
                                </td>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#94a3b8', maxWidth: 200 }}>
                                    {conv.lastMessage}
                                </td>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#64748b' }}>
                                    {conv.date}
                                </td>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                    <button style={{
                                        padding: 8,
                                        borderRadius: 10,
                                        background: 'rgba(51, 65, 85, 0.5)',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}>
                                        <Eye style={{ width: 18, height: 18, color: '#94a3b8' }} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
