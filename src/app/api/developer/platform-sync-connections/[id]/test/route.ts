import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser } from '@/lib/api-utils'
import { decryptCredentials } from '@/lib/api/platform-sync-crypto'
import {
    testProviderConnection,
    type PlatformSyncProvider,
    validatePlatformSyncCredentials,
} from '@/lib/api/platform-sync-providers'

export const dynamic = 'force-dynamic'

// POST /api/developer/platform-sync-connections/[id]/test
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: connection, error: connectionError } = await admin
        .from('api_platform_sync_connections')
        .select('id, provider, credentials_encrypted')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

    if (connectionError) {
        return NextResponse.json({ error: connectionError.message }, { status: 500 })
    }
    if (!connection) {
        return NextResponse.json({ error: 'Sync connection not found' }, { status: 404 })
    }

    let statusCode = 500
    let summary = 'Unknown test error'
    let ok = false

    try {
        const provider = connection.provider as PlatformSyncProvider
        const decrypted = decryptCredentials(connection.credentials_encrypted)
        const validated = validatePlatformSyncCredentials(provider, decrypted)
        if (!validated.ok) {
            throw new Error(validated.error)
        }
        const testResult = await testProviderConnection(
            provider,
            validated.credentials
        )
        statusCode = testResult.statusCode
        summary = testResult.summary
        ok = testResult.ok
    } catch (error: any) {
        statusCode = 500
        summary = error?.message || 'Unable to test provider connection'
    }

    await admin
        .from('api_platform_sync_connections')
        .update({
            last_tested_at: new Date().toISOString(),
            last_test_status_code: statusCode,
            last_test_error: ok ? null : summary,
        })
        .eq('id', id)
        .eq('user_id', user.id)

    if (!ok) {
        return NextResponse.json({
            error: summary,
            data: {
                ok,
                status_code: statusCode,
            },
        }, { status: 400 })
    }

    return NextResponse.json({
        data: {
            ok,
            status_code: statusCode,
            summary,
        },
    })
}
