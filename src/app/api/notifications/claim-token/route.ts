import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/notifications/claim-token
 * Claims all unclaimed device tokens (user_id IS NULL) by assigning
 * them to the authenticated user. This is called from the dashboard
 * when a user logs in through the WebView on the Android app.
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId required' }, { status: 400 });
        }

        // Find all unclaimed tokens
        const { data: unclaimed } = await supabaseAdmin
            .from('device_tokens')
            .select('id, token')
            .is('user_id', null);

        if (!unclaimed || unclaimed.length === 0) {
            return NextResponse.json({ success: true, claimed: 0 });
        }

        // Claim them for this user
        const { error } = await supabaseAdmin
            .from('device_tokens')
            .update({ user_id: userId, updated_at: new Date().toISOString() })
            .is('user_id', null);

        if (error) {
            console.error('[Claim Token] Error:', error);
            return NextResponse.json({ error: 'Failed to claim tokens' }, { status: 500 });
        }

        console.log(`[Claim Token] Claimed ${unclaimed.length} token(s) for user ${userId}`);
        return NextResponse.json({ success: true, claimed: unclaimed.length });
    } catch (error) {
        console.error('[Claim Token] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
