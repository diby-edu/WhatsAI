-- Fonction RPC pour ajouter des crédits de manière atomique
-- Cela évite les race conditions (Lost Update) lors des webhooks de paiement

create or replace function increment_credits(
  p_user_id uuid,
  p_amount int
)
returns table (new_balance int)
language plpgsql
security definer
as $$
declare
  v_new_balance int;
begin
  -- Update atomique avec returning
  update profiles
  set credits_balance = credits_balance + p_amount
  where id = p_user_id
  returning credits_balance into v_new_balance;

  return query select v_new_balance;
end;
$$;
