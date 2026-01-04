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

    // Helpers
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return
        setUploading(true)
        try {
            const file = e.target.files[0]
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `avatars/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('files')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: publicUrl } = supabase.storage
                .from('files')
                .getPublicUrl(filePath)

            setFormData({ ...formData, avatar_url: publicUrl.publicUrl })
        } catch (error) {
            alert('Erreur upload')
        } finally {
            setUploading(false)
        }
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

            if (method === 'POST') {
                setCreatedAgentId(data.agent?.id || data.id)
            }
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
        } catch (error) {
            setWhatsappStatus('error')
        }
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
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                        {/* Avatar */}
                        <div className="flex flex-col items-center justify-center -mt-2">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-28 h-28 rounded-full border-2 border-dashed border-slate-700 hover:border-emerald-500 flex items-center justify-center cursor-pointer overflow-hidden relative group transition-all bg-slate-950 shadow-2xl"
                            >
                                {formData.avatar_url ? (
                                    <img src={formData.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center p-2">
                                        {uploading ? <Loader2 className="animate-spin mx-auto text-emerald-500" /> : <Upload className="mx-auto text-slate-600 mb-2 group-hover:text-emerald-500 transition-colors" />}
                                        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Logo</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-white text-xs font-bold">Modifier</span>
                                </div>
                                <input ref={fileInputRef} type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                            </div>
                        </div>

                        {/* Main Info Card */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                <MapPin size={16} className="text-emerald-500" /> Identité & Coordonnées
                            </h2>

                            <div className="space-y-6">
                                {/* Name */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1 mb-2 block">Nom de l'agent *</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-500 transition-colors">
                                            <Bot size={18} />
                                        </div>
                                        <input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-4 pl-12 pr-4 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none placeholder:text-slate-700 font-medium"
                                            placeholder="Ex: Marius le Vendeur"
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1 mb-2 block">Rôle / Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-4 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none placeholder:text-slate-700 resize-none h-24 text-sm"
                                        placeholder="Décrivez brièvement le rôle de cet agent pour donner du contexte à l'IA..."
                                    />
                                </div>

                                {/* Address */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1 mb-2 block">Adresse Physique</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-500 transition-colors">
                                            <MapPin size={18} />
                                        </div>
                                        <input
                                            value={formData.business_address}
                                            onChange={e => setFormData({ ...formData, business_address: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-4 pl-12 pr-4 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none placeholder:text-slate-700"
                                            placeholder="Ex: Abidjan, Cocody Riviera 2"
                                        />
                                    </div>
                                </div>

                                {/* GPS Coords */}
                                <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                                            <Globe size={14} /> Coordonnées GPS (Optionnel)
                                        </label>
                                        <button
                                            onClick={getLocation}
                                            className="text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-medium border border-blue-500/10"
                                        >
                                            <Map size={12} /> Ma position
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="number"
                                            placeholder="Latitude"
                                            value={formData.latitude}
                                            onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                                            className="bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-3 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-700 font-mono"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Longitude"
                                            value={formData.longitude}
                                            onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                                            className="bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-3 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-700 font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contact & Socials */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                <LinkIcon size={16} className="text-blue-500" /> Contact & Réseaux
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1 mb-2 block">Téléphone Support</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-500 transition-colors">
                                            <Smartphone size={18} />
                                        </div>
                                        <input
                                            value={formData.contact_phone}
                                            onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-4 pl-12 pr-4 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none placeholder:text-slate-700"
                                            placeholder="+225 07..."
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1 mb-2 block">Site Web</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors">
                                            <Globe size={18} />
                                        </div>
                                        <input
                                            value={formData.site_url}
                                            onChange={e => setFormData({ ...formData, site_url: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-4 pl-12 pr-4 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none placeholder:text-slate-700"
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )

            case 1: // HOURS
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="text-center mb-4">
                            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-800 shadow-lg">
                                <Clock className="text-emerald-500" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-white">Horaires d'Ouverture</h3>
                            <p className="text-slate-400 text-sm">Quand votre agent est-il disponible ?</p>
                        </div>

                        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-sm space-y-3">
                            <div className="grid grid-cols-[100px_1fr] gap-4 mb-2 px-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <span>Jour</span>
                                <span>Plage Horaire</span>
                            </div>
                            {Object.entries(formData.business_hours).map(([day, hours]) => (
                                <div key={day} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800/50 rounded-xl hover:bg-slate-950 hover:border-slate-800 transition-all group">
                                    <span className="capitalize w-24 text-slate-300 font-medium pl-1">{t(`WeekDays.${day}`)}</span>
                                    <div className="flex items-center gap-3 flex-1 justify-end">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!hours.closed}
                                                className="sr-only peer"
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    business_hours: { ...formData.business_hours, [day]: { ...hours, closed: !e.target.checked } }
                                                })}
                                            />
                                            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                        </label>

                                        {!hours.closed ? (
                                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <input
                                                    type="time"
                                                    value={hours.open}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        business_hours: { ...formData.business_hours, [day]: { ...hours, open: e.target.value } }
                                                    })}
                                                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 outline-none w-28 text-center font-mono"
                                                />
                                                <span className="text-slate-600">-</span>
                                                <input
                                                    type="time"
                                                    value={hours.close}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        business_hours: { ...formData.business_hours, [day]: { ...hours, close: e.target.value } }
                                                    })}
                                                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 outline-none w-28 text-center font-mono"
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-slate-600 text-sm italic w-[240px] text-center border border-dashed border-slate-800 rounded-lg py-1.5">Fermé</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )

            case 2: // PERSONALITY
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                <Languages size={16} className="text-purple-500" /> Style de Conversation
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setFormData({ ...formData, agent_tone: 'professional' })}
                                    className={`relative p-5 rounded-2xl border text-left transition-all group overflow-hidden ${formData.agent_tone === 'professional' ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/50' : 'bg-slate-950 border-slate-800 hover:bg-slate-900'}`}
                                >
                                    <div className="absolute top-4 right-4 text-emerald-500 opacity-0 transform translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                        {formData.agent_tone === 'professional' && <Check size={20} />}
                                    </div>
                                    <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800 group-hover:border-slate-700">
                                        <Bot size={20} className="text-slate-300" />
                                    </div>
                                    <div className="font-bold text-white mb-1.5 text-lg">Professionnel</div>
                                    <div className="text-sm text-slate-400 leading-relaxed">Courtois, précis, utilise le vouvoiement. Idéal pour le B2B.</div>
                                </button>

                                <button
                                    onClick={() => setFormData({ ...formData, agent_tone: 'friendly' })}
                                    className={`relative p-5 rounded-2xl border text-left transition-all group overflow-hidden ${formData.agent_tone === 'friendly' ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/50' : 'bg-slate-950 border-slate-800 hover:bg-slate-900'}`}
                                >
                                    <div className="absolute top-4 right-4 text-emerald-500 opacity-0 transform translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                        {formData.agent_tone === 'friendly' && <Check size={20} />}
                                    </div>
                                    <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800 group-hover:border-slate-700">
                                        <MessageSquare size={20} className="text-slate-300" />
                                    </div>
                                    <div className="font-bold text-white mb-1.5 text-lg">Amical</div>
                                    <div className="text-sm text-slate-400 leading-relaxed">Chaleureux, utilise des emojis et le tutoiement. Idéal pour le B2C.</div>
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                <Zap size={16} className="text-yellow-500" /> Objectif Principal
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setFormData({ ...formData, agent_goal: 'sales' })}
                                    className={`relative p-5 rounded-2xl border text-left transition-all group overflow-hidden ${formData.agent_goal === 'sales' ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/50' : 'bg-slate-950 border-slate-800 hover:bg-slate-900'}`}
                                >
                                    <div className="absolute top-4 right-4 text-blue-500 opacity-0 transform translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                        {formData.agent_goal === 'sales' && <Check size={20} />}
                                    </div>
                                    <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800 group-hover:border-slate-700">
                                        <Zap size={20} className="text-yellow-400" />
                                    </div>
                                    <div className="font-bold text-white mb-1.5 text-lg">Vente Aggressive</div>
                                    <div className="text-sm text-slate-400 leading-relaxed">Pousse à l'achat, met en avant les promos et le FOMO.</div>
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, agent_goal: 'support' })}
                                    className={`relative p-5 rounded-2xl border text-left transition-all group overflow-hidden ${formData.agent_goal === 'support' ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/50' : 'bg-slate-950 border-slate-800 hover:bg-slate-900'}`}
                                >
                                    <div className="absolute top-4 right-4 text-blue-500 opacity-0 transform translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                        {formData.agent_goal === 'support' && <Check size={20} />}
                                    </div>
                                    <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800 group-hover:border-slate-700">
                                        <Shield size={20} className="text-emerald-400" />
                                    </div>
                                    <div className="font-bold text-white mb-1.5 text-lg">Support Client</div>
                                    <div className="text-sm text-slate-400 leading-relaxed">Répond aux questions, rassure, aide à la résolution de problèmes.</div>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )

            case 3: // RULES
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl flex gap-4 items-start">
                            <div className="p-2 bg-amber-500/20 rounded-lg">
                                <Shield className="text-amber-500" size={24} />
                            </div>
                            <div>
                                <h4 className="text-amber-500 font-bold text-base mb-1">Détecteur de Conflits IA</h4>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    L'IA vérifiera automatiquement si vos règles contredisent vos horaires ou votre adresse. C'est une sécurité supplémentaire pour éviter les hallucinations.
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 block flex items-center justify-between">
                                <span>Règles Spécifiques (Prompt Custom)</span>
                                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">IA Strict Mode</span>
                            </label>
                            <textarea
                                value={formData.custom_rules}
                                onChange={e => setFormData({ ...formData, custom_rules: e.target.value })}
                                className="w-full h-64 bg-slate-950 border border-slate-800 rounded-xl p-5 text-white focus:ring-1 focus:ring-emerald-500 outline-none resize-none leading-relaxed font-mono text-sm"
                                placeholder={`- Pas de retour sur les soldes
- Livraison gratuite à partir de 50.000 FCFA
- Ne jamais donner le numéro personnel du patron
- Toujours proposer l'article complémentaire`}
                            />
                        </div>

                        {/* Conflict Status Bar */}
                        <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-3">
                                {conflictStatus === 'idle' && <span className="text-slate-500 text-sm font-medium">En attente de vérification...</span>}
                                {conflictStatus === 'checking' && <span className="text-blue-400 text-sm flex items-center gap-2 font-medium"><Loader2 className="animate-spin" size={16} /> Analyse en cours...</span>}
                                {conflictStatus === 'safe' && <span className="text-emerald-400 text-sm flex items-center gap-2 font-medium"><Check size={16} /> Aucune contradiction détectée</span>}
                                {conflictStatus === 'conflict' && <span className="text-red-400 text-sm flex items-center gap-2 font-medium"><AlertCircle size={16} /> Conflit détecté !</span>}
                            </div>
                            <button
                                onClick={checkConflict}
                                disabled={formData.custom_rules.length < 10 || conflictStatus === 'checking'}
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg ${formData.custom_rules.length < 10 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' :
                                    'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                                    }`}
                            >
                                Vérifier la cohérence
                            </button>
                        </div>

                        {conflictStatus === 'conflict' && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                                <p className="text-red-400 text-sm font-bold flex items-center gap-2 mb-1"><AlertCircle size={16} /> Problème Identifié :</p>
                                <p className="text-red-300 text-sm ml-6 leading-relaxed">{conflictReason}</p>
                            </div>
                        )}
                    </motion.div>
                )

            case 4: // CONNECT
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-center py-8">
                        <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-8 border border-slate-700">
                            <Smartphone className="text-slate-500" size={48} />
                        </div>

                        {!qrCode && whatsappStatus !== 'connected' && (
                            <div className="space-y-6">
                                <h3 className="text-2xl font-bold text-white">Connecter WhatsApp</h3>
                                <p className="text-slate-400 max-w-sm mx-auto leading-relaxed">
                                    Scannez le QR Code pour lier ce bot à votre numéro WhatsApp Business. La connexion est instantanée.
                                </p>
                                <button
                                    onClick={connectWhatsApp}
                                    className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-xl shadow-emerald-500/20 transition-all transform hover:scale-105 active:scale-95 text-lg"
                                >
                                    Générer le QR Code
                                </button>
                            </div>
                        )}

                        {qrCode && whatsappStatus !== 'connected' && (
                            <div className="flex flex-col items-center space-y-6">
                                <div className="p-6 bg-white rounded-3xl shadow-2xl skew-y-1 transform border-4 border-slate-800">
                                    <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                                </div>
                                <div>
                                    <p className="text-white font-mono animate-pulse mb-2">En attente du scan...</p>
                                    <p className="text-slate-500 text-xs">Ouvrez WhatsApp {'>'} Appareils connectés {'>'} Connecter un appareil</p>
                                </div>

                            </div>
                        )}

                        {whatsappStatus === 'connected' && (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 p-10 rounded-3xl max-w-md mx-auto relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
                                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
                                    <Check className="text-white" size={40} strokeWidth={3} />
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-2">Connecté !</h3>
                                <p className="text-emerald-300 mb-8 text-lg font-mono">{connectedPhone}</p>
                                <button
                                    onClick={() => router.push('/dashboard/agents')}
                                    className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors border border-slate-700 font-bold"
                                >
                                    Retour à la liste
                                </button>
                            </div>
                        )}
                    </motion.div>
                )
        }
    }

    // --- MAIN RENDER ---
    return (
        <div className="min-h-screen bg-[#0B1120] pb-24 font-sans selection:bg-emerald-500/30">
            {/* STICKY TOP BAR */}
            <div className="border-b border-slate-800 bg-[#0B1120]/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/agents" className="w-10 h-10 flex items-center justify-center hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all border border-transparent hover:border-slate-700">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-tight">Nouveau Bot</h1>
                            <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest">{STEPS[currentStep].title}</p>
                        </div>
                    </div>
                </div>

                {/* PROGRESS BAR (Simplified) */}
                <div className="max-w-4xl mx-auto px-6 mt-1 mb-0">
                    <div className="flex justify-between items-center relative py-4">
                        {/* Background Line */}
                        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-slate-800 -z-0 rounded-full"></div>
                        {/* Active Line */}
                        <div
                            className="absolute top-1/2 left-0 h-[2px] bg-emerald-500 -z-0 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
                        ></div>

                        {STEPS.map((step, index) => {
                            const isActive = index === currentStep
                            const isCompleted = index < currentStep
                            return (
                                <div key={step.id} className="relative z-10 flex flex-col items-center group cursor-default">
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center border-[2px] transition-all duration-300 bg-[#0B1120]
                                        ${isActive ? 'border-emerald-500 text-emerald-400 bg-slate-900 shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-110' :
                                            isCompleted ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' :
                                                'border-slate-800 text-slate-700 bg-slate-950'}
                                    `}>
                                        <step.icon size={14} strokeWidth={3} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="max-w-3xl mx-auto px-6 py-8">
                {renderStep()}
            </div>

            {/* FIXED BOTTOM ACTION BAR */}
            <div className="fixed bottom-0 left-0 w-full bg-[#0B1120]/90 backdrop-blur-lg border-t border-slate-800 p-4 z-40">
                <div className="max-w-3xl mx-auto flex justify-between items-center">
                    <button
                        onClick={() => setCurrentStep(prev => prev - 1)}
                        disabled={currentStep === 0}
                        className={`flex items-center gap-2 text-slate-400 px-6 py-3 font-medium hover:text-white transition-colors ${currentStep === 0 ? 'opacity-0 pointer-events-none' : ''}`}
                    >
                        <ArrowLeft size={18} /> Précédent
                    </button>

                    {currentStep < STEPS.length - 1 ? (
                        <button
                            onClick={() => {
                                // Block checks
                                if (STEPS[currentStep].id === 'rules' && formData.custom_rules.length > 5 && conflictStatus !== 'safe') {
                                    alert("🛡️ SÉCURITÉ : Vérifiez la cohérence avant de continuer.")
                                    return
                                }
                                handleSave(true) // Auto-save
                                setCurrentStep(prev => prev + 1)
                            }}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                        >
                            Suivant <ArrowRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={() => handleSave()}
                            disabled={saving}
                            className={`bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all ${saving ? 'opacity-70 cursor-wait' : 'hover:scale-105 active:scale-95'}`}
                        >
                            {saving ? <Loader2 className="animate-spin" /> : <Check size={18} />} Terminer
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
