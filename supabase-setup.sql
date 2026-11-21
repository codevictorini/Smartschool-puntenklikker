create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text
    check (
      char_length(nickname) between 3 and 20
      and nickname = btrim(nickname)
      and nickname !~ '[[:cntrl:]]'
    ),
  coins bigint not null check (coins between 0 and 1000000000),
  updated_at timestamptz not null default now()
);

alter table public.leaderboard alter column nickname drop not null;
alter table public.leaderboard enable row level security;

revoke all on public.leaderboard from anon, authenticated;
grant select, insert, update on public.leaderboard to authenticated;

create or replace function public.is_puntklik_leaderboard_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and lower(email) = 'victorerauw@sint-jozefsinstituut.be'
      and email_confirmed_at is not null
  );
$$;

revoke all on function public.is_puntklik_leaderboard_owner() from public, anon;
grant execute on function public.is_puntklik_leaderboard_owner() to authenticated;

drop policy if exists "Authenticated users can read leaderboard" on public.leaderboard;
create policy "Authenticated users can read leaderboard"
  on public.leaderboard
  for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own leaderboard entry" on public.leaderboard;
create policy "Users can insert their own leaderboard entry"
  on public.leaderboard
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own leaderboard entry" on public.leaderboard;
drop policy if exists "Users and owner can update leaderboard entries" on public.leaderboard;
create policy "Users and owner can update leaderboard entries"
  on public.leaderboard
  for update
  to authenticated
  using (
    auth.uid() = user_id
    or (select public.is_puntklik_leaderboard_owner())
  )
  with check (
    auth.uid() = user_id
    or (select public.is_puntklik_leaderboard_owner())
  );

create table if not exists public.store_promotions (
  id boolean primary key default true check (id),
  discount_percent smallint not null check (discount_percent between 1 and 100),
  max_discount_coins integer not null default 5 check (max_discount_coins between 0 and 5),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  created_by uuid not null references auth.users (id)
);

alter table public.store_promotions enable row level security;
revoke all on public.store_promotions from anon, authenticated;
grant select on public.store_promotions to anon, authenticated;
grant insert, update on public.store_promotions to authenticated;

drop policy if exists "Authenticated users can read store promotions" on public.store_promotions;
drop policy if exists "Anyone can read store promotions" on public.store_promotions;
create policy "Anyone can read store promotions"
  on public.store_promotions
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Owners can create store promotions" on public.store_promotions;
create policy "Owners can create store promotions"
  on public.store_promotions
  for insert
  to authenticated
  with check ((select public.is_puntklik_leaderboard_owner()) and created_by = auth.uid());

drop policy if exists "Owners can update store promotions" on public.store_promotions;
create policy "Owners can update store promotions"
  on public.store_promotions
  for update
  to authenticated
  using ((select public.is_puntklik_leaderboard_owner()))
  with check ((select public.is_puntklik_leaderboard_owner()) and created_by = auth.uid());

create table if not exists public.secret_shop_settings (
  id boolean primary key default true check (id),
  is_open boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

insert into public.secret_shop_settings (id, is_open)
values (true, false)
on conflict (id) do nothing;

alter table public.secret_shop_settings enable row level security;
revoke all on public.secret_shop_settings from anon, authenticated;
grant select on public.secret_shop_settings to anon, authenticated;
grant update on public.secret_shop_settings to authenticated;

drop policy if exists "Authenticated users can read secret shop state" on public.secret_shop_settings;
drop policy if exists "Anyone can read secret shop state" on public.secret_shop_settings;
create policy "Anyone can read secret shop state"
  on public.secret_shop_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Owners can control secret shop state" on public.secret_shop_settings;
create policy "Owners can control secret shop state"
  on public.secret_shop_settings
  for update
  to authenticated
  using ((select public.is_puntklik_leaderboard_owner()))
  with check ((select public.is_puntklik_leaderboard_owner()) and updated_by = auth.uid());

create table if not exists public.secret_shop_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  description text not null check (char_length(description) between 2 and 120),
  emoji text not null check (char_length(emoji) between 1 and 8),
  price bigint not null check (price between 1 and 1000000000),
  effect_type text not null check (effect_type in ('cosmetic', 'coin_bonus', 'shop_discount')),
  effect_percent smallint,
  effect_duration_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  check (
    (effect_type = 'cosmetic' and effect_percent is null and effect_duration_minutes is null)
    or (
      effect_type in ('coin_bonus', 'shop_discount')
      and effect_percent is not null
      and effect_percent between 1 and 100
      and effect_duration_minutes is not null
      and effect_duration_minutes between 1 and 1440
    )
  )
);

