import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin', '/dashboard', '/api'],
        },
        sitemap: 'https://wazzapai.com/sitemap.xml',
    }
}
