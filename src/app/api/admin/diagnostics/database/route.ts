import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({
                success: false,
                error: 'Variables Supabase non configurées'
            })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        const start = Date.now()
        const { data, error } = await supabase.from('profiles').select('id').limit(1)
        const latency = Date.now() - start

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message,
                latency
            })
        }

        return NextResponse.json({
            success: true,
            latency,
            message: 'Connexion établie'
        })
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message || 'Connexion échouée'
        })
    }
}
