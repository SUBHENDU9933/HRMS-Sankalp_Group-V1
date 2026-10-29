-- Sankalp Employee Tracking Foundation
-- Review-only migration. Do NOT apply to production until reviewed and tested on a non-production project.
-- Adds nullable classification fields without backfilling or modifying existing employee rows.
-- Tracking starts only after an authenticated employee explicitly checks in.
-- Location history is readable only by authorized managers/admins.

begin;

alter table public.employees
  add column if not exists employment_type text,
  add column if not exists worker_category text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_employment_type_check'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_employment_type_check
      check (employment_type is null or employment_type in ('permanent', 'contract', 'daily_wage', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_worker_category_check'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_worker_category_check
      check (worker_category is null or worker_category in ('staff', 'labourer', 'mistri', 'other'));
  end if;
end $$;

create table if not exists public.tracking_shifts (
  id text primary key default gen_random_uuid()::text,
  employee_id text not null references public.employees(id) on delete restrict,
  site_label text,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  check_in_latitude double precision,
  check_in_longitude double precision,
  check_out_latitude double precision,
  check_out_longitude double precision,
  created_at timestamptz not null default now(),
  constraint tracking_shifts_check_in_latitude_range check (check_in_latitude is null or check_in_latitude between -90 and 90),
  constraint tracking_shifts_check_in_longitude_range check (check_in_longitude is null or check_in_longitude between -180 and 180),
  constraint tracking_shifts_check_out_latitude_range check (check_out_latitude is null or check_out_latitude between -90 and 90),
  constraint tracking_shifts_check_out_longitude_range check (check_out_longitude is null or check_out_longitude between -180 and 180),
  constraint tracking_shifts_checkout_after_checkin check (checked_out_at is null or checked_out_at >= checked_in_at),
  constraint tracking_shifts_id_employee_unique unique (id, employee_id)
);

create unique index if not exists tracking_one_open_shift_per_employee
  on public.tracking_shifts(employee_id) where checked_out_at is null;
create index if not exists tracking_shifts_employee_time_idx
  on public.tracking_shifts(employee_id, checked_in_at desc);
create index if not exists tracking_shifts_open_idx
  on public.tracking_shifts(checked_in_at desc) where checked_out_at is null;

create table if not exists public.employee_locations (
  id uuid primary key default gen_random_uuid(),
  shift_id text not null references public.tracking_shifts(id) on delete restrict,
  employee_id text not null references public.employees(id) on delete restrict,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  speed_mps double precision check (speed_mps is null or speed_mps >= 0),
  heading_degrees double precision check (heading_degrees is null or heading_degrees between 0 and 360),
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  device_session_id text,
  constraint employee_locations_shift_employee_fk
    foreign key (shift_id, employee_id)
    references public.tracking_shifts(id, employee_id)
    deferrable initially immediate
);

-- The composite unique constraint above ensures every location's shift belongs to the same employee.
create index if not exists employee_locations_employee_time_idx
  on public.employee_locations(employee_id, captured_at desc);
create index if not exists employee_locations_shift_time_idx
  on public.employee_locations(shift_id, captured_at);

alter table public.tracking_shifts enable row level security;
alter table public.employee_locations enable row level security;

-- Employees may view their own shift records. Only managers/admins may read all shifts.
drop policy if exists tracking_shifts_select on public.tracking_shifts;
create policy tracking_shifts_select on public.tracking_shifts
  for select to authenticated
  using (employee_id = public.my_employee_id() or public.is_manager_or_admin());

-- GPS history is intentionally manager/admin-only; employees do not get direct SELECT access.
drop policy if exists employee_locations_manager_select on public.employee_locations;
create policy employee_locations_manager_select on public.employee_locations
  for select to authenticated
  using (public.is_manager_or_admin());

-- No direct INSERT/UPDATE/DELETE policies. Writes go through validated SECURITY DEFINER RPCs.
revoke all on public.tracking_shifts from public, anon, authenticated;
revoke all on public.employee_locations from public, anon, authenticated;
grant select on public.tracking_shifts to authenticated;
grant select on public.employee_locations to authenticated;

create or replace function public.start_tracking_shift(
  p_site_label text default null,
  p_latitude double precision default null,
  p_longitude double precision default null
) returns public.tracking_shifts
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_employee_id text;
  v_shift public.tracking_shifts;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_employee_id := public.my_employee_id();
  if v_employee_id is null or not exists (
    select 1 from public.employees e
    where e.id = v_employee_id and e.status = 'active'
  ) then
    raise exception 'Active HRMS employee record required';
  end if;

  if p_latitude is not null and p_latitude not between -90 and 90 then
    raise exception 'Invalid latitude';
  end if;
  if p_longitude is not null and p_longitude not between -180 and 180 then
    raise exception 'Invalid longitude';
  end if;

  insert into public.tracking_shifts(employee_id, site_label, check_in_latitude, check_in_longitude)
  values (v_employee_id, nullif(trim(p_site_label), ''), p_latitude, p_longitude)
  returning * into v_shift;

  return v_shift;
end;
$function$;

create or replace function public.end_tracking_shift(
  p_shift_id text,
  p_latitude double precision default null,
  p_longitude double precision default null
) returns public.tracking_shifts
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_employee_id text;
  v_shift public.tracking_shifts;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_employee_id := public.my_employee_id();
  if v_employee_id is null then
    raise exception 'HRMS employee mapping not found';
  end if;
  if p_latitude is not null and p_latitude not between -90 and 90 then
    raise exception 'Invalid latitude';
  end if;
  if p_longitude is not null and p_longitude not between -180 and 180 then
    raise exception 'Invalid longitude';
  end if;

  update public.tracking_shifts
    set checked_out_at = now(),
        check_out_latitude = p_latitude,
        check_out_longitude = p_longitude
    where id = p_shift_id
      and employee_id = v_employee_id
      and checked_out_at is null
  returning * into v_shift;

  if not found then
    raise exception 'Active shift not found for this employee';
  end if;

  return v_shift;
end;
$function$;

create or replace function public.record_employee_location(
  p_shift_id text,
  p_latitude double precision,
  p_longitude double precision,
  p_captured_at timestamptz default now(),
  p_accuracy_m double precision default null,
  p_speed_mps double precision default null,
  p_heading_degrees double precision default null,
  p_device_session_id text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_employee_id text;
  v_location_id uuid;
  v_captured_at timestamptz := coalesce(p_captured_at, now());
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_employee_id := public.my_employee_id();
  if v_employee_id is null then
    raise exception 'HRMS employee mapping not found';
  end if;
  if p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180 then
    raise exception 'Invalid GPS coordinates';
  end if;
  if v_captured_at > now() + interval '5 minutes' then
    raise exception 'GPS capture timestamp is in the future';
  end if;

  insert into public.employee_locations(
    shift_id, employee_id, latitude, longitude, accuracy_m, speed_mps,
    heading_degrees, captured_at, device_session_id
  )
  select s.id, s.employee_id, p_latitude, p_longitude, p_accuracy_m, p_speed_mps,
         p_heading_degrees, v_captured_at, p_device_session_id
  from public.tracking_shifts s
  where s.id = p_shift_id
    and s.employee_id = v_employee_id
    and v_captured_at >= s.checked_in_at
    and v_captured_at <= coalesce(s.checked_out_at, now())
  returning id into v_location_id;

  if not found then
    raise exception 'Location must belong to this employee and an authorized shift time';
  end if;

  return v_location_id;
end;
$function$;

-- Return only minimal employee fields required for the live manager map.
create or replace function public.get_tracking_dashboard()
returns table (
  employee_id text,
  employee_name text,
  employee_code text,
  employment_type text,
  worker_category text,
  shift_id text,
  site_label text,
  checked_in_at timestamptz,
  last_latitude double precision,
  last_longitude double precision,
  accuracy_m double precision,
  captured_at timestamptz,
  received_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_manager_or_admin() then
    raise exception 'Manager or admin access required';
  end if;

  return query
  select s.employee_id, e.name::text, e.employee_code::text, e.employment_type, e.worker_category,
         s.id, s.site_label, s.checked_in_at,
         l.latitude, l.longitude, l.accuracy_m, l.captured_at, l.received_at
  from public.tracking_shifts s
  join public.employees e on e.id = s.employee_id
  left join lateral (
    select el.latitude, el.longitude, el.accuracy_m, el.captured_at, el.received_at
    from public.employee_locations el
    where el.shift_id = s.id
    order by el.captured_at desc, el.received_at desc
    limit 1
  ) l on true
  where s.checked_out_at is null
  order by s.checked_in_at desc;
end;
$function$;

create or replace function public.get_tracking_history(
  p_employee_id text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  shift_id text,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  captured_at timestamptz,
  received_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_manager_or_admin() then
    raise exception 'Manager or admin access required';
  end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '31 days' then
    raise exception 'Provide a valid history range of 31 days or less';
  end if;

  return query
  select l.shift_id, l.latitude, l.longitude, l.accuracy_m, l.captured_at, l.received_at
  from public.employee_locations l
  where l.employee_id = p_employee_id
    and l.captured_at >= p_from
    and l.captured_at < p_to
  order by l.captured_at asc;
end;
$function$;

revoke all on function public.start_tracking_shift(text, double precision, double precision) from public, anon;
revoke all on function public.end_tracking_shift(text, double precision, double precision) from public, anon;
revoke all on function public.record_employee_location(text, double precision, double precision, timestamptz, double precision, double precision, double precision, text) from public, anon;
revoke all on function public.get_tracking_dashboard() from public, anon;
revoke all on function public.get_tracking_history(text, timestamptz, timestamptz) from public, anon;

grant execute on function public.start_tracking_shift(text, double precision, double precision) to authenticated;
grant execute on function public.end_tracking_shift(text, double precision, double precision) to authenticated;
grant execute on function public.record_employee_location(text, double precision, double precision, timestamptz, double precision, double precision, double precision, text) to authenticated;
grant execute on function public.get_tracking_dashboard() to authenticated;
grant execute on function public.get_tracking_history(text, timestamptz, timestamptz) to authenticated;

commit;
