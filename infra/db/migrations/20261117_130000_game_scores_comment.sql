-- 몬스터볼 수박게임 점수에 한줄평(최대 10자) 추가. 선택 입력, 리더보드에 최고기록의 한줄평 표시.
alter table public.game_scores add column if not exists comment text;
