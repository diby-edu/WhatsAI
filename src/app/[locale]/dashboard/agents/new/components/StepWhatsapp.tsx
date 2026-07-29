import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import type { useTranslations } from 'next-intl'
import type { useRouter } from 'next/navigation'
import { Smartphone, QrCode, Loader2, AlertCircle, RefreshCw, CheckCircle2, Bot, Globe, ArrowRight } from 'lucide-react'

interface StepWhatsappProps {
    t: ReturnType<typeof useTranslations>
    createdAgent: any
    whatsappStatus: 'idle' | 'connecting' | 'qr_ready' | 'connected' | 'error'
    connectionMode: 'qr' | 'pairing_code'
    setConnectionMode: Dispatch<SetStateAction<'qr' | 'pairing_code'>>
    pairingPhone: string
    setPairingPhone: Dispatch<SetStateAction<string>>
    connectWhatsApp: () => void
    buttonPrimaryStyle: CSSProperties
    buttonSecondaryStyle: CSSProperties
    isSupportClient: boolean
    handleFinish: () => void
    countdown: number | null
    cancelConnection: () => void
    qrCode: string | null
    pairingCode: string | null
    connectedPhone: string | null
    isExternalSync: boolean
    router: ReturnType<typeof useRouter>
    goToKnowledgeBase: () => void
    error: string | null
    slowConnectionHint: boolean
}

