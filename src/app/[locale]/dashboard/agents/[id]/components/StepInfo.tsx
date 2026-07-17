import type { Dispatch, SetStateAction } from 'react'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import type { useToast } from '@/components/ui/Toast'
import type { AgentFormData } from '../types'

function sanitizeEscalationPhone(value: string): string {
    const raw = value || ''
    const digits = raw.replace(/[^\d]/g, '')
    return raw.startsWith('+') ? '+' + digits : digits
}

interface StepInfoProps {
    formData: AgentFormData
    setFormData: Dispatch<SetStateAction<AgentFormData>>
    toast: ReturnType<typeof useToast>
    highlightEscalation: boolean
    setHighlightEscalation: Dispatch<SetStateAction<boolean>>
}

export function StepInfo({ formData, setFormData, toast, highlightEscalation, setHighlightEscalation }: StepInfoProps) {
    const inputStyle = {
        width: '100%',
        padding: 12,
        borderRadius: 12,
        border: '1px solid rgba(148, 163, 184, 0.1)',
        background: 'rgba(30, 41, 59, 0.5)',
        color: 'white',
        outline: 'none'
    }

    const getLocation = () => {
        if (!navigator.geolocation) { toast.error('Géolocalisation non supportée'); return }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                }))
            },
            (err) => toast.error('Erreur de localisation : ' + err.message)
        )
    }

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Name */}
            <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                    Nom du Bot / Agent *
                </label>
                <input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Marius le Vendeur"
                    style={inputStyle}
                />
            </div>

            {/* Description with examples */}
            <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                    Description / Personnalité
                </label>
                <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Décrivez brièvement la personnalité de votre agent..."
                    rows={3}
                    style={{ ...inputStyle, resize: 'none' }}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8', background: 'rgba(30, 41, 59, 0.3)', padding: 12, borderRadius: 8 }}>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>Dites-moi qui je suis ! Exemples :</p>
                    <ul style={{ listStyle: 'disc', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <li>"Assistant chaleureux pour une pizzeria, je tutoie les clients et je propose toujours le supplément fromage."</li>
                        <li>"Réceptionniste d'hôtel de luxe, poli et distingué, je demande toujours les dates de séjour."</li>
                        <li>"Vendeur expert en smartphone, technique mais accessible, je pousse à l'achat."</li>
                    </ul>
                </div>
            </div>

            {/* Toggle boutique en ligne */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 10 }}>
                <input
                    type="checkbox"
                    id="is_online_only"
                    checked={formData.is_online_only}
                    onChange={(e) => setFormData({ ...formData, is_online_only: e.target.checked })}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#818cf8' }}
                />
                <label htmlFor="is_online_only" style={{ cursor: 'pointer', color: '#e2e8f0', fontSize: 14 }}>
                    Boutique 100% en ligne (pas d'adresse physique)
                    <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 2 }}>L'IA ne mentionnera jamais d'adresse physique.</span>
                </label>
            </div>

            {/* Address with MapPin icon */}
            <div style={{ display: formData.is_online_only ? 'none' : undefined }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                    Adresse Physique
                </label>
                <div style={{ position: 'relative' }}>
                    <input
                        value={formData.business_address}
                        onChange={e => setFormData({ ...formData, business_address: e.target.value })}
                        placeholder="Ex: Abidjan, Cocody..."
                        style={inputStyle}
                    />
                    <MapPin size={16} style={{ position: 'absolute', right: 12, top: 12, color: '#94a3b8' }} />
                </div>
            </div>

            {/* Lat/Lon with Ma position link */}
            <div className="agent-grid-2" style={{ display: formData.is_online_only ? 'none' : undefined }}>
                <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                        Latitude
                    </label>
                    <input
                        type="number"
                        step="any"
                        value={formData.latitude || ''}
                        onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                        placeholder="0.0000"
                        style={inputStyle}
                    />
                </div>
                <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                        Longitude
                        <span onClick={getLocation} style={{ color: '#10b981', cursor: 'pointer', fontSize: 12 }}>Ma position</span>
                    </label>
                    <input
                        type="number"
                        step="any"
                        value={formData.longitude || ''}
                        onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                        placeholder="0.0000"
                        style={inputStyle}
                    />
                </div>
            </div>

            {/* Phone + Site Web */}
            <div className="agent-grid-2">
                <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                        Numéro d'Escalade / SAV
                    </label>
                    <input
                        value={formData.escalation_phone}
                        onChange={e => { setFormData({ ...formData, escalation_phone: sanitizeEscalationPhone(e.target.value) }); setHighlightEscalation(false) }}

                        placeholder="+225 07 XX XX XX XX"
                        style={{
                            ...inputStyle,
                            border: highlightEscalation ? '2px solid #fbbf24' : inputStyle.border,
                            boxShadow: highlightEscalation ? '0 0 15px rgba(251, 191, 36, 0.3)' : 'none',
                            transition: 'all 0.3s ease'
                        }}
                    />
                    {highlightEscalation && (
                        <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-amber-400 text-xs font-bold mt-1"
                        >
                            👈 C'est ici !
                        </motion.div>
                    )}
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                        Numéro donné au client en cas de problème (SAV).
                    </p>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                        Site Web
                    </label>
                    <input
                        value={formData.social_links.website}
                        onChange={e => setFormData({ ...formData, social_links: { ...formData.social_links, website: e.target.value } })}
                        placeholder="https://..."
                        style={inputStyle}
                    />
                </div>
            </div>
        </motion.div>
    )
}
