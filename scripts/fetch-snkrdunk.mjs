// SNKRDUNK 일어판 포켓몬 카드를 "포켓몬 단위"로 인기순 수집한다.
//
//   node scripts/fetch-snkrdunk.mjs --pokemon charizard,pikachu,mewtwo --maxpages 30
//   옵션: --pokemon 영문명 콤마목록 | --maxpages N(포켓몬당 최대 페이지) | --delay ms(기본 1000)
//         --images .cache/snkrdunk-images(기본) | --no-images | --headful
//
// 검색 결과 목록(conversion=인기순)에 이름·세트코드·번호·세트명·가격·이미지가 다 들어있어 상세 방문 불필요.
// 페이지당 20장. &page=N으로 넘기고, 첫 카드가 1페이지와 같아지면(=파라미터 무시/끝) 멈춘다.
// 재실행 안전: source_id 충돌 시 갱신. 이미지는 이미 받은 건 건너뜀.
import { chromium } from "playwright";
import pg from "pg";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const has = (n) => args.includes(`--${n}`);

// 대상 목록: --pokemon "a,b"로 임시 지정하거나, 기본은 scripts/snkrdunk-targets.json(버전관리).
const TARGETS_PATH = opt("targets", path.join(path.dirname(fileURLToPath(import.meta.url)), "snkrdunk-targets.json"));
const KO = new Map(); // en(lowercase) → ko
const TAGTEAM = new Set(); // tagteam:true 인 en — 키워드 단어매칭 대신 "A & B ... GX"(포켓몬 태그팀)만 거른다
let SPECIES = [];
if (opt("pokemon")) {
  SPECIES = opt("pokemon").split(",").map((s) => s.trim()).filter(Boolean);
} else {
  const j = JSON.parse(await readFile(TARGETS_PATH, "utf8"));
  for (const t of j.targets) {
    SPECIES.push(t.en);
    if (t.ko) KO.set(t.en.toLowerCase(), t.ko);
    if (t.tagteam) TAGTEAM.add(t.en);
  }
}
const MAXPAGES = Number(opt("maxpages", "30"));
const DELAY = Number(opt("delay", "1000"));
const IMGDIR = opt("images", ".cache/snkrdunk-images");
const WANT_IMAGES = !has("no-images");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 목록 원문을 파싱한다. 두 형식 지원:
//   일본판: "3MEGA Charizard X ex MA [M2a 223/193](High Class Pack ...)₩21,417~"  → 대괄호=세트코드+번호
//   영문판: "Nessa U :Reverse Holo [157/185][EN](Sword & Shield ...)₩ -"         → 대괄호=번호만, [EN] 마커
const RARITY = /\b(SAR|SIR|SSR|SR|AR|UR|FUR|MUR|HR|CSR|CHR|RRR|RR|MA|GX|VSTAR|VMAX|V|K|ACE|PROMO|UC|U|RC|R|C|S|A)\b\s*$/;
export function parseItem(text) {
  const t = text.replace(/\s+/g, " ").trim();
  // 앞 숫자 = 페이지 내 위치(인기순위는 수집 순서로 따로 매김) → 제거
  const rankM = t.match(/^(\d+)(?=\D)/);
  const body = rankM ? t.slice(rankM[0].length) : t;
  // 첫 대괄호 [ ... ] = 번호(+세트코드)
  const br = body.match(/\[([^\]]+)\]/);
  if (!br) return null;
  const name = body.slice(0, br.index).trim();
  if (!name) return null;
  const inner = br[1].trim();
  const after = body.slice(br.index + br[0].length);
  const lang = /\[[A-Z]{2}\]/.test(after) || /\[EN\]/i.test(after) ? "en" : "ja";
  // 대괄호 안: "SETCODE NUM/TOTAL"(일본판) | "NUM/TOTAL"(영문판) | "SETCODE"만(옛날·프로모 [DP5] 등)
  let setCode = null, numPart = null;
  const sp = inner.match(/^(\S+)\s+(.+)$/);
  if (sp) { setCode = sp[1]; numPart = sp[2]; }
  else if (inner.includes("/") || /^\d+$/.test(inner)) { numPart = inner; } // 번호꼴
  else { setCode = inner; } // 단일 세트코드(번호 없음)
  const [number, total] = (numPart || "").split("/");
  // 세트명 = 대괄호 뒤 (...) 안
  const setNameM = after.match(/\(([^)]*)\)/);
  const priceM = body.match(/(?:₩|¥|\$)\s*([\d,]+)/);
  const rm = name.match(RARITY);
  return {
    popularity_rank: null,
    name_en: name,
    rarity: rm ? rm[1] : null,
    set_code: setCode,
    collector_number: number?.trim() || null,
    total: total?.trim() || null,
    set_name: setNameM ? setNameM[1].trim() : null,
    price_krw: priceM ? Number(priceM[1].replace(/,/g, "")) : null,
    lang,
    raw_title: t,
  };
}