alter table public.secret_shop_items enable row level security;
revoke all on public.secret_shop_items from anon, authenticated;
grant select, insert, update on public.secret_shop_items to authenticated;

drop policy if exists "Players can read open secret shop items" on public.secret_shop_items;
create policy "Players can read open secret shop items"
  on public.secret_shop_items
  for select
  to authenticated
  using (
    (select public.is_puntklik_leaderboard_owner())
    or exists (
      select 1
      from public.secret_shop_settings
      where id = true and is_open
    )
  );

drop policy if exists "Owners can create secret shop items" on public.secret_shop_items;
create policy "Owners can create secret shop items"
  on public.secret_shop_items
  for insert
  to authenticated
  with check ((select public.is_puntklik_leaderboard_owner()) and created_by = auth.uid());

drop policy if exists "Owners can update secret shop items" on public.secret_shop_items;
create policy "Owners can update secret shop items"
  on public.secret_shop_items
  for update
  to authenticated
  using ((select public.is_puntklik_leaderboard_owner()))
  with check ((select public.is_puntklik_leaderboard_owner()) and created_by = auth.uid());

create table if not exists public.secret_shop_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.secret_shop_items (id),
  item_name text not null,
  item_emoji text not null,
  item_description text not null,
  effect_type text not null check (effect_type in ('cosmetic', 'coin_bonus', 'shop_discount')),
  effect_percent smallint,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,
  check (
    (effect_type = 'cosmetic' and effect_percent is null and expires_at is null)
    or (
      effect_type in ('coin_bonus', 'shop_discount')
      and effect_percent is not null
      and effect_percent between 1 and 100
      and expires_at is not null
      and expires_at > purchased_at
    )
  )
);

create unique index if not exists secret_shop_purchases_unique_cosmetics
  on public.secret_shop_purchases (user_id, item_id)
  where effect_type = 'cosmetic';

create index if not exists secret_shop_purchases_active_effects
  on public.secret_shop_purchases (user_id, expires_at)
  where effect_type in ('coin_bonus', 'shop_discount');

alter table public.secret_shop_purchases enable row level security;
revoke all on public.secret_shop_purchases from anon, authenticated;
grant select on public.secret_shop_purchases to authenticated;

drop policy if exists "Players can read their own secret shop purchases" on public.secret_shop_purchases;
create policy "Players can read their own secret shop purchases"
  on public.secret_shop_purchases
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.purchase_secret_shop_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.secret_shop_items%rowtype;
  v_balance bigint;
  v_discount_percent integer := 0;
  v_promo_percent integer := 0;
  v_max_discount integer := 5;
  v_discount bigint := 0;
  v_price bigint;
  v_new_balance bigint;
  v_purchased_at timestamptz := now();
  v_expires_at timestamptz;
  v_purchase_id uuid;
