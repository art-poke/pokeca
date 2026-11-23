// npm run demo:admin — seed only the dedicated loopback preview database.
import { createHash } from "node:crypto";
import postgres from "postgres";
import {
  isPreviewDatabase,
  previewAdminEmail,
} from "../lib/local-admin-preview.ts";

const url = process.env.DATABASE_URL;
if (!url || !isPreviewDatabase(url) || process.env.NODE_ENV === "production") {
  throw new Error(
    "로컬 pokeca_admin_preview DB에서만 샘플을 만들 수 있습니다.",
  );
}
const db = postgres(url, { max: 1 });
const day = 86_400_000;
const now = Date.now();
const today = Math.floor((now + 9 * 3_600_000) / day);
const first = today - 63;
const midnight = (date: number) => date * day - 9 * 3_600_000;
const iso = (time: number) => new Date(time).toISOString();
function id(key: string) {
  const hex = createHash("sha256")
    .update("artpoke-preview/" + key)
    .digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    "8" + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

type Event = {
  type: string;
  visitor_id: string;
  session_id: string;
  member_id: string | null;
  created_at: string;
  payload: postgres.Parameter;
  event_key: string;
};
const names = [
  "별빛수집가",
  "피카도감",
  "도안공방",
  "달빛트레이너",
  "리자몽팬",
  "이브이노트",
];
const origins = [
  { page: "card_detail", action: "download_artwork", placement: "content" },
  { page: "game_hub", action: "select_game", placement: "content" },
  { page: "request_list", action: "request_artwork", placement: "content" },
  { page: "home", action: "start_login", placement: "header" },
];
const operator = id("operator");

try {
  await db.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(87514401)`;
    await tx`insert into users(id,name,email,created_at) values(${operator},'뮤츠조아요 (샘플)',${previewAdminEmail},${iso(midnight(first - 1))})
      on conflict (id) do nothing`;
    await tx`insert into artists(user_id,display_name,handle,provider) values(${operator},'뮤츠조아요 (샘플)','mewtwolike','kakao')
      on conflict (user_id) do nothing`;
    await tx`insert into admins(user_id,email,manage_members) values(${operator},${previewAdminEmail},true) on conflict do nothing`;
    await tx`update analytics_start set started_at=least(started_at,${iso(midnight(first))})`;
    const cards =
      await tx`select id from cards order by set_code,collector_number limit 10`;
    if (!cards.length) throw new Error("DB 마이그레이션을 먼저 실행해 주세요.");

    for (let date = first; date <= today; date++) {
      const visits = 35 + ((date * 17) % 29) + Math.floor((date - first) / 3);
      const signups = 2 + (date % 4);
      const events: Event[] = [];
      for (let i = 0; i < visits; i++) {
        const starts = midnight(date);
        const elapsed = Math.min(day, now - starts);
        const time = starts + Math.floor((elapsed * (i + 1)) / (visits + 2));
        const step = Math.min(1000, (now - time) / 16);
        const session = id("session/" + date + "/" + i);
        const returning = i > 9 && i % 2 === 0 && date > first;
        const age = [1, 7, 30][(i >> 1) % 3];
        const joined = returning ? Math.max(first, date - age) : date;
        const member = id("member/" + joined + "/" + (returning ? i % 2 : i));
        const visitor =
          returning || i < signups
            ? id("browser/" + member)
            : id("guest/" + i + "/" + (date % 4));
        const provider = (i + date) % 2 ? "google" : "kakao";
        const origin = origins[(date + i) % origins.length];
        let current = returning ? member : null;
        let sequence = 0;
        function add(
          type: string,
          payload: Record<string, string | number> = {},
        ) {
          const key = id(session + "/" + sequence + "/" + type);
          events.push({
            type,
            payload: tx.json(payload),
            member_id: current,
            session_id: session,
            visitor_id: visitor,
            created_at: iso(time + sequence++ * step),
            event_key: key,
          });
          return key;
        }
        add("page_view", {
          page: origin.page,
          landing: "yes",
          source: ["", "naver", "x", "google"][i % 4],
        });
        if (!returning) {
          add("cta_impression", origin);
          if (i < signups + 6) add("cta_clicked", origin);
          if (i < signups + 2) {
            const attempt = add("oauth_started", { ...origin, provider });
            if (i < signups) {
              const name =
                names[(date + i) % names.length] + "-" + (date % 100) + (i + 1);
              const handle = "sample_" + date + "_" + i;
              await tx`insert into users(id,name,created_at) values(${member},${name},${iso(time + sequence * step)}) on conflict do nothing`;
              await tx`insert into artists(user_id,display_name,handle,provider) values(${member},${name},${handle},${provider}) on conflict do nothing`;
              current = member;
              add("login_succeeded", { ...origin, provider, attempt });
              add("signup_completed", { ...origin, provider, attempt });
              if (i === 0) {
                await tx`insert into requests(card_id,format,user_id,visitor_id,created_at,resolved_at)
                  values(${cards[date % cards.length].id},'9pocket',${member},${visitor},${iso(time)},${date % 3 && date < today ? iso(time + day) : null})
                  on conflict do nothing`;
                add("request_created");
              }
            }
          }
        }
        if (i % 3 === 0) {
          add("search", {
            query: ["피카츄", "이브이", "리자몽", "뮤츠"][i % 4],
            hits: i % 5 ? 3 : 0,
          });
          if (i % 5) {
            add("page_view", { page: "card_detail" });
            if (current) add("download");
          }
        } else if (i % 3 === 1 && current) {
          const round = {
            game: ["name", "odd", "monsterball"][(i % 5) % 3],
            round: session,
          };
          add("page_view", { page: "game_play" });
          add("game_started", round);
          if (i % 4) add("game_finished", round);
        } else if (i % 4 === 0) {
          add("page_view", { page: "ranking" });
          add("cta_clicked", {
            page: "ranking",
            action: "select_ranked_item",
            placement: "content",
          });
        } else if (i % 5 === 0) {
          add("page_view", { page: "story_detail" });
          add("story_read");
        }
      }
      await tx`insert into events ${tx(events)} on conflict (event_key) do update set payload=excluded.payload
        where events.payload is distinct from excluded.payload`;
    }
    for (const [i, card] of cards.entries()) {
      const work = id("artwork/" + i);
      await tx`insert into artworks(id,card_id,artist_name,artist_id,title,format,status)
        values(${work},${card.id},'뮤츠조아요 (샘플)',${operator},${"미리보기 도안 " + (i + 1)},${i % 2 ? "9pocket" : "psa"},${i === 0 ? "hidden" : "active"})
        on conflict do nothing`;
      if (i < 2)
        await tx`insert into reports(id,artwork_id,reason,message,status)
        values(${id("report/" + i)},${work},'other','로컬 예시 신고입니다.',${i ? "resolved" : "open"}) on conflict do nothing`;
    }
  });
  console.log("최근 64일의 방문·전환·회원과 작품·신고 샘플을 준비했습니다.");
} finally {
  await db.end();
}
