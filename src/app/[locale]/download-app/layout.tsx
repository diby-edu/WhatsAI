import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Télécharger l\'app WazzapAI',
    description: 'Téléchargez l\'application WazzapAI sur Android et gérez votre business WhatsApp depuis votre téléphone.',
    openGraph: {
        title: 'Télécharger l\'app WazzapAI',
        description: 'Gérez vos agents IA WhatsApp depuis votre mobile. Disponible sur le Play Store.',
    },
}

export default function DownloadAppLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
