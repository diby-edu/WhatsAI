import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role for admin operations
function getSupabaseAdmin() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase credentials missing')
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    )
}

// GET - List all credit packs
export async function GET() {
    try {
        const supabase = getSupabaseAdmin()
        const { data: packs, error } = await supabase
            .from('credit_packs')
            .select('*')
            .order('display_order', { ascending: true })

        if (error) throw error

        return Response.json({ packs })
    } catch (error) {
        console.error('Error fetching credit packs:', error)
        return Response.json({ error: 'Failed to fetch credit packs' }, { status: 500 })
    }
}

// POST - Create new credit pack
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, credits, price, savings = 0, is_active = true, display_order = 0 } = body

        if (!name || !credits || !price) {
            return Response.json({ error: 'Name, credits and price are required' }, { status: 400 })
        }

        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('credit_packs')
            .insert({ name, credits, price, savings, is_active, display_order })
            .select()
            .single()

        if (error) throw error

        return Response.json({ pack: data, message: 'Credit pack created' })
    } catch (error) {
        console.error('Error creating credit pack:', error)
        return Response.json({ error: 'Failed to create credit pack' }, { status: 500 })
    }
}

// PUT - Update credit pack
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, ...updates } = body

        if (!id) {
            return Response.json({ error: 'Pack ID is required' }, { status: 400 })
        }

        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('credit_packs')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        return Response.json({ pack: data, message: 'Credit pack updated' })
    } catch (error) {
        console.error('Error updating credit pack:', error)
        return Response.json({ error: 'Failed to update credit pack' }, { status: 500 })
    }
}

// DELETE - Delete credit pack
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return Response.json({ error: 'Pack ID is required' }, { status: 400 })
        }

        const supabase = getSupabaseAdmin()
        const { error } = await supabase
            .from('credit_packs')
            .delete()
            .eq('id', id)

        if (error) throw error

        return Response.json({ message: 'Credit pack deleted' })
    } catch (error) {
        console.error('Error deleting credit pack:', error)
        return Response.json({ error: 'Failed to delete credit pack' }, { status: 500 })
    }
}
