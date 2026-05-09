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
        // Cookie de session — posé au chargement de la page pour éviter boucle infinie
        response.cookies.set('android_app_session', '1', {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            // Pas de maxAge → expire à la fermeture du navigateur
        })
    }

    return response
}
