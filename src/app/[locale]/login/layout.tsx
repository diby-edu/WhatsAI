import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('Auth.login.meta')
    return {
        title: t('title'),
        description: t('description'),
        robots: { index: false, follow: false },
    }
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
