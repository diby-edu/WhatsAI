const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function run() {
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL missing in .env.local')
        process.exit(1)
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })

    try {
        await client.connect()
        const query = process.argv[2]
        if (!query) {
            console.error('❌ No query provided')
            process.exit(1)
        }
        console.log('📝 Running:', query)
        const res = await client.query(query)
        console.table(res.rows)
    } catch (err) {
        console.error('❌ Error:', err.message)
    } finally {
        await client.end()
    }
}

run()