begin
  if v_user_id is null then
    raise exception 'Login vereist';
  end if;

  if not exists (
    select 1 from public.secret_shop_settings where id = true and is_open
  ) then
    raise exception 'De secret shop is gesloten';
  end if;

  select *
    into v_item
    from public.secret_shop_items
    where id = p_item_id and is_active
    for update;
  if not found then
    raise exception 'Dit secret-shopitem is niet beschikbaar';
  end if;

  select coins
    into v_balance
    from public.leaderboard
    where user_id = v_user_id
    for update;
  if not found then
    raise exception 'Je accountscore is nog niet aangemaakt';
  end if;

  if v_item.effect_type = 'cosmetic' and exists (
    select 1
    from public.secret_shop_purchases
    where user_id = v_user_id and item_id = p_item_id and effect_type = 'cosmetic'
  ) then
    raise exception 'Je hebt dit geheime item al';
  end if;

  select discount_percent, max_discount_coins
    into v_promo_percent, v_max_discount
    from public.store_promotions
    where id = true and starts_at <= v_purchased_at and ends_at > v_purchased_at;
  v_discount_percent := coalesce(v_promo_percent, 0) + coalesce((
    select sum(effect_percent)
    from public.secret_shop_purchases
    where user_id = v_user_id
      and effect_type = 'shop_discount'
      and expires_at > v_purchased_at
  ), 0);
  v_max_discount := coalesce(v_max_discount, 5);

  v_discount := least(
    v_item.price,
    v_max_discount,
    floor(v_item.price * least(v_discount_percent, 100)::numeric / 100)::bigint
  );
  v_price := v_item.price - v_discount;
  if v_balance < v_price then
    raise exception 'Niet genoeg coins';
  end if;

  if v_item.effect_type <> 'cosmetic' then
    v_expires_at := v_purchased_at + make_interval(mins => v_item.effect_duration_minutes);
  end if;

  v_new_balance := v_balance - v_price;
  update public.leaderboard
    set coins = v_new_balance, updated_at = v_purchased_at
    where user_id = v_user_id;

  insert into public.secret_shop_purchases (
    user_id, item_id, item_name, item_emoji, item_description,
    effect_type, effect_percent, purchased_at, expires_at
  )
  values (
    v_user_id,
    p_item_id,
    v_item.name,
    v_item.emoji,
    v_item.description,
    v_item.effect_type,
    v_item.effect_percent,
    v_purchased_at,
    v_expires_at
  )
  returning id into v_purchase_id;

  return jsonb_build_object(
    'purchase_id', v_purchase_id,
    'item_id', v_item.id,
    'name', v_item.name,
    'emoji', v_item.emoji,
    'price', v_price,
    'coins', v_new_balance,
    'effect_type', v_item.effect_type,
    'effect_percent', v_item.effect_percent,
    'purchased_at', v_purchased_at,
    'expires_at', v_expires_at
  );
end;
$$;

revoke all on function public.purchase_secret_shop_item(uuid) from public, anon;
grant execute on function public.purchase_secret_shop_item(uuid) to authenticated;

create table if not exists public.store_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in ('double_coins', 'coin_gift', 'coin_shower', 'flash_sale', 'lucky_drop', 'points_challenge', 'theme')
  ),
  event_config jsonb not null default '{}'::jsonb check (jsonb_typeof(event_config) = 'object'),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null check (ends_at > starts_at),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

alter table public.store_events
  drop constraint if exists store_events_event_type_check;
alter table public.store_events
  add constraint store_events_event_type_check
  check (event_type in (
    'double_coins', 'coin_gift', 'coin_shower', 'flash_sale',
    'lucky_drop', 'points_challenge', 'theme'
  ));

create index if not exists store_events_active
  on public.store_events (event_type, starts_at, ends_at);

alter table public.store_events enable row level security;
revoke all on public.store_events from anon, authenticated;
grant select (id, event_type, event_config, starts_at, ends_at, created_at)
  on public.store_events to anon, authenticated;

drop policy if exists "Anyone can read active store events" on public.store_events;
create policy "Anyone can read active store events"
  on public.store_events
  for select
  to anon, authenticated
  using (starts_at <= now() and ends_at > now());

