'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QrCode, Smartphone, Loader2, CheckCircle, XCircle, RefreshCw, Link2, Unlink } from 'lucide-react'

interface WhatsAppConnectProps {
    agentId: string
    isConnected: boolean
    onConnectionChange?: (connected: boolean) => void
}

type ConnectionStatus = 'idle' | 'connecting' | 'qr_ready' | 'connected' | 'disconnected' | 'error'

export default function WhatsAppConnect({ agentId, isConnected, onConnectionChange }: WhatsAppConnectProps) {
    const [status, setStatus] = useState<ConnectionStatus>(isConnected ? 'connected' : 'idle')
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [linkingCode, setLinkingCode] = useState<string | null>(null)
    const [phoneNumber, setPhoneNumber] = useState('')
    const [useLinkingCode, setUseLinkingCode] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const checkStatus = useCallback(async () => {
        try {
            const res = await fetch(`/api/whatsapp/connect?agentId=${agentId}`)
            const data = await res.json()

            if (data.data) {
                setStatus(data.data.status)
                setQrCode(data.data.qrCode || null)
                setLinkingCode(data.data.linkingCode || null)

                if (data.data.status === 'connected') {
                    onConnectionChange?.(true)
                }
            }
        } catch (err) {
            console.error('Status check error:', err)
        }
    }, [agentId, onConnectionChange])

    // Poll for status updates when connecting
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null

        if (status === 'connecting' || status === 'qr_ready') {
            interval = setInterval(checkStatus, 3000)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [status, checkStatus])

    const startConnection = async () => {
        setError(null)
        setStatus('connecting')

        try {
            const res = await fetch('/api/whatsapp/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId,
                    useLinkingCode,
                    phoneNumber: useLinkingCode ? phoneNumber.replace(/\s/g, '') : undefined,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.message || 'Erreur de connexion')
            }

            setStatus(data.data.status)
            setQrCode(data.data.qrCode || null)
            setLinkingCode(data.data.linkingCode || null)

            if (data.data.status === 'connected') {
                onConnectionChange?.(true)
            }
        } catch (err) {
            setError((err as Error).message)
            setStatus('error')
        }
    }

    const disconnect = async (logout: boolean = false) => {
        try {
            await fetch(`/api/whatsapp/connect?agentId=${agentId}&logout=${logout}`, {
                method: 'DELETE',
            })

            setStatus('disconnected')
            setQrCode(null)
            setLinkingCode(null)
            onConnectionChange?.(false)
        } catch (err) {
            console.error('Disconnect error:', err)
        }
    }

    return (
        <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-primary-400" />
                    Connexion WhatsApp
                </h3>
                <div className={`badge ${status === 'connected' ? 'badge-success' :
                        status === 'connecting' || status === 'qr_ready' ? 'badge-warning' :
                            'bg-dark-700 text-dark-400 border-dark-600'
                    }`}>
                    {status === 'connected' ? 'Connecté' :
                        status === 'connecting' ? 'Connexion...' :
                            status === 'qr_ready' ? 'En attente du scan' :
                                'Déconnecté'}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {status === 'idle' || status === 'disconnected' || status === 'error' ? (
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                    >
                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                                <XCircle className="w-5 h-5 text-red-400" />
                                <span className="text-red-400">{error}</span>
                            </div>
                        )}

                        {/* Connection method toggle */}
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-dark-800/50">
                            <button
                                onClick={() => setUseLinkingCode(false)}
                                className={`flex-1 py-3 rounded-xl font-medium transition-all ${!useLinkingCode
                                        ? 'bg-primary-500 text-white'
                                        : 'bg-dark-700 text-dark-400 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <QrCode className="w-5 h-5" />
                                    QR Code
                                </div>
                            </button>
                            <button
                                onClick={() => setUseLinkingCode(true)}
                                className={`flex-1 py-3 rounded-xl font-medium transition-all ${useLinkingCode
                                        ? 'bg-primary-500 text-white'
                                        : 'bg-dark-700 text-dark-400 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Link2 className="w-5 h-5" />
                                    Code de liaison
                                </div>
                            </button>
                        </div>

                        {useLinkingCode && (
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-2">
                                    Numéro WhatsApp (avec indicatif pays)
                                </label>
                                <input
                                    type="tel"
                                    placeholder="225 07 12 34 56 78"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="input"
                                />
                                <p className="text-xs text-dark-500 mt-2">
                                    Entrez votre numéro sans le + ni d'espaces
                                </p>
                            </div>
                        )}

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={startConnection}
                            disabled={useLinkingCode && !phoneNumber}
                            className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Connecter WhatsApp
                        </motion.button>

                        <p className="text-xs text-dark-500 text-center">
                            {useLinkingCode
                                ? 'Un code à 8 chiffres sera généré pour lier votre WhatsApp.'
                                : 'Un QR code sera généré pour scanner avec votre téléphone.'}
                        </p>
                    </motion.div>
                ) : status === 'connecting' ? (
                    <motion.div
                        key="connecting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center py-8"
                    >
                        <Loader2 className="w-12 h-12 text-primary-400 animate-spin mb-4" />
                        <p className="text-dark-300">Connexion en cours...</p>
                    </motion.div>
                ) : status === 'qr_ready' ? (
                    <motion.div
                        key="qr"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="space-y-6"
                    >
                        {qrCode && (
                            <div className="flex flex-col items-center">
                                <div className="p-4 bg-white rounded-2xl mb-4">
                                    <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64" />
                                </div>
                                <p className="text-dark-300 text-center">
                                    Ouvrez WhatsApp sur votre téléphone → Menu → Appareils liés → Scanner ce QR code
                                </p>
                            </div>
                        )}

                        {linkingCode && (
                            <div className="text-center">
                                <p className="text-dark-400 mb-4">
                                    Ou entrez ce code dans WhatsApp :
                                </p>
                                <div className="text-4xl font-mono font-bold text-primary-400 tracking-widest bg-dark-800 rounded-xl py-4 px-6 inline-block">
                                    {linkingCode}
                                </div>
                                <p className="text-xs text-dark-500 mt-4">
                                    WhatsApp → Paramètres → Appareils liés → Lier un appareil → Lier par numéro de téléphone
                                </p>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button
                                onClick={() => disconnect()}
                                className="flex-1 btn btn-secondary"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={startConnection}
                                className="flex-1 btn btn-ghost"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Rafraîchir
                            </button>
                        </div>
                    </motion.div>
                ) : status === 'connected' ? (
                    <motion.div
                        key="connected"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                    >
                        <div className="flex items-center justify-center gap-4 py-8">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-400" />
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-white">WhatsApp Connecté</div>
                                <div className="text-dark-400">Votre agent est prêt à répondre</div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => disconnect(false)}
                                className="flex-1 btn btn-secondary"
                            >
                                <Unlink className="w-4 h-4" />
                                Déconnecter
                            </button>
                            <button
                                onClick={() => disconnect(true)}
                                className="flex-1 btn bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                            >
                                Supprimer la session
                            </button>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    )
}
