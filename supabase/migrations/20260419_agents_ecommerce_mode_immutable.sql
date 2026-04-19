create or replace function public.prevent_agents_ecommerce_mode_update()
returns trigger
language plpgsql
as $$
begin
    if old.ecommerce_mode is distinct from new.ecommerce_mode then
        raise exception 'agents.ecommerce_mode is immutable after creation';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_agents_ecommerce_mode_immutable on public.agents;

create trigger trg_agents_ecommerce_mode_immutable
before update of ecommerce_mode on public.agents
for each row
execute function public.prevent_agents_ecommerce_mode_update();
