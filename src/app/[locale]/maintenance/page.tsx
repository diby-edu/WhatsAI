export default function MaintenancePage() {
    return (
        <div style={{
            minHeight: '100vh',
            background: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, sans-serif',
        }}>
            <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
                <div style={{ fontSize: 64, marginBottom: 24 }}>🔧</div>
                <h1 style={{ color: '#ffffff', fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
                    Maintenance en cours
                </h1>
                <p style={{ color: '#9ca3af', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
                    Notre plateforme est temporairement indisponible pour une maintenance technique.
                    <br /><br />
                    Nous travaillons activement à rétablir le service dans les meilleurs délais.
                </p>
                <p style={{ color: '#4b5563', fontSize: 14 }}>
                    Merci de votre compréhension — L'équipe WhatsAI
                </p>
            </div>
        </div>
    )
}
