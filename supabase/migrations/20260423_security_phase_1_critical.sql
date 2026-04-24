-- ============================================================
-- Phase 1 (critical): exposure + user_metadata policies + always-true policies
-- Safe for production: idempotent and guarded by existence checks.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0) Helper function for admin checks based on profiles.role
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT p.role
    INTO v_role
    FROM public.profiles p
    WHERE p.id = auth.uid()
    LIMIT 1;

    RETURN v_role IN ('admin', 'superadmin');
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated, service_role;

-- ------------------------------------------------------------
-- 1) Remove any policy that references auth.user_metadata
-- ------------------------------------------------------------
DO $$
DECLARE
    rec record;
BEGIN
    FOR rec IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND (
            COALESCE(qual, '') ILIKE '%user_metadata%'
            OR COALESCE(with_check, '') ILIKE '%user_metadata%'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
    END LOOP;
END $$;

-- Explicit legacy names seen in production.
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do everything on agents" ON public.agents;

-- Recreate safe admin policies based on profiles.role helper.
DROP POLICY IF EXISTS "profiles_admin_manage_by_role" ON public.profiles;
CREATE POLICY "profiles_admin_manage_by_role"
    ON public.profiles
    FOR ALL
    TO authenticated
    USING (public.current_user_is_admin())
    WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "agents_admin_manage_by_role" ON public.agents;
CREATE POLICY "agents_admin_manage_by_role"
    ON public.agents
    FOR ALL
    TO authenticated
    USING (public.current_user_is_admin())
    WITH CHECK (public.current_user_is_admin());

-- ------------------------------------------------------------
-- 2) Exposure fixes: RLS + minimum grants/policies
-- ------------------------------------------------------------

-- 2.a whatsapp_sessions
DO $$
DECLARE
    has_user_id boolean;
BEGIN
    IF to_regclass('public.whatsapp_sessions') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Users can view own whatsapp sessions" ON public.whatsapp_sessions';
        EXECUTE 'DROP POLICY IF EXISTS "Users can create whatsapp sessions" ON public.whatsapp_sessions';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update own whatsapp sessions" ON public.whatsapp_sessions';
        EXECUTE 'DROP POLICY IF EXISTS "Users can delete own whatsapp sessions" ON public.whatsapp_sessions';
        EXECUTE 'DROP POLICY IF EXISTS "whatsapp_sessions_user_select_own" ON public.whatsapp_sessions';
        EXECUTE 'DROP POLICY IF EXISTS "whatsapp_sessions_user_insert_own" ON public.whatsapp_sessions';
        EXECUTE 'DROP POLICY IF EXISTS "whatsapp_sessions_user_update_own" ON public.whatsapp_sessions';
        EXECUTE 'DROP POLICY IF EXISTS "whatsapp_sessions_user_delete_own" ON public.whatsapp_sessions';
        EXECUTE 'DROP POLICY IF EXISTS "whatsapp_sessions_service_role_all" ON public.whatsapp_sessions';

        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'whatsapp_sessions'
              AND column_name = 'user_id'
        ) INTO has_user_id;

        IF has_user_id THEN
            EXECUTE 'CREATE POLICY "whatsapp_sessions_user_select_own" ON public.whatsapp_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id)';
            EXECUTE 'CREATE POLICY "whatsapp_sessions_user_insert_own" ON public.whatsapp_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
            EXECUTE 'CREATE POLICY "whatsapp_sessions_user_update_own" ON public.whatsapp_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
            EXECUTE 'CREATE POLICY "whatsapp_sessions_user_delete_own" ON public.whatsapp_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id)';
            EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_sessions TO authenticated';
        ELSE
            EXECUTE 'REVOKE ALL ON public.whatsapp_sessions FROM authenticated, anon';
        END IF;

        EXECUTE 'CREATE POLICY "whatsapp_sessions_service_role_all" ON public.whatsapp_sessions FOR ALL TO service_role USING (true) WITH CHECK (true)';
        EXECUTE 'GRANT ALL ON public.whatsapp_sessions TO service_role';
    END IF;
END $$;

-- 2.b admin_audit_logs
DO $$
BEGIN
    IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "admin_audit_logs_service_role_all" ON public.admin_audit_logs';
        EXECUTE 'DROP POLICY IF EXISTS "admin_audit_logs_admin_read" ON public.admin_audit_logs';

        EXECUTE 'CREATE POLICY "admin_audit_logs_service_role_all" ON public.admin_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "admin_audit_logs_admin_read" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.current_user_is_admin())';

        EXECUTE 'REVOKE ALL ON public.admin_audit_logs FROM anon';
        EXECUTE 'GRANT SELECT ON public.admin_audit_logs TO authenticated';
        EXECUTE 'GRANT ALL ON public.admin_audit_logs TO service_role';
    END IF;
END $$;

