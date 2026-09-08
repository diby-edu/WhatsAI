import type { Metadata } from 'next'
import { Navbar, Hero, Features, HowItWorks, Pricing, FAQ, Footer, Problem, BeforeAfter, BusinessTypes, ROICalculator, SocialProof, WhatsAppCommunity, FinalCTA, ApiSection } from '@/components/landing'
import FloatingCommunityBadge from '@/components/landing/FloatingCommunityBadge'
import { pageAlternates } from '@/lib/seo'

// Audit F-13 : page d'accueil redevenue Server Component pour exposer les
// balises canonical + hreflang (fr/en). Le badge communauté (interactif) a été
// extrait dans FloatingCommunityBadge (client).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    alternates: pageAlternates(locale, '/'),
  }
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
      <Features />
      <Problem />
      <BeforeAfter />
      <HowItWorks />
      <BusinessTypes />
      <ROICalculator />
      <ApiSection />
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
