import { Navbar, Hero, Features, HowItWorks, Pricing, FAQ, Footer } from '@/components/landing'

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
              "ratingValue": "4.8",
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
      <HowItWorks />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  )
}
