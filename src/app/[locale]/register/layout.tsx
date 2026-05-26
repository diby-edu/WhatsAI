import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Créer un compte — WazzapAI',
    description: 'Inscrivez-vous gratuitement sur WazzapAI et commencez à automatiser vos ventes et votre support client sur WhatsApp grâce à l\'IA.',
    openGraph: {
        title: 'Créer un compte — WazzapAI',
        description: 'Automatisez WhatsApp avec l\'IA. Inscription gratuite, aucune carte bancaire requise.',
    },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
