import type { Dispatch, SetStateAction } from 'react'
import { motion } from 'framer-motion'
import { Smartphone, QrCode, Loader2, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'
import { QR_CONNECTION_ERROR_MESSAGE } from '../constants'
import type { AgentFormData } from '../types'

interface StepWhatsappProps {
    formData: AgentFormData
    whatsappStatus: 'idle' | 'connecting' | 'qr_ready' | 'connected' | 'error'
    connectionMode: 'qr' | 'pairing_code'
    setConnectionMode: Dispatch<SetStateAction<'qr' | 'pairing_code'>>
    pairingPhone: string
    setPairingPhone: Dispatch<SetStateAction<string>>
    connectWhatsApp: () => void
    countdown: number | null
    cancelConnection: () => void
    qrCode: string | null
    pairingCode: string | null
    whatsappErrorMessage: string | null
    connectedPhone: string | null
    disconnectWhatsApp: () => void
    slowConnectionHint: boolean
}

export function StepWhatsapp({
    formData,
    whatsappStatus,
    connectionMode,
    setConnectionMode,
    pairingPhone,
    setPairingPhone,
    connectWhatsApp,
    countdown,
    cancelConnection,
    qrCode,
    pairingCode,
    whatsappErrorMessage,
    connectedPhone,
    disconnectWhatsApp,
    slowConnectionHint,
}: StepWhatsappProps) {
    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 20 }}>
            {!formData.is_active && (
                <div style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)', fontSize: 13, color: '#fde68a', width: '100%', maxWidth: 460 }}>
                    Agent désactivé. Activez-le d&apos;abord pour lancer ou reprendre un scan WhatsApp.
                </div>
            )}

            {whatsappStatus !== 'connected' && (
                <div style={{ width: '100%', maxWidth: 460, border: '1px solid rgba(148,163,184,0.25)', background: 'rgba(15,23,42,0.55)', borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 10 }}>Mode de connexion</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button type="button" onClick={() => setConnectionMode('qr')} style={{ borderRadius: 10, border: connectionMode === 'qr' ? '1px solid rgba(52,211,153,0.7)' : '1px solid rgba(71,85,105,0.8)', background: connectionMode === 'qr' ? 'rgba(16,185,129,0.15)' : 'rgba(30,41,59,0.7)', color: connectionMode === 'qr' ? '#a7f3d0' : '#cbd5e1', padding: '10px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            QR code (ordinateur)
                        </button>
                        <button type="button" onClick={() => setConnectionMode('pairing_code')} style={{ borderRadius: 10, border: connectionMode === 'pairing_code' ? '1px solid rgba(52,211,153,0.7)' : '1px solid rgba(71,85,105,0.8)', background: connectionMode === 'pairing_code' ? 'rgba(16,185,129,0.15)' : 'rgba(30,41,59,0.7)', color: connectionMode === 'pairing_code' ? '#a7f3d0' : '#cbd5e1', padding: '10px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            Code de liaison (mobile)
                        </button>
                    </div>
                    {connectionMode === 'pairing_code' && (
                        <div style={{ marginTop: 10 }}>
                            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Numéro WhatsApp (avec indicatif)</label>
                            <input type="tel" value={pairingPhone} onChange={(e) => setPairingPhone(e.target.value)} placeholder="+2250700000000" style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(71,85,105,0.8)', background: 'rgba(30,41,59,0.7)', color: 'white', padding: '10px 12px', fontSize: 13, outline: 'none' }} />
                        </div>
                    )}
                </div>
            )}

            {whatsappStatus === 'idle' && (
                <>
                    <button onClick={connectWhatsApp} disabled={!formData.is_active} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: 15, fontWeight: 600, color: 'white', background: formData.is_active ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(51,65,85,0.5)', border: 'none', borderRadius: 12, cursor: formData.is_active ? 'pointer' : 'not-allowed', opacity: formData.is_active ? 1 : 0.5 }}>
                        {connectionMode === 'pairing_code' ? <Smartphone style={{ width: 20, height: 20 }} /> : <QrCode style={{ width: 20, height: 20 }} />}
                        {connectionMode === 'pairing_code' ? 'Générer le code de liaison' : 'Générer le QR Code'}
                    </button>
                    <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {connectionMode === 'pairing_code' ? <Smartphone style={{ width: 40, height: 40, color: '#34d399' }} /> : <QrCode style={{ width: 40, height: 40, color: '#34d399' }} />}
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 600, color: 'white', textAlign: 'center' }}>Connexion WhatsApp</h3>
                    <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: 400 }}>
                        {connectionMode === 'pairing_code' ? 'Générez un code de liaison pour connecter cet agent depuis ce même téléphone.' : 'Scannez le QR code avec WhatsApp pour connecter ce numéro à votre agent.'}
                    </p>
                </>
            )}

            {whatsappStatus === 'connecting' && (
                <>
                    <Loader2 style={{ width: 48, height: 48, color: '#34d399', animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: '#94a3b8' }}>{connectionMode === 'pairing_code' ? 'Génération du code de liaison...' : 'Démarrage du service WhatsApp...'}</p>
                    {countdown !== null && (
                        <div style={{ fontSize: 13, color: countdown > 0 ? '#64748b' : '#f59e0b', textAlign: 'center' }}>
                            {countdown > 0 ? `${countdown}s` : 'Prend plus de temps que prévu...'}
                        </div>
                    )}
                    {slowConnectionHint && (
                        <p style={{ color: '#fbbf24', fontSize: 13, textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
                            Ça prend plus de temps que prévu. Il arrive que WhatsApp ait un problème temporaire au moment d&apos;enregistrer un nouvel appareil — patientez ou réessayez dans quelques minutes si ça continue.
                        </p>
                    )}
                    <button onClick={cancelConnection} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', borderRadius: 10, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                </>
            )}

            {whatsappStatus === 'qr_ready' && (qrCode || pairingCode) && (
                <>
                    {qrCode ? (
                        <>
                            <div style={{ background: 'white', padding: 16, borderRadius: 16 }}>
                                <img src={qrCode} alt="QR Code WhatsApp" style={{ width: 250, height: 250 }} />
                            </div>
                            <p style={{ color: '#94a3b8', textAlign: 'center' }}>Scannez avec WhatsApp (Appareils connectés)</p>
                            <p style={{ color: '#64748b', textAlign: 'center', fontSize: 12, maxWidth: 280 }}>Le QR se renouvelle automatiquement toutes les ~20 s.</p>
                        </>
                    ) : (
                        <div style={{ width: '100%', maxWidth: 380, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.12)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
                            <p style={{ color: '#a7f3d0', fontSize: 13, marginBottom: 8 }}>Code de liaison WhatsApp</p>
                            <p style={{ color: 'white', fontSize: 30, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>{pairingCode}</p>
                            <p style={{ color: '#d1fae5', fontSize: 12, lineHeight: 1.5 }}>Sur votre téléphone : WhatsApp &gt; Appareils connectés &gt; Connecter un appareil &gt; Entrer le code.</p>
                        </div>
                    )}
                    {countdown !== null && (
                        <div style={{ fontSize: 12, color: countdown > 0 ? '#64748b' : '#f59e0b', textAlign: 'center', marginTop: 4 }}>
                            {countdown > 0 ? `Expiration dans ${countdown}s` : 'Essayez de régénérer'}
                        </div>
                    )}
                    <button onClick={cancelConnection} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', borderRadius: 10, padding: '7px 18px', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                </>
            )}

            {whatsappStatus === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, background: 'rgba(239,68,68,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertCircle style={{ width: 40, height: 40, color: '#f87171' }} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>Connexion interrompue</div>
                    <div style={{ maxWidth: 400, fontSize: 14, color: '#fca5a5' }}>{whatsappErrorMessage || QR_CONNECTION_ERROR_MESSAGE}</div>
                    <div style={{ maxWidth: 400, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(71,85,105,0.5)', background: 'rgba(30,41,59,0.6)', fontSize: 13, color: '#cbd5e1' }}>
                        Si WhatsApp affiche &quot;Impossible de connecter l&apos;appareil&quot;, régénérez un nouveau QR code puis rescannez-le.
                    </div>
                    <button onClick={connectWhatsApp} disabled={!formData.is_active} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: 15, fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
                        <RefreshCw style={{ width: 20, height: 20 }} /> {connectionMode === 'pairing_code' ? 'Régénérer un nouveau code' : 'Régénérer un nouveau QR code'}
                    </button>
                </div>
            )}

            {whatsappStatus === 'connected' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 80, height: 80, background: 'rgba(16,185,129,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 style={{ width: 40, height: 40, color: '#34d399' }} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399' }}>Connecté !</div>
                    <div style={{ color: '#94a3b8' }}>{connectedPhone}</div>
                    <button onClick={disconnectWhatsApp} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', marginTop: 8 }}>Déconnecter</button>
                </div>
            )}
        </motion.div>
    )
}
