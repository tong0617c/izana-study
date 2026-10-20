-- Transaction-only integration checks. All fixtures roll back.
begin;
insert into auth.users(id) values
 ('90000000-0000-4000-8000-000000000001'),
 ('90000000-0000-4000-8000-000000000002'),
 ('90000000-0000-4000-8000-000000000003');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('test.room',public.publish_classroom('[{"id":"90000000-0000-4000-8000-000000000099","title":"Test lesson","type":"text","body":"Test content","keywords":[],"updatedAt":"2026-10-20","notes":"PRIVATE TEACHER NOTE"}]')::text,true);
select set_config('test.invite',(select invite_code::text from public.classrooms where id=current_setting('test.room')::uuid),true);
do $$begin
 if exists(select 1 from classrooms where materials::text like '%PRIVATE%') then raise exception 'Teacher note leaked'; end if;
end$$;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
select public.join_classroom(current_setting('test.invite')::uuid,'Test student');
select public.submit_classroom_progress(current_setting('test.room')::uuid,'{"items":[{"title":"Test lesson","recall":"Student answer"}],"records":[]}');
do $$begin
 if not public.save_study_state(0,'{"test":1}') then raise exception 'Initial state insert failed'; end if;
 if public.save_study_state(0,'{"test":2}') then raise exception 'Stale write was accepted'; end if;
 if not public.save_study_state(1,'{"test":3}') then raise exception 'Expected revision update failed'; end if;
end$$;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
do $$begin
 if (select count(*) from classroom_progress where classroom_id=current_setting('test.room')::uuid)<>1 then raise exception 'Teacher cannot read student work'; end if;
 if (select count(*) from study_state)<>0 then raise exception 'Teacher can read private state'; end if;
end$$;
select public.review_classroom_student(current_setting('test.room')::uuid,'90000000-0000-4000-8000-000000000002','Test lesson','Please revise.');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
do $$begin
 if (select jsonb_array_length(feedback) from classroom_progress where classroom_id=current_setting('test.room')::uuid)<>1 then raise exception 'Student cannot see feedback'; end if;
end$$;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
do $$begin
 if (select count(*) from classrooms)<>0 then raise exception 'Stranger can read classrooms'; end if;
 if (select count(*) from classroom_progress)<>0 then raise exception 'Stranger can read progress'; end if;
 if (select count(*) from study_state)<>0 then raise exception 'Stranger can read private state'; end if;
end$$;
rollback;
select 'PASS: classroom access, private notes, teacher review, student feedback, optimistic locking; fixtures rolled back' as result;
