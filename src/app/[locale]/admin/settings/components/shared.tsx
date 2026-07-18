export function ToggleSwitch({ value, onChange, color = '#10b981' }: { value: boolean, onChange: () => void, color?: string }) {
    return (
        <button
            type="button"
            onClick={onChange}
            style={{
                width: 52,
                height: 28,
                borderRadius: 14,
                background: value ? color : '#475569',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s'
            }}
        >
            <div style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: 3,
                left: value ? 27 : 3,
                transition: 'left 0.2s'
            }} />
        </button>
    )
}

export function SettingRow({ label, description, children }: { label: string, description?: string, children: React.ReactNode }) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderRadius: 12,
            background: 'rgba(15, 23, 42, 0.3)'
        }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: 'white', marginBottom: description ? 4 : 0 }}>{label}</div>
                {description && <div style={{ fontSize: 13, color: '#64748b' }}>{description}</div>}
            </div>
            <div style={{ marginLeft: 20 }}>{children}</div>
        </div>
    )
}
