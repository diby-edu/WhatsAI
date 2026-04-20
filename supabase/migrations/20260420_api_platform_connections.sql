-- Incoming platform webhook connections (direct integration without middleware)

create table if not exists public.api_platform_connections (
    id                    uuid primary key default gen_random_uuid(),
    user_id               uuid not null references auth.users(id) on delete cascade,
    agent_id              uuid not null references public.agents(id) on delete cascade,
    name                  text not null,
    provider              text not null check (provider in ('shopify', 'woocommerce', 'chariow', 'maketou', 'generic')),
    webhook_token         text not null unique,
    signing_secret        text not null,
    allowed_events        text[] default null,
    rate_limit_per_minute int not null default 300 check (rate_limit_per_minute >= 30 and rate_limit_per_minute <= 5000),
    is_active             boolean not null default true,
    last_received_at      timestamptz,
    last_status_code      int,
    last_error            text,
    metadata              jsonb not null default '{}'::jsonb,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create index if not exists idx_api_platform_connections_user_id
    on public.api_platform_connections(user_id);

create index if not exists idx_api_platform_connections_agent_id
    on public.api_platform_connections(agent_id);

create index if not exists idx_api_platform_connections_provider
    on public.api_platform_connections(provider);

alter table public.api_platform_connections enable row level security;

drop policy if exists "Users manage own api_platform_connections" on public.api_platform_connections;
create policy "Users manage own api_platform_connections" on public.api_platform_connections
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
        select 1 from pg_trigger where tgname = 'trg_api_platform_connections_updated_at'
    ) then
        create trigger trg_api_platform_connections_updated_at
            before update on public.api_platform_connections
            for each row execute function public.set_updated_at();
    end if;
end $$;
