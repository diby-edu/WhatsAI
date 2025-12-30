
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const { id: conversationId } = params

    try {
        const supabase = await createClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch conversation details with agent info
        const { data: conversation, error } = await supabase
            .from('conversations')
            .select(`
                *,
                agent:agents(id, name)
            `)
            .eq('id', conversationId)
            // Ensure user owns the agent
            .eq('agent.user_id', user.id)
            .single()

        if (error || !conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        // Fetch messages for this conversation
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })

        return NextResponse.json({
            data: {
                conversation,
                messages: messages || []
            }
        })

    } catch (error) {
        console.error('Error fetching conversation:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}


export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const { id: conversationId } = params

    // This is for Toggling Pause status (existing functionality)
    // To handle manual message sending, see [id]/messages/route.ts

    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const { id: conversationId } = params

    try {
        const supabase = await createClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify ownership via agent
        // First get the conversation to check agent ownership
        const { data: conversation, error: checkError } = await supabase
            .from('conversations')
            .select(`
                *,
                agent:agents(id, user_id)
            `)
            .eq('id', conversationId)
            .single()

        if (checkError || !conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        if (conversation.agent.user_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Delete messages first (cascade should handle this, but being safe)
        const { error: msgDeleteError } = await supabase
            .from('messages')
            .delete()
            .eq('conversation_id', conversationId)

        if (msgDeleteError) {
            console.error('Error deleting messages:', msgDeleteError)
            return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 })
        }

        // Delete conversation
        const { error: deleteError } = await supabase
            .from('conversations')
            .delete()
            .eq('id', conversationId)

        if (deleteError) {
            console.error('Error deleting conversation:', deleteError)
            return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Error deleting conversation:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
