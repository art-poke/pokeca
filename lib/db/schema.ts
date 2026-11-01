// 이 파일은 DB 스키마의 Drizzle 거울(mirror)이다. 단일 출처(source of truth)는
// infra/db/00_authjs.sql(Auth.js 어댑터 테이블) + infra/db/01_app.sql(앱 테이블)이다.
// SQL을 바꾸면 이 파일도 함께 맞춰 드리프트를 막는다.
import { pgTable, uuid, text, timestamp, bigint, primaryKey, unique } from "drizzle-orm/pg-core";

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

// 작가 계정 (infra/db/01_app.sql의 public.artists 거울).
export const artists = pgTable("artists", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  provider: text("provider").notNull(),
  intro: text("intro"),
  linkUrl: text("link_url"),
  status: text("status").notNull().default("pending"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 일반 회원 (infra/db/01_app.sql의 public.members 거울).
export const members = pgTable("members", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  nickname: text("nickname").notNull(),
  avatarPath: text("avatar_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 카드 즐겨찾기 (infra/db/01_app.sql의 public.favorites 거울). (회원, 카드)당 1행.
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: uuid("card_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.cardId] }) }),
);