export function StepWhatsapp({
    t,
    createdAgent,
    whatsappStatus,
    connectionMode,
    setConnectionMode,
    pairingPhone,
    setPairingPhone,
    connectWhatsApp,
    buttonPrimaryStyle,
    buttonSecondaryStyle,
    isSupportClient,
    handleFinish,
    countdown,
    cancelConnection,
    qrCode,
    pairingCode,
    connectedPhone,
    isExternalSync,
    router,
    goToKnowledgeBase,
    error,
    slowConnectionHint,
}: StepWhatsappProps) {
    // If agent not created yet, show prompt to create it
    if (!createdAgent) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 40, textAlign: 'center' }}>
                <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: 20,
                    background: 'rgba(251, 191, 36, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <AlertCircle style={{ width: 40, height: 40, color: '#fbbf24' }} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 600, color: 'white' }}>
                    Créez d'abord votre agent
                </h3>
                <p style={{ color: '#94a3b8', maxWidth: 400 }}>
                    Cliquez sur le bouton <strong style={{ color: '#10b981' }}>"Créer l'agent"</strong> en bas de page pour finaliser la configuration, puis vous pourrez connecter WhatsApp.
                </p>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 20 }}>
            {whatsappStatus !== 'connected' && (
                <div style={{
                    width: '100%',
                    maxWidth: 460,
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    background: 'rgba(15, 23, 42, 0.55)',
                    borderRadius: 14,
                    padding: 14
                }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 10 }}>
                        Mode de connexion
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => setConnectionMode('qr')}
                            style={{
                                borderRadius: 10,
                                border: connectionMode === 'qr' ? '1px solid rgba(52, 211, 153, 0.7)' : '1px solid rgba(71, 85, 105, 0.8)',
                                background: connectionMode === 'qr' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.7)',
                                color: connectionMode === 'qr' ? '#a7f3d0' : '#cbd5e1',
                                padding: '10px 12px',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            QR code (ordinateur)
                        </button>
                        <button
                            type="button"
                            onClick={() => setConnectionMode('pairing_code')}
                            style={{
                                borderRadius: 10,
                                border: connectionMode === 'pairing_code' ? '1px solid rgba(52, 211, 153, 0.7)' : '1px solid rgba(71, 85, 105, 0.8)',
                                background: connectionMode === 'pairing_code' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.7)',
                                color: connectionMode === 'pairing_code' ? '#a7f3d0' : '#cbd5e1',
                                padding: '10px 12px',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Code de liaison (mobile)
                        </button>
                    </div>
                    {connectionMode === 'pairing_code' && (
                        <div style={{ marginTop: 10 }}>
                            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                                Numero WhatsApp (avec indicatif)
                            </label>
                            <input
                                type="tel"
                                value={pairingPhone}
                                onChange={(e) => setPairingPhone(e.target.value)}
                                placeholder="+2250700000000"
                                style={{
                                    width: '100%',
                                    borderRadius: 10,
                                    border: '1px solid rgba(71, 85, 105, 0.8)',
                                    background: 'rgba(30, 41, 59, 0.7)',
                                    color: 'white',
                                    padding: '10px 12px',
                                    fontSize: 13,
                                    outline: 'none'
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            {whatsappStatus === 'idle' && (
                <>
                    <button
                        onClick={connectWhatsApp}
                        style={buttonPrimaryStyle}
                    >
                        {connectionMode === 'pairing_code'
                            ? <Smartphone style={{ width: 20, height: 20 }} />
                            : <QrCode style={{ width: 20, height: 20 }} />}
                        {connectionMode === 'pairing_code' ? 'Generer le code de liaison' : t('Wizard.buttons.generateQr')}
                    </button>
                    <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: 20,
                        background: 'rgba(16, 185, 129, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {connectionMode === 'pairing_code'
                            ? <Smartphone style={{ width: 40, height: 40, color: '#34d399' }} />
                            : <QrCode style={{ width: 40, height: 40, color: '#34d399' }} />}
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 600, color: 'white', textAlign: 'center' }}>
                        {t('connect.title')}
                    </h3>
                    <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: 400 }}>
                        {connectionMode === 'pairing_code'
                            ? 'Generez un code de liaison pour connecter cet agent depuis ce meme telephone.'
                            : t('connect.scanPrompt')}
                    </p>
                    {!isSupportClient && (
                        <button onClick={handleFinish} style={{ ...buttonSecondaryStyle, marginTop: 8 }}>
                            {t('Wizard.buttons.skip')}
                        </button>
                    )}
                </>
            )}

            {whatsappStatus === 'connecting' && (
                <>
                    <Loader2 style={{ width: 48, height: 48, color: '#34d399', animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: '#94a3b8' }}>
                        {connectionMode === 'pairing_code' ? 'Generation du code de liaison...' : t('connect.initialization')}
                    </p>
                    {countdown !== null && (
                        <div style={{ fontSize: 13, color: countdown > 0 ? '#64748b' : '#f59e0b', textAlign: 'center' }}>
                            {countdown > 0 ? `${countdown}s` : 'Prend plus de temps que prévu...'}
                        </div>
                    )}
                    {slowConnectionHint && (
                        <p style={{ color: '#fbbf24', fontSize: 13, textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
                            Ça prend plus de temps que prévu. Il arrive que WhatsApp ait un problème temporaire au moment d'enregistrer un nouvel appareil — patientez ou réessayez dans quelques minutes si ça continue.
                        </p>
                    )}
                    <button onClick={cancelConnection} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', borderRadius: 10, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>
                        Annuler
                    </button>
                </>
            )}

            {whatsappStatus === 'qr_ready' && (qrCode || pairingCode) && (
                <>
                    {qrCode ? (
                        <>
                            <div style={{
                                background: 'white',
                                padding: 16,
                                borderRadius: 16
                            }}>
                                <img src={qrCode} alt="QR Code WhatsApp" style={{ width: 250, height: 250 }} />
                            </div>
                            <p style={{ color: '#94a3b8', textAlign: 'center' }}>
                                {t('connect.qrInstructions.step3')}
                            </p>
                            <p style={{ color: '#64748b', textAlign: 'center', fontSize: 12, maxWidth: 280 }}>
                                Le QR se renouvelle automatiquement toutes les ~20 s.<br />
                                Si votre téléphone charge sans fin, attendez le nouveau QR et rescannez.
                            </p>
                        </>
                    ) : (
                        <div style={{
                            width: '100%',
                            maxWidth: 380,
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            background: 'rgba(16, 185, 129, 0.12)',
                            borderRadius: 14,
                            padding: 16,
                            textAlign: 'center'
                        }}>
                            <p style={{ color: '#a7f3d0', fontSize: 13, marginBottom: 8 }}>Code de liaison WhatsApp</p>
                            <p style={{ color: 'white', fontSize: 30, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>
                                {pairingCode}
                            </p>
                            <p style={{ color: '#d1fae5', fontSize: 12, lineHeight: 1.5 }}>
                                Sur votre telephone: WhatsApp &gt; Appareils connectes &gt; Connecter un appareil &gt; Entrer le code.
                            </p>
                        </div>
                    )}
                    {countdown !== null && (
                        <div style={{ fontSize: 12, color: countdown > 0 ? '#64748b' : '#f59e0b', textAlign: 'center', marginTop: 4 }}>
                            {countdown > 0 ? `Expiration dans ${countdown}s` : 'Essayez de régénérer'}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={connectWhatsApp} style={buttonSecondaryStyle}>
                            <RefreshCw style={{ width: 18, height: 18 }} />
                            {connectionMode === 'pairing_code' ? 'Regenerer le code' : t('connect.actions.regenerate')}
                        </button>
                        <button onClick={cancelConnection} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
                            Annuler
                        </button>
                    </div>
                </>
            )}

            {whatsappStatus === 'connected' && (
                <>
                    <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <CheckCircle2 style={{ width: 48, height: 48, color: '#34d399' }} />
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 600, color: 'white' }}>
                        {t('connect.connectedSuccess')} 🎉
                    </h3>
                    <p style={{ color: '#94a3b8' }}>
                        Numéro: {connectedPhone}
                    </p>
                    {!isSupportClient && (
                        <>
                            {isExternalSync ? (
                                <>
                                    <button
                                        onClick={() => router.push('/dashboard/developers?tab=platform_connections')}
                                        style={buttonPrimaryStyle}
                                    >
                                        <Globe style={{ width: 18, height: 18 }} />
                                        Configurer la connexion plateforme
                                    </button>
                                    <button
                                        onClick={handleFinish}
                                        style={buttonSecondaryStyle}
                                    >
                                        {t('Wizard.buttons.finish')}
                                        <ArrowRight style={{ width: 20, height: 20 }} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={goToKnowledgeBase}
                                        style={buttonSecondaryStyle}
                                    >
                                        <Bot style={{ width: 18, height: 18 }} />
                                        Ajouter une base de connaissance
                                    </button>
                                    <button
                                        onClick={handleFinish}
                                        style={buttonPrimaryStyle}
                                    >
                                        {t('Wizard.buttons.finish')}
                                        <ArrowRight style={{ width: 20, height: 20 }} />
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </>
            )}

            {whatsappStatus === 'error' && (
                <>
                    <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <AlertCircle style={{ width: 48, height: 48, color: '#f87171' }} />
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 600, color: 'white' }}>
                        {t('connect.error')}
                    </h3>
                    <p style={{ color: '#f87171' }}>{error}</p>
                    <button
                        onClick={connectWhatsApp}
                        style={buttonPrimaryStyle}
                    >
                        <RefreshCw style={{ width: 18, height: 18 }} />
                        {connectionMode === 'pairing_code' ? 'Regenerer le code de liaison' : t('Wizard.buttons.retry')}
                    </button>
                </>
            )}
        </div>
    )
}
