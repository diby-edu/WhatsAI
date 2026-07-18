export interface Agent {
    id: string
    name: string
    total_conversations: number
}

export interface UserOption {
    id?: string
    email: string
    name: string
    plan: string
}

export type TabId = 'whatsapp' | 'email' | 'push' | 'ai'

export interface AiDraftEntry {
    id: string
    prompt: string
    channel: 'email' | 'push' | 'whatsapp'
    generated: Record<string, string>
    createdAt: string
}
