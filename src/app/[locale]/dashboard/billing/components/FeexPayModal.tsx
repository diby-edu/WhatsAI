'use client'

import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type {
    FeexPayCountryCode,
    FeexPayNetworkCode,
} from '@/lib/payments/feexpay-networks'

interface FeexPayCountry {
    code: FeexPayCountryCode
    name: string
    dialCode: string
}

interface FeexPayNetwork {
    code: FeexPayNetworkCode
    label: string
    supportsHostedRedirect: boolean
}

interface FeexPayModalProps {
    isBrowser: boolean
    showFeexPayModal: boolean
    isLoading: string | null
    feexPayCountry: FeexPayCountryCode
    setFeexPayCountry: (value: FeexPayCountryCode) => void
    feexPayCountries: FeexPayCountry[]
    feexPayNetwork: FeexPayNetworkCode | ''
    setFeexPayNetwork: (value: FeexPayNetworkCode) => void
    feexPayNetworks: FeexPayNetwork[]
    feexPayPhone: string
    setFeexPayPhone: (value: string) => void
    feexPayNeedsOtp: boolean
    feexPayOtp: string
    setFeexPayOtp: (value: string) => void
    selectedFeexPayNetwork: FeexPayNetwork | null
    feexPayError: string | null
    closeFeexPayModal: () => void
    submitFeexPayModal: () => void
}

export function FeexPayModal({
    isBrowser,
    showFeexPayModal,
    isLoading,
    feexPayCountry,
    setFeexPayCountry,
    feexPayCountries,
    feexPayNetwork,
    setFeexPayNetwork,
    feexPayNetworks,
    feexPayPhone,
    setFeexPayPhone,
    feexPayNeedsOtp,
    feexPayOtp,
    setFeexPayOtp,
    selectedFeexPayNetwork,
    feexPayError,
    closeFeexPayModal,
    submitFeexPayModal,
}: FeexPayModalProps) {
    const t = useTranslations('Billing')

    if (!isBrowser || !showFeexPayModal) return null

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.72)',
                backdropFilter: 'blur(4px)',
                zIndex: 9999,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 16,
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 520,
                    background: 'rgba(15, 23, 42, 0.98)',
                    border: '1px solid rgba(148, 163, 184, 0.24)',
                    borderRadius: 14,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                }}
            >
                <div style={{ color: 'white', fontWeight: 700, fontSize: 17 }}>
                    Paiement FeexPay
                </div>
                <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.4 }}>
                    Choisissez le pays, le reseau et le numero payeur Mobile Money.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                        Pays
                        <select
                            value={feexPayCountry}
                            onChange={(event) => setFeexPayCountry(event.target.value as FeexPayCountryCode)}
                            disabled={Boolean(isLoading)}
                            style={{
                                height: 40,
                                borderRadius: 8,
                                border: '1px solid rgba(148, 163, 184, 0.25)',
                                background: 'rgba(15, 23, 42, 0.85)',
                                color: 'white',
                                padding: '0 10px',
                            }}
                        >
                            {feexPayCountries.map((country) => (
                                <option key={country.code} value={country.code}>
                                    {country.name} (+{country.dialCode})
                                </option>
                            ))}
                        </select>
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                        Reseau
                        <select
                            value={feexPayNetwork}
                            onChange={(event) => setFeexPayNetwork(event.target.value as FeexPayNetworkCode)}
                            disabled={Boolean(isLoading)}
                            style={{
                                height: 40,
                                borderRadius: 8,
                                border: '1px solid rgba(148, 163, 184, 0.25)',
                                background: 'rgba(15, 23, 42, 0.85)',
                                color: 'white',
                                padding: '0 10px',
                            }}
                        >
                            {feexPayNetworks.map((network) => (
                                <option key={network.code} value={network.code}>
                                    {network.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                    Numero payeur (format international)
                    <input
                        type="tel"
                        value={feexPayPhone}
                        onChange={(event) => setFeexPayPhone(event.target.value)}
                        placeholder="+2250700000000"
                        disabled={Boolean(isLoading)}
                        style={{
                            height: 40,
                            borderRadius: 8,
                            border: '1px solid rgba(148, 163, 184, 0.25)',
                            background: 'rgba(15, 23, 42, 0.85)',
                            color: 'white',
                            padding: '0 10px',
                        }}
                    />
                </label>

                {feexPayNeedsOtp && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                        OTP
                        <input
                            type="text"
                            value={feexPayOtp}
                            onChange={(event) => setFeexPayOtp(event.target.value)}
                            placeholder="Code OTP"
                            disabled={Boolean(isLoading)}
                            style={{
                                height: 40,
                                borderRadius: 8,
                                border: '1px solid rgba(148, 163, 184, 0.25)',
                                background: 'rgba(15, 23, 42, 0.85)',
                                color: 'white',
                                padding: '0 10px',
                            }}
                        />
                    </label>
                )}

                {selectedFeexPayNetwork && (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        Canal: {selectedFeexPayNetwork.label} ({selectedFeexPayNetwork.supportsHostedRedirect ? 'redirection web' : 'confirmation mobile'})
                    </div>
                )}

                {feexPayError && (
                    <div style={{ color: '#f87171', fontSize: 12 }}>
                        {feexPayError}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                    <button
                        type="button"
                        onClick={closeFeexPayModal}
                        disabled={Boolean(isLoading)}
                        style={{
                            height: 38,
                            borderRadius: 8,
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            background: 'rgba(51, 65, 85, 0.5)',
                            color: 'white',
                            padding: '0 14px',
                            cursor: 'pointer',
                        }}
                    >
                        {t('FeexPay.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={submitFeexPayModal}
                        disabled={Boolean(isLoading)}
                        style={{
                            height: 38,
                            borderRadius: 8,
                            border: 'none',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: 'white',
                            padding: '0 14px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                                {t('FeexPay.initializing')}
                            </>
                        ) : t('FeexPay.continue')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
