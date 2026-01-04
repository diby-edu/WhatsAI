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
    ChevronLeft,
    ChevronRight,
    Circle
} from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useTranslations } from 'next-intl'
import QRCode from 'qrcode'

const STEPS = [
    { id: 'identity', title: 'Identité', icon: MapPin },
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

    // Helpers
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

    const checkConflict = async () => {
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

    const getLocation = () => {
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

    const connectWhatsApp = async () => {
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

    const pollStatus = () => {
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
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto space-y-12">
                        {/* Avatar - Minimalist */}
                        <div className="flex justify-center">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-24 h-24 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-600 flex items-center justify-center cursor-pointer overflow-hidden relative group transition-all"
                            >
                                {formData.avatar_url ? (
                                    <img src={formData.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center">
                                        {uploading ? <Loader2 className="animate-spin text-slate-500 w-5 h-5 mx-auto" /> : <Upload className="text-slate-600 group-hover:text-slate-400 w-5 h-5 mx-auto" />}
                                    </div>
                                )}
                                <input ref={fileInputRef} type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                            </div>
                        </div>

                        {/* Fields */}
                        <div className="space-y-8">
                            <div className="space-y-2">
                                <label className="text-sm text-slate-400 font-medium">Nom de l'agent</label>
                                <input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-white focus:border-slate-600 focus:ring-0 outline-none transition-all placeholder:text-slate-700 font-light"
                                    placeholder="Ex: Marius le Vendeur"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-slate-400 font-medium">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-white focus:border-slate-600 focus:ring-0 outline-none transition-all placeholder:text-slate-700 resize-none h-24 font-light"
                                    placeholder="Une brève description..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-slate-400 font-medium">Adresse Physique</label>
                                <input
                                    value={formData.business_address}
                                    onChange={e => setFormData({ ...formData, business_address: e.target.value })}
                                    className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-white focus:border-slate-600 focus:ring-0 outline-none transition-all placeholder:text-slate-700 font-light"
                                    placeholder="Adresse complète"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400 font-medium">Latitude</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={formData.latitude}
                                            onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                                            className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-white focus:border-slate-600 focus:ring-0 outline-none transition-all placeholder:text-slate-700 font-mono text-sm"
                                            placeholder="0.0000"
                                        />
                                        <button onClick={getLocation} className="absolute right-3 top-3 text-slate-600 hover:text-white transition-colors">
                                            <MapPin size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400 font-medium">Longitude</label>
                                    <input
                                        type="number"
                                        value={formData.longitude}
                                        onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-white focus:border-slate-600 focus:ring-0 outline-none transition-all placeholder:text-slate-700 font-mono text-sm"
                                        placeholder="0.0000"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 pt-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400 font-medium">Téléphone Support</label>
                                    <input
                                        value={formData.contact_phone}
                                        onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-white focus:border-slate-600 focus:ring-0 outline-none transition-all placeholder:text-slate-700 font-light"
                                        placeholder="+225..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400 font-medium">Site Web</label>
                                    <input
                                        value={formData.site_url}
                                        onChange={e => setFormData({ ...formData, site_url: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-white focus:border-slate-600 focus:ring-0 outline-none transition-all placeholder:text-slate-700 font-light"
                                        placeholder="https://"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )

            case 1: // HOURS
                return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto space-y-8">
                        <div className="text-center pb-8 border-b border-white/5">
                            <h3 className="text-2xl font-light text-white mb-2">Horaires d'Ouverture</h3>
                            <p className="text-slate-500 font-light">Définissez quand votre agent doit répondre aux clients.</p>
                        </div>

                        <div className="space-y-1">
                            {Object.entries(formData.business_hours).map(([day, hours]) => (
                                <div key={day} className="flex items-center justify-between py-3 px-4 hover:bg-white/5 rounded-lg transition-colors group">
                                    <span className="capitalize w-32 text-slate-400 font-medium group-hover:text-white transition-colors">{t(`WeekDays.${day}`)}</span>
                                    <div className="flex items-center gap-4">
                                        {!hours.closed ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    value={hours.open}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        business_hours: { ...formData.business_hours, [day]: { ...hours, open: e.target.value } }
                                                    })}
                                                    className="bg-transparent border border-white/10 rounded px-2 py-1 text-sm text-white focus:border-white/30 outline-none w-20 text-center font-mono"
                                                />
                                                <span className="text-slate-600 font-light">à</span>
                                                <input
                                                    type="time"
                                                    value={hours.close}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        business_hours: { ...formData.business_hours, [day]: { ...hours, close: e.target.value } }
                                                    })}
                                                    className="bg-transparent border border-white/10 rounded px-2 py-1 text-sm text-white focus:border-white/30 outline-none w-20 text-center font-mono"
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-slate-600 text-sm italic w-[184px] text-right pr-4">Fermé</span>
                                        )}

                                        <button
                                            onClick={() => setFormData({
                                                ...formData,
                                                business_hours: { ...formData.business_hours, [day]: { ...hours, closed: !hours.closed } }
                                            })}
                                            className={`w-10 h-6 rounded-full relative transition-colors ${!hours.closed ? 'bg-slate-700' : 'bg-slate-900 border border-slate-800'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${!hours.closed ? 'left-5' : 'left-1 bg-slate-600'}`}></div>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )

            case 2: // PERSONALITY
                return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-12">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            {/* TONE */}
                            <section className="space-y-6">
                                <label className="block text-slate-500 text-sm font-medium uppercase tracking-widest mb-4">Ton de voix</label>
                                <div className="space-y-4">
                                    <button
                                        onClick={() => setFormData({ ...formData, agent_tone: 'professional' })}
                                        className={`w-full p-6 text-left border rounded-xl transition-all duration-300 ${formData.agent_tone === 'professional' ? 'bg-slate-800/50 border-slate-600' : 'bg-transparent border-slate-800 opacity-50 hover:opacity-100 hover:border-slate-700'}`}
                                    >
                                        <div className="text-lg text-white font-light mb-2">Professionnel</div>
                                        <div className="text-sm text-slate-400 font-light leading-relaxed">Un language formel et précis, utilisant le vouvoiement. Idéal pour les services B2B et le support technique.</div>
                                    </button>

                                    <button
                                        onClick={() => setFormData({ ...formData, agent_tone: 'friendly' })}
                                        className={`w-full p-6 text-left border rounded-xl transition-all duration-300 ${formData.agent_tone === 'friendly' ? 'bg-slate-800/50 border-slate-600' : 'bg-transparent border-slate-800 opacity-50 hover:opacity-100 hover:border-slate-700'}`}
                                    >
                                        <div className="text-lg text-white font-light mb-2">Amical</div>
                                        <div className="text-sm text-slate-400 font-light leading-relaxed">Un ton chaleureux et engageant, utilisant le tutoiement et des emojis. Parfait pour le e-commerce et les communautés.</div>
                                    </button>
                                </div>
                            </section>

                            {/* GOAL */}
                            <section className="space-y-6">
                                <label className="block text-slate-500 text-sm font-medium uppercase tracking-widest mb-4">Objectif</label>
                                <div className="space-y-4">
                                    <button
                                        onClick={() => setFormData({ ...formData, agent_goal: 'sales' })}
                                        className={`w-full p-6 text-left border rounded-xl transition-all duration-300 ${formData.agent_goal === 'sales' ? 'bg-slate-800/50 border-slate-600' : 'bg-transparent border-slate-800 opacity-50 hover:opacity-100 hover:border-slate-700'}`}
                                    >
                                        <div className="text-lg text-white font-light mb-2">Vente</div>
                                        <div className="text-sm text-slate-400 font-light leading-relaxed">Maximiser les conversions. L'agent proposera activement des produits et des offres spéciales.</div>
                                    </button>

                                    <button
                                        onClick={() => setFormData({ ...formData, agent_goal: 'support' })}
                                        className={`w-full p-6 text-left border rounded-xl transition-all duration-300 ${formData.agent_goal === 'support' ? 'bg-slate-800/50 border-slate-600' : 'bg-transparent border-slate-800 opacity-50 hover:opacity-100 hover:border-slate-700'}`}
                                    >
                                        <div className="text-lg text-white font-light mb-2">Support</div>
                                        <div className="text-sm text-slate-400 font-light leading-relaxed">Résoudre les problèmes. L'agent privilégiera l'écoute et l'assistance à la vente.</div>
                                    </button>
                                </div>
                            </section>
                        </div>
                    </motion.div>
                )

            case 3: // RULES
                return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-8">
                        <div className="text-center pb-4">
                            <h3 className="text-2xl font-light text-white mb-2">Règles Spécifiques</h3>
                            <p className="text-slate-500 font-light text-sm">Instructions particulières pour l'IA.</p>
                        </div>

                        <textarea
                            value={formData.custom_rules}
                            onChange={e => setFormData({ ...formData, custom_rules: e.target.value })}
                            className="w-full h-64 bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-white focus:border-slate-600 focus:ring-0 outline-none resize-none font-light leading-relaxed text-sm"
                            placeholder="- Livraison gratuite à partir de 50.000 FCFA..."
                        />

                        {/* Minimalist Conflict Bar */}
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${conflictStatus === 'safe' ? 'bg-emerald-500' : conflictStatus === 'conflict' ? 'bg-red-500' : 'bg-slate-700'}`}></div>
                                {conflictStatus === 'idle' && <span className="text-slate-500 text-sm font-light">Cohérence non vérifiée</span>}
                                {conflictStatus === 'checking' && <span className="text-slate-400 text-sm font-light">Vérification...</span>}
                                {conflictStatus === 'safe' && <span className="text-slate-400 text-sm font-light">Aucune contradiction.</span>}
                                {conflictStatus === 'conflict' && <span className="text-red-400 text-sm font-light">Conflit détecté.</span>}
                            </div>
                            <button
                                onClick={checkConflict}
                                disabled={formData.custom_rules.length < 10 || conflictStatus === 'checking'}
                                className="text-sm text-white hover:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                Vérifier maintenant
                            </button>
                        </div>

                        {conflictStatus === 'conflict' && (
                            <div className="bg-red-500/5 border-l-2 border-red-500/50 p-4 text-red-300/80 text-sm font-light leading-relaxed">
                                {conflictReason}
                            </div>
                        )}
                    </motion.div>
                )

            case 4: // CONNECT
                return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12 max-w-lg mx-auto">
                        <h3 className="text-3xl font-thin text-white mb-8">Connexion WhatsApp</h3>

                        {!qrCode && whatsappStatus !== 'connected' && (
                            <button
                                onClick={connectWhatsApp}
                                className="px-8 py-3 bg-white text-black hover:bg-slate-200 rounded-full font-medium transition-all"
                            >
                                Générer le code
                            </button>
                        )}

                        {qrCode && whatsappStatus !== 'connected' && (
                            <div className="inline-block p-4 bg-white rounded-lg shadow-2xl mt-4">
                                <img src={qrCode} alt="QR Code" className="w-64 h-64 grayscale opacity-90 transition-all hover:filter-none hover:opacity-100" />
                            </div>
                        )}

                        {whatsappStatus === 'connected' && (
                            <div className="space-y-4">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 mb-4">
                                    <Check size={32} strokeWidth={1.5} />
                                </div>
                                <p className="text-xl text-white font-light">Connecté</p>
                                <p className="text-slate-500 font-mono text-sm">{connectedPhone}</p>
                            </div>
                        )}
                    </motion.div>
                )
        }
    }

    // --- MAIN RENDER ---
    return (
        <div className="min-h-screen bg-slate-950 font-sans selection:bg-slate-800 text-slate-200">
            {/* Minimalist Top Bar */}
            <div className="fixed top-0 left-0 w-full bg-slate-950/80 backdrop-blur-md z-50 border-b border-white/5">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/dashboard/agents" className="text-slate-500 hover:text-white transition-colors">
                        <ArrowLeft size={18} />
                    </Link>

                    {/* Minimalist Progress Indicators */}
                    <div className="flex gap-4">
                        {STEPS.map((step, index) => {
                            const isActive = index === currentStep
                            // const isCompleted = index < currentStep
                            return (
                                <div key={step.id} className="transition-all duration-500">
                                    <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isActive ? 'bg-white scale-125' : 'bg-slate-800'}`}></div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="w-4"></div> {/* Spacer for alignment */}
                </div>
            </div>

            {/* Title Header */}
            <div className="pt-32 pb-12 text-center">
                <h1 className="text-3xl font-light text-white tracking-tight mb-2">{STEPS[currentStep].title}</h1>
                <p className="text-slate-500 text-sm font-light">Étape {currentStep + 1} sur {STEPS.length}</p>
            </div>

            {/* CONTENT */}
            <div className="max-w-5xl mx-auto px-6 pb-32">
                {renderStep()}
            </div>

            {/* Minimalist Bottom Navigation using Floating Action Button style if wanted, or just simple text buttons */}
            <div className="fixed bottom-12 right-12 z-50 flex gap-4">
                <button
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    disabled={currentStep === 0}
                    className={`
                        w-12 h-12 rounded-full bg-slate-900 border border-slate-800 text-white flex items-center justify-center 
                        hover:bg-slate-800 transition-all disabled:opacity-0 disabled:translate-y-4
                    `}
                >
                    <ChevronLeft size={20} />
                </button>

                {currentStep < STEPS.length - 1 ? (
                    <button
                        onClick={() => {
                            if (STEPS[currentStep].id === 'rules' && formData.custom_rules.length > 5 && conflictStatus !== 'safe') { alert("Vérification requise."); return; }
                            handleSave(true); setCurrentStep(prev => prev + 1)
                        }}
                        className="h-12 px-6 rounded-full bg-white text-black font-medium flex items-center gap-2 hover:bg-slate-200 transition-all shadow-xl shadow-black/50"
                    >
                        Suivant <ArrowRight size={18} />
                    </button>
                ) : (
                    <button
                        onClick={() => handleSave()}
                        disabled={saving}
                        className="h-12 px-6 rounded-full bg-white text-black font-medium flex items-center gap-2 hover:bg-slate-200 transition-all shadow-xl shadow-black/50"
                    >
                        {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Check size={18} />} Terminer
                    </button>
                )}
            </div>
        </div>
    )
}
