import { NextResponse } from 'next/server'

export async function POST() {
    const response = NextResponse.json({ ok: true })
    response.cookies.set('android_app_dismissed', '1', {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 an
        httpOnly: false,
        sameSite: 'lax',
    })
    return response
}
