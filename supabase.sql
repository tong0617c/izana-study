-- Run once in your Supabase project's SQL Editor.
create table if not exists public.study_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.study_state enable row level security;
drop policy if exists "Read own study state" on public.study_state;
create policy "Read own study state" on public.study_state for select to authenticated using (auth.uid() = user_id);
revoke all on public.study_state from anon, authenticated;
grant select on public.study_state to authenticated;
create or replace function public.save_study_state(expected_revision bigint,new_payload jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if octet_length(new_payload::text) > 10000000 then raise exception 'Data exceeds 10MB'; end if;
  if expected_revision = 0 then
    insert into study_state(user_id,payload,revision) values(auth.uid(),new_payload,1)
    on conflict (user_id) do nothing;
  else
    update study_state set payload=new_payload, revision=revision+1,updated_at=now()
    where user_id=auth.uid() and revision=expected_revision;
  end if;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;
revoke all on function public.save_study_state(bigint,jsonb) from public, anon;
grant execute on function public.save_study_state(bigint,jsonb) to authenticated;
