'use client'

import { motion } from 'framer-motion'

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number, cols?: number }) {
    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ height: 48, background: 'rgba(148, 163, 184, 0.1)', borderRadius: 12, width: '100%' }} />
            {Array.from({ length: rows }).map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                    style={{
                        height: 64,
                        background: 'rgba(148, 163, 184, 0.05)',
                        borderRadius: 16,
                        display: 'flex',
                        gap: 16,
                        padding: '0 20px',
                        alignItems: 'center'
                    }}
                >
                    {Array.from({ length: cols }).map((_, j) => (
                        <div key={j} style={{ flex: 1, height: 20, background: 'rgba(148, 163, 184, 0.1)', borderRadius: 8 }} />
                    ))}
                </motion.div>
            ))}
        </div>
    )
}

export function CardSkeleton({ count = 1 }: { count?: number }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, width: '100%' }}>
            {Array.from({ length: count }).map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.4)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 24,
                        padding: 24,
                        height: 200,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(148, 163, 184, 0.1)' }} />
                        <div style={{ height: 20, width: 120, background: 'rgba(148, 163, 184, 0.1)', borderRadius: 8 }} />
                    </div>
                    <div style={{ height: 40, width: '60%', background: 'rgba(148, 163, 184, 0.1)', borderRadius: 8 }} />
                    <div style={{ height: 20, width: '100%', background: 'rgba(148, 163, 184, 0.05)', borderRadius: 8 }} />
                </motion.div>
            ))}
        </div>
    )
}

export function ChartSkeleton() {
    return (
        <motion.div
            initial={{ opacity: 0.5 }}
            animate={{ opacity: [0.5, 0.7, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 24,
                padding: 24,
                height: 400,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 20
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ height: 24, width: 150, background: 'rgba(148, 163, 184, 0.1)', borderRadius: 8 }} />
                <div style={{ height: 24, width: 80, background: 'rgba(148, 163, 184, 0.05)', borderRadius: 8 }} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '20px 0' }}>
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} style={{ flex: 1, height: `${20 + Math.random() * 80}%`, background: 'rgba(148, 163, 184, 0.1)', borderRadius: '4px 4px 0 0' }} />
                ))}
            </div>
        </motion.div>
    )
}
