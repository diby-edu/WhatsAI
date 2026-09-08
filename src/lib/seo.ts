import type { Metadata } from 'next'

// Audit F-13 : centralise le calcul des balises canonical + hreflang (fr/en)
// pour les pages publiques, afin d'éviter le contenu dupliqué entre /fr et /en
// et d'indiquer à Google l'URL de référence de chaque page.
const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'

export function pageAlternates(locale: string, path: string = ''): Metadata['alternates'] {
    const clean = path === '/' ? '' : path
    return {
        canonical: `${BASE}/${locale}${clean}`,
        languages: {
            fr: `${BASE}/fr${clean}`,
            en: `${BASE}/en${clean}`,
            'x-default': `${BASE}/fr${clean}`,
        },
    }
}
