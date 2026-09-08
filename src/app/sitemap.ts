import type { MetadataRoute } from 'next'

// Audit F-11 : /sitemap.xml renvoyait un 404. On liste ici les pages publiques
// pour les deux locales, avec les alternates hreflang fr/en (voir aussi F-13).
export default function sitemap(): MetadataRoute.Sitemap {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'
    const publicPaths = ['', '/about', '/contact', '/privacy', '/terms', '/gdpr', '/download-app']
    const locales = ['fr', 'en'] as const
    const now = new Date()

    return locales.flatMap((locale) =>
        publicPaths.map((path) => ({
            url: `${base}/${locale}${path}`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: path === '' ? 1 : 0.6,
            alternates: {
                languages: {
                    fr: `${base}/fr${path}`,
                    en: `${base}/en${path}`,
                },
            },
        }))
    )
}
