// 공식 한국 사이트의 카드 이미지(워터마크 webp)를 세트·번호 규칙으로 받아 로컬에 모은다.
//
//   npm run cards:images -- --csv data/cards-kr.csv --out .cache/card-images --manifest data/card-images.csv
//   옵션: --limit N(앞 N장만) --delay ms(기본 700) --sets SV2a,M2(해당 세트만)
//
// 이미지 주소는 /public-assets/.../wmimages/{폴더}/{세트}/{세트}_{번호3자리}.webp 로 결정된다
// (예: SV/SV2a/SV2a_201.webp, MEGA/M2/M2_116.webp). 폴더는 세트 접두어로 추정하고 안 맞으면 후보를 돌아가며 찾는다.
// 이미 받은 파일은 건너뛴다(재실행 안전). 결과는 manifest CSV에 기록한다(status: ok/missing/error).
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseCardImport } from "../lib/card-import.ts";

const BASE = "https://pokemoncard.co.kr/public-assets/home/data/cards.image_www/data/wmimages";
const UA = "pokeca-archive card list (nonprofit fan archive)";
const FOLDERS = ["SV", "MEGA", "PROMO", "SM", "S", "XY", "BW"];

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const csvPath = opt("csv") ?? "data/cards-kr.csv";
const outDir = opt("out") ?? ".cache/card-images";
const manifestPath = opt("manifest") ?? "data/card-images.csv";
const limit = opt("limit") ? Number(opt("limit")) : Infinity;
const delay = opt("delay") ? Number(opt("delay")) : 700;
const onlySets = opt("sets")?.split(",").map((s) => s.toLowerCase());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const guessFolder = (set: string) => (/^M/i.test(set) ? "MEGA" : /^SV/i.test(set) ? "SV" : "SV");
const fileNumber = (collector: string) => {
  const n = collector.split("/")[0].trim();
  return /^\d+$/.test(n) ? n.padStart(3, "0") : n;
};

type Row = { set: string; number: string; file: string; bytes: number; status: "ok" | "missing" | "error"; url: string };

const csvText = await readFile(csvPath, "utf8");
const parsed = parseCardImport(csvText);
if (parsed.errors.length) {
  for (const e of parsed.errors) console.error(e.message);
  process.exit(1);
}
// 파서는 set_code를 소문자로 정규화하지만 공식 이미지 경로는 대소문자를 가린다(SV2a, M2a).
// CSV 원문 첫 컬럼에서 공식 표기를 되찾는다.
const officialCase = new Map<string, string>();
for (const line of csvText.split(/\r?\n/).slice(1)) {
  const raw = line.split(",")[0]?.trim();
  if (raw) officialCase.set(raw.toLowerCase(), raw);
}
let cards = parsed.cards.map((c) => ({ set: officialCase.get(c.set_code) ?? c.set_code, number: c.collector_number }));
if (onlySets) cards = cards.filter((c) => onlySets.includes(c.set.toLowerCase()));
cards = cards.slice(0, limit);

// 규칙으로 못 정하는 카드(덱 제품은 같은 번호가 덱별 변형 _N/_G/_P로 갈림)는 data/card-image-overrides.csv 에
// set_code,collector_number,source_url 로 적어 두면 그 주소를 그대로 쓴다.
const overridesPath = opt("overrides") ?? "data/card-image-overrides.csv";
const overrides = new Map<string, string>();
for (const line of (await readFile(overridesPath, "utf8").catch(() => "")).split(/\r?\n/).slice(1)) {
  const [set, number, url] = line.split(",");
  if (set && number && url) overrides.set(`${set.toLowerCase()} ${number.toUpperCase()}`, url.trim());
}

const folderOf = new Map<string, string>(); // 세트별로 확인된 폴더
const rows: Row[] = [];
let ok = 0, missing = 0, error = 0, skipped = 0;

