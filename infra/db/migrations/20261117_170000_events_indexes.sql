-- 어드민 인사이트(admin-insights) 집계용 events 인덱스 (eng review R1).
-- events는 PK(id)만 있어 type/visitor_id/created_at 기준 집계가 전부 seq-scan이었다.
-- "전부 보관" 정책이라 테이블이 무한 증가 → 대시보드 성능 절벽 방지용. 데이터 변경 없음(DROP INDEX로 원복).
create index if not exists events_type_created_idx on public.events (type, created_at desc);
create index if not exists events_visitor_idx on public.events (visitor_id);
