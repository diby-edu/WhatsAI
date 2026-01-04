'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Loader2,
    Upload,
    X,
    MapPin,
    Clock,
    Zap,
    Shield,
    QrCode,
    Smartphone,
    Globe,
    Facebook,
    AlertCircle,
    Copy,
    RefreshCw,
    Map,
    Bot,
    Languages,
    MessageSquare,
    Link as LinkIcon
} from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useTranslations } from 'next-intl'
import QRCode from 'qrcode'

const STEPS = [
    { id: 'identity', title: 'Informations', icon: MapPin },
    { id: 'availability', title: 'Horaires', icon: Clock },
    { id: 'personality', title: 'Personnalité', icon: Zap },
    { id: 'rules', title: 'Règles', icon: Shield },
    { id: 'connect', title: 'Connexion', icon: QrCode }
]

export default function NewAgentPage() {
    const t = useTranslations('Agents.Wizard')
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // State
    const [currentStep, setCurrentStep] = useState(0)
    const [uploading, setUploading] = useState(false)
    const [createdAgentId, setCreatedAgentId] = useState<string | null>(null)
    const [qrCode, setQrCode] = useState('')
    const [whatsappStatus, setWhatsappStatus] = useState('idle')
    const [connectedPhone, setConnectedPhone] = useState('')
    const [conflictStatus, setConflictStatus] = useState<'idle' | 'checking' | 'safe' | 'conflict' | 'error'>('idle')
    const [conflictReason, setConflictReason] = useState('')
    const [saving, setSaving] = useState(false)

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        business_name: '',
        business_address: '',
        latitude: '',
        longitude: '',
        contact_phone: '',
        site_url: '',
        facebook_url: '',
        custom_rules: '',
        agent_tone: 'friendly',
        agent_goal: 'sales',
        avatar_url: '',
        business_hours: {
            monday: { open: '09:00', close: '18:00', closed: false },
            tuesday: { open: '09:00', close: '18:00', closed: false },
            wednesday: { open: '09:00', close: '18:00', closed: false },
            thursday: { open: '09:00', close: '18:00', closed: false },
            friday: { open: '09:00', close: '18:00', closed: false },
            saturday: { open: '10:00', close: '16:00', closed: false },
            sunday: { open: '00:00', close: '00:00', closed: true }
        }
    })

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Helpers (Omitting non-render logic for brevity as it remains same)
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return
        setUploading(true)
        try {
            const file = e.target.files[0]
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `avatars/${fileName}`
            const { error: uploadError } = await supabase.storage.from('files').upload(filePath, file)
            if (uploadError) throw uploadError
            const { data: publicUrl } = supabase.storage.from('files').getPublicUrl(filePath)
            setFormData({ ...formData, avatar_url: publicUrl.publicUrl })
        } catch (error) { alert('Erreur upload') } finally { setUploading(false) }
    }

    const checkConflict = async () => { /* Same as before */
        if (!formData.custom_rules || formData.custom_rules.length < 10) return
        setConflictStatus('checking')
        try {
            const res = await fetch('/api/internal/analyze-conflict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    structured_data: {
                        address: formData.business_address,
                        hours: formData.business_hours,
                        phone: formData.contact_phone
                    },
                    custom_rules_text: formData.custom_rules
                })
            })
            const data = await res.json()
            if (data.conflict) {
                setConflictStatus('conflict')
                setConflictReason(data.reason)
            } else {
                setConflictStatus('safe')
            }
        } catch (e) {
            setConflictStatus('error')
        }
    }

    const getLocation = () => { /* Same as before */
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: pos.coords.latitude.toString(),
                    longitude: pos.coords.longitude.toString()
                }))
            }, () => alert("Impossible de récupérer la position."))
        }
    }

    const handleSave = async (silent = false) => {
        if (!silent) setSaving(true)
        try {
            const url = createdAgentId ? `/api/agents/${createdAgentId}` : '/api/agents'
            const method = createdAgentId ? 'PATCH' : 'POST'
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            if (method === 'POST') setCreatedAgentId(data.agent?.id || data.id)
            if (!silent) alert('Sauvegardé !')
        } catch (e) {
            console.error(e)
            if (!silent) alert('Erreur sauvegarde')
        } finally {
            if (!silent) setSaving(false)
        }
    }

    const connectWhatsApp = async () => { /* Same as before */
        if (!createdAgentId) return
        setWhatsappStatus('loading')
        try {
            const res = await fetch('/api/whatsapp/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: createdAgentId })
            })
            const data = await res.json()
            if (data.qr) {
                setQrCode(await QRCode.toDataURL(data.qr))
                setWhatsappStatus('qr_ready')
                pollStatus()
            }
        } catch (error) { setWhatsappStatus('error') }
    }

    const pollStatus = () => { /* Same as before */
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/agents/${createdAgentId}`)
                const data = await res.json()
                if (data.whatsapp_status === 'connected') {
                    setWhatsappStatus('connected')
                    setConnectedPhone(data.whatsapp_jid?.split('@')[0] || '')
                    clearInterval(interval)
                }
            } catch (e) { }
        }, 3000)
    }

    // --- RENDER ---

    const renderStep = () => {
        switch (currentStep) {
            case 0: // IDENTITY
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        {/* Avatar */}
                        <div className="flex justify-center mb-6">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-32 h-32 rounded-full border-2 border-dashed border-slate-700 hover:border-emerald-500 flex items-center justify-center cursor-pointer overflow-hidden relative group transition-all bg-slate-800/50"
                            >
                                {formData.avatar_url ? (
                                    <img src={formData.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center p-2">
                                        {uploading ? <Loader2 className="animate-spin mx-auto text-emerald-500" /> : <Upload className="mx-auto text-slate-500 mb-1 group-hover:text-emerald-500" />}
                                        <span className="text-xs text-slate-400">Ajouter Logo</span>
                                    </div>
                                )}
                                <input ref={fileInputRef} type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                            </div>
                        </div>

                        {/* Fields (Cleaned up to be standard) */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-300 font-medium mb-2">Nom de l'agent *</label>
                                <input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-600"
                                    placeholder="Ex: Marius le Vendeur"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-300 font-medium mb-2">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-600 resize-none h-24"
                                    placeholder="Décrivez brièvement le rôle de cet agent..."
                                />
                            </div>
                            <div>
                                <label className="block text-slate-300 font-medium mb-2">Adresse Physique</label>
                                <input
                                    value={formData.business_address}
                                    onChange={e => setFormData({ ...formData, business_address: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-600"
                                    placeholder="Ex: Abidjan, Cocody Riviera 2"
                                />
                            </div>

                            {/* GPS Group */}
                            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-slate-300 font-medium text-sm">Coordonnées GPS (Optionnel)</label>
                                    <button onClick={getLocation} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                        <Map size={12} /> Ma position
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="number"
                                        placeholder="Latitude"
                                        value={formData.latitude}
                                        onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                                        className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Longitude"
                                        value={formData.longitude}
                                        onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                                        className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-300 font-medium mb-2">Site Web</label>
                                    <input
                                        value={formData.site_url}
                                        onChange={e => setFormData({ ...formData, site_url: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none placeholder:text-slate-600"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-300 font-medium mb-2">Téléphone Support</label>
                                    <input
                                        value={formData.contact_phone}
                                        onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none placeholder:text-slate-600"
                                        placeholder="+225..."
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )

            case 1: // HOURS
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-white">Horaires d'Ouverture</h3>
                            <p className="text-slate-400 text-sm">Définissez les plages de réponse.</p>
                        </div>
                        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-2">
                            {Object.entries(formData.business_hours).map(([day, hours]) => (
                                <div key={day} className="flex items-center justify-between p-2 hover:bg-slate-800/50 rounded-lg transition-colors">
                                    <span className="capitalize w-24 text-slate-300 font-medium">{t(`WeekDays.${day}`)}</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={!hours.closed}
                                            onChange={e => setFormData({
                                                ...formData,
                                                business_hours: { ...formData.business_hours, [day]: { ...hours, closed: !e.target.checked } }
                                            })}
                                            className="w-4 h-4 rounded border-slate-600 text-emerald-500 bg-slate-700"
                                        />
                                        {!hours.closed ? (
                                            <>
                                                <input
                                                    type="time"
                                                    value={hours.open}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        business_hours: { ...formData.business_hours, [day]: { ...hours, open: e.target.value } }
                                                    })}
                                                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-emerald-500 outline-none"
                                                />
                                                <span className="text-slate-500">-</span>
                                                <input
                                                    type="time"
                                                    value={hours.close}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        business_hours: { ...formData.business_hours, [day]: { ...hours, close: e.target.value } }
                                                    })}
                                                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-emerald-500 outline-none"
                                                />
                                            </>
                                        ) : (
                                            <span className="text-slate-500 text-sm italic w-[180px] text-center">Fermé</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )

            case 2: // PERSONALITY
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <section>
                            <label className="block text-slate-300 font-bold mb-3">Ton de la conversation</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setFormData({ ...formData, agent_tone: 'professional' })}
                                    className={`p-4 rounded-xl border text-left transition-all ${formData.agent_tone === 'professional' ? 'bg-emerald-500/10 border-emerald-500' : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'}`}
                                >
                                    <div className="font-bold text-white mb-1">Professionnel</div>
                                    <div className="text-xs text-slate-400">Courtois, précis, vouvoiement.</div>
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, agent_tone: 'friendly' })}
                                    className={`p-4 rounded-xl border text-left transition-all ${formData.agent_tone === 'friendly' ? 'bg-emerald-500/10 border-emerald-500' : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'}`}
                                >
                                    <div className="font-bold text-white mb-1">Amical</div>
                                    <div className="text-xs text-slate-400">Chaleureux, emojis, tutoiement.</div>
                                </button>
                            </div>
                        </section>

                        <section>
                            <label className="block text-slate-300 font-bold mb-3">Objectif Principal</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setFormData({ ...formData, agent_goal: 'sales' })}
                                    className={`p-4 rounded-xl border text-left transition-all ${formData.agent_goal === 'sales' ? 'bg-blue-500/10 border-blue-500' : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'}`}
                                >
                                    <div className="font-bold text-white mb-1">Vente</div>
                                    <div className="text-xs text-slate-400">Priorité : Conclure la vente.</div>
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, agent_goal: 'support' })}
                                    className={`p-4 rounded-xl border text-left transition-all ${formData.agent_goal === 'support' ? 'bg-blue-500/10 border-blue-500' : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'}`}
                                >
                                    <div className="font-bold text-white mb-1">Support</div>
                                    <div className="text-xs text-slate-400">Priorité : Aider le client.</div>
                                </button>
                            </div>
                        </section>
                    </motion.div>
                )

            case 3: // RULES
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg flex gap-3 text-sm">
                            <Shield className="text-amber-500 shrink-0" size={20} />
                            <div>
                                <span className="text-amber-500 font-bold">Détection de Conflits : </span>
                                <span className="text-slate-300">L'IA vérifiera si vos règles contredisent vos horaires ou autres infos.</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-slate-300 font-medium mb-2">Règles Spécifiques</label>
                            <textarea
                                value={formData.custom_rules}
                                onChange={e => setFormData({ ...formData, custom_rules: e.target.value })}
                                className="w-full h-48 bg-slate-900 border border-slate-700 rounded-lg p-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none font-mono text-sm leading-relaxed"
                                placeholder="- Livraison gratuite > 50.000F..."
                            />
                        </div>

                        {/* Conflict Status Bar */}
                        <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            <div className="flex items-center gap-2">
                                {conflictStatus === 'idle' && <span className="text-slate-500 text-sm">Prêt à vérifier</span>}
                                {conflictStatus === 'checking' && <span className="text-blue-400 text-sm flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> Analyse...</span>}
                                {conflictStatus === 'safe' && <span className="text-emerald-400 text-sm flex items-center gap-2"><Check size={14} /> OK</span>}
                                {conflictStatus === 'conflict' && <span className="text-red-400 text-sm flex items-center gap-2"><AlertCircle size={14} /> Conflit !</span>}
                            </div>
                            <button
                                onClick={checkConflict}
                                disabled={formData.custom_rules.length < 10 || conflictStatus === 'checking'}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${formData.custom_rules.length < 10 ? 'bg-slate-800 text-slate-600' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/20'}`}
                            >
                                Vérifier
                            </button>
                        </div>

                        {conflictStatus === 'conflict' && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
                                {conflictReason}
                            </div>
                        )}
                    </motion.div>
                )

            case 4: // CONNECT
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-center py-8">
                        {!qrCode && whatsappStatus !== 'connected' && (
                            <button
                                onClick={connectWhatsApp}
                                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition-all"
                            >
                                Générer QR Code
                            </button>
                        )}

                        {qrCode && whatsappStatus !== 'connected' && (
                            <div className="inline-block p-4 bg-white rounded-xl shadow-xl mt-4">
                                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                            </div>
                        )}

                        {whatsappStatus === 'connected' && (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 p-8 rounded-2xl">
                                <h3 className="text-2xl font-bold text-white mb-2">Connecté !</h3>
                                <p className="text-emerald-300">{connectedPhone}</p>
                            </div>
                        )}
                    </motion.div>
                )
        }
    }

    // --- MAIN RENDER ---
    return (
        <div className="min-h-screen bg-slate-900 pb-20">
            {/* STICKY TOP BAR - Matches Products/New */}
            <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/agents" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">Nouveau Bot</h1>
                            <p className="text-sm text-slate-400">{STEPS[currentStep].title}</p>
                        </div>
                    </div>
                </div>
                {/* PROGRESS BAR */}
                <div className="max-w-4xl mx-auto px-4 mt-2 mb-0">
                    <div className="flex justify-between items-center relative pb-4">
                        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-slate-800 -z-0 rounded-full mt-[-8px]"></div>
                        <div className="absolute top-1/2 left-0 h-[2px] bg-emerald-500 -z-0 rounded-full transition-all duration-300 mt-[-8px]" style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}></div>
                        {STEPS.map((step, index) => {
                            const isActive = index === currentStep
                            const isCompleted = index < currentStep
                            return (
                                <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 bg-slate-900 px-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isActive ? 'border-emerald-500 text-emerald-400 bg-slate-900' : isCompleted ? 'border-emerald-500 text-emerald-500 bg-slate-900' : 'border-slate-700 text-slate-600 bg-slate-900'}`}>
                                        <step.icon size={14} strokeWidth={2.5} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="max-w-3xl mx-auto px-4 py-8">
                {renderStep()}
            </div>

            {/* FIXED BOTTOM BAR */}
            <div className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur border-t border-slate-800 p-4 z-20">
                <div className="max-w-3xl mx-auto flex justify-between items-center">
                    <button onClick={() => setCurrentStep(prev => prev - 1)} disabled={currentStep === 0} className={`flex items-center gap-2 text-slate-400 px-4 py-2 hover:text-white transition-colors ${currentStep === 0 ? 'opacity-0 pointer-events-none' : ''}`}>
                        <ArrowLeft size={18} /> Précédent
                    </button>
                    {currentStep < STEPS.length - 1 ? (
                        <button onClick={() => {
                            if (STEPS[currentStep].id === 'rules' && formData.custom_rules.length > 5 && conflictStatus !== 'safe') { alert("Vérifiez la cohérence !"); return; }
                            handleSave(true); setCurrentStep(prev => prev + 1)
                        }} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all">
                            Suivant <ArrowRight size={18} />
                        </button>
                    ) : (
                        <button onClick={() => handleSave()} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all">
                            {saving ? <Loader2 className="animate-spin" /> : <Check size={18} />} Terminer
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
