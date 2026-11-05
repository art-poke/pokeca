// 이 파일은 DB 스키마의 Drizzle 거울(mirror)이다. 단일 출처(source of truth)는
// infra/db/00_authjs.sql(Auth.js 어댑터 테이블) + infra/db/01_app.sql(앱 테이블)이다.
// SQL을 바꾸면 이 파일도 함께 맞춰 드리프트를 막는다.
import { pgTable, uuid, text, timestamp, bigint, boolean, smallint, numeric, jsonb, date, primaryKey, unique } from "drizzle-orm/pg-core";

// 세트(확장팩) (infra/db/01_app.sql의 public.sets 거울). 정본 키 code.
export const sets = pgTable("sets", {
  code: text("code").primaryKey(),
  nameKo: text("name_ko").notNull(),
  releasedOn: date("released_on"),
});

// 규격 프로필 (infra/db/01_app.sql의 public.spec_profiles 거울). code CHECK는 마이그레이션에서 제거됨.
export const specProfiles = pgTable("spec_profiles", {
  code: text("code").primaryKey(),
  nameKo: text("name_ko").notNull(),
  widthMm: numeric("width_mm"),
  heightMm: numeric("height_mm"),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: bigint("expires_at", { mode: "number" }),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => ({
  providerUnique: unique().on(t.provider, t.providerAccountId),
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("sessionToken").notNull().unique(),
  userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }),
);

// 어드민 허용 목록 (infra/db/01_app.sql의 public.admins 거울).
export const admins = pgTable("admins", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 프로필(=작가) (infra/db/01_app.sql의 public.artists 거울).
// 로그인하면 자동 생성. handle 있으면 공개/발행 가능(발행 전 null). members 흡수(avatar_path).
export const artists = pgTable("artists", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  avatarPath: text("avatar_path"),
  handle: text("handle").unique(), // 발행 전 null
  email: text("email"),
  provider: text("provider").notNull(),
  intro: text("intro"),
  linkUrl: text("link_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 정본 카드 (infra/db/01_app.sql의 public.cards 거울). 정본 키는 (set_code, collector_number).
export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    setCode: text("set_code").notNull(),
    collectorNumber: text("collector_number").notNull(),
    nameKo: text("name_ko").notNull(),
    rarity: text("rarity"),
    illustrator: text("illustrator"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ setNumberUnique: unique().on(t.setCode, t.collectorNumber) }),
);

// 같은 그림의 일본판·영문판 (infra/db/01_app.sql의 public.card_aliases 거울).
export const cardAliases = pgTable(
  "card_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    setCode: text("set_code").notNull(),
    collectorNumber: text("collector_number").notNull(),
    name: text("name"),
  },
  (t) => ({ langKeyUnique: unique().on(t.lang, t.setCode, t.collectorNumber) }),
);

// 카드를 찾지 못한 검색 (infra/db/01_app.sql의 public.search_misses 거울).
export const searchMisses = pgTable("search_misses", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  query: text("query").notNull(),
  parsed: jsonb("parsed"),
  visitorId: uuid("visitor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  requested: boolean("requested").notNull().default(false),
});

// 측정 이벤트 (infra/db/01_app.sql의 public.events 거울).
export const events = pgTable("events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  type: text("type").notNull(),
  visitorId: uuid("visitor_id"),
  cardId: uuid("card_id").references(() => cards.id),
  artworkId: uuid("artwork_id").references(() => artworks.id),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 작품 (infra/db/01_app.sql의 public.artworks 거울).
// 생성·상태·허락 변경은 plpgsql 함수(artwork_create 등)가 한 트랜잭션에서 처리한다.
// consent_level·thumbnail_ok 컬럼은 마이그레이션에서 제거됐다(아카이브 전용 전환).
export const artworks = pgTable(
  "artworks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id),
    artistName: text("artist_name").notNull(),
    format: text("format").notNull(),
    sourceUrl: text("source_url"),
    sourceVisibility: text("source_visibility"),
    status: text("status").notNull().default("active"),
    filesPurged: boolean("files_purged").notNull().default(false),
    uploadId: uuid("upload_id").unique(),
    linkStatus: text("link_status").notNull().default("unchecked"),
    linkCheckedAt: timestamp("link_checked_at", { withTimezone: true }),
    printSizeVerified: boolean("print_size_verified").notNull().default(false),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // 계정을 지워도 작품은 남긴다(artist_name 보존).
    artistId: uuid("artist_id").references(() => artists.userId, { onDelete: "set null" }),
    title: text("title"),
  },
);

// 작품 파일(원본·미리보기). (작품, 종류, 자리)당 1행. (infra/db/01_app.sql의 public.artwork_files 거울).
export const artworkFiles = pgTable(
  "artwork_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    path: text("path").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    position: smallint("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ artworkKindPositionUnique: unique().on(t.artworkId, t.kind, t.position) }),
);

