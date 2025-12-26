'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    Save,
    RefreshCw,
    Shield,
    Bell,
    Globe,
    CreditCard,
    Mail,
    Database,
    Lock,
    ToggleLeft,
    ToggleRight,
    AlertTriangle
} from 'lucide-react'

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState({
        appName: 'WhatsAI',
        maintenanceMode: false,
        allowRegistrations: true,
        defaultCredits: 100,
        openaiModel: 'gpt-4o-mini',
        maxAgentsFree: 1,
        maxAgentsStarter: 1,
        maxAgentsPro: 2,
        maxAgentsBusiness: 4,
        emailNotifications: true,
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpUser: 'noreply@whatsai.com',
        cinetpayMode: 'sandbox',
        cinetpaySiteId: '********',
    })

    const handleToggle = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }))
    }

    return (
        <div className="space-y-8 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Paramètres système</h1>
                    <p className="text-dark-400">Configuration globale de l'application</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-primary"
                >
                    <Save className="w-4 h-4" />
                    Sauvegarder
                </motion.button>
            </div>

            {/* General Settings */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl"
            >
                <div className="p-6 border-b border-dark-700">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Globe className="w-5 h-5 text-primary-400" />
                        Paramètres généraux
                    </h2>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-2">
                            Nom de l'application
                        </label>
                        <input
                            type="text"
                            value={settings.appName}
                            onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                            className="input"
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-dark-800/50">
                        <div>
                            <div className="font-medium text-white">Mode maintenance</div>
                            <div className="text-sm text-dark-400">Désactive l'accès au site pour les utilisateurs</div>
                        </div>
                        <button
                            onClick={() => handleToggle('maintenanceMode')}
                            className={`relative w-14 h-8 rounded-full transition-colors ${settings.maintenanceMode ? 'bg-red-500' : 'bg-dark-600'
                                }`}
                        >
                            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${settings.maintenanceMode ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-dark-800/50">
                        <div>
                            <div className="font-medium text-white">Autoriser les inscriptions</div>
                            <div className="text-sm text-dark-400">Permet aux nouveaux utilisateurs de s'inscrire</div>
                        </div>
                        <button
                            onClick={() => handleToggle('allowRegistrations')}
                            className={`relative w-14 h-8 rounded-full transition-colors ${settings.allowRegistrations ? 'bg-primary-500' : 'bg-dark-600'
                                }`}
                        >
                            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${settings.allowRegistrations ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-2">
                            Crédits par défaut (nouveaux utilisateurs)
                        </label>
                        <input
                            type="number"
                            value={settings.defaultCredits}
                            onChange={(e) => setSettings({ ...settings, defaultCredits: parseInt(e.target.value) })}
                            className="input w-40"
                        />
                    </div>
                </div>
            </motion.div>

            {/* AI Settings */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card rounded-2xl"
            >
                <div className="p-6 border-b border-dark-700">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-purple-400" />
                        Configuration IA
                    </h2>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-2">
                            Modèle OpenAI par défaut
                        </label>
                        <select
                            value={settings.openaiModel}
                            onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
                            className="input"
                        >
                            <option value="gpt-4o-mini">GPT-4o Mini (économique)</option>
                            <option value="gpt-4o">GPT-4o (équilibré)</option>
                            <option value="gpt-4-turbo">GPT-4 Turbo (puissant)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">
                                Agents Free
                            </label>
                            <input
                                type="number"
                                value={settings.maxAgentsFree}
                                onChange={(e) => setSettings({ ...settings, maxAgentsFree: parseInt(e.target.value) })}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">
                                Agents Starter
                            </label>
                            <input
                                type="number"
                                value={settings.maxAgentsStarter}
                                onChange={(e) => setSettings({ ...settings, maxAgentsStarter: parseInt(e.target.value) })}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">
                                Agents Pro
                            </label>
                            <input
                                type="number"
                                value={settings.maxAgentsPro}
                                onChange={(e) => setSettings({ ...settings, maxAgentsPro: parseInt(e.target.value) })}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">
                                Agents Business
                            </label>
                            <input
                                type="number"
                                value={settings.maxAgentsBusiness}
                                onChange={(e) => setSettings({ ...settings, maxAgentsBusiness: parseInt(e.target.value) })}
                                className="input"
                            />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Payment Settings */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card rounded-2xl"
            >
                <div className="p-6 border-b border-dark-700">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-yellow-400" />
                        Configuration paiements (CinetPay)
                    </h2>
                </div>
                <div className="p-6 space-y-6">
                    <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <div className="font-medium text-yellow-400">Mode Sandbox actif</div>
                            <div className="text-sm text-yellow-400/70">Les paiements sont en mode test. Aucun vrai paiement ne sera effectué.</div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-2">
                            Mode
                        </label>
                        <select
                            value={settings.cinetpayMode}
                            onChange={(e) => setSettings({ ...settings, cinetpayMode: e.target.value })}
                            className="input"
                        >
                            <option value="sandbox">Sandbox (Test)</option>
                            <option value="live">Production (Live)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-2">
                            Site ID
                        </label>
                        <input
                            type="password"
                            value={settings.cinetpaySiteId}
                            className="input"
                            disabled
                        />
                        <p className="text-xs text-dark-500 mt-1">Configuré via les variables d'environnement</p>
                    </div>
                </div>
            </motion.div>

            {/* Email Settings */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card rounded-2xl"
            >
                <div className="p-6 border-b border-dark-700">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Mail className="w-5 h-5 text-blue-400" />
                        Configuration emails
                    </h2>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-dark-800/50">
                        <div>
                            <div className="font-medium text-white">Notifications email</div>
                            <div className="text-sm text-dark-400">Envoyer des emails automatiques aux utilisateurs</div>
                        </div>
                        <button
                            onClick={() => handleToggle('emailNotifications')}
                            className={`relative w-14 h-8 rounded-full transition-colors ${settings.emailNotifications ? 'bg-primary-500' : 'bg-dark-600'
                                }`}
                        >
                            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${settings.emailNotifications ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">
                                Serveur SMTP
                            </label>
                            <input
                                type="text"
                                value={settings.smtpHost}
                                onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">
                                Port SMTP
                            </label>
                            <input
                                type="number"
                                value={settings.smtpPort}
                                onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) })}
                                className="input"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-dark-300 mb-2">
                            Email d'envoi
                        </label>
                        <input
                            type="email"
                            value={settings.smtpUser}
                            onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                            className="input"
                        />
                    </div>
                </div>
            </motion.div>

            {/* Danger Zone */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card rounded-2xl border-2 border-red-500/20"
            >
                <div className="p-6 border-b border-red-500/20">
                    <h2 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Zone dangereuse
                    </h2>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                        <div>
                            <div className="font-medium text-white">Réinitialiser toutes les sessions</div>
                            <div className="text-sm text-dark-400">Déconnecte tous les utilisateurs</div>
                        </div>
                        <button className="btn bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">
                            Réinitialiser
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                        <div>
                            <div className="font-medium text-white">Purger les logs</div>
                            <div className="text-sm text-dark-400">Supprime tous les logs de plus de 30 jours</div>
                        </div>
                        <button className="btn bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">
                            Purger
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
