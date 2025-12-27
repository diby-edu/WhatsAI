import { Navbar, Hero, Features, HowItWorks, Pricing, FAQ, Footer, WhatsAppButton } from '@/components/landing'

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <Footer />
      <WhatsAppButton />
    </main>
  )
}
