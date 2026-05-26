'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertCircle, X, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
    id: string
    type: ToastType
    message: string
}

interface ConfirmOptions {
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
}

interface ToastContextValue {
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
    warning: (message: string) => void
    confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used within ToastProvider')
    return ctx
}

const ICONS: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 style={{ width: 18, height: 18, flexShrink: 0, color: '#34d399' }} />,
    error:   <XCircle      style={{ width: 18, height: 18, flexShrink: 0, color: '#f87171' }} />,
    warning: <AlertCircle  style={{ width: 18, height: 18, flexShrink: 0, color: '#fbbf24' }} />,
    info:    <Info         style={{ width: 18, height: 18, flexShrink: 0, color: '#60a5fa' }} />,
}

const COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  text: '#d1fae5' },
    error:   { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: '#fecaca' },
    warning: { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  text: '#fde68a' },
    info:    { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)',  text: '#bfdbfe' },
}

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
    const c = COLORS[item.type]
    useEffect(() => {
        const t = setTimeout(() => onRemove(item.id), 4000)
        return () => clearTimeout(t)
    }, [item.id, onRemove])

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderRadius: 12,
            background: c.bg, border: `1px solid ${c.border}`,
            color: c.text, fontSize: 14, fontWeight: 500,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            minWidth: 260, maxWidth: 380,
            animation: 'slideInToast 0.2s ease',
        }}>
            {ICONS[item.type]}
            <span style={{ flex: 1 }}>{item.message}</span>
            <button onClick={() => onRemove(item.id)} style={{ background: 'none', border: 'none', color: c.text, cursor: 'pointer', padding: 2, opacity: 0.7, display: 'flex' }}>
                <X style={{ width: 14, height: 14 }} />
            </button>
        </div>
    )
}

interface ConfirmState extends ConfirmOptions {
    resolve: (value: boolean) => void
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])
    const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
    const idRef = useRef(0)

    const push = useCallback((type: ToastType, message: string) => {
        const id = String(++idRef.current)
        setToasts(prev => [...prev, { id, type, message }])
    }, [])

    const remove = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise(resolve => {
            setConfirmState({ ...options, resolve })
        })
    }, [])

    const handleConfirm = (value: boolean) => {
        confirmState?.resolve(value)
        setConfirmState(null)
    }

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && confirmState) handleConfirm(false)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [confirmState])

    const ctx: ToastContextValue = {
        success: (m) => push('success', m),
        error:   (m) => push('error', m),
        info:    (m) => push('info', m),
        warning: (m) => push('warning', m),
        confirm,
    }

    return (
        <ToastContext.Provider value={ctx}>
            {children}

            {/* Toast stack */}
            <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
                <style>{`
                    @keyframes slideInToast {
                        from { opacity: 0; transform: translateY(12px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
                {toasts.map(t => <ToastItem key={t.id} item={t} onRemove={remove} />)}
            </div>

            {/* Confirm modal */}
            {confirmState && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                    onClick={(e) => { if (e.target === e.currentTarget) handleConfirm(false) }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 16, padding: 28, maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                            <h3 style={{ color: 'white', fontWeight: 700, fontSize: 17, margin: 0, marginBottom: 8 }}>{confirmState.title}</h3>
                            {confirmState.message && <p style={{ color: '#94a3b8', fontSize: 14, margin: 0, lineHeight: 1.6 }}>{confirmState.message}</p>}
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => handleConfirm(false)} style={{ padding: '9px 20px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(30,41,59,0.8)', color: '#94a3b8', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                                {confirmState.cancelLabel ?? 'Annuler'}
                            </button>
                            <button onClick={() => handleConfirm(true)} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: confirmState.danger ? '#dc2626' : 'linear-gradient(135deg,#10b981,#059669)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                                {confirmState.confirmLabel ?? 'Confirmer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ToastContext.Provider>
    )
}
