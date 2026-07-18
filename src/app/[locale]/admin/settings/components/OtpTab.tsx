import type { Dispatch, SetStateAction } from 'react'
import { MessageCircle, Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react'

interface OtpTabProps {
    otpStatus: 'not_configured' | 'connecting' | 'qr_ready' | 'connected' | 'disconnected'
    otpQrCode: string | null
    otpPhone: string | null
    otpLoading: boolean
    handleOtpConnect: () => void
    handleOtpDisconnect: () => void
    otpResetPhone: string
    setOtpResetPhone: Dispatch<SetStateAction<string>>
    handleOtpResetLimit: () => void
    otpResetLoading: boolean
    otpResetMsg: string | null
}

export function OtpTab({
    otpStatus,
    otpQrCode,
    otpPhone,
    otpLoading,
    handleOtpConnect,
    handleOtpDisconnect,
    otpResetPhone,
    setOtpResetPhone,
    handleOtpResetLimit,
    otpResetLoading,
    otpResetMsg,
}: OtpTabProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{
                padding: '20px 24px',
                borderRadius: 16,
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(148,163,184,0.12)',
            }}>
                <h3 style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MessageCircle size={18} style={{ color: '#10b981' }} />
                    Connexion WhatsApp — Envoi OTP
                </h3>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
                    Ce numéro dédié envoie les codes de vérification aux nouveaux utilisateurs. Il ne répond jamais aux messages reçus.
                </p>

                {/* Statut */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                    {otpStatus === 'connected' ? (
                        <>
                            <Wifi size={16} style={{ color: '#10b981' }} />
                            <span style={{ color: '#10b981', fontWeight: 600, fontSize: 14 }}>Connecté</span>
                            {otpPhone && <span style={{ color: '#64748b', fontSize: 13 }}>— {otpPhone}</span>}
                        </>
                    ) : otpStatus === 'qr_ready' ? (
                        <>
                            <Loader2 size={16} style={{ color: '#f59e0b', animation: 'spin 1s linear infinite' }} />
                            <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 14 }}>Scannez le QR code ci-dessous</span>
                        </>
                    ) : otpStatus === 'connecting' ? (
                        <>
                            <Loader2 size={16} style={{ color: '#64748b', animation: 'spin 1s linear infinite' }} />
                            <span style={{ color: '#64748b', fontWeight: 600, fontSize: 14 }}>Génération du QR code…</span>
                        </>
                    ) : (
                        <>
                            <WifiOff size={16} style={{ color: '#64748b' }} />
                            <span style={{ color: '#64748b', fontWeight: 600, fontSize: 14 }}>
                                {otpStatus === 'not_configured' ? 'Non configuré' : 'Déconnecté'}
                            </span>
                        </>
                    )}
                </div>

                {/* QR Code */}
                {otpQrCode && (otpStatus === 'qr_ready' || otpStatus === 'connecting') && (
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <div style={{
                            display: 'inline-block',
                            padding: 16,
                            background: 'white',
                            borderRadius: 16,
                            marginBottom: 12,
                        }}>
                            <img src={otpQrCode} alt="QR Code WhatsApp OTP" width={200} height={200} style={{ display: 'block' }} />
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: 13 }}>
                            Ouvrez WhatsApp sur la SIM dédiée → <strong>Appareils liés</strong> → <strong>Lier un appareil</strong>
                        </p>
                    </div>
                )}

                {/* Boutons */}
                <div style={{ display: 'flex', gap: 10 }}>
                    {otpStatus !== 'connected' && (
                        <button
                            onClick={handleOtpConnect}
                            disabled={otpLoading}
                            style={{
                                padding: '10px 20px', borderRadius: 10, border: 'none',
                                background: 'linear-gradient(135deg, #10b981, #0891b2)',
                                color: 'white', fontWeight: 600, fontSize: 13,
                                cursor: otpLoading ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}
                        >
                            {otpLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
                            {otpStatus === 'not_configured' ? 'Initialiser' : 'Afficher le QR code'}
                        </button>
                    )}
                    {otpStatus === 'connected' && (
                        <button
                            onClick={handleOtpDisconnect}
                            disabled={otpLoading}
                            style={{
                                padding: '10px 20px', borderRadius: 10,
                                border: '1px solid rgba(239,68,68,0.3)',
                                background: 'rgba(239,68,68,0.08)',
                                color: '#f87171', fontWeight: 600, fontSize: 13,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                            }}
                        >
                            <WifiOff size={14} /> Déconnecter
                        </button>
                    )}
                </div>

                {/* Reset tentatives OTP */}
                <div style={{
                    marginTop: 8,
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(15,23,42,0.4)',
                    border: '1px solid rgba(100,116,139,0.2)',
                }}>
                    <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13, marginBottom: 8 }}>
                        Réinitialiser les tentatives d'un utilisateur
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                        Si un utilisateur est bloqué ("Trop de tentatives"), saisissez son numéro international et cliquez Réinitialiser.
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            type="text"
                            value={otpResetPhone}
                            onChange={e => setOtpResetPhone(e.target.value)}
                            placeholder="ex: 225747094746"
                            style={{
                                flex: 1, padding: '8px 12px', borderRadius: 8,
                                background: 'rgba(15,23,42,0.6)',
                                border: '1px solid rgba(100,116,139,0.3)',
                                color: 'white', fontSize: 13,
                            }}
                        />
                        <button
                            onClick={handleOtpResetLimit}
                            disabled={otpResetLoading || !otpResetPhone.trim()}
                            style={{
                                padding: '8px 16px', borderRadius: 8,
                                background: otpResetLoading ? 'rgba(100,116,139,0.3)' : 'rgba(59,130,246,0.2)',
                                color: '#60a5fa', fontWeight: 600, fontSize: 13,
                                cursor: otpResetLoading || !otpResetPhone.trim() ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6,
                                border: '1px solid rgba(59,130,246,0.3)',
                            }}
                        >
                            {otpResetLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
                            Réinitialiser
                        </button>
                    </div>
                    {otpResetMsg && (
                        <div style={{
                            marginTop: 8, fontSize: 12, padding: '6px 10px', borderRadius: 6,
                            background: otpResetMsg.startsWith('Erreur') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                            color: otpResetMsg.startsWith('Erreur') ? '#f87171' : '#34d399',
                            border: `1px solid ${otpResetMsg.startsWith('Erreur') ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                        }}>
                            {otpResetMsg}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
