alter table public.maquinas
add column if not exists oee_meta numeric;

alter table public.maquinas
alter column oee_meta set default 95;

update public.maquinas
set oee_meta = 95
where oee_meta is null;
