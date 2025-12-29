'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Loader2, RefreshCw, Smartphone, Check, Link2, QrCode } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface WhatsAppConnectProps {
    sessionId: string
    onConnected?: () => void
}

export default function WhatsAppConnect({ sessionId, onConnected }: WhatsAppConnectProps) {
    const t = useTranslations('Agents.connect')
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [status, setStatus] = useState<'initializing' | 'qr_ready' | 'connected' | 'connecting' | 'disconnected'>('disconnected')
    const [pairingCode, setPairingCode] = useState<string | null>(null)
    const [useLinkingCode, setUseLinkingCode] = useState(false)
    const [phoneNumber, setPhoneNumber] = useState('')

    useEffect(() => {
        // Mock socket connection for demo purposes if no real backend
        // Ideally this connects to your backend socket to receive QR updates
        startConnection()
        return () => {
            // cleanup
        }
    }, [sessionId])

    const startConnection = async () => {
        setStatus('connecting')
        // Simulate QR generation delay
        setTimeout(() => {
            setQrCode('mock-qr-code-data')
            setStatus('qr_ready')
        }, 1500)
    }

    const disconnect = async () => {
        setStatus('disconnected')
        setQrCode(null)
    }

    const handlePairingCode = async (e: React.FormEvent) => {
        e.preventDefault()
        setStatus('connecting')
        // Simulate pairing code generation
        setTimeout(() => {
            setPairingCode('ABC-123-XYZ')
            setStatus('qr_ready')
        }, 1000)
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Status Badge */}
            <div className={`badge ${status === 'connected' ? 'badge-success' :
                status === 'connecting' || status === 'qr_ready' ? 'badge-warning' :
                    'bg-dark-700 text-dark-400 border-dark-600'
                }`}>
                {status === 'connected' ? t('status.connected') :
                    status === 'connecting' ? t('status.connecting') :
                        status === 'qr_ready' ? t('status.qrReady') :
                            t('status.disconnected')}
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Connection Box */}
                <div className="flex-1 w-full relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-secondary-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative p-8 rounded-3xl bg-dark-800/80 backdrop-blur-xl border border-dark-600/50 flex flex-col items-center justify-center min-h-[400px]">

                        {status === 'connecting' ? (
                            <div className="text-center">
                                <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4 mx-auto" />
                                <p className="text-dark-300">{t('preparing')}</p>
                            </div>
                        ) : status === 'connected' ? (
                            <div className="text-center">
                                <div className="w-20 h-20 rounded-full bg-success-500/20 flex items-center justify-center mb-6 mx-auto">
                                    <Check className="w-10 h-10 text-success-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">{t('status.connected')}</h3>
                                <p className="text-dark-300">{t('success.subtitle')}</p>
                            </div>
                        ) : (
                            <>
                                {useLinkingCode ? (
                                    <div className="w-full max-w-sm">
                                        {!pairingCode ? (
                                            <form onSubmit={handlePairingCode} className="flex flex-col gap-4">
                                                <div className="text-center mb-4">
                                                    <h3 className="text-xl font-bold text-white mb-2">{t('methods.code')}</h3>
                                                    <p className="text-dark-300 text-sm">
                                                        {t('codeInstructions.note')}
                                                    </p>
                                                </div>
                                                <input
                                                    type="tel"
                                                    value={phoneNumber}
                                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                                    placeholder={t('codeInstructions.placeholder')}
                                                    className="w-full px-4 py-3 rounded-xl bg-dark-900 border border-dark-700 text-white focus:border-primary-500 outline-none transition-colors"
                                                    required
                                                />
                                                <button
                                                    type="submit"
                                                    className="btn btn-primary w-full py-3"
                                                >
                                                    {t('actions.connect')}
                                                </button>
                                            </form>
                                        ) : (
                                            <div className="text-center">
                                                <p className="text-dark-300 mb-4">{t('codeInstructions.generatedCode')}</p>
                                                <div className="flex justify-center gap-2 text-2xl font-mono font-bold text-white tracking-wider mb-6">
                                                    {pairingCode.split('').map((char, i) => (
                                                        <span key={i} className="w-8 h-10 flex items-center justify-center bg-dark-900 rounded border border-dark-700">
                                                            {char}
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-dark-400">
                                                    {t('codeInstructions.step')}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="bg-white p-4 rounded-2xl">
                                            {qrCode ? (
                                                <QRCodeSVG value={qrCode} size={240} />
                                            ) : (
                                                <div className="w-[240px] h-[240px] bg-dark-100 flex items-center justify-center rounded-xl">
                                                    <span className="text-dark-400">{t('methods.qr')}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap text-sm text-dark-400">
                                            <Smartphone className="w-4 h-4" />
                                            {t('scanPrompt')}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Instructions */}
                <div className="w-full md:w-80 flex flex-col gap-4">
                    <div className="p-6 rounded-2xl bg-dark-800/50 border border-dark-700/50">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Smartphone className="w-5 h-5 text-primary-400" />
                            {t('title')}
                        </h3>
                        <ol className="list-decimal list-inside space-y-3 text-sm text-dark-300 marker:text-primary-500">
                            <li>{t('qrInstructions.step1')}</li>
                            <li>{t('qrInstructions.step2')}</li>
                            <li>{t('qrInstructions.step3')}</li>
                        </ol>
                    </div>

                    {status !== 'connected' && (
                        <>
                            {/* Connection Method Toggle */}
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
                                        {t('methods.qr')}
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
                                        {t('methods.code')}
                                    </div>
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-4">
                                <button
                                    onClick={() => disconnect()}
                                    className="flex-1 btn btn-secondary"
                                >
                                    {t('actions.cancel')}
                                </button>
                                <button
                                    onClick={startConnection}
                                    className="flex-1 btn btn-ghost"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    {t('actions.refresh')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
