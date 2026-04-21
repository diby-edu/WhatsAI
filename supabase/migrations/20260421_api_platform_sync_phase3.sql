-- Phase 3: automatic sync scheduling + retries + execution traces

alter table public.api_platform_sync_connections
    add column if not exists auto_sync_enabled boolean not null default false;

alter table public.api_platform_sync_connections
    add column if not exists sync_interval_minutes int not null default 15;

do $$ begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'api_platform_sync_connections_sync_interval_check'
    ) then
        alter table public.api_platform_sync_connections
            add constraint api_platform_sync_connections_sync_interval_check
            check (sync_interval_minutes >= 5 and sync_interval_minutes <= 1440);
    end if;
end $$;

alter table public.api_platform_sync_connections
    add column if not exists retry_count int not null default 0;

alter table public.api_platform_sync_connections
    add column if not exists next_retry_at timestamptz;

alter table public.api_platform_sync_connections
    add column if not exists last_sync_started_at timestamptz;

alter table public.api_platform_sync_connections
    add column if not exists last_sync_finished_at timestamptz;

create table if not exists public.api_platform_sync_runs (
    id             uuid primary key default gen_random_uuid(),
    connection_id  uuid not null references public.api_platform_sync_connections(id) on delete cascade,
    user_id        uuid not null references auth.users(id) on delete cascade,
    agent_id       uuid not null references public.agents(id) on delete cascade,
    trigger_source text not null check (trigger_source in ('manual', 'cron')),
    status         text not null check (status in ('success', 'failed')),
    fetched_count  int not null default 0,
    synced_count   int not null default 0,
    has_more       boolean not null default false,
    error          text,
    started_at     timestamptz not null,
    finished_at    timestamptz not null,
    created_at     timestamptz not null default now()
);

create index if not exists idx_api_platform_sync_runs_connection_id
    on public.api_platform_sync_runs(connection_id, created_at desc);

create index if not exists idx_api_platform_sync_runs_user_id
    on public.api_platform_sync_runs(user_id, created_at desc);

alter table public.api_platform_sync_runs enable row level security;

drop policy if exists "Users view own api_platform_sync_runs" on public.api_platform_sync_runs;
create policy "Users view own api_platform_sync_runs" on public.api_platform_sync_runs
    for select using (auth.uid() = user_id);

drop policy if exists "Service role manage api_platform_sync_runs" on public.api_platform_sync_runs;
create policy "Service role manage api_platform_sync_runs" on public.api_platform_sync_runs
    for all using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');
