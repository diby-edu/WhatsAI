'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { formatPriceFromFcfa } from '@/lib/currency'

interface CurrencyContextType {
    currency: string
    setCurrency: (c: string) => void
    /** Pour les prix stockés en FCFA (produits, commandes) */
    formatFromFcfa: (priceFcfa: number) => string
    /** Pour les prix stockés en USD (plans, packs de crédits) */
    formatFromUsd: (priceUsd: number) => string
}

const CurrencyContext = createContext<CurrencyContextType>({
    currency: 'USD',
    setCurrency: () => {},
    formatFromFcfa: (p) => `$${p}`,
    formatFromUsd: (p) => `$${p}`,
})

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrency] = useState('USD')

    useEffect(() => {
        fetch('/api/profile')
            .then(r => r.json())
            .then(data => {
                if (data.data?.profile?.currency) {
                    setCurrency(data.data.profile.currency)
                }
            })
            .catch(() => {})
    }, [])

    const format = (amount: number): string => {
        if (currency === 'XOF') {
            return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount) + ' FCFA'
        }
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(amount)
    }

    const formatFromFcfa = (priceFcfa: number): string => {
        return formatPriceFromFcfa(priceFcfa, currency)
    }

    const formatFromUsd = (priceUsd: number): string => {
        // Taux : 1 USD = 560 FCFA, 1 USD = 1 EUR (taux buffer)
        let converted = priceUsd
        if (currency === 'XOF') converted = priceUsd * 560
        return format(converted)
    }

    return (
        <CurrencyContext.Provider value={{ currency, setCurrency, formatFromFcfa, formatFromUsd }}>
            {children}
        </CurrencyContext.Provider>
    )
}

export function useCurrency() {
    return useContext(CurrencyContext)
}
