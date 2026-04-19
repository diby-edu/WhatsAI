alter table public.agents
add column if not exists ecommerce_mode text not null default 'native';

update public.agents
set ecommerce_mode = 'native'
where ecommerce_mode is null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'agents_ecommerce_mode_check'
    ) then
        alter table public.agents
        add constraint agents_ecommerce_mode_check
        check (ecommerce_mode in ('native', 'external_sync'));
    end if;
end $$;

comment on column public.agents.ecommerce_mode is
    'Mode e-commerce de l''agent: native = catalogue/checkout WazzapAI, external_sync = catalogue externe synchronise + checkout externe.';