create table if not exists public.store_event_rewards (
  event_id uuid not null references public.store_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  coins_awarded integer not null check (coins_awarded between 1 and 1000000),
  claimed_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.store_event_rewards enable row level security;
revoke all on public.store_event_rewards from anon, authenticated;

create table if not exists public.store_event_progress (
  event_id uuid not null references public.store_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  points_count integer not null default 0 check (points_count >= 0),
  reward_claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.store_event_point_claims (
  event_id uuid not null,
  user_id uuid not null,
  point_hash text not null check (point_hash ~ '^[0-9a-f]{64}$'),
  claimed_at timestamptz not null default now(),
  primary key (event_id, user_id, point_hash),
  foreign key (event_id, user_id)
    references public.store_event_progress (event_id, user_id) on delete cascade
);

alter table public.store_event_progress enable row level security;
alter table public.store_event_point_claims enable row level security;
revoke all on public.store_event_progress, public.store_event_point_claims from anon, authenticated;

create table if not exists public.store_announcements (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(btrim(author_name)) between 1 and 30),
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (
    expires_at > created_at and expires_at <= created_at + interval '5 seconds'
  ),
  created_by uuid not null references auth.users (id)
);

alter table public.store_announcements
  drop constraint if exists store_announcements_message_check;
alter table public.store_announcements
  add constraint store_announcements_message_check
  check (char_length(btrim(message)) between 1 and 1000);

alter table public.store_announcements enable row level security;
revoke all on public.store_announcements from anon, authenticated;
grant select (id, author_name, message, created_at, expires_at)
  on public.store_announcements to anon, authenticated;

drop policy if exists "Anyone can read active announcements" on public.store_announcements;
create policy "Anyone can read active announcements"
  on public.store_announcements
  for select
  to anon, authenticated
  using (created_at <= now() and expires_at > now());

create or replace function public.start_store_event(
  p_event_type text,
  p_event_config jsonb,
  p_duration_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_event_id uuid;
  v_starts_at timestamptz := now();
  v_ends_at timestamptz;
  v_amount integer;
begin
  if v_owner_id is null or not public.is_puntklik_leaderboard_owner() then
    raise exception 'Je account heeft geen ownerrechten';
  end if;
  if p_duration_minutes is null or p_duration_minutes < 1 or p_duration_minutes > 1440 then
    raise exception 'De eventduur moet tussen 1 minuut en 24 uur liggen';
  end if;
  if p_event_config is null or jsonb_typeof(p_event_config) <> 'object' then
    raise exception 'Ongeldige eventinstellingen';
  end if;

  case p_event_type
    when 'double_coins' then
      null;
    when 'coin_gift' then
      if coalesce(p_event_config->>'coins', '') !~ '^[0-9]{1,7}$' then
        raise exception 'Ongeldig aantal bonuscoins';
      end if;
      v_amount := (p_event_config->>'coins')::integer;
      if v_amount < 1 or v_amount > 1000000 then
        raise exception 'De coinbonus moet tussen 1 en 1.000.000 liggen';
      end if;
    when 'coin_shower' then
      if coalesce(p_event_config->>'coins_per_bag', '') !~ '^[0-9]{1,7}$' then
        raise exception 'Ongeldig aantal coins per muntzakje';
      end if;
      v_amount := (p_event_config->>'coins_per_bag')::integer;
      if v_amount < 1 or v_amount > 1000000 then
        raise exception 'Coins per muntzakje moeten tussen 1 en 1.000.000 liggen';
      end if;
    when 'flash_sale' then
      if coalesce(p_event_config->>'item_key', '') not in (
        'figure:berry', 'figure:mint', 'figure:night', 'figure:watermelon',
        'figure:orange', 'figure:donut', 'figure:cupcake',
        'topping:sprinkles', 'topping:chocolate', 'topping:gold'
      ) then
        raise exception 'Ongeldig winkelitem voor de flash sale';
      end if;
      if coalesce(p_event_config->>'discount_percent', '') !~ '^[0-9]{1,3}$' then
        raise exception 'Ongeldig kortingspercentage';
      end if;
      v_amount := (p_event_config->>'discount_percent')::integer;
      if v_amount < 1 or v_amount > 100 then
        raise exception 'De flash-sale-korting moet tussen 1 en 100%% liggen';
      end if;
    when 'lucky_drop' then
      if coalesce(p_event_config->>'chance_percent', '') !~ '^[0-9]{1,3}$'
        or coalesce(p_event_config->>'reward_coins', '') !~ '^[0-9]{1,7}$' then
        raise exception 'Ongeldige lucky-drop-instellingen';
      end if;
      if (p_event_config->>'chance_percent')::integer not between 1 and 100
        or (p_event_config->>'reward_coins')::integer not between 1 and 1000000 then
        raise exception 'Lucky drop moet een kans van 1–100%% en beloning van 1–1.000.000 coins hebben';
      end if;
    when 'points_challenge' then
      if coalesce(p_event_config->>'target_points', '') !~ '^[0-9]{1,4}$'
        or coalesce(p_event_config->>'reward_coins', '') !~ '^[0-9]{1,7}$' then
        raise exception 'Ongeldige puntenchallenge-instellingen';
      end if;
      if (p_event_config->>'target_points')::integer not between 1 and 1000
        or (p_event_config->>'reward_coins')::integer not between 1 and 1000000 then
        raise exception 'De challenge moet 1–1.000 punten en 1–1.000.000 bonuscoins bevatten';
      end if;
    when 'theme' then
      if coalesce(p_event_config->>'theme', '') not in (
        'berry', 'mint', 'night', 'watermelon', 'orange', 'donut', 'cupcake'
      ) then
        raise exception 'Ongeldig thema';
      end if;
    else
      raise exception 'Onbekend eventtype';
  end case;

  v_ends_at := v_starts_at + make_interval(mins => p_duration_minutes);
  update public.store_events
    set ends_at = v_starts_at
    where event_type = p_event_type
      and starts_at < v_starts_at
      and ends_at > v_starts_at;
  insert into public.store_events (event_type, event_config, starts_at, ends_at, created_by)
  values (p_event_type, p_event_config, v_starts_at, v_ends_at, v_owner_id)
  returning id into v_event_id;

  return jsonb_build_object(
    'id', v_event_id,
    'starts_at', v_starts_at,
    'ends_at', v_ends_at,
    'event_type', p_event_type
  );
end;
$$;

revoke all on function public.start_store_event(text, jsonb, integer) from public, anon;
grant execute on function public.start_store_event(text, jsonb, integer) to authenticated;

create or replace function public.grant_store_event_fruit(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_event public.store_events%rowtype;
begin
  if v_owner_id is null or not public.is_puntklik_leaderboard_owner() then
    raise exception 'Je account heeft geen ownerrechten';
  end if;

  update public.store_events
    set event_config = event_config || '{"owner_fruit_granted":true,"fruit_bonus_percent":60}'::jsonb
    where id = p_event_id
      and starts_at <= now()
      and ends_at > now()
      and coalesce(event_config->>'owner_fruit_granted', 'false') <> 'true'
    returning * into v_event;

  if not found then
    raise exception 'Actief event niet gevonden of het ownerfruit is al gegeven';
  end if;

  return jsonb_build_object(
    'event_id', v_event.id,
    'fruit_bonus_percent', 60,
    'ends_at', v_event.ends_at
  );
end;
$$;

revoke all on function public.grant_store_event_fruit(uuid) from public, anon;
grant execute on function public.grant_store_event_fruit(uuid) to authenticated;

create or replace function public.claim_store_event_coin_gifts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance bigint;
  v_event record;
  v_awarded integer := 0;
  v_event_amount integer;
  v_owner_fruit_active boolean;
begin
  if v_user_id is null then
    raise exception 'Login vereist';
  end if;
  select coins into v_balance
    from public.leaderboard
    where user_id = v_user_id
    for update;
  if not found then
    raise exception 'Je accountscore is nog niet aangemaakt';
  end if;

  select exists (
    select 1
      from public.store_events
      where starts_at <= now()
        and ends_at > now()
        and event_config->>'owner_fruit_granted' = 'true'
  ) into v_owner_fruit_active;

  for v_event in
    select id, event_config->>'coins' as coins
    from public.store_events
    where event_type = 'coin_gift'
      and starts_at <= now()
      and ends_at > now()
    order by starts_at
  loop
    v_event_amount := v_event.coins::integer;
    if v_owner_fruit_active then
      v_event_amount := least(1000000, v_event_amount + greatest(1, round(v_event_amount * 0.60)::integer));
    end if;
    if v_balance <= 1000000000 - v_event_amount then
      insert into public.store_event_rewards (event_id, user_id, coins_awarded)
      values (v_event.id, v_user_id, v_event_amount)
      on conflict do nothing
      returning coins_awarded into v_event_amount;
      if found then
        update public.leaderboard
          set coins = coins + v_event_amount, updated_at = now()
          where user_id = v_user_id
          returning coins into v_balance;
        v_awarded := v_awarded + v_event_amount;
      end if;
    end if;
  end loop;

  return jsonb_build_object('coins_awarded', v_awarded);
end;
$$;

revoke all on function public.claim_store_event_coin_gifts() from public, anon;
grant execute on function public.claim_store_event_coin_gifts() to authenticated;

create or replace function public.record_store_event_point(p_event_id uuid, p_point_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_target integer;
  v_reward integer;
  v_count integer;
  v_claimed boolean := false;
  v_coins_awarded integer := 0;
  v_old_balance bigint;
  v_new_balance bigint;
  v_owner_fruit_active boolean;
begin
  if v_user_id is null then
    raise exception 'Login vereist';
  end if;
  if p_point_hash is null or p_point_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Ongeldige puntreferentie';
  end if;

  select (event_config->>'target_points')::integer,
         (event_config->>'reward_coins')::integer
    into v_target, v_reward
    from public.store_events
    where id = p_event_id
      and event_type = 'points_challenge'
      and starts_at <= now()
      and ends_at > now();
  if not found then
    raise exception 'Deze puntenchallenge is niet actief';
  end if;

  select exists (
    select 1
      from public.store_events
      where starts_at <= now()
        and ends_at > now()
        and event_config->>'owner_fruit_granted' = 'true'
  ) into v_owner_fruit_active;
  if v_owner_fruit_active then
    v_reward := least(1000000, v_reward + greatest(1, round(v_reward * 0.60)::integer));
  end if;

  insert into public.store_event_progress (event_id, user_id)
  values (p_event_id, v_user_id)
  on conflict do nothing;
  perform 1
    from public.store_event_progress
    where event_id = p_event_id and user_id = v_user_id
    for update;

  insert into public.store_event_point_claims (event_id, user_id, point_hash)
  values (p_event_id, v_user_id, p_point_hash)
  on conflict do nothing
  returning true into v_claimed;
  if not coalesce(v_claimed, false) then
    select points_count into v_count
      from public.store_event_progress
      where event_id = p_event_id and user_id = v_user_id;
    return jsonb_build_object(
      'points_count', v_count,
      'target_points', v_target,
      'coins_awarded', 0
    );
  end if;

  update public.store_event_progress
    set points_count = points_count + 1, updated_at = now()
    where event_id = p_event_id and user_id = v_user_id
    returning points_count into v_count;

  if v_count >= v_target and exists (
    select 1 from public.store_event_progress
    where event_id = p_event_id and user_id = v_user_id and not reward_claimed
  ) then
    select coins into v_old_balance
      from public.leaderboard
      where user_id = v_user_id
      for update;
    if not found then
      raise exception 'Je accountscore is nog niet aangemaakt';
    end if;
    update public.leaderboard
      set coins = least(1000000000, coins + v_reward), updated_at = now()
      where user_id = v_user_id;
    select coins into v_new_balance
      from public.leaderboard
      where user_id = v_user_id;
    v_coins_awarded := (v_new_balance - v_old_balance)::integer;
    update public.store_event_progress
      set reward_claimed = true, updated_at = now()
      where event_id = p_event_id and user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'points_count', v_count,
    'target_points', v_target,
    'coins_awarded', v_coins_awarded
  );
end;
$$;

revoke all on function public.record_store_event_point(uuid, text) from public, anon;
grant execute on function public.record_store_event_point(uuid, text) to authenticated;

create or replace function public.send_global_announcement(p_author_name text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_announcement public.store_announcements%rowtype;
begin
  if v_owner_id is null or not public.is_puntklik_leaderboard_owner() then
    raise exception 'Je account heeft geen ownerrechten';
  end if;
  if p_author_name is null or char_length(btrim(p_author_name)) not between 1 and 30
    or p_author_name ~ '[[:cntrl:]]' then
    raise exception 'De naam moet 1 tot 30 tekens bevatten';
  end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 1000
    or p_message ~ '[[:cntrl:]]' then
    raise exception 'Het bericht moet 1 tot 1.000 tekens bevatten';
  end if;

  delete from public.store_announcements where expires_at <= now();
  insert into public.store_announcements (author_name, message, created_by, expires_at)
  values (btrim(p_author_name), btrim(p_message), v_owner_id, now() + interval '5 seconds')
  returning * into v_announcement;
  return jsonb_build_object(
    'id', v_announcement.id,
    'author_name', v_announcement.author_name,
    'message', v_announcement.message,
    'created_at', v_announcement.created_at,
    'expires_at', v_announcement.expires_at
  );
end;
$$;

revoke all on function public.send_global_announcement(text, text) from public, anon;
grant execute on function public.send_global_announcement(text, text) to authenticated;

create table if not exists public.owner_event_countdown (
  id boolean primary key default true check (id),
  event_name text,
  event_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  check (
    (event_name is null and event_at is null)
    or (
      event_name is not null
      and char_length(btrim(event_name)) between 1 and 60
      and event_at is not null
    )
  )
);

insert into public.owner_event_countdown (id)
values (true)
on conflict (id) do nothing;

alter table public.owner_event_countdown enable row level security;
revoke all on public.owner_event_countdown from anon, authenticated;
grant select (id, event_name, event_at, updated_at)
  on public.owner_event_countdown to anon, authenticated;

drop policy if exists "Anyone can read owner event countdown" on public.owner_event_countdown;
create policy "Anyone can read owner event countdown"
  on public.owner_event_countdown
  for select
  to anon, authenticated
  using (true);

create or replace function public.set_owner_event_countdown(p_event_name text, p_event_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_name text;
begin
  if v_owner_id is null or not public.is_puntklik_leaderboard_owner() then
    raise exception 'Je account heeft geen ownerrechten';
  end if;

  if p_event_name is null and p_event_at is null then
    update public.owner_event_countdown
      set event_name = null, event_at = null, updated_at = now(), updated_by = v_owner_id
      where id = true;
    return jsonb_build_object('cleared', true);
  end if;

  v_name := btrim(coalesce(p_event_name, ''));
  if char_length(v_name) not between 1 and 60 or v_name ~ '[[:cntrl:]]' then
    raise exception 'De eventnaam moet 1 tot 60 tekens bevatten';
  end if;
  if p_event_at is null or p_event_at <= now() then
    raise exception 'Kies een starttijd in de toekomst';
  end if;

  insert into public.owner_event_countdown (id, event_name, event_at, updated_at, updated_by)
  values (true, v_name, p_event_at, now(), v_owner_id)
  on conflict (id) do update
    set event_name = excluded.event_name,
        event_at = excluded.event_at,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  return jsonb_build_object('event_name', v_name, 'event_at', p_event_at);
end;
$$;

revoke all on function public.set_owner_event_countdown(text, timestamptz) from public, anon;
grant execute on function public.set_owner_event_countdown(text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
