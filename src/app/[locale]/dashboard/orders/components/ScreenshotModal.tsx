import type { Dispatch, SetStateAction } from 'react'
import type { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'

interface ScreenshotModalProps {
    t: ReturnType<typeof useTranslations>
    setScreenshotModal: Dispatch<SetStateAction<string | null>>
    screenshotSignedUrl: string | null
    setScreenshotSignedUrl: Dispatch<SetStateAction<string | null>>
    screenshotLoading: boolean
}

export function ScreenshotModal({ t, setScreenshotModal, screenshotSignedUrl, setScreenshotSignedUrl, screenshotLoading }: ScreenshotModalProps) {
    return (
        <div
            onClick={() => { setScreenshotModal(null); setScreenshotSignedUrl(null) }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                cursor: 'pointer'
            }}
        >
            <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
                {screenshotLoading || !screenshotSignedUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 300, height: 300 }}>
                        <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : (
                    <Image
                        src={screenshotSignedUrl}
                        width={1200}
                        height={1600}
                        unoptimized
                        alt={t('screenshotAlt')}
                        style={{ maxWidth: '100%', height: 'auto', maxHeight: '85vh', borderRadius: 12 }}
                    />
                )}
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <button
                        onClick={() => { setScreenshotModal(null); setScreenshotSignedUrl(null) }}
                        style={{
                            padding: '12px 24px',
                            borderRadius: 10,
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        {t('card.close')}
                    </button>
                </div>
            </div>
        </div>
    )
}
