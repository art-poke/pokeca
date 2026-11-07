-- 9포켓을 슬리브용/탑로더 바인더용으로 분리. 기존 9pocket=슬리브용(68×92), 신규 9pocket_tl=탑로더(82×105).
-- format FK가 spec_profiles.code를 참조하므로 새 code 행을 먼저 넣는다.
insert into public.spec_profiles (code, name_ko) values ('9pocket_tl', '9포켓 탑로더 바인더용')
  on conflict (code) do update set name_ko = excluded.name_ko;
update public.spec_profiles set name_ko = '9포켓 슬리브용' where code = '9pocket';
