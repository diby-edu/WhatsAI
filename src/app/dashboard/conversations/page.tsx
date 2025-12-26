'use client'

import { motion } from 'framer-motion'
import { MessageCircle, User, Bot, Clock, Search } from 'lucide-react'

const conversations = [
    { id: 1, phone: '+225 07 12 34 56', name: 'Client 1', agent: 'Agent Commercial', messages: 12, lastMessage: 'Merci pour votre réponse !', date: 'Il y a 5 min' },
    { id: 2, phone: '+225 05 98 76 54', name: 'Client 2', agent: 'Support Client', messages: 8, lastMessage: 'D\'accord, je comprends', date: 'Il y a 15 min' },
    { id: 3, phone: '+225 01 23 45 67', name: 'Client 3', agent: 'Agent Commercial', messages: 23, lastMessage: 'Quand puis-je passer commande ?', date: 'Il y a 1h' },
]

export default function DashboardConversationsPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Mes conversations</h1>
                    <p style={{ color: '#94a3b8' }}>{conversations.length} conversations actives</p>
                </div>
                <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b' }} />
                    <input
                        placeholder="Rechercher..."
                        style={{
                            padding: '12px 12px 12px 44px',
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 14,
                            color: 'white',
                            width: 280
                        }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {conversations.map((conv, i) => (
                    <motion.div
                        key={conv.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 16,
                            padding: 20,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{
                                width: 50,
                                height: 50,
                                borderRadius: 14,
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <User style={{ width: 24, height: 24, color: 'white' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600, color: 'white' }}>{conv.phone}</span>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: 6,
                                        fontSize: 11,
                                        background: 'rgba(168, 85, 247, 0.15)',
                                        color: '#c084fc'
                                    }}>{conv.agent}</span>
                                </div>
                                <p style={{ color: '#94a3b8', fontSize: 14 }}>{conv.lastMessage}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 12, marginBottom: 4 }}>
                                    <Clock style={{ width: 12, height: 12 }} />
                                    {conv.date}
                                </div>
                                <span style={{
                                    padding: '4px 10px',
                                    borderRadius: 100,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#34d399'
                                }}>{conv.messages} msg</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
