-- Japanese cards drawn by Shinji Kanda, checked against the official illustrator index.
-- Alternate finishes with the same set and number remain in SNKRDUNK staging.
with incoming (source_id, species, species_ko, name_en, rarity, set_code, collector_number, total, set_name, image_path, source_url, raw_title, is_primary) as (
  values
  ('886019', 'magikarp', '잉어킹', 'Magikarp', null, 'M6a', '165', '103', 'Expansion Pack "30th CELEBRATION"', '886019.webp', 'https://snkrdunk.com/en/trading-cards/886019', '1Magikarp [M6a 165/103](Expansion Pack "30th CELEBRATION")₩33,988~', true),
  ('892568', 'pikachu', '피카츄', 'Pikachu', null, 'M6a', '034', '103', 'Expansion Pack "30th CELEBRATION"', '892568.webp', 'https://snkrdunk.com/en/trading-cards/892568', '1Pikachu [M6a 034/103](Expansion Pack "30th CELEBRATION")₩8,500~', true),
  ('866233', 'sableye', '깜까미', 'Sableye C', 'C', 'M6', '046', '076', 'Expansion Pack "Storm Emeralda"', '866233.webp', 'https://snkrdunk.com/en/trading-cards/866233', 'SNKRDUNK 1Sableye C [M6 046/076](Expansion Pack "Storm Emeralda")₩ -', true),
  ('752395', 'talonflame', '파이어로', 'Talonflame U', 'U', 'M3', '014', '080', 'Expansion Pack "Munikis / Nihil Zero"', '752395.webp', 'https://snkrdunk.com/en/trading-cards/752395', '1Talonflame U [M3 014/080](Expansion Pack "Munikis / Nihil Zero")₩ -', true),
  ('740621', 'slither wing', '땅을기는날개', 'Slither Wing', null, 'MC', '423', '742', 'Start Deck 100 "Battle Collection"', '740621.webp', 'https://snkrdunk.com/en/trading-cards/740621', '1Slither Wing [MC 423/742](Start Deck 100 "Battle Collection")₩ -', true),
  ('740492', 'girafarig', '키링키', 'Girafarig', null, 'MC', '301', '742', 'Start Deck 100 "Battle Collection"', '740492.webp', 'https://snkrdunk.com/en/trading-cards/740492', 'SNKRDUNK 1Girafarig [MC 301/742](Start Deck 100 "Battle Collection")₩ -', true),
  ('740353', 'sharpedo', '샤크니아', 'Sharpedo', null, 'MC', '179', '742', 'Start Deck 100 "Battle Collection"', '740353.webp', 'https://snkrdunk.com/en/trading-cards/740353', 'SNKRDUNK 1Sharpedo [MC 179/742](Start Deck 100 "Battle Collection")₩ -', true),
  ('704402', 'oricorio ex', '춤추새 ex', 'Oricorio ex SAR', 'SAR', 'M2', '111', '080', 'Expansion Pack "Inferno X"', '704402.webp', 'https://snkrdunk.com/en/trading-cards/704402', '1Oricorio ex SAR [M2 111/080](Expansion Pack "Inferno X")₩23,789~', true),
  ('703003', 'duraludon', '두랄루돈', 'Duraludon C', 'C', 'M2', '062', '080', 'Expansion Pack "Inferno X"', '703003.webp', 'https://snkrdunk.com/en/trading-cards/703003', '1Duraludon C [M2 062/080](Expansion Pack "Inferno X")₩8,500~', true),
  ('659221', 'sandshrew', '모래두지', 'Sandshrew C', 'C', 'M1L', '020', '063', 'Expansion Pack "Mega Brave"', '659221.webp', 'https://snkrdunk.com/en/trading-cards/659221', 'SNKRDUNK 1Sandshrew C [M1L 020/063](Expansion Pack "Mega Brave")₩ -', true),
  ('607932', 'seismitoad', '두빅굴', 'Seismitoad AR', 'AR', 'SV11B', '109', '086', 'Expansion Pack "Black Bolt"', '607932.webp', 'https://snkrdunk.com/en/trading-cards/607932', 'SNKRDUNK 1Seismitoad AR [SV11B 109/086](Expansion Pack "Black Bolt")₩55,244~', true),
  ('466510', 'roaring moon ex', '고동치는달 ex', 'Roaring Moon ex SAR', 'SAR', 'SV8a', '218', '187', 'High Class Pack "Terastal Festival ex"', '466510.webp', 'https://snkrdunk.com/en/trading-cards/466510', 'SNKRDUNK 1Roaring Moon ex SAR [SV8a 218/187](High Class Pack "Terastal Festival ex")₩20,398~', true),
  ('466380', 'slither wing', '땅을기는날개', 'Slither Wing', null, 'SV8a', '087', '187', 'High Class Pack "Terastal Festival ex"', '466380.webp', 'https://snkrdunk.com/en/trading-cards/466380', '2Slither Wing [SV8a 087/187](High Class Pack "Terastal Festival ex")₩10,199~', true),
  ('471630', 'slither wing', '땅을기는날개', 'Slither Wing : Master Ball Mirror', null, 'SV8a', '087', '187', 'High Class Pack "Terastal Festival ex"', '471630.webp', 'https://snkrdunk.com/en/trading-cards/471630', '1Slither Wing :Master Ball Mirror [SV8a 087/187](High Class Pack "Terastal Festival ex")₩11,049~', false),
  ('466381', 'slither wing', '땅을기는날개', 'Slither Wing : Monster Ball Mirror', null, 'SV8a', '087', '187', 'High Class Pack "Terastal Festival ex"', '466381.webp', 'https://snkrdunk.com/en/trading-cards/466381', '3Slither Wing :Monster Ball Mirror [SV8a 087/187](High Class Pack "Terastal Festival ex")₩ -', false),
  ('418741', 'magneton', '레어코일', 'Magneton AR', 'AR', 'SV8', '112', '106', 'Expansion Pack "Supercharged Breaker / Super Electric Breaker"', '418741.webp', 'https://snkrdunk.com/en/trading-cards/418741', '1Magneton AR [SV8 112/106](Expansion Pack "Supercharged Breaker / Super Electric Breaker")₩10,199~', true),
  ('414047', 'kecleon', '켈리몬', 'Kecleon C', 'C', 'SV8', '086', '106', 'Expansion Pack "Supercharged Breaker / Super Electric Breaker"', '414047.webp', 'https://snkrdunk.com/en/trading-cards/414047', '1Kecleon C [SV8 086/106](Expansion Pack "Supercharged Breaker / Super Electric Breaker")₩ -', true),
  ('277231', 'slither wing', '땅을기는날개', 'Slither Wing U', 'U', 'SV6a', '026', '064', 'Enhanced Expansion Pack "Night Wanderer"', '277231.webp', 'https://snkrdunk.com/en/trading-cards/277231', '1Slither Wing U [SV6a 026/064](Enhanced Expansion Pack "Night Wanderer")₩ -', true),
  ('277224', 'iron moth', '무쇠독나방', 'Iron Moth U', 'U', 'SV6a', '009', '064', 'Enhanced Expansion Pack "Night Wanderer"', '277224.webp', 'https://snkrdunk.com/en/trading-cards/277224', 'SNKRDUNK 1Iron Moth U [SV6a 009/064](Enhanced Expansion Pack "Night Wanderer")₩ -', true),
  ('221934', 'girafarig', '키링키', 'Girafarig C', 'C', 'SV5a', '034', '066', 'Enhanced Expansion Pack "Crimson Haze"', '221934.webp', 'https://snkrdunk.com/en/trading-cards/221934', '1Girafarig C [SV5a 034/066](Enhanced Expansion Pack "Crimson Haze")₩8,500~', true),
  ('184071', 'sharpedo', '샤크니아', 'Sharpedo U', 'U', 'SV5K', '017', '071', 'Expansion Pack "Wild Force"', '184071.webp', 'https://snkrdunk.com/en/trading-cards/184071', '1Sharpedo U [SV5K 017/071](Expansion Pack "Wild Force" )₩ -', true),
  ('162025', 'slowbro', '야도란', 'Slowbro', null, 'SV4a', '037', '190', 'High Class Pack "Shiny Treasure ex"', '162025.webp', 'https://snkrdunk.com/en/trading-cards/162025', '1Slowbro [SV4a 037/190](High Class Pack "Shiny Treasure ex")₩8,500~', true),
  ('149242', 'alomomola', '맘복치', 'Alomomola', null, 'SVG', '017', '049', 'Special deck set ex "Venusaur & Charizard & Blastoise"', '149242.webp', 'https://snkrdunk.com/en/trading-cards/149242', '1Alomomola [SVG 017/049](Special deck set ex "Venusaur & Charizard & Blastoise")₩42,496~', true),
  ('150763', 'blitzle', '줄뮤마', 'Blitzle C', 'C', 'SV4M', '023', '066', 'Expansion Pack "A glimpse of the future"', '150763.webp', 'https://snkrdunk.com/en/trading-cards/150763', '1Blitzle C[SV4M 023/066](Expansion Pack "A glimpse of the future")₩14,449~', true),
  ('136219', 'absol', '앱솔', 'Absol U', 'U', 'SV3a', '036', '062', 'Enhanced Expansion Pack "Raging Surf"', '136219.webp', 'https://snkrdunk.com/en/trading-cards/136219', 'SNKRDUNK 1Absol U[SV3a 036/062](Enhanced Expansion Pack "Raging Surf")₩8,500~', true),
  ('129816', 'alomomola', '맘복치', 'Alomomola', null, 'SVD', '026', '139', 'Selected ex Start Deck', '129816.webp', 'https://snkrdunk.com/en/trading-cards/129816', '1Alomomola [SVD 026/139](Selected ex Start Deck)₩ -', true),
  ('128036', 'aerodactyl', '프테라', 'Aerodactyl R', 'R', 'SV2a', '142', '165', 'Enhanced Expansion Pack "Pokemon Card 151"', '128036.webp', 'https://snkrdunk.com/en/trading-cards/128036', 'SNKRDUNK 3Aerodactyl R[SV2a 142/165](Enhanced Expansion Pack "Pokemon Card 151")₩8,500~', true),
  ('128258', 'aerodactyl', '프테라', 'Aerodactyl R : Master Ball Mirror', 'R', 'SV2a', '142', '165', 'Enhanced Expansion Pack "Pokemon Card 151"', '128258.webp', 'https://snkrdunk.com/en/trading-cards/128258', 'SNKRDUNK 1Aerodactyl R: Master Ball Mirror[SV2a 142/165](Enhanced Expansion Pack "Pokemon Card 151")₩48,445~', false),
  ('128037', 'aerodactyl', '프테라', 'Aerodactyl R : Monster Ball Mirror', 'R', 'SV2a', '142', '165', 'Enhanced Expansion Pack "Pokemon Card 151"', '128037.webp', 'https://snkrdunk.com/en/trading-cards/128037', 'SNKRDUNK 2Aerodactyl R: Monster Ball Mirror[SV2a 142/165](Enhanced Expansion Pack "Pokemon Card 151")₩8,500~', false),
  ('120801', 'bronzor', '동미러', 'Bronzor C', 'C', 'SV2P', '050', '071', 'Expansion Pack "Snow hazard"', '120801.webp', 'https://snkrdunk.com/en/trading-cards/120801', '1Bronzor C[SV2P 050/071](Expansion Pack "Snow hazard")₩12,749~', true),
  ('116069', 'magikarp', '잉어킹', 'Magikarp AR', 'AR', 'SV1a', '080', '073', 'Scarlet & Violet Enhanced Expansion Pack "Triplet Beat"', '116069.webp', 'https://snkrdunk.com/en/trading-cards/116069', 'SNKRDUNK 1Magikarp AR[SV1a 080/073](Scarlet & Violet Enhanced Expansion Pack "Triplet Beat")₩98,589~', true),
  ('270348', 'slowbro', '야도란', 'Slowbro R', 'R', 'SV1V', '020', '078', 'Expansion Pack "Violet ex"', '270348.webp', 'https://snkrdunk.com/en/trading-cards/270348', 'SNKRDUNK 1Slowbro R [SV1V 020/078](Expansion Pack "Violet ex")₩8,500~', true),
  ('806399', 'alomomola', '맘복치', 'Alomomola', null, 'SVAW', '001', '023', 'Starter Set ex "Kuwassu & Mimikkyu"', '806399.webp', 'https://snkrdunk.com/en/trading-cards/806399', 'SNKRDUNK 1Alomomola [SVAW 001/023](Starter Set ex "Kuwassu & Mimikkyu")₩ -', true),
  ('103800', 'galarian moltres', '가라르 파이어', 'Galarian Moltres AR', 'AR', 's12a', '190', '172', 'High Class Pack "VSTAR Universe"', '103800.webp', 'https://snkrdunk.com/en/trading-cards/103800', '1Galarian Moltres AR[s12a 190/172](High Class Pack "VSTAR Universe")₩9,349~', true),
  ('285609', 'magmar', '마그마', 'Magmar', null, 'S12a', '016', '172', 'High Class Pack "VSTAR Universe"', '285609.webp', 'https://snkrdunk.com/en/trading-cards/285609', '2Magmar [S12a 016/172](High Class Pack "VSTAR Universe")₩ -', true),
  ('285610', 'magmar', '마그마', 'Magmar : Mirror', null, 'S12a', '016', '172', 'High Class Pack "VSTAR Universe"', '285610.webp', 'https://snkrdunk.com/en/trading-cards/285610', '1Magmar :Mirror [S12a 016/172](High Class Pack "VSTAR Universe")₩10,199~', false),
  ('325084', 'moltres', '파이어', 'Moltres', null, 'SO', '007', '030', 'Special Deck Set Lizardon VSTAR vs Rayquaza VSTAR', '325084.webp', 'https://snkrdunk.com/en/trading-cards/325084', '1Moltres [SO 007/030](Special Deck Set Lizardon VSTAR vs Rayquaza VSTAR)₩40,796~', true),
  ('287944', 'beheeyem', '벰크', 'Beheeyem U', 'U', 'S12', '044', '098', 'Expansion Pack "Paradigm Trigger"', '287944.webp', 'https://snkrdunk.com/en/trading-cards/287944', '1Beheeyem U [S12 044/098](Expansion Pack "Paradigm Trigger")₩ -', true),
  ('287933', 'stunfisk', '메더', 'Stunfisk C', 'C', 'S12', '029', '098', 'Expansion Pack "Paradigm Trigger"', '287933.webp', 'https://snkrdunk.com/en/trading-cards/287933', '1Stunfisk C [S12 029/098](Expansion Pack "Paradigm Trigger")₩8,500~', true),
  ('93379', 'giratina v', '기라티나 V', 'Giratina V SR', 'SR', 'S11', '111', '100', 'Expansion Pack "Lost Abyss"', '93379.webp', 'https://snkrdunk.com/en/trading-cards/93379', '1Giratina V SR: SA[S11 111/100](Expansion Pack "Lost Abyss")₩747,916~', true),
  ('136984', 'hypno', '슬리퍼', 'Hypno U', 'U', 'S11', '043', '100', 'Expansion Pack "Lost Abyss"', '136984.webp', 'https://snkrdunk.com/en/trading-cards/136984', '1Hypno U[S11 043/100](Expansion Pack "Lost Abyss")₩ -', true),
  ('139563', 'bronzong', '동탁군', 'Bronzong U', 'U', 's10P', '049', '067', 'Expansion Pack "Space Juggler"', '139563.webp', 'https://snkrdunk.com/en/trading-cards/139563', '1Bronzong U[s10P 049/067](Expansion Pack "Space Juggler")₩ -', true),
  ('139480', 'ariados', '아리아도스', 'Ariados U', 'U', 's10D', '040', '067', 'Expansion Pack "Time Gazer"', '139480.webp', 'https://snkrdunk.com/en/trading-cards/139480', '1Ariados U[s10D 040/067](Expansion Pack "Time Gazer")₩ -', true),
  ('139637', 'whiscash', '메깅', 'Whiscash U', 'U', 's9a', '022', '067', 'Enhanced Expansion Pack "Battle Region"', '139637.webp', 'https://snkrdunk.com/en/trading-cards/139637', '1Whiscash U[s9a 022/067](Enhanced Expansion Pack "Battle Region")₩8,500~', true),
  ('139638', 'whiscash', '메깅', 'Whiscash U : Mirror', 'U', 's9a', '022', '067', 'Enhanced Expansion Pack "Battle Region"', '139638.webp', 'https://snkrdunk.com/en/trading-cards/139638', '2Whiscash U: Mirror[s9a 022/067](Enhanced Expansion Pack "Battle Region")₩ -', false),
  ('139800', 'sawk', '타격귀', 'Sawk C', 'C', 'S9', '057', '100', 'Expansion Pack "Star Birth"', '139800.webp', 'https://snkrdunk.com/en/trading-cards/139800', 'SNKRDUNK 1Sawk C[S9 057/100](Expansion Pack "Star Birth")₩ -', true),
  ('139759', 'magmar', '마그마', 'Magmar C', 'C', 'S9', '016', '100', 'Expansion Pack "Star Birth"', '139759.webp', 'https://snkrdunk.com/en/trading-cards/139759', 'SNKRDUNK 1Magmar C[S9 016/100](Expansion Pack "Star Birth")₩ -', true)
),
staged as (
  insert into public.snkrdunk_cards
    (source_id, species, species_ko, name_en, rarity, set_code, collector_number, total, set_name, image_path, source_url, raw_title, lang)
  select source_id, species, species_ko, name_en, rarity, set_code, collector_number, total, set_name, image_path, source_url, raw_title, 'ja'
  from incoming
  on conflict (source_id) do update set
    image_path = coalesce(public.snkrdunk_cards.image_path, excluded.image_path),
    species_ko = coalesce(public.snkrdunk_cards.species_ko, excluded.species_ko)
  returning source_id
),
new_sets as (
  insert into public.sets (code, name_ko)
  select lower(set_code), min(coalesce(set_name, set_code))
  from incoming
  group by lower(set_code)
  on conflict (code) do nothing
  returning code
),
cataloged as (
  insert into public.cards (set_code, collector_number, name_ko, rarity, illustrator, image_path, lang)
  select lower(i.set_code), i.collector_number || '/' || i.total, i.species_ko || ' ' || i.name_en,
         i.rarity, 'Shinji Kanda', i.image_path, 'ja'
  from incoming i
  left join new_sets s on s.code = lower(i.set_code)
  where i.is_primary and not exists (
    select 1 from public.cards c
    where lower(c.set_code) = lower(i.set_code)
      and public.normalize_collector_number(split_part(c.collector_number, '/', 1))
        = public.normalize_collector_number(i.collector_number)
      and public.normalize_collector_number(split_part(c.collector_number, '/', 2))
        = public.normalize_collector_number(i.total)
  )
  on conflict (set_code, collector_number) do nothing
  returning id
)
update public.cards c
set illustrator = 'Shinji Kanda'
from incoming i
where i.is_primary and c.illustrator is null
  and lower(c.set_code) = lower(i.set_code)
  and public.normalize_collector_number(split_part(c.collector_number, '/', 1))
    = public.normalize_collector_number(i.collector_number)
  and public.normalize_collector_number(split_part(c.collector_number, '/', 2))
    = public.normalize_collector_number(i.total);
