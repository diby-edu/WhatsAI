import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Public API to get active subscription plans
export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data: plans, error } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('price_fcfa', { ascending: true })

        if (error) {
            console.error('Error fetching plans:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Transform plans for frontend consumption
        const transformedPlans = (plans || []).map(plan => ({
            id: plan.id,
            name: plan.name,
            price: plan.price_fcfa,
            credits: plan.credits_included,
            features: plan.features || [],
            billing_cycle: plan.billing_cycle || 'monthly',
            max_agents: plan.max_agents || 1,
            max_whatsapp_numbers: plan.max_whatsapp_numbers || 1,
            is_popular: plan.is_popular || false,
            description: plan.description || ''
        }))

        return NextResponse.json({ plans: transformedPlans })
    } catch (err: any) {
        console.error('Error:', err)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
