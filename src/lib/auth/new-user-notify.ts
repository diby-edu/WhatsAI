import { createAdminClient } from '@/lib/api-utils'
import { notifyAdmins } from '@/lib/notifications/admin-notify'

type MaybeNotifyNewUserParams = {
    userId: string
    userEmail?: string | null
    userName?: string | null
}

export async function maybeNotifyNewUserOnce({
    userId,
    userEmail,
    userName,
}: MaybeNotifyNewUserParams): Promise<boolean> {
    try {
        const supabase = createAdminClient()
        const now = new Date().toISOString()

        const { data: profile, error } = await supabase
            .from('profiles')
            .update({ new_user_notified_at: now })
            .eq('id', userId)
            .eq('role', 'user')
            .eq('onboarding_completed', false)
            .is('new_user_notified_at', null)
            .select('id, email, full_name')
            .maybeSingle()

        if (error) {
            console.error('maybeNotifyNewUserOnce update error:', error)
            return false
        }

        if (!profile) {
            return false
        }

        await notifyAdmins('new_user', {
            userId: profile.id,
            userEmail: profile.email || userEmail || undefined,
            userName: profile.full_name || userName || undefined,
        })

        return true
    } catch (error) {
        console.error('maybeNotifyNewUserOnce error:', error)
        return false
    }
}