async function fetchOne(url: string): Promise<{ status: number; body?: Buffer }> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 200) return { status: 200, body: Buffer.from(await res.arrayBuffer()) };
      if (res.status === 403 || res.status === 404) return { status: res.status };
      await sleep(5_000 * attempt);
    } catch {
      await sleep(5_000 * attempt);
    }
  }
  return { status: 0 };
}

await mkdir(outDir, { recursive: true });
const started = Date.now();
for (const [i, c] of cards.entries()) {
  const num = fileNumber(c.number);
  const file = path.join(outDir, c.set, `${c.set}_${num}.webp`);
  const existing = await stat(file).catch(() => null);
  if (existing && existing.size > 0) {
    skipped++;
    rows.push({ set: c.set, number: c.number, file, bytes: existing.size, status: "ok", url: "" });
    continue;
  }

  const known = folderOf.get(c.set);
  const candidates = known ? [known] : [guessFolder(c.set), ...FOLDERS.filter((f) => f !== guessFolder(c.set))];
  let result: Row | null = null;
  const override = overrides.get(`${c.set.toLowerCase()} ${c.number.toUpperCase()}`);
  if (override) {
    const r = await fetchOne(override);
    if (r.status === 200 && r.body) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, r.body);
      result = { set: c.set, number: c.number, file, bytes: r.body.length, status: "ok", url: override };
    } else {
      result = { set: c.set, number: c.number, file: "", bytes: 0, status: r.status === 0 ? "error" : "missing", url: override };
    }
  }
  if (!result) {
  // 덱 제품(SVI 배틀 아카데미 등)은 파일명 뒤에 레귤레이션 마크가 붙는다(SVI_061_G.webp). 기본 이름이 없으면 그것도 시도.
  const SUFFIXES = ["", "_G", "_H", "_F", "_I"];
  outer: for (const folder of candidates) {
    for (const suffix of SUFFIXES) {
      const url = `${BASE}/${folder}/${c.set}/${c.set}_${num}${suffix}.webp`;
      const r = await fetchOne(url);
      if (r.status === 200 && r.body) {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, r.body);
        folderOf.set(c.set, folder);
        result = { set: c.set, number: c.number, file, bytes: r.body.length, status: "ok", url };
        break outer;
      }
      if (r.status === 0) {
        result = { set: c.set, number: c.number, file: "", bytes: 0, status: "error", url };
        break outer;
      }
      await sleep(200);
    }
    if (known) {
      // 폴더는 맞는데 그 번호만 없음(에너지 카드 등) → 다른 폴더를 뒤질 필요 없음
      const url = `${BASE}/${folder}/${c.set}/${c.set}_${num}.webp`;
      result = { set: c.set, number: c.number, file: "", bytes: 0, status: "missing", url };
      break;
    }
  }
  }
  if (!result) {
    result = { set: c.set, number: c.number, file: "", bytes: 0, status: "missing", url: `${BASE}/?/${c.set}/${c.set}_${num}.webp` };
  }
  rows.push(result);
  if (result.status === "ok") ok++;
  else if (result.status === "missing") missing++;
  else error++;

  if ((i + 1) % 50 === 0 || i + 1 === cards.length) {
    const sec = Math.round((Date.now() - started) / 1000);
    console.log(`${i + 1}/${cards.length} · 받음 ${ok} · 건너뜀 ${skipped} · 없음 ${missing} · 오류 ${error} · ${sec}s`);
  }
  await sleep(delay);
}

const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csv = ["set_code,collector_number,file,bytes,status,source_url"]
  .concat(rows.map((r) => [r.set, r.number, r.file, String(r.bytes), r.status, r.url].map(esc).join(",")))
  .join("\n");
await writeFile(manifestPath, csv + "\n");
console.log(`manifest: ${manifestPath}`);
console.log(`세트별 폴더: ${[...folderOf].map(([s, f]) => `${s}=${f}`).join(" ")}`);
if (missing || error) {
  console.log("못 받은 카드:");
  for (const r of rows.filter((r) => r.status !== "ok")) console.log(`  ${r.status} ${r.set} ${r.number} ${r.url}`);
}
