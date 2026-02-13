import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { token, platform } = await request.json();

        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 400 });
        }

        // Upsert device token (update if exists, insert if new)
        const { error } = await supabase
            .from('device_tokens')
            .upsert({
                user_id: user.id,
                token,
                platform: platform || 'android',
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'token'
            });

        if (error) {
            console.error('Error saving device token:', error);
            return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Register device error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
