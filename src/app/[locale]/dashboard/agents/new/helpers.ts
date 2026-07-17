export function isValidEscalationPhone(value: string): boolean {
    return /^\+\d{6,15}$/.test((value || '').trim())
}
