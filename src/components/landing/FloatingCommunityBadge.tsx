'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, X } from 'lucide-react'

const COMMUNITY_LINK = 'https://chat.whatsapp.com/E7vbXhqS0o5D4Wn2lrdDGi'

// Extrait de [locale]/page.tsx (audit F-13) pour que la page d'accueil puisse
// redevenir un Server Component et exporter generateMetadata (canonical/hreflang).
export default function FloatingCommunityBadge() {
  const [visible, setVisible] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    // Si l'utilisateur a déjà fermé le badge dans cette session, on ne l'affiche
    // pas : on n'arme simplement pas le timer (visible reste false). On évite ainsi
    // un setState synchrone dans l'effet (règle React Compiler).
    if (sessionStorage.getItem('comm_badge_closed') === '1') {
      return
    }
    const timer = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  if (closed || !visible) return null

  return (
    <div className="floating-community-badge" style={{
      position: 'fixed',
      bottom: 24,
      left: 24,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 18px',
      borderRadius: 14,
      background: 'linear-gradient(135deg, #25D366, #128C7E)',
      boxShadow: '0 8px 32px rgba(37, 211, 102, 0.4)',
      animation: 'slideInUp 0.4s ease',
      maxWidth: 'min(260px, calc(100vw - 120px))'
    }}>
      <MessageCircle style={{ width: 22, height: 22, color: 'white', flexShrink: 0 }} />
      <a
        href={COMMUNITY_LINK}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: 'white',
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: 14,
          lineHeight: 1.3,
          flex: 1
        }}
      >
        Rejoindre la communauté
      </a>
      <button
        onClick={() => {
          setClosed(true)
          sessionStorage.setItem('comm_badge_closed', '1')
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.7)',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0
        }}
      >
        <X style={{ width: 16, height: 16 }} />
      </button>
      <style jsx global>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .floating-community-badge {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
