alter table public.card_fragment_practice add column hints_used smallint not null default 0 check (hints_used between 0 and 2);

update public.card_fragment_practice
set hints_used = 1
where game = 'name' and used_hint;
