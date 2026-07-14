'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function formatFCFA(value: number) {
    const n = Math.round(Number(value) || 0)
    return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`
}

export default function SalesBarChart({ chartData }: { chartData: { date: string; sales: number }[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
                    itemStyle={{ color: 'white' }}
                    formatter={(value) => [formatFCFA(value as number || 0), 'Ventes']}
                />
                <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    )
}
