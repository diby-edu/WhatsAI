'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    Settings,
    User,
    Bell,
    Lock,
    CreditCard,
    Trash2,
    Save,
    Loader2,
    Check
} from 'lucide-react'

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('profile')
    const [loading, setLoading] = useState(false)
    const [saved, setSaved] = useState(false)

    const [profile, setProfile] = useState({
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '+225 07 XX XX XX',
        company: 'Ma Société',
    })

    const [notifications, setNotifications] = useState({
        email_new_lead: true,
        email_daily_summary: true,
        email_weekly_report: false,
        push_new_message: true,
        push_escalation: true,
    })

    const handleSave = async () => {
        setLoading(true)
        await new Promise(resolve => setTimeout(resolve, 1000))
        setLoading(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const tabs = [
        { id: 'profile', label: 'Profil', icon: User },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Sécurité', icon: Lock },
        { id: 'danger', label: 'Zone de danger', icon: Trash2 },
    ]

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold">Paramètres</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Gérez votre compte et vos préférences
                </p>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Tabs */}
                <div className="md:w-48 flex md:flex-col gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${activeTab === tab.id
                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-600'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                                }`}
                        >
                            <tab.icon className="w-5 h-5" />
                            <span className="font-medium text-sm">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 card">
                    {activeTab === 'profile' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                        >
                            <h2 className="text-lg font-semibold">Informations du profil</h2>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Nom complet</label>
                                    <input
                                        type="text"
                                        value={profile.fullName}
                                        onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Email</label>
                                    <input
                                        type="email"
                                        value={profile.email}
                                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Téléphone</label>
                                    <input
                                        type="tel"
                                        value={profile.phone}
                                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Entreprise</label>
                                    <input
                                        type="text"
                                        value={profile.company}
                                        onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>

                            <button onClick={handleSave} className="btn-primary">
                                {loading ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Enregistrement...</>
                                ) : saved ? (
                                    <><Check className="w-5 h-5" /> Enregistré !</>
                                ) : (
                                    <><Save className="w-5 h-5" /> Enregistrer</>
                                )}
                            </button>
                        </motion.div>
                    )}

                    {activeTab === 'notifications' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                        >
                            <h2 className="text-lg font-semibold">Préférences de notification</h2>

                            <div className="space-y-4">
                                <h3 className="text-sm font-medium text-gray-500">Notifications par email</h3>
                                {[
                                    { key: 'email_new_lead', label: 'Nouveaux leads', description: 'Recevoir un email pour chaque nouveau lead' },
                                    { key: 'email_daily_summary', label: 'Résumé quotidien', description: 'Rapport quotidien de vos conversations' },
                                    { key: 'email_weekly_report', label: 'Rapport hebdomadaire', description: 'Analytics et statistiques de la semaine' },
                                ].map((item) => (
                                    <div key={item.key} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                                        <div>
                                            <h4 className="font-medium">{item.label}</h4>
                                            <p className="text-sm text-gray-500">{item.description}</p>
                                        </div>
                                        <button
                                            onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key as keyof typeof notifications] })}
                                            className={`w-12 h-6 rounded-full transition-colors ${notifications[item.key as keyof typeof notifications] ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${notifications[item.key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-0.5'
                                                }`} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button onClick={handleSave} className="btn-primary">
                                <Save className="w-5 h-5" /> Enregistrer
                            </button>
                        </motion.div>
                    )}

                    {activeTab === 'security' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                        >
                            <h2 className="text-lg font-semibold">Sécurité du compte</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Mot de passe actuel</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Nouveau mot de passe</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Confirmer le nouveau mot de passe</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>

                            <button className="btn-primary">
                                <Lock className="w-5 h-5" /> Changer le mot de passe
                            </button>
                        </motion.div>
                    )}

                    {activeTab === 'danger' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                        >
                            <h2 className="text-lg font-semibold text-red-600">Zone de danger</h2>

                            <div className="p-4 border-2 border-red-200 dark:border-red-900 rounded-xl bg-red-50 dark:bg-red-900/20">
                                <h3 className="font-semibold text-red-600 mb-2">Supprimer le compte</h3>
                                <p className="text-sm text-red-600/80 mb-4">
                                    Cette action est irréversible. Toutes vos données seront définitivement supprimées.
                                </p>
                                <button className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">
                                    Supprimer mon compte
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    )
}
