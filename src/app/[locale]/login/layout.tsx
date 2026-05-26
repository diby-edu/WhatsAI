import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Connexion — WazzapAI',
    description: 'Connectez-vous à votre compte WazzapAI pour gérer vos agents IA WhatsApp, vos conversations et vos ventes.',
    robots: { index: false, follow: false },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
