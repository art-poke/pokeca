-- 규격 확장 대응: code CHECK를 없애 새 규격을 spec_profiles 행 추가만으로 늘릴 수 있게 한다.
-- artworks.format / requests.format FK가 유효성을 계속 강제한다. 지금은 '기타(etc)' 추가.
alter table public.spec_profiles drop constraint spec_profiles_code_check;

insert into public.spec_profiles (code, name_ko) values ('etc', '기타')
  on conflict (code) do nothing;
