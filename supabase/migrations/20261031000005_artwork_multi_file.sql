-- 다중 파일(규격별): 9포켓=조각 여러 장. artwork_files에 position 추가, (artwork_id,kind) 유니크를 (artwork_id,kind,position)로.
alter table public.artwork_files add column position smallint not null default 0;
alter table public.artwork_files drop constraint if exists artwork_files_artwork_id_kind_key;
alter table public.artwork_files
  add constraint artwork_files_artwork_kind_position_key unique (artwork_id, kind, position);

-- artwork_create: p_files에 position 포함.
create or replace function public.artwork_create(p_artwork jsonb, p_files jsonb, p_actor text)
returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid := (p_artwork ->> 'id')::uuid;
begin
  if exists (select 1 from public.artworks where id = v_id) then return v_id; end if;
  if not exists (select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'original') then
    raise exception 'original_required';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_files) f where f ->> 'kind' = 'thumbnail') then
    raise exception 'thumbnail_required';
  end if;

  insert into public.artworks (
    id, upload_id, card_id, artist_name, artist_id, format, source_url, source_visibility,
    print_size_verified, consented_at
  ) values (
    v_id, v_id, (p_artwork ->> 'card_id')::uuid, p_artwork ->> 'artist_name',
    nullif(p_artwork ->> 'artist_id', '')::uuid, p_artwork ->> 'format',
    nullif(p_artwork ->> 'source_url', ''), nullif(p_artwork ->> 'source_visibility', ''),
    coalesce((p_artwork ->> 'print_size_verified')::boolean, false),
    coalesce((p_artwork ->> 'consented_at')::timestamptz, now())
  );

  insert into public.artwork_files (artwork_id, kind, path, mime_type, size_bytes, position)
  select v_id, f ->> 'kind', f ->> 'path', f ->> 'mime_type', (f ->> 'size_bytes')::bigint,
         coalesce((f ->> 'position')::smallint, 0)
  from jsonb_array_elements(p_files) f;

  insert into public.consent_events (artwork_id, kind, before, after, evidence_path, actor)
  values (v_id, 'created', null, jsonb_build_object('status', 'active'),
          nullif(p_artwork ->> 'evidence_path', ''), p_actor);
  return v_id;
end; $$;

-- attach_file: 단일 파일(position 0) 교체용. 새 유니크 제약에 맞춰 on conflict 갱신.
create or replace function public.artwork_attach_file(
  p_id uuid, p_kind text, p_path text, p_mime_type text, p_size_bytes bigint
)
returns jsonb language plpgsql set search_path = '' as $$
declare v_status text; v_old text;
begin
  select status into v_status from public.artworks where id = p_id for update;
  if v_status is null then raise exception 'not_found'; end if;
  if v_status = 'withdrawn' then raise exception 'withdrawn_is_final'; end if;
  select path into v_old from public.artwork_files
    where artwork_id = p_id and kind = p_kind and position = 0;
  if v_old = p_path then return jsonb_build_object('purge_paths', '[]'::jsonb); end if;
  insert into public.artwork_files (artwork_id, kind, path, mime_type, size_bytes, position)
  values (p_id, p_kind, p_path, p_mime_type, p_size_bytes, 0)
  on conflict (artwork_id, kind, position) do update
    set path = excluded.path, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
        created_at = now();
  return jsonb_build_object(
    'purge_paths', case when v_old is null then '[]'::jsonb else jsonb_build_array(v_old) end);
end; $$;

grant execute on function public.artwork_create(jsonb, jsonb, text) to service_role;
grant execute on function public.artwork_attach_file(uuid, text, text, text, bigint) to service_role;
