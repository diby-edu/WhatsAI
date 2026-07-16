import { NextRequest } from 'next/server'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

const execAsync = promisify(exec)

function formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    const index = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, index))} ${sizes[index]}`
}

type HealthStatus = 'ok' | 'warning' | 'critical' | 'not_available'

interface HealthReport {
    timestamp: string
    uptime: number
    nodeVersion: string
    platform: string
    memory: {
        total: string
        used: string
        free: string
        percent: number
        heapUsed: string
        heapTotal: string
        status: HealthStatus
    }
    cpu: {
        cores: number
        model: string
        loadAverage: { '1min': string; '5min': string; '15min': string }
        status: HealthStatus
    }
    disk: {
        status: HealthStatus
        message?: string
        total?: string
        used?: string
        available?: string
        percent?: number
    }
    uptimeFormatted?: string
    overallStatus?: HealthStatus
}

export async function GET(request: NextRequest) {
    const { response } = await requireAdminAccess()
    if (response) return response

    try {
        const memoryUsage = process.memoryUsage()
        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const usedMem = totalMem - freeMem
        const memPercent = Math.round((usedMem / totalMem) * 100)
        const cpus = os.cpus()
        const loadAvg = os.loadavg()

        const health: HealthReport = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: os.platform(),
            memory: {
                total: formatBytes(totalMem),
                used: formatBytes(usedMem),
                free: formatBytes(freeMem),
                percent: memPercent,
                heapUsed: formatBytes(memoryUsage.heapUsed),
                heapTotal: formatBytes(memoryUsage.heapTotal),
                status: memPercent > 90 ? 'critical' : memPercent > 75 ? 'warning' : 'ok',
            },
            cpu: {
                cores: cpus.length,
                model: cpus[0]?.model || 'Unknown',
                loadAverage: {
                    '1min': loadAvg[0].toFixed(2),
                    '5min': loadAvg[1].toFixed(2),
                    '15min': loadAvg[2].toFixed(2),
                },
                status: loadAvg[0] > cpus.length * 0.9 ? 'critical' : loadAvg[0] > cpus.length * 0.7 ? 'warning' : 'ok',
            },
            disk: { status: 'not_available', message: 'Unavailable' },
        }

        if (os.platform() !== 'win32') {
            try {
                const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $2,$3,$4,$5}'")
                const parts = stdout.trim().split(' ')
                const usedPercent = parseInt(parts[3]?.replace('%', '') || '0', 10)
                health.disk = {
                    total: parts[0],
                    used: parts[1],
                    available: parts[2],
                    percent: usedPercent,
                    status: usedPercent > 90 ? 'critical' : usedPercent > 80 ? 'warning' : 'ok',
                }
            } catch {
                health.disk = { status: 'warning', message: 'Disk check unavailable' }
            }
        }

        const uptimeSeconds = process.uptime()
        const days = Math.floor(uptimeSeconds / 86400)
        const hours = Math.floor((uptimeSeconds % 86400) / 3600)
        const minutes = Math.floor((uptimeSeconds % 3600) / 60)
        health.uptimeFormatted = `${days}j ${hours}h ${minutes}m`

        const statuses = [health.memory.status, health.cpu.status, health.disk?.status].filter(Boolean)
        health.overallStatus = statuses.includes('critical') ? 'critical' : statuses.includes('warning') ? 'warning' : 'ok'

        return successResponse(health)
    } catch (err: unknown) {
        console.error('Health check error:', err)
        const message = err instanceof Error ? err.message : 'Erreur health check'
        return errorResponse(message, 500)
    }
}
