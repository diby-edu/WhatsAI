import { successResponse } from '@/lib/api-utils'

export async function GET() {
    return successResponse({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    })
}
