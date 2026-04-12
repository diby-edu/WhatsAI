'use client'

import { useState, useEffect } from 'react'
import { Navbar, Hero, HowItWorks, Pricing, FAQ, Footer, Problem, BeforeAfter, BusinessTypes, ROICalculator, SocialProof, WhatsAppCommunity, FinalCTA } from '@/components/landing'
import { MessageCircle, X } from 'lucide-react'

const COMMUNITY_LINK = 'https://chat.whatsapp.com/E7vbXhqS0o5D4Wn2lrdDGi'

function FloatingCommunityBadge() {
  const [visible, setVisible] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('comm_badge_closed') === '1') {
      setClosed(true)
      return
    }
    const timer = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  if (closed || !visible) return null

  return (
    <div style={{
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
      maxWidth: 260
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
      `}</style>
    </div>
  )
}

export default function Home() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "WazzapAI",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web, cloud-based",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "XOF",
              "description": "Free trial available"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.9",
              "ratingCount": "124"
            },
            "description": "The Ultimate WhatsApp Automation Platform powered by AI. Transform your WhatsApp into a 24/7 Sales Machine.",
            "author": {
              "@type": "Organization",
              "name": "WazzapAI Global"
            }
          })
        }}
      />
      <Navbar />
      <Hero />
      <Problem />
      <BeforeAfter />
      <HowItWorks />
      <BusinessTypes />
      <ROICalculator />
      <Pricing />
      <SocialProof />
      <WhatsAppCommunity />
      <FAQ />
      <FinalCTA />
      <Footer />
      <FloatingCommunityBadge />
    </main>
  )
}
