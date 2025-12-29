'use client'

import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function HomeButton() {
    const pathname = usePathname()

    // Ne pas afficher sur la page d'accueil ou le dashboard
    // Note: On vérifie aussi si pathname existe pour éviter les erreurs de build
    if (!pathname || pathname === '/' || pathname.startsWith('/dashboard')) {
        return null
    }

    return (
        <Link
            href="/"
            style={{
                position: 'fixed',
                top: 24,
                left: 24,
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textDecoration: 'none',
                background: 'rgba(15, 23, 42, 0.6)',
                padding: '8px 16px',
                borderRadius: 16,
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
            <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <MessageCircle style={{ width: 18, height: 18, color: 'white' }} />
            </div>
            <span style={{
                fontWeight: 700,
                color: 'white',
                fontSize: 16,
                background: 'linear-gradient(135deg, #10b981, #34d399)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
            }}>
                WhatsAI
            </span>
        </Link>
    )
}
