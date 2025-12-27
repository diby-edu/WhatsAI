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

        const { data: buckets, error } = await supabase.storage.listBuckets()

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            })
        }

        return NextResponse.json({
            success: true,
            buckets: buckets?.length || 0,
            bucketNames: buckets?.map(b => b.name) || []
        })
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message || 'Erreur de connexion au storage'
        })
    }
}
