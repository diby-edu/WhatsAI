import { createClient } from '@/lib/supabase/server'

// GET - List active credit packs for public
export async function GET() {
    try {
        const supabase = await createClient()

        const { data: packs, error } = await supabase
            .from('credit_packs')
            .select('id, name, credits, price, savings')
            .eq('is_active', true)
            .order('display_order', { ascending: true })

        if (error) {
            // If table doesn't exist, return default packs
            if (error.code === '42P01') {
                return Response.json({
                    packs: [
                        { id: 'pack_500', name: 'Pack 500', credits: 500, price: 5000, savings: 0 },
                        { id: 'pack_1000', name: 'Pack 1000', credits: 1000, price: 9000, savings: 10 },
                        { id: 'pack_2500', name: 'Pack 2500', credits: 2500, price: 20000, savings: 20 },
                        { id: 'pack_5000', name: 'Pack 5000', credits: 5000, price: 35000, savings: 30 },
                    ]
                })
            }
            throw error
        }

        return Response.json({ packs: packs || [] })
    } catch (error) {
        console.error('Error fetching credit packs:', error)
        // Return default packs on error
        return Response.json({
            packs: [
                { id: 'pack_500', name: 'Pack 500', credits: 500, price: 5000, savings: 0 },
                { id: 'pack_1000', name: 'Pack 1000', credits: 1000, price: 9000, savings: 10 },
                { id: 'pack_2500', name: 'Pack 2500', credits: 2500, price: 20000, savings: 20 },
                { id: 'pack_5000', name: 'Pack 5000', credits: 5000, price: 35000, savings: 30 },
            ]
        })
    }
}
