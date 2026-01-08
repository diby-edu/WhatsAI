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

    console.log(`Found ${products.length} products matching search.`)

    products.forEach((p, index) => {
        console.log(`\n--- PRODUCT #${index + 1} ---`)
        console.log('Name:', p.name)
        console.log('ID:', p.id)
        console.log('Image URL (single):', p.image_url)
        console.log('Images Array (multi):', JSON.stringify(p.images))
        console.log('Created At:', p.created_at)
        console.log('User ID:', p.user_id)
    })
}

main()
