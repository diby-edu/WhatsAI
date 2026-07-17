import cron from 'node-cron'
import { logCronRun } from './cron/shared'
import { checkExpiringSubscriptions, checkExpiredSubscriptions, checkExpiredPaidAccounts } from './cron/subscriptions'
import { sendDailySummary, checkWhatsAppService } from './cron/summary-monitoring'
import { handleArchivedAgentLifecycle, handlePaidAccountCleanup, handleTestAccountCleanup } from './cron/lifecycle'
import { handleCreditExpiry, checkHighCreditUsage } from './cron/credits'
import { handlePlatformCatalogAutoSync } from './cron/catalog-sync'
import { sendOnboardingSequenceEmails } from './cron/onboarding-emails'

// =============================================
// Cron Service - Scheduled tasks (runs in PM2 process)
// =============================================

let cronInitialized = false

/**
 * Initializes all cron jobs.
 * Should be called once at app startup.
 * Safe to call multiple times (idempotent).
 */
export function initCronJobs(): void {
    if (cronInitialized) {
        console.log('⏰ [CRON] Already initialized, skipping.')
        return
    }

    // Only run cron in production to avoid duplicate executions in dev (hot reload)
    if (process.env.NODE_ENV !== 'production') {
        console.log('⏰ [CRON] Skipping cron init in development mode.')
        return
    }

    // Schedule: every day at 8:00 AM UTC
    cron.schedule('0 8 * * *', () => {
        logCronRun('expiring_subscriptions', checkExpiringSubscriptions)
        logCronRun('expired_subscriptions', checkExpiredSubscriptions)
        logCronRun('expired_paid_accounts', checkExpiredPaidAccounts)
        logCronRun('daily_summary', sendDailySummary)
    }, {
        timezone: 'UTC'
    })

    // Onboarding email sequence: every day at 9:00 AM UTC
    cron.schedule('0 9 * * *', () => {
        logCronRun('onboarding_sequence', sendOnboardingSequenceEmails)
    }, {
        timezone: 'UTC'
    })

    // Daily at 22:30 UTC — agent archive lifecycle + credit expiry + 85% usage alert
    cron.schedule('30 22 * * *', () => {
        logCronRun('agent_lifecycle', handleArchivedAgentLifecycle)
        logCronRun('credit_expiry', handleCreditExpiry)
        logCronRun('high_credit_usage', checkHighCreditUsage)
        logCronRun('paid_account_cleanup', handlePaidAccountCleanup)
        logCronRun('test_account_cleanup', handleTestAccountCleanup)
    }, {
        timezone: 'UTC'
    })

    // WhatsApp service health check: every 5 minutes
    cron.schedule('*/5 * * * *', () => {
        logCronRun('whatsapp_health', checkWhatsAppService)
        logCronRun('catalog_sync', handlePlatformCatalogAutoSync)
    }, {
        timezone: 'UTC'
    })

    cronInitialized = true
    console.log('⏰ [CRON] Cron jobs initialized — daily tasks at 8:00/9:00 AM + WhatsApp monitor every 5 min')
}

export { checkWhatsAppService }

// Also export the check functions for manual testing
export {
    checkExpiringSubscriptions,
    checkExpiredSubscriptions,
    checkExpiredPaidAccounts,
    sendDailySummary,
    handleArchivedAgentLifecycle,
    handleCreditExpiry,
    checkHighCreditUsage,
    handlePaidAccountCleanup,
    handleTestAccountCleanup,
    handlePlatformCatalogAutoSync,
    sendOnboardingSequenceEmails,
}
