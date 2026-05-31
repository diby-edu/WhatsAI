'use client'

import { createContext, useContext, useState, useCallback } from 'react'

export type UpgradeReason = 'agent_limit' | 'low_credits' | 'session' | 'feature_locked'

type UpgradeModalContextType = {
    openUpgradeModal: (reason?: UpgradeReason) => void
    closeUpgradeModal: () => void
    isOpen: boolean
    reason: UpgradeReason | null
}

const UpgradeModalContext = createContext<UpgradeModalContextType>({
    openUpgradeModal: () => {},
    closeUpgradeModal: () => {},
    isOpen: false,
    reason: null,
})

export function UpgradeModalProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [reason, setReason] = useState<UpgradeReason | null>(null)

    const openUpgradeModal = useCallback((r?: UpgradeReason) => {
        setReason(r ?? 'session')
        setIsOpen(true)
    }, [])

    const closeUpgradeModal = useCallback(() => {
        setIsOpen(false)
    }, [])

    return (
        <UpgradeModalContext.Provider value={{ openUpgradeModal, closeUpgradeModal, isOpen, reason }}>
            {children}
        </UpgradeModalContext.Provider>
    )
}

export function useUpgradeModal() {
    return useContext(UpgradeModalContext)
}
