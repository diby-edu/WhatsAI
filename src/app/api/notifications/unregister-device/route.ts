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

        const { token } = await request.json();

        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 400 });
        }

        // Delete device token
        const { error } = await supabase
            .from('device_tokens')
            .delete()
            .match({ user_id: user.id, token });

        if (error) {
            console.error('Error deleting device token:', error);
            return NextResponse.json({ error: 'Failed to delete token' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unregister device error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
