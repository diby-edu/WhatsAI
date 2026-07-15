'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'

export default function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
    const locale = useLocale()
    const pathname = usePathname()
    const router = useRouter()

    const switchLocale = () => {
        const newLocale = locale === 'fr' ? 'en' : 'fr'
        const segments = pathname.split('/')
        if (segments.length > 1 && (segments[1] === 'fr' || segments[1] === 'en')) {
            segments[1] = newLocale
            router.push(segments.join('/'))
        } else {
            router.push(`/${newLocale}${pathname}`)
        }
    }

    return (
        <button
            onClick={switchLocale}
            title={locale === 'fr' ? 'Switch to English' : 'Passer en français'}
            style={{
                padding: compact ? 8 : 10,
                borderRadius: compact ? 10 : 12,
                backgroundColor: '#1e293b',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                color: '#94a3b8',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
            }}
        >
            <Globe style={{ width: compact ? 16 : 18, height: compact ? 16 : 18 }} />
            <span>{locale === 'fr' ? 'EN' : 'FR'}</span>
        </button>
    )
}
