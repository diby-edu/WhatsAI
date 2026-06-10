import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function errorResponse(message: string, status = 400) {
    return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json()

        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return errorResponse('Email invalide', 400)
        }

        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options)
                        })
                    },
                },
            }
        )

        const { error } = await supabase.auth.resend({ type: 'signup', email })

        if (error) {
            console.warn('[AUTH RESEND] error for', email, '—', error.message, '| status:', error.status)

            // Rate limit
            if (
                error.status === 429 ||
                error.message.toLowerCase().includes('rate limit') ||
                error.message.toLowerCase().includes('security purposes') ||
                error.message.toLowerCase().includes('too many')
            ) {
                return errorResponse('Trop de tentatives. Attendez quelques minutes avant de réessayer.', 429)
            }

            // Email already confirmed
            if (
                error.message.toLowerCase().includes('already confirmed') ||
                error.message.toLowerCase().includes('already verified')
            ) {
                return errorResponse('Votre email est déjà confirmé. Connectez-vous directement.', 409)
            }

            return errorResponse(error.message, 400)
        }

        console.info('[AUTH RESEND] confirmation email sent to', email)
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[AUTH RESEND] unexpected error:', err)
        return errorResponse('Une erreur est survenue', 500)
    }
}
