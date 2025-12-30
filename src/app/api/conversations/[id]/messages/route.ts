
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
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

        const body = await request.json()
        const { message } = body

        if (!message || typeof message !== 'string') {
            return NextResponse.json({ error: 'Message content required' }, { status: 400 })
        }

        // Get conversation details to find agent and phone number
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select(`
                *,
                agent:agents(id, name)
            `)
            .eq('id', conversationId)
            .single()

        if (convError || !conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
        }

        // Store message in database with 'pending' status for the worker to pick up
        const { data: newMessage, error: msgError } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                role: 'assistant',
                content: message,
                message_type: 'text',
                status: 'pending', // Worker will pick this up
                metadata: {
                    manual_response: true
                }
            })
            .select()
            .single()

        if (msgError) {
            return NextResponse.json({ error: 'Failed to queue message' }, { status: 500 })
        }

        // Update conversation last message immediately for UI responsiveness
        await supabase
            .from('conversations')
            .update({
                last_message: message,
                last_message_at: new Date().toISOString(),
                bot_paused: true
            })
            .eq('id', conversationId)

        return NextResponse.json({
            success: true,
            data: {
                message: newMessage,
                bot_paused: true
            }
        })

        if (msgError) {
            console.error('Error saving manual message:', msgError)
            // Still return success if message was sent on WA, just warn
        }

        // Update conversation last message
        await supabase
            .from('conversations')
            .update({
                last_message: message,
                last_message_at: new Date().toISOString(),
                // Optionally pause bot on manual reply
                bot_paused: true
            })
            .eq('id', conversationId)

        return NextResponse.json({
            success: true,
            data: {
                message: newMessage,
                bot_paused: true
            }
        })

    } catch (error) {
        console.error('Error sending manual message:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
