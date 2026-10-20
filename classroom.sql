-- Teacher / student classroom extension.
create table public.classrooms (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id) on delete cascade,
 invite_code uuid not null unique default gen_random_uuid(),
 title text not null default '伊佐那补习室',
 materials jsonb not null default '[]',
 updated_at timestamptz not null default now()
);
create table public.classroom_members (
 classroom_id uuid references public.classrooms(id) on delete cascade,
 student_id uuid references auth.users(id) on delete cascade,
 display_name text not null,
 joined_at timestamptz not null default now(),
 primary key(classroom_id,student_id)
);
create table public.classroom_progress (
 classroom_id uuid references public.classrooms(id) on delete cascade,
 student_id uuid references auth.users(id) on delete cascade,
 payload jsonb not null default '{}',
 feedback jsonb not null default '[]',
 updated_at timestamptz not null default now(),
 primary key(classroom_id,student_id)
);
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.classroom_progress enable row level security;

-- Helper reads membership without recursive RLS evaluation.
create function public.is_classroom_member(room uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from classroom_members where classroom_id=room and student_id=auth.uid());
$$;
create policy "Teacher or member reads classroom" on public.classrooms for select to authenticated
 using(owner_id=auth.uid() or public.is_classroom_member(id));
create policy "Teacher or student reads membership" on public.classroom_members for select to authenticated
 using(student_id=auth.uid() or exists(select 1 from classrooms c where c.id=classroom_id and c.owner_id=auth.uid()));
create policy "Teacher or student reads progress" on public.classroom_progress for select to authenticated
 using(student_id=auth.uid() or exists(select 1 from classrooms c where c.id=classroom_id and c.owner_id=auth.uid()));
revoke all on public.classrooms,public.classroom_members,public.classroom_progress from anon,authenticated;
grant select on public.classrooms,public.classroom_members,public.classroom_progress to authenticated;

create function public.publish_classroom(new_materials jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; clean jsonb;
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 if jsonb_typeof(new_materials) <> 'array' or octet_length(new_materials::text)>5000000 then raise exception 'Invalid materials'; end if;
 -- Whitelist public lesson fields, never copy teacher notes or history.
 select coalesce(jsonb_agg(jsonb_build_object('id',e->>'id','title',e->>'title','body',e->>'body','type',e->>'type','keywords',coalesce(e->'keywords','[]'),'updatedAt',e->>'updatedAt')),'[]')
 into clean from jsonb_array_elements(new_materials) e;
 insert into classrooms(owner_id,materials) values(auth.uid(),clean)
 on conflict(owner_id) do update set materials=excluded.materials,updated_at=now()
 returning id into result;
 return result;
end; $$;

create function public.join_classroom(code uuid,student_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare room classrooms;
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 if length(trim(student_name))<1 or length(student_name)>60 then raise exception 'Invalid name'; end if;
 select * into room from classrooms where invite_code=code;
 if not found then raise exception '邀请码无效'; end if;
 if room.owner_id=auth.uid() then raise exception '不能加入自己的补习室'; end if;
 insert into classroom_members(classroom_id,student_id,display_name) values(room.id,auth.uid(),trim(student_name))
 on conflict(classroom_id,student_id) do update set display_name=excluded.display_name;
 return room.id;
end; $$;

create function public.submit_classroom_progress(room_id uuid,new_payload jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.is_classroom_member(room_id) then raise exception 'Membership required'; end if;
 if octet_length(new_payload::text)>5000000 then raise exception 'Progress too large'; end if;
 insert into classroom_progress(classroom_id,student_id,payload) values(room_id,auth.uid(),new_payload)
 on conflict(classroom_id,student_id) do update set payload=excluded.payload,updated_at=now();
 return true;
end; $$;

create function public.review_classroom_student(room_id uuid,student uuid,target text,comment_text text)
returns boolean language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
 if not exists(select 1 from classrooms where id=room_id and owner_id=auth.uid()) then raise exception 'Teacher required'; end if;
 if length(trim(comment_text))<1 or length(comment_text)>5000 then raise exception 'Invalid feedback'; end if;
 update classroom_progress set feedback=feedback||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'target',target,'text',trim(comment_text),'date',now()))
 where classroom_id=room_id and student_id=student;
 get diagnostics affected=row_count;
 return affected=1;
end; $$;
revoke all on function public.is_classroom_member(uuid),public.publish_classroom(jsonb),public.join_classroom(uuid,text),public.submit_classroom_progress(uuid,jsonb),public.review_classroom_student(uuid,uuid,text,text) from public,anon;
grant execute on function public.is_classroom_member(uuid),public.publish_classroom(jsonb),public.join_classroom(uuid,text),public.submit_classroom_progress(uuid,jsonb),public.review_classroom_student(uuid,uuid,text,text) to authenticated;
