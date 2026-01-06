'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Settings, ToggleLeft, ToggleRight, Mic, Eye, Zap, Shield,
    Loader2, Save, AlertTriangle, CheckCircle, ArrowLeft, Globe
} from 'lucide-react'
import Link from 'next/link'

interface FeatureFlag {
    id: string
    name: string
    key: string
    enabled: boolean
    description: string
    icon: any
    category: string
}

export default function AdminFeaturesPage() {
    const [features, setFeatures] = useState<FeatureFlag[]>([
        {
            id: '1', name: 'Réponses Vocales', key: 'voice_responses', enabled: true,
            description: 'Permet aux agents de répondre avec des messages vocaux (coût: +4 crédits)',
            icon: Mic, category: 'AI'
        },
        {
            id: '2', name: 'Vision (Images)', key: 'vision_enabled', enabled: true,
            description: 'Permet aux agents d\'analyser les images envoyées par les clients',
            icon: Eye, category: 'AI'
        },
        {
            id: '3', name: 'Outils IA (Réservations)', key: 'ai_tools_booking', enabled: true,
            description: 'Active l\'outil create_booking pour enregistrer les réservations automatiquement',
            icon: Zap, category: 'AI'
        },
        {
            id: '4', name: 'Outils IA (Commandes)', key: 'ai_tools_orders', enabled: true,
            description: 'Active l\'outil create_order pour enregistrer les commandes automatiquement',
            icon: Zap, category: 'AI'
        },
        {
            id: '5', name: 'Mode Maintenance', key: 'maintenance_mode', enabled: false,
            description: 'Désactive temporairement tous les bots et affiche un message de maintenance',
            icon: AlertTriangle, category: 'System'
        },
        {
            id: '6', name: 'Inscriptions Ouvertes', key: 'registrations_open', enabled: true,
            description: 'Permet aux nouveaux utilisateurs de s\'inscrire sur la plateforme',
            icon: Globe, category: 'System'
        },
        {
            id: '7', name: 'Paiements CinetPay', key: 'payments_enabled', enabled: true,
            description: 'Active les paiements via CinetPay pour les crédits et commandes',
            icon: Shield, category: 'Payments'
        }
    ])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        fetchFeatures()
    }, [])

    const fetchFeatures = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/features')
            const data = await res.json()
            if (data.data?.features) {
                // Merge server features with UI definitions
                setFeatures(prev => prev.map(f => {
                    const serverFeature = data.data.features.find((sf: any) => sf.key === f.key)
                    return serverFeature ? { ...f, enabled: serverFeature.enabled } : f
                }))
            }
        } catch (err) {
            console.error('Error fetching features:', err)
        } finally {
            setLoading(false)
        }
    }

    const toggleFeature = (featureId: string) => {
        setFeatures(prev => prev.map(f =>
            f.id === featureId ? { ...f, enabled: !f.enabled } : f
        ))
        setSaved(false)
    }

    const saveFeatures = async () => {
        setSaving(true)
        try {
            await fetch('/api/admin/features', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    features: features.map(f => ({ key: f.key, enabled: f.enabled }))
                })
            })
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (err) {
            console.error('Error saving features:', err)
        } finally {
            setSaving(false)
        }
    }

    const categories = [...new Set(features.map(f => f.category))]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Link href="/admin" style={{ color: '#64748b' }}>
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                            Feature Flags
                        </h1>
                        <p style={{ color: '#64748b', fontSize: 13 }}>
                            Activer/Désactiver les fonctionnalités de la plateforme
                        </p>
                    </div>
                </div>
                <button
                    onClick={saveFeatures}
                    disabled={saving}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px',
                        background: saved ? 'rgba(34, 197, 94, 0.2)' : 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none', borderRadius: 10,
                        color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                        opacity: saving ? 0.7 : 1
                    }}
                >
                    {saving ? (
                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : saved ? (
                        <CheckCircle size={16} />
                    ) : (
                        <Save size={16} />
                    )}
                    {saved ? 'Enregistré !' : 'Enregistrer'}
                </button>
            </div>

            {/* Features by Category */}
            {categories.map(category => (
                <div key={category} style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 14, overflow: 'hidden'
                }}>
                    <div style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        background: 'rgba(15, 23, 42, 0.3)'
                    }}>
                        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {category}
                        </h2>
                    </div>
                    <div style={{ padding: 8 }}>
                        {features.filter(f => f.category === category).map((feature) => (
                            <motion.div
                                key={feature.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '16px 12px', borderRadius: 10,
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12,
                                        background: feature.enabled ? 'rgba(52, 211, 153, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.3s'
                                    }}>
                                        <feature.icon size={20} style={{
                                            color: feature.enabled ? '#34d399' : '#64748b',
                                            transition: 'color 0.3s'
                                        }} />
                                    </div>
                                    <div>
                                        <div style={{ color: 'white', fontWeight: 500, fontSize: 15, marginBottom: 2 }}>
                                            {feature.name}
                                        </div>
                                        <div style={{ color: '#64748b', fontSize: 13, maxWidth: 400 }}>
                                            {feature.description}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleFeature(feature.id)}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer', padding: 4
                                    }}
                                >
                                    {feature.enabled ? (
                                        <ToggleRight size={36} style={{ color: '#34d399' }} />
                                    ) : (
                                        <ToggleLeft size={36} style={{ color: '#475569' }} />
                                    )}
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            ))}

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
