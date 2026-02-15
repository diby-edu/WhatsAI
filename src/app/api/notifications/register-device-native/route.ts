import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role to bypass RLS for native app token registration
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const { token, platform } = await request.json();

        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 400 });
        }

        console.log(`[Native FCM] Registering token: ${token.substring(0, 20)}... platform: ${platform}`);

        // Check if token already exists
        const { data: existing } = await supabaseAdmin
            .from('device_tokens')
            .select('id, user_id')
            .eq('token', token)
            .single();

        if (existing) {
            // Token already exists, just update the timestamp
            const { error } = await supabaseAdmin
                .from('device_tokens')
                .update({
                    platform: platform || 'android',
                    updated_at: new Date().toISOString()
                })
                .eq('token', token);

            if (error) {
                console.error('[Native FCM] Error updating token:', error);
                return NextResponse.json({ error: 'Failed to update token' }, { status: 500 });
            }

            console.log('[Native FCM] Token updated successfully');
            return NextResponse.json({ success: true, action: 'updated' });
        }

        // Insert new token without user_id (will be claimed later when user logs in)
        const { error } = await supabaseAdmin
            .from('device_tokens')
            .insert({
                token,
                platform: platform || 'android',
                user_id: null, // Will be associated with user later
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('[Native FCM] Error saving token:', error);

            // If it's a unique constraint error, the token was already inserted
            if (error.code === '23505') {
                return NextResponse.json({ success: true, action: 'already_exists' });
            }

            return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
        }

        console.log('[Native FCM] Token saved successfully');
        return NextResponse.json({ success: true, action: 'created' });
    } catch (error) {
        console.error('[Native FCM] Register device error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
