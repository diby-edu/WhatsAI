export const SEGMENT_OPTIONS = [
    { value: 'all', label: 'Tous les utilisateurs' },
    { value: 'free', label: 'Free uniquement' },
    { value: 'starter', label: 'Starter uniquement' },
    { value: 'pro', label: 'Pro uniquement' },
    { value: 'business', label: 'Business uniquement' },
    { value: 'agent_connected', label: 'Au moins un agent connecte' },
    { value: 'agent_paused', label: 'Au moins un agent en pause' },
    { value: 'agent_reconnect_required', label: 'Au moins un agent a reconnecter' },
    { value: 'agent_qr_ready', label: 'Au moins un agent a connecter' },
    { value: 'individual', label: 'Sélection individuelle' },
]

export const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
    free: { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' },
    starter: { bg: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa' },
    pro: { bg: 'rgba(16, 185, 129, 0.1)', color: '#34d399' },
    business: { bg: 'rgba(168, 85, 247, 0.1)', color: '#c084fc' },
}

export function isAgentStatusSegment(value: string) {
    return value.startsWith('agent_')
}

export function getSegmentHint(value: string) {
    switch (value) {
        case 'agent_connected':
            return 'Cible les utilisateurs ayant au moins un agent actuellement connecte.'
        case 'agent_paused':
            return 'Cible les utilisateurs ayant au moins un agent en pause.'
        case 'agent_reconnect_required':
            return 'Cible les utilisateurs ayant au moins un agent a reconnecter.'
        case 'agent_qr_ready':
            return 'Cible les utilisateurs ayant au moins un agent en attente de premiere connexion.'
        default:
            return null
    }
}