// 상태·허락 변경 이력 (infra/db/01_app.sql의 public.consent_events 거울).
export const consentEvents = pgTable("consent_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  artworkId: uuid("artwork_id")
    .notNull()
    .references(() => artworks.id),
  kind: text("kind").notNull(),
  before: jsonb("before"),
  after: jsonb("after").notNull(),
  reason: text("reason"),
  evidencePath: text("evidence_path"),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 추천·다운로드 점수: (유저, 도안)당 1행 (infra/db/01_app.sql의 public.engagements 거울).
export const engagements = pgTable(
  "engagements",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.artworkId] }) }),
);

// 카드 즐겨찾기 (infra/db/01_app.sql의 public.favorites 거울). (회원, 카드)당 1행.
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.cardId] }) }),
);

// 다형 댓글(도안·게시글) + 1단계 대댓글 (infra/db/01_app.sql의 public.comments 거울).
// target_id/parent_id는 FK 없는 다형 참조. author_name은 작성 시점 표시명 스냅샷.
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  // 실제 DB는 parent_id가 comments(id) 자기참조 FK(on delete cascade). 거울에서는 평범한 uuid로 둔다.
  parentId: uuid("parent_id"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// 찾기/도안 요청 (infra/db/01_app.sql의 public.requests 거울).
// 익명 규격별 "찾기요청"(visitor_id) 과 회원 카드/규격 요청(user_id)이 한 테이블에 들어온다.
// 마이그레이션으로 format·visitor_id는 nullable, user_id·resolved_at·resolved_by 추가됨.
export const requests = pgTable("requests", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  cardId: uuid("card_id")
    .notNull()
    .references(() => cards.id),
  format: text("format").references(() => specProfiles.code),
  visitorId: uuid("visitor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => users.id),
});

// 카드는 있으나 해당 규격 active 도안이 0개였던 방문 (infra/db/01_app.sql의 public.card_demand 거울).
export const cardDemand = pgTable("card_demand", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  cardId: uuid("card_id")
    .notNull()
    .references(() => cards.id),
  format: text("format").references(() => specProfiles.code),
  visitorId: uuid("visitor_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 신고·내림 요청 (infra/db/01_app.sql의 public.reports 거울). report_submit 함수가 저장한다.
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").references(() => artworks.id),
  sourceUrl: text("source_url"),
  reason: text("reason").notNull(),
  contact: text("contact"),
  message: text("message"),
  status: text("status").notNull().default("open"),
  resolutionNote: text("resolution_note"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 신고 남용 방지 카운터 (infra/db/01_app.sql의 public.report_throttle 거울). IP 대역 HMAC만 남긴다.
export const reportThrottle = pgTable("report_throttle", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  ipHash: text("ip_hash").notNull(),
  artworkId: uuid("artwork_id").references(() => artworks.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 커뮤니티 게시판 (infra/db/01_app.sql의 public.posts 거울). 공지=어드민, 건의·자유=회원.
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  board: text("board").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  imagePath: text("image_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// 작가 후기 (infra/db/01_app.sql의 public.artist_reviews 거울). 회원이 작가에게 남기는 후기.
export const artistReviews = pgTable("artist_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  artistId: uuid("artist_id")
    .notNull()
    .references(() => artists.userId, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  imagePath: text("image_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
