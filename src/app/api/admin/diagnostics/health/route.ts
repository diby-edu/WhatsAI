import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-utils'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
    try {
        const health: any = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {},
            cpu: {},
            disk: null,
            nodeVersion: process.version,
            platform: os.platform()
        }

        // Memory usage
        const memUsage = process.memoryUsage()
        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const usedMem = totalMem - freeMem
        const memPercent = Math.round((usedMem / totalMem) * 100)

        health.memory = {
            total: formatBytes(totalMem),
            used: formatBytes(usedMem),
            free: formatBytes(freeMem),
            percent: memPercent,
            heapUsed: formatBytes(memUsage.heapUsed),
            heapTotal: formatBytes(memUsage.heapTotal),
            status: memPercent > 90 ? 'critical' : memPercent > 75 ? 'warning' : 'ok'
        }

        // CPU usage
        const cpus = os.cpus()
        const loadAvg = os.loadavg()
        health.cpu = {
            cores: cpus.length,
            model: cpus[0]?.model || 'Unknown',
            loadAverage: {
                '1min': loadAvg[0].toFixed(2),
                '5min': loadAvg[1].toFixed(2),
                '15min': loadAvg[2].toFixed(2)
            },
            status: loadAvg[0] > cpus.length * 0.9 ? 'critical' : loadAvg[0] > cpus.length * 0.7 ? 'warning' : 'ok'
        }

        // Disk usage (Linux/macOS only)
        if (os.platform() !== 'win32') {
            try {
                const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $2,$3,$4,$5}'")
                const parts = stdout.trim().split(' ')
                if (parts.length >= 4) {
                    const usedPercent = parseInt(parts[3].replace('%', ''))
                    health.disk = {
                        total: parts[0],
                        used: parts[1],
                        available: parts[2],
                        percent: usedPercent,
                        status: usedPercent > 90 ? 'critical' : usedPercent > 80 ? 'warning' : 'ok'
                    }
                }
            } catch (err) {
                health.disk = { error: 'Unable to check disk', status: 'unknown' }
            }
        } else {
            health.disk = { status: 'not_available', message: 'Windows - check manually' }
        }

        // Uptime formatted
        const uptimeSeconds = process.uptime()
        const days = Math.floor(uptimeSeconds / 86400)
        const hours = Math.floor((uptimeSeconds % 86400) / 3600)
        const minutes = Math.floor((uptimeSeconds % 3600) / 60)
        health.uptimeFormatted = `${days}j ${hours}h ${minutes}m`

        // Overall status
        const statuses = [health.memory.status, health.cpu.status, health.disk?.status].filter(Boolean)
        health.overallStatus = statuses.includes('critical') ? 'critical'
            : statuses.includes('warning') ? 'warning' : 'ok'

        return successResponse(health)
    } catch (err: any) {
        console.error('Health check error:', err)
        return errorResponse('Erreur health check', 500)
    }
}

function formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i]
}
