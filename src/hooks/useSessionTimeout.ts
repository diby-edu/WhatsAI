'use client'

import { useEffect, useRef } from 'react'

export function useSessionTimeout(
    timeoutHours: number | null,
    onTimeout: () => void | Promise<void>
) {
    const timeoutRef = useRef(onTimeout)

    useEffect(() => {
        timeoutRef.current = onTimeout
    }, [onTimeout])

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!timeoutHours || timeoutHours <= 0) return

        const timeoutMs = timeoutHours * 60 * 60 * 1000
        let timer: number | null = null

        const resetTimer = () => {
            if (timer !== null) {
                window.clearTimeout(timer)
            }

            timer = window.setTimeout(() => {
                void timeoutRef.current()
            }, timeoutMs)
        }

        const events: Array<keyof WindowEventMap> = [
            'mousemove',
            'mousedown',
            'keydown',
            'scroll',
            'touchstart',
        ]

        resetTimer()

        for (const eventName of events) {
            window.addEventListener(eventName, resetTimer, { passive: true })
        }

        window.addEventListener('focus', resetTimer)

        return () => {
            if (timer !== null) {
                window.clearTimeout(timer)
            }

            for (const eventName of events) {
                window.removeEventListener(eventName, resetTimer)
            }

            window.removeEventListener('focus', resetTimer)
        }
    }, [timeoutHours])
}
