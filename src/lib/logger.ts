/**
 * Logger conditionnel — silencieux en production sauf pour error/warn.
 *
 * Usage :
 *   import { logger } from '@/lib/logger'
 *   logger.info('Agent créé', { agentId })   // visible uniquement en dev
 *   logger.error('Paiement échoué', err)      // visible en dev ET production
 */

const isDev = process.env.NODE_ENV !== 'production'

export const logger = {
    /** Visible uniquement en développement */
    debug: (...args: unknown[]) => {
        if (isDev) console.debug('[debug]', ...args)
    },

    /** Visible uniquement en développement */
    info: (...args: unknown[]) => {
        if (isDev) console.log('[info]', ...args)
    },

    /** Visible en développement ET production */
    warn: (...args: unknown[]) => {
        console.warn('[warn]', ...args)
    },

    /** Visible en développement ET production */
    error: (...args: unknown[]) => {
        console.error('[error]', ...args)
    },
}
