-- ============================================================
-- Phase 2 (hardening): normalize function search_path in batch
-- ============================================================

BEGIN;

DO $$
DECLARE
    fn_name text;
    fn_sig text;
BEGIN
    FOR fn_name IN
        SELECT unnest(ARRAY[
            'deduct_credits',
            'update_conversation_on_message',
            'cleanup_old_device_tokens',
            'get_message_stats_last_7_days',
            'add_credits',
            'set_updated_at',
            'handle_new_user',
            'generate_order_number',
            'create_restaurant_order_with_items',
            'products_search_vector_update',
            'expire_unverified_orders',
            'match_documents',
            'reset_monthly_credits',
            'global_search',
            'prevent_agents_ecommerce_mode_update',
            'increment_credits',
            'cleanup_whatsapp_sessions_on_agent_delete',
            'orders_search_vector_update',
            'messages_search_vector_update',
            'conversations_search_vector_update',
            'create_restaurant_booking',
            'update_updated_at_column',
            'create_order_with_items'
        ]::text[])
    LOOP
        FOR fn_sig IN
            SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = fn_name
        LOOP
            EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', fn_sig);
        END LOOP;
    END LOOP;
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, explicit)
-- ============================================================
-- To rollback this phase only:
-- DO $$
-- DECLARE
--     fn_name text;
--     fn_sig text;
-- BEGIN
--     FOR fn_name IN
--         SELECT unnest(ARRAY[
--             'deduct_credits',
--             'update_conversation_on_message',
--             'cleanup_old_device_tokens',
--             'get_message_stats_last_7_days',
--             'add_credits',
--             'set_updated_at',
--             'handle_new_user',
--             'generate_order_number',
--             'create_restaurant_order_with_items',
--             'products_search_vector_update',
--             'expire_unverified_orders',
--             'match_documents',
--             'reset_monthly_credits',
--             'global_search',
--             'prevent_agents_ecommerce_mode_update',
--             'increment_credits',
--             'cleanup_whatsapp_sessions_on_agent_delete',
--             'orders_search_vector_update',
--             'messages_search_vector_update',
--             'conversations_search_vector_update',
--             'create_restaurant_booking',
--             'update_updated_at_column',
--             'create_order_with_items'
--         ]::text[])
--     LOOP
--         FOR fn_sig IN
--             SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
--             FROM pg_proc p
--             JOIN pg_namespace n ON n.oid = p.pronamespace
--             WHERE n.nspname = 'public'
--               AND p.proname = fn_name
--         LOOP
--             EXECUTE format('ALTER FUNCTION %s RESET search_path', fn_sig);
--         END LOOP;
--     END LOOP;
-- END $$;