async function extractPage(page) {
  return page.$$eval('a[href*="/trading-cards/"]', (as) => {
    const seen = new Set(); const out = [];
    for (const a of as) {
      const href = a.getAttribute("href") || "";
      const id = (href.match(/trading-cards\/(\d+)/) || [])[1];
      if (!id || seen.has(id)) continue; seen.add(id);
      const img = a.querySelector("img");
      out.push({ id, text: (a.textContent || "").trim(), img: img && (img.getAttribute("src") || img.getAttribute("data-src")) });
    }
    return out;
  });
}

async function downloadImage(ctx, url, dest) {
  try { await stat(dest); return "skip"; } catch {}
  const u = url.includes("?") ? url : url + "?size=l";
  const resp = await ctx.request.get(u, { timeout: 20000 });
  if (!resp.ok()) return "err" + resp.status();
  await writeFile(dest, Buffer.from(await resp.body()));
  return "ok";
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 필요");
  await mkdir(IMGDIR, { recursive: true });
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const browser = await chromium.launch({ headless: !has("headful") });
  const ctx = await browser.newContext({ userAgent: UA, locale: "en-US" });
  const page = await ctx.newPage();

  let totalCards = 0, totalImg = 0, parseFail = 0, filtered = 0;
  for (const sp of SPECIES) {
    let firstIdPage1 = null, got = 0, rank = 0;
    const needle = sp.toLowerCase();
    // 단어 경계 매칭 — "Bea"가 "Beast", "Lana"가 "Lanakila"에 오매칭되지 않게.
    const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const isTag = TAGTEAM.has(sp); // 태그팀 모드: "A & B ... GX"만. species는 'tagteam'으로 저장.
    const speciesLabel = isTag ? "tagteam" : sp;
    for (let p = 1; p <= MAXPAGES; p++) {
      const url = `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(sp)}&sortKey=conversion&page=${p}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
      const items = await extractPage(page);
      if (items.length === 0) break;
      if (p === 1) firstIdPage1 = items[0].id;
      else if (items[0].id === firstIdPage1) break; // page 파라미터 무시 = 끝
      for (const it of items) {
        const parsed = parseItem(it.text);
        if (!parsed) { parseFail++; continue; }
        // SNKRDUNK 검색은 fuzzy. 일반=키워드 단어매칭. 태그팀=이름이 "A & B ... GX"인 포켓몬 태그팀만
        // (트레이너 듀오·"Strongest Tag Team" 프로모는 GX가 없어 자동 제외).
        const keep = isTag
          ? / & /.test(parsed.name_en) && /\bGX\b/i.test(parsed.name_en)
          : re.test(parsed.name_en);
        if (!keep) { filtered++; continue; }
        rank += 1; // 수집 순서 = 전역 인기순위(목록 앞 숫자는 페이지 내 위치라 못 씀)
        parsed.popularity_rank = rank;
        let imagePath = null;
        if (WANT_IMAGES && it.img) {
          imagePath = `${it.id}.webp`;
          const r = await downloadImage(ctx, it.img, path.join(IMGDIR, imagePath));
          if (r === "ok") totalImg++;
        }
        await db.query(
          `insert into public.snkrdunk_cards
             (source_id, species, species_ko, name_en, rarity, set_code, collector_number, total, set_name, price_krw, popularity_rank, image_path, source_url, raw_title, lang)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           on conflict (source_id) do update set
             species=excluded.species, species_ko=excluded.species_ko, name_en=excluded.name_en, rarity=excluded.rarity,
             set_code=excluded.set_code, collector_number=excluded.collector_number, total=excluded.total,
             set_name=excluded.set_name, price_krw=excluded.price_krw, popularity_rank=excluded.popularity_rank,
             image_path=coalesce(excluded.image_path, public.snkrdunk_cards.image_path),
             source_url=excluded.source_url, raw_title=excluded.raw_title, lang=excluded.lang, fetched_at=now()`,
          [it.id, speciesLabel, KO.get(sp.toLowerCase()) ?? null, parsed.name_en, parsed.rarity, parsed.set_code, parsed.collector_number, parsed.total,
           parsed.set_name, parsed.price_krw, parsed.popularity_rank, imagePath,
           `https://snkrdunk.com/en/trading-cards/${it.id}`, parsed.raw_title, parsed.lang],
        );
        got++; totalCards++;
      }
      await sleep(DELAY);
    }
    console.log(`  ${sp}: ${got}장`);
  }
  await browser.close();
  await db.end();
  console.log(`\n완료 — 카드 ${totalCards}, 이미지 ${totalImg}, 파싱실패 ${parseFail}, 타종 제외 ${filtered}`);
}
// 직접 실행할 때만 크롤. import(재파싱 등)하면 parseItem만 쓴다.
if (process.argv[1] && process.argv[1].endsWith("fetch-snkrdunk.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
