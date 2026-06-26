'use client'

import { useEffect } from 'react'

const RELOAD_KEY = 'chunk_reload_at'
const COOLDOWN_MS = 10_000

function isChunkError(message: string): boolean {
    return (
        message.includes('ChunkLoadError') ||
        message.includes('Loading chunk') ||
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('Importing a module script failed')
    )
}

function tryReload() {
    try {
        const last = sessionStorage.getItem(RELOAD_KEY)
        if (last && Date.now() - parseInt(last) < COOLDOWN_MS) return
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
        window.location.reload()
    } catch {
        // sessionStorage indisponible (mode privé strict) — ne rien faire
    }
}

export default function ChunkErrorReload() {
    useEffect(() => {
        const handleError = (e: ErrorEvent) => {
            if (e.message && isChunkError(e.message)) tryReload()
        }

        const handleRejection = (e: PromiseRejectionEvent) => {
            const msg = e.reason?.message || String(e.reason || '')
            if (isChunkError(msg)) tryReload()
        }

        window.addEventListener('error', handleError)
        window.addEventListener('unhandledrejection', handleRejection)

        return () => {
            window.removeEventListener('error', handleError)
            window.removeEventListener('unhandledrejection', handleRejection)
        }
    }, [])

    return null
}
