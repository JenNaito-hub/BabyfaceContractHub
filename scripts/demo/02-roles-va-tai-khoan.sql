-- Biến DB local thành thứ PostgREST + supabase-js nói chuyện được

-- Role giống Supabase
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator noinherit login password 'authpass'; exception when duplicate_object then null; end $$;

grant anon, authenticated, service_role to authenticator;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;

-- auth.uid()/auth.role() đọc từ claims PostgREST đặt vào GUC
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'anon')
$$;

-- Tài khoản demo
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'jen@aescentic.vn', '{"full_name":"Jen Naito"}'),
  ('22222222-2222-2222-2222-222222222222', 'quanly@aescentic.vn', '{"full_name":"Quản lý Đồng Khởi"}'),
  ('33333333-3333-3333-3333-333333333333', 'nhanvien@aescentic.vn', '{"full_name":"Ngọc — NV Đồng Khởi"}')
on conflict (id) do nothing;

update public.profiles set role = 'admin', full_name = 'Jen Naito'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set role = 'manager', full_name = 'Quản lý Đồng Khởi',
  store_id = (select id from public.stores where ma = 'S1')
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set role = 'staff', full_name = 'Ngọc — NV Đồng Khởi',
  store_id = (select id from public.stores where ma = 'S1')
  where id = '33333333-3333-3333-3333-333333333333';

notify pgrst, 'reload schema';
