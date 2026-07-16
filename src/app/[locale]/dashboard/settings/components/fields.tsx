'use client'

import { motion } from 'framer-motion'
import { Loader2, Check, Save } from 'lucide-react'

// Input Field Component
export function InputField({
    label,
    icon: Icon,
    value,
    onChange,
    placeholder,
    disabled,
    type = 'text',
    suffix,
    autoComplete
}: {
    label: string
    icon: any
    value: string
    onChange?: (value: string) => void
    placeholder?: string
    disabled?: boolean
    type?: string
    suffix?: React.ReactNode
    autoComplete?: string
}) {
    return (
        <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>{label}</label>
            <div style={{ position: 'relative' }}>
                <Icon style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b' }} />
                <input
                    type={type}
                    value={value || ''}
                    onChange={(e) => onChange?.(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    style={{
                        width: '100%',
                        padding: '12px 12px 12px 44px',
                        paddingRight: suffix ? 44 : 12,
                        background: disabled ? 'rgba(51, 65, 85, 0.3)' : 'rgba(30, 41, 59, 0.8)',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        borderRadius: 10,
                        color: disabled ? '#64748b' : 'white',
                        fontSize: 14,
                        cursor: disabled ? 'not-allowed' : 'text'
                    }}
                />
                {suffix && (
                    <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                        {suffix}
                    </div>
                )}
            </div>
        </div>
    )
}

// Toggle Option Component
export function ToggleOption({
    label,
    description,
    checked,
    onChange
}: {
    label: string
    description: string
    checked: boolean
    onChange: (value: boolean) => void
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: 12
        }}>
            <div>
                <h4 style={{ color: 'white', fontWeight: 500, marginBottom: 4 }}>{label}</h4>
                <p style={{ color: '#64748b', fontSize: 13 }}>{description}</p>
            </div>
            <button
                onClick={() => onChange(!checked)}
                style={{
                    width: 52,
                    height: 28,
                    borderRadius: 14,
                    border: 'none',
                    background: checked ? '#10b981' : 'rgba(100, 116, 139, 0.3)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s'
                }}
            >
                <motion.div
                    animate={{ x: checked ? 24 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: 2
                    }}
                />
            </button>
        </div>
    )
}

// Save Button Component
export function SaveButton({
    saving,
    saved,
    onClick,
    label,
    messages
}: {
    saving: boolean
    saved: boolean
    onClick: () => void
    label?: string
    messages: {
        save: string,
        saving: string,
        saved: string
    }
}) {
    return (
        <button
            onClick={onClick}
            disabled={saving}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 28,
                padding: '14px 28px',
                background: saved
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none',
                borderRadius: 12,
                color: 'white',
                fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer',
                transition: 'all 0.2s'
            }}
        >
            {saving ? (
                <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
            ) : saved ? (
                <Check style={{ width: 18, height: 18 }} />
            ) : (
                <Save style={{ width: 18, height: 18 }} />
            )}
            {saving ? messages.saving : saved ? messages.saved : label || messages.save}
        </button>
    )
}
