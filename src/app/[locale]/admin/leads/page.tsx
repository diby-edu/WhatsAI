'use client'

import { Target } from 'lucide-react'

export default function AdminLeadsPage() {
    return (
        <div style={{ padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Target style={{ width: 20, height: 20, color: 'white' }} />
                </div>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>Leads</h1>
                    <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Contacts capturés par les agents IA</p>
                </div>
            </div>

            <div style={{
                marginTop: 48,
                padding: 48,
                borderRadius: 16,
                border: '1px dashed rgba(148, 163, 184, 0.2)',
                textAlign: 'center',
                color: '#475569'
            }}>
                <Target style={{ width: 40, height: 40, marginBottom: 16, opacity: 0.3, margin: '0 auto 16px' }} />
                <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Module en cours de développement</p>
                <p style={{ fontSize: 13, color: '#334155' }}>
                    Cette section affichera tous les leads capturés par les agents WhatsApp IA.
                </p>
            </div>
        </div>
    )
}
