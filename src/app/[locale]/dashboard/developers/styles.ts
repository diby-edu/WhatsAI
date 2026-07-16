import type { CSSProperties } from 'react'
import type { ScopeMode } from './types'

export const sectionStyle: CSSProperties = {
    background: 'var(--card-bg, #1a1a2e)',
    border: '1px solid var(--border, #2a2a3e)',
    borderRadius: 16,
    padding: 24,
}

export const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--input-bg, #0f0f1a)',
    border: '1px solid var(--border, #2a2a3e)',
    borderRadius: 8,
    color: 'var(--text-primary, #fff)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
}

export const secondaryButtonStyle: CSSProperties = {
    padding: '10px 14px',
    background: 'transparent',
    border: '1px solid var(--border, #2a2a3e)',
    borderRadius: 8,
    color: 'var(--text-secondary, #9ca3af)',
    cursor: 'pointer',
    fontSize: 13,
}

export const primaryButtonStyle: CSSProperties = {
    padding: '10px 16px',
    background: '#25d366',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
}

export function normalizeScopeMode(allowedAgentIds: string[] | null | undefined): ScopeMode {
    return allowedAgentIds && allowedAgentIds.length > 0 ? 'selected' : 'all'
}
