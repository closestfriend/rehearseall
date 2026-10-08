create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('interview_start', 'reconnect_mint', 'evaluation')),
  mode text not null check (mode in ('text', 'voice', 'assessment')),
  session_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, session_id)
);

create index if not exists usage_events_user_month_idx
  on public.usage_events (user_id, created_at);

create table if not exists public.cost_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text,
  operation text not null,
  mode text,
  provider text not null,
  model text not null,
  succeeded boolean not null,
  input_tokens integer,
  output_tokens integer,
  error_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.history (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  score integer,
  mode text,
  created_at timestamptz not null default now()
);

create index if not exists history_user_created_idx
  on public.history (user_id, created_at desc);

create table if not exists public.webhook_events (
  stripe_event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.usage_events enable row level security;
alter table public.cost_events enable row level security;
alter table public.webhook_events enable row level security;
alter table public.history enable row level security;

create policy "users read own history" on public.history for select using (auth.uid() = user_id);
create policy "users write own history" on public.history for insert with check (auth.uid() = user_id);
create policy "users delete own history" on public.history for delete using (auth.uid() = user_id);

create or replace function public.authorize_interview(
  p_user_id uuid,
  p_mode text,
  p_session_id text,
  p_initial boolean,
  p_free_limit integer,
  p_pro_limit integer
)
returns table(allowed boolean, plan text, used integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan text;
  month_start timestamptz := date_trunc('month', now());
  used_count integer;
  limit_count integer;
begin
  if p_mode not in ('text', 'voice', 'assessment') then
    raise exception 'invalid interview mode';
  end if;

  insert into public.profiles (id) values (p_user_id) on conflict (id) do nothing;
  select profiles.plan into current_plan from public.profiles where profiles.id = p_user_id for update;

  if not p_initial then
    if exists (
      select 1 from public.usage_events
      where user_id = p_user_id and session_id = p_session_id and kind = 'interview_start' and mode = p_mode
    ) then
      select count(*)::integer into used_count
      from public.usage_events where user_id = p_user_id and kind = 'interview_start' and created_at >= month_start;
      limit_count := case when current_plan = 'pro' then p_pro_limit else p_free_limit end;
      return query select true, current_plan, used_count, greatest(limit_count - used_count, 0);
      return;
    end if;
    return query select false, current_plan, 0, 0;
    return;
  end if;

  select count(*)::integer into used_count
  from public.usage_events where user_id = p_user_id and kind = 'interview_start' and created_at >= month_start;
  limit_count := case when current_plan = 'pro' then p_pro_limit else p_free_limit end;
  if used_count >= limit_count then
    return query select false, current_plan, used_count, 0;
    return;
  end if;

  insert into public.usage_events (user_id, kind, mode, session_id)
  values (p_user_id, 'interview_start', p_mode, p_session_id);
  used_count := used_count + 1;
  return query select true, current_plan, used_count, greatest(limit_count - used_count, 0);
end;
$$;

create or replace function public.refund_interview(
  p_user_id uuid,
  p_mode text,
  p_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_mode not in ('text', 'voice', 'assessment') then
    raise exception 'invalid interview mode';
  end if;

  delete from public.usage_events
  where user_id = p_user_id
    and kind = 'interview_start'
    and mode = p_mode
    and session_id = p_session_id;
  return found;
end;
$$;

create or replace function public.claim_webhook_event(p_event_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.webhook_events (stripe_event_id) values (p_event_id)
  on conflict (stripe_event_id) do nothing;
  return found;
end;
$$;

revoke execute on function public.authorize_interview(uuid, text, text, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.authorize_interview(uuid, text, text, boolean, integer, integer) to service_role;
revoke execute on function public.refund_interview(uuid, text, text) from public, anon, authenticated;
grant execute on function public.refund_interview(uuid, text, text) to service_role;
revoke execute on function public.claim_webhook_event(text) from public, anon, authenticated;
grant execute on function public.claim_webhook_event(text) to service_role;
