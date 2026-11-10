// 태그팀 GX 카드(cards.lang='ja', name_ko가 "태그팀 <영문>")의 영문 포켓몬 이름을 한글로 바꾸는
// 마이그레이션을 생성한다. SNKRDUNK는 태그팀을 영문/일본어 로마자로만 줘서 수집 후 이 스크립트로 번역한다.
//   node --env-file=.env.local scripts/gen-tagteam-korean.mjs > infra/db/migrations/<...>_tagteam_korean_names.sql
// 번역은 고유명 치환(긴 키 우선 — "Alolan Raichu"를 "Raichu"보다 먼저). 레어도(GX/RR/SR/HR/SA)·트레이너태그((N)/(Lillie))는 그대로.
import { Client } from "pg";

// 영문/일본어로마자 → 한글 (태그팀 등장 포켓몬 66종, 2026-11 검증).
const KO = {
  "Alolan Exeggutor": "알로라 나시", "Alolan Muk": "알로라 질퍽이", "Alolan Raichu": "알로라 라이츄",
  "Mega Lopunny": "메가 이어롭", "Mega Mimilop": "메가 이어롭", "Mega Sableye": "메가 깜까미",
  Arceus: "아르세우스", Articuno: "프리져", Blastoise: "거북왕", Braixen: "테르나", Buzzwole: "매시붕",
  Celebi: "세레비", Charizard: "리자몽", Cleffa: "삐", Darkrai: "다크라이", Deoxys: "테오키스",
  Dialga: "디아루가", Dusknoir: "야느와르몽", Eevee: "이브이", Espeon: "에브이", Garchomp: "한카리아스",
  Gardevoir: "가디안", Gengar: "팬텀", Giratina: "기라티나", Greninja: "개굴닌자", Guzzlord: "악식킹",
  Igglybuff: "푸푸린", Jigglypuff: "푸린", Kairiky: "괴력몬", Latias: "라티아스", Latios: "라티오스",
  Lucario: "루카리오", Lunala: "루나아라", Machamp: "괴력몬", Magikarp: "잉어킹", Marshadow: "마샤도",
  Melmetal: "멜메탈", Mew: "뮤", Mewtwo: "뮤츠", Mimikyu: "따라큐", Moltres: "파이어", Muk: "질퍽이",
  Naganadel: "아고용", Palkia: "펄기아", Pheromosa: "페로코체", Pikachu: "피카츄", Piplup: "팽도리",
  Psyduck: "고라파덕", Purin: "푸린", Raichu: "라이츄", Reshiram: "레시라무", Rowlet: "나몰빼미",
  Slowpoke: "야돈", Snivy: "주리비얀", Snorlax: "잠만보", Solgaleo: "솔가레오", Sylveon: "님피아",
  Togepi: "토게피", Trevenant: "대로트", Tyranitar: "마기라스", Umbreon: "블래키", Venusaur: "이상해꽃",
  Wailord: "고래왕", Zapdos: "썬더", Zekrom: "제크로무", Zoroark: "조로아크",
};
// 긴 이름 우선(복합명이 단일명보다 먼저 치환되게).
const keys = Object.keys(KO).sort((a, b) => b.length - a.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const translate = (name) => {
  let out = name;
  for (const k of keys) out = out.replace(new RegExp(`\\b${esc(k)}\\b`, "g"), KO[k]);
  return out;
};
const sqlStr = (s) => "'" + s.replace(/'/g, "''") + "'";

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(
  `select set_code, collector_number, name_ko from public.cards
   where lang='ja' and name_ko like '태그팀 %' order by set_code, collector_number`,
);
await client.end();

console.log("-- 태그팀 GX 카드 이름을 한글로(영문 포켓몬명 → 한글). scripts/gen-tagteam-korean.mjs 생성.");
console.log("-- 멱등: 이미 한글이면 치환 대상 없음. 번역맵은 스크립트에 있음(재생성 가능).");
let changed = 0;
for (const r of rows) {
  const next = translate(r.name_ko);
  if (next === r.name_ko) continue;
  changed++;
  console.log(
    `update public.cards set name_ko=${sqlStr(next)} where set_code=${sqlStr(r.set_code)} and collector_number=${sqlStr(r.collector_number)} and lang='ja';`,
  );
}
console.error(`generated ${changed} updates (of ${rows.length} tagteam cards)`);
