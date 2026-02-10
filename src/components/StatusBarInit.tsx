'use client'

import { useEffect } from 'react'
import { initStatusBar } from '@/lib/capacitor/status-bar'

export default function StatusBarInit() {
    useEffect(() => {
        initStatusBar()
    }, [])

    return null // This component doesn't render anything
}