-- 2.c subscription_plans
DO $$
BEGIN
    IF to_regclass('public.subscription_plans') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Anyone can read active plans" ON public.subscription_plans';
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage plans" ON public.subscription_plans';
        EXECUTE 'DROP POLICY IF EXISTS "subscription_plans_public_read_active" ON public.subscription_plans';
        EXECUTE 'DROP POLICY IF EXISTS "subscription_plans_admin_manage" ON public.subscription_plans';
        EXECUTE 'DROP POLICY IF EXISTS "subscription_plans_service_role_all" ON public.subscription_plans';

        EXECUTE 'CREATE POLICY "subscription_plans_public_read_active" ON public.subscription_plans FOR SELECT TO anon, authenticated USING (is_active = true)';
        EXECUTE 'CREATE POLICY "subscription_plans_admin_manage" ON public.subscription_plans FOR ALL TO authenticated USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin())';
        EXECUTE 'CREATE POLICY "subscription_plans_service_role_all" ON public.subscription_plans FOR ALL TO service_role USING (true) WITH CHECK (true)';

        EXECUTE 'GRANT SELECT ON public.subscription_plans TO anon, authenticated';
        EXECUTE 'GRANT ALL ON public.subscription_plans TO service_role';
    END IF;
END $$;

-- 2.d app_settings
DO $$
BEGIN
    IF to_regclass('public.app_settings') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "app_settings_service_role_all" ON public.app_settings';
        EXECUTE 'DROP POLICY IF EXISTS "app_settings_admin_manage" ON public.app_settings';

        EXECUTE 'CREATE POLICY "app_settings_service_role_all" ON public.app_settings FOR ALL TO service_role USING (true) WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "app_settings_admin_manage" ON public.app_settings FOR ALL TO authenticated USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin())';

        EXECUTE 'REVOKE ALL ON public.app_settings FROM anon';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated';
        EXECUTE 'GRANT ALL ON public.app_settings TO service_role';
    END IF;
END $$;

-- ------------------------------------------------------------
-- 3) Security-definer views: switch to security invoker + tighten grants
-- ------------------------------------------------------------
DO $$
DECLARE
    is_pg15_or_more boolean := current_setting('server_version_num')::int >= 150000;
BEGIN
    IF is_pg15_or_more THEN
        IF to_regclass('public.credit_usage_stats') IS NOT NULL THEN
            EXECUTE 'ALTER VIEW public.credit_usage_stats SET (security_invoker = true)';
            EXECUTE 'REVOKE ALL ON public.credit_usage_stats FROM anon, authenticated';
            EXECUTE 'GRANT SELECT ON public.credit_usage_stats TO service_role';
        END IF;

        IF to_regclass('public.view_admin_alerts') IS NOT NULL THEN
            EXECUTE 'ALTER VIEW public.view_admin_alerts SET (security_invoker = true)';
            EXECUTE 'REVOKE ALL ON public.view_admin_alerts FROM anon, authenticated';
            EXECUTE 'GRANT SELECT ON public.view_admin_alerts TO service_role';
        END IF;

        IF to_regclass('public.view_analytics_payments') IS NOT NULL THEN
            EXECUTE 'ALTER VIEW public.view_analytics_payments SET (security_invoker = true)';
            EXECUTE 'REVOKE ALL ON public.view_analytics_payments FROM anon, authenticated';
            EXECUTE 'GRANT SELECT ON public.view_analytics_payments TO service_role';
        END IF;
    END IF;
END $$;

-- ------------------------------------------------------------
-- 4) "Always true" policies scoped explicitly to service_role
-- ------------------------------------------------------------

-- leads
DO $$
BEGIN
    IF to_regclass('public.leads') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "leads_insert_service_role" ON public.leads';
        EXECUTE 'CREATE POLICY "leads_insert_service_role" ON public.leads FOR INSERT TO service_role WITH CHECK (true)';
    END IF;
END $$;

-- payouts
DO $$
BEGIN
    IF to_regclass('public.payouts') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Service role full access to payouts" ON public.payouts';
        EXECUTE 'CREATE POLICY "Service role full access to payouts" ON public.payouts FOR ALL TO service_role USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- audit_logs (table can be absent depending on environment)
DO $$
BEGIN
    IF to_regclass('public.audit_logs') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs';
        EXECUTE 'CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT TO service_role WITH CHECK (true)';
    END IF;
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, explicit)
-- ============================================================
-- 1) Remove new helper/admin policies:
--    DROP FUNCTION IF EXISTS public.current_user_is_admin();
--    DROP POLICY IF EXISTS "profiles_admin_manage_by_role" ON public.profiles;
--    DROP POLICY IF EXISTS "agents_admin_manage_by_role" ON public.agents;
--
-- 2) Restore previous grants if needed:
--    GRANT SELECT ON public.credit_usage_stats TO authenticated;
--    GRANT SELECT ON public.view_admin_alerts TO authenticated;
--    GRANT SELECT ON public.view_analytics_payments TO authenticated;
--    GRANT SELECT ON public.app_settings TO authenticated;
--    GRANT SELECT ON public.admin_audit_logs TO authenticated;
--
-- 3) Recreate legacy policies only if required by your old behavior.
