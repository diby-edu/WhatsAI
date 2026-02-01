
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectOrders() {
    console.log('🔍 Fetching last 5 orders with items and products...');

    // Mimic the query from api/orders/route.ts
    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            id,
            order_number,
            status,
            items:order_items(
                id,
                product_id,
                product_name,
                product:products(
                    id,
                    name,
                    product_type
                )
            )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('❌ Error fetching orders:', error);
        return;
    }

    console.log(JSON.stringify(orders, null, 2));
}

inspectOrders();
