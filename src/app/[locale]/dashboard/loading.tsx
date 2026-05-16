export default function DashboardLoading() {
    return (
        <div style={{
            padding: '24px',
            backgroundColor: '#0f172a',
            minHeight: '100vh',
        }}>
            {/* Top bar skeleton */}
            <div style={{
                height: 56,
                borderRadius: 12,
                backgroundColor: '#1e293b',
                marginBottom: 32,
                animation: 'pulse 1.5s ease-in-out infinite',
            }} />

            {/* Stats row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 16,
                marginBottom: 32,
            }}>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{
                        height: 96,
                        borderRadius: 16,
                        backgroundColor: '#1e293b',
                        animation: 'pulse 1.5s ease-in-out infinite',
                        animationDelay: `${i * 0.1}s`,
                    }} />
                ))}
            </div>

            {/* Content blocks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{
                    height: 240,
                    borderRadius: 16,
                    backgroundColor: '#1e293b',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    animationDelay: '0.2s',
                }} />
                <div style={{
                    height: 240,
                    borderRadius: 16,
                    backgroundColor: '#1e293b',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    animationDelay: '0.3s',
                }} />
            </div>

            {/* Table skeleton */}
            <div style={{
                borderRadius: 16,
                backgroundColor: '#1e293b',
                padding: 20,
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: '0.4s',
            }}>
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} style={{
                        height: 48,
                        borderRadius: 8,
                        backgroundColor: 'rgba(148,163,184,0.08)',
                        marginBottom: i < 5 ? 8 : 0,
                    }} />
                ))}
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    )
}
