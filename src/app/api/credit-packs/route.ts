import { createClient } from '@/lib/supabase/server'

// Fallback packs (prices in FCFA) — used if DB table unavailable
const FALLBACK_PACKS = [
    { id: 'boost_mini', name: 'Boost Mini', credits: 200,   price: 3000,   savings: 0 },
    { id: 'boost_s',    name: 'Boost S',    credits: 500,   price: 7000,   savings: 7 },
    { id: 'boost_m',    name: 'Boost M',    credits: 2000,  price: 25000,  savings: 17 },
    { id: 'boost_l',    name: 'Boost L',    credits: 5000,  price: 55000,  savings: 27 },
    { id: 'boost_xl',   name: 'Boost XL',   credits: 12000, price: 110000, savings: 39 },
]

// GET - List active credit packs for public (prices in FCFA)
export async function GET() {
    try {
        const supabase = await createClient()

        const { data: packs, error } = await supabase
            .from('credit_packs')
            .select('id, name, credits, price, savings')
            .eq('is_active', true)
            .order('display_order', { ascending: true })

        if (error) {
            if (error.code === '42P01') {
                return Response.json({ packs: FALLBACK_PACKS })
            }
            throw error
        }

        return Response.json({ packs: packs || [] })
    } catch (error) {
        console.error('Error fetching credit packs:', error)
        return Response.json({ packs: FALLBACK_PACKS })
    }
}
