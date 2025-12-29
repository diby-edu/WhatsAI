import { Navbar, Hero, Features, HowItWorks, Pricing, FAQ, Footer } from '@/components/landing'

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
    </main>
  )
}
