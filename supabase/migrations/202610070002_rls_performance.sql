-- Keep auth evaluation stable per statement and cover the cost-event FK.
drop policy if exists "users read own history" on public.history;
drop policy if exists "users write own history" on public.history;
drop policy if exists "users delete own history" on public.history;

create policy "users read own history"
  on public.history for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users write own history"
  on public.history for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users delete own history"
  on public.history for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists cost_events_user_id_idx
  on public.cost_events(user_id);
