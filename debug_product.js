const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function main() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    console.log('Searching for "Office Pro Plus 2021"...')
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .ilike('name', '%Office Pro Plus 2021%')

    if (error) {
        console.error('Error:', error)
        return
    }

    if (!products || products.length === 0) {
        console.error('Product not found!')
        return
    }

    const p = products[0]
    console.log('Product Found:', p.name)
    console.log('ID:', p.id)
    console.log('Variants (Raw):', JSON.stringify(p.variants, null, 2))
    console.log('Type:', typeof p.variants)
    console.log('Length:', p.variants ? p.variants.length : 'N/A')
}

main()
