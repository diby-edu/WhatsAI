'use client'

import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

export function RevenueAreaChart({ data }: { data: any[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="colorPlatform" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMerchant" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12, color: 'white' }} />
                <Legend verticalAlign="top" height={36} align="right" />
                <Area type="monotone" dataKey="Plateforme" stroke="#34d399" strokeWidth={3} fillOpacity={1} fill="url(#colorPlatform)" />
                <Area type="monotone" dataKey="Marchands" stroke="#60a5fa" strokeWidth={3} fillOpacity={1} fill="url(#colorMerchant)" />
            </AreaChart>
        </ResponsiveContainer>
    )
}

export function UsersBarChart({ data }: { data: any[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.05)' }} contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12 }} />
                <Bar dataKey="Utilisateurs" fill="#a78bfa" radius={[6, 6, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    )
}

export function MessagesAreaChart({ data }: { data: any[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12 }} />
                <Area type="stepAfter" dataKey="Messages" stroke="#fb7185" strokeWidth={3} fill="rgba(251, 113, 133, 0.1)" />
            </AreaChart>
        </ResponsiveContainer>
    )
}
