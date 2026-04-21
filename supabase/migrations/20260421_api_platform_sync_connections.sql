-- Dashboard-managed catalogue sync connections (Woo / Shopify)

create table if not exists public.api_platform_sync_connections (
    id                    uuid primary key default gen_random_uuid(),
    user_id               uuid not null references auth.users(id) on delete cascade,
    agent_id              uuid not null references public.agents(id) on delete cascade,
    name                  text not null,
    provider              text not null check (provider in ('woocommerce', 'shopify')),
    credentials_encrypted jsonb not null,
    credentials_hint      jsonb not null default '{}'::jsonb,
    is_active             boolean not null default true,
    last_tested_at        timestamptz,
    last_test_status_code int,
    last_test_error       text,
    last_synced_at        timestamptz,
    last_sync_status      text not null default 'idle' check (last_sync_status in ('idle', 'running', 'success', 'failed')),
    last_sync_error       text,
    last_sync_count       int not null default 0,
    metadata              jsonb not null default '{}'::jsonb,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create index if not exists idx_api_platform_sync_connections_user_id
    on public.api_platform_sync_connections(user_id);

create index if not exists idx_api_platform_sync_connections_agent_id
    on public.api_platform_sync_connections(agent_id);

create index if not exists idx_api_platform_sync_connections_provider
    on public.api_platform_sync_connections(provider);

alter table public.api_platform_sync_connections enable row level security;

drop policy if exists "Users manage own api_platform_sync_connections" on public.api_platform_sync_connections;
create policy "Users manage own api_platform_sync_connections" on public.api_platform_sync_connections
    for all using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

do $$ begin
    if not exists (
        select 1 from pg_trigger where tgname = 'trg_api_platform_sync_connections_updated_at'
    ) then
        create trigger trg_api_platform_sync_connections_updated_at
            before update on public.api_platform_sync_connections
            for each row execute function public.set_updated_at();
    end if;
end $$;
