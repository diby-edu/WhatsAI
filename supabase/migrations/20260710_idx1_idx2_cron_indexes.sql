-- IDX-1 / IDX-2 : index composites partiels pour les jobs cron qui scannent
-- orders/bookings en pending (checkPendingPayments, cancelExpiredOrders,
-- cancelExpiredBookingDeposits dans src/lib/whatsapp/cron/jobs.js).
-- CONCURRENTLY : ne bloque pas les écritures pendant la création en prod.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_pending_online
    ON public.orders (status, payment_method, created_at)
    WHERE status = 'pending';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_deposit_pending
    ON public.bookings (status, deposit_status, created_at)
    WHERE booking_source = 'restaurant' AND deposit_required = true;
