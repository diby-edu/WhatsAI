'use client'

import { useEffect, useRef } from 'react'

// Audit F-08 : widget CAPTCHA Cloudflare Turnstile.
// La Site Key est PUBLIQUE (elle apparaît dans le HTML) — surchargeable via
// NEXT_PUBLIC_TURNSTILE_SITE_KEY, avec repli sur la clé du projet WazzapAI.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAFHOaAYa8MVVQEAf'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
    interface Window {
        turnstile?: any
    }
}

let scriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    if (window.turnstile) return Promise.resolve()
    if (scriptPromise) return scriptPromise

    scriptPromise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
        if (existing) {
            existing.addEventListener('load', () => resolve())
            existing.addEventListener('error', () => reject(new Error('Turnstile load error')))
            return
        }
        const s = document.createElement('script')
        s.src = SCRIPT_SRC
        s.async = true
        s.defer = true
        s.onload = () => resolve()
        s.onerror = () => reject(new Error('Turnstile load error'))
        document.head.appendChild(s)
    })
    return scriptPromise
}

type TurnstileWidgetProps = {
    onVerify: (token: string) => void
    onExpire?: () => void
    /** Incrémenter cette valeur force la régénération d'un jeton (les jetons sont à usage unique). */
    resetSignal?: number
    className?: string
}

export default function TurnstileWidget({ onVerify, onExpire, resetSignal = 0, className }: TurnstileWidgetProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const widgetIdRef = useRef<string | null>(null)
    const onVerifyRef = useRef(onVerify)
    const onExpireRef = useRef(onExpire)

    // Garder les callbacks à jour sans re-render le widget (évite les closures périmées).
    useEffect(() => {
        onVerifyRef.current = onVerify
        onExpireRef.current = onExpire
    })

    // Rendu unique du widget.
    useEffect(() => {
        let cancelled = false
        loadTurnstileScript()
            .then(() => {
                if (cancelled || !containerRef.current || !window.turnstile) return
                if (widgetIdRef.current !== null) return
                widgetIdRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: SITE_KEY,
                    callback: (token: string) => onVerifyRef.current?.(token),
                    'expired-callback': () => onExpireRef.current?.(),
                    'error-callback': () => onExpireRef.current?.(),
                })
            })
            .catch(() => {
                // Chargement impossible (réseau/bloqueur) : on reste silencieux ;
                // la soumission échouera proprement si le CAPTCHA est requis côté serveur.
            })
        return () => {
            cancelled = true
            if (widgetIdRef.current !== null && window.turnstile) {
                try { window.turnstile.remove(widgetIdRef.current) } catch { /* noop */ }
                widgetIdRef.current = null
            }
        }
    }, [])

    // Régénère un jeton quand le parent le demande (après un échec de soumission).
    useEffect(() => {
        if (resetSignal > 0 && widgetIdRef.current !== null && window.turnstile) {
            try { window.turnstile.reset(widgetIdRef.current) } catch { /* noop */ }
        }
    }, [resetSignal])

    return <div ref={containerRef} className={className} />
}
