import type { MetadataRoute } from 'next'

// Audit F-11 : /robots.txt renvoyait un 404 (happé par le préfixe de locale).
// Cette route metadata Next.js le sert désormais et interdit explicitement
// l'indexation des zones privées / techniques.
export default function robots(): MetadataRoute.Robots {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/api',
                '/admin',
                '/dashboard',
                '/onboarding',
                '/complete-profile',
                '/confirm-email',
                '/reset-password',
                '/pay',
                '/payment',
            ],
        },
        sitemap: `${base}/sitemap.xml`,
        host: base,
    }
}
