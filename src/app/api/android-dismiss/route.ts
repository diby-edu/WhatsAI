import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === '1'

    const response = NextResponse.json({ ok: true })

    if (permanent) {
        // Cookie 1 an — "Continuer dans le navigateur" cliqué
        response.cookies.set('android_app_dismissed', '1', {
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
            httpOnly: false,
            sameSite: 'lax',
        })
    } else {
        // Cookie temporaire — pose au chargement de la page pour eviter boucle infinie.
        // maxAge explicite (24h) plutot qu'un cookie de session : dans une WebView
        // Capacitor (app Android native), le process peut etre tue par l'OS en
        // arriere-plan puis relance sans que ce soit une vraie "fermeture du
        // navigateur" — un cookie de session pur serait alors perdu au redemarrage
        // et pourrait declencher la redirection /download-app dans l'app elle-meme.
        response.cookies.set('android_app_session', '1', {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24,
        })
    }

    return response
}
