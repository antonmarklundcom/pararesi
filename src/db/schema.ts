import {
  mysqlTable,
  int,
  varchar,
  text,
  longtext,
  mysqlEnum,
  datetime,
  json,
  timestamp,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/mysql-core";

// --- Users & auth ---

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  // Nullable until the user follows the set-password link from the purchase webhook.
  passwordHash: varchar("password_hash", { length: 255 }),
  name: varchar("name", { length: 255 }),
  role: mysqlEnum("role", ["admin", "member"]).notNull().default("member"),
  tier: mysqlEnum("tier", ["none", "guide", "insider"]).notNull().default("none"),
  // Null = lifetime/one-time (guide tier). Set for insider subscriptions.
  tierExpiresAt: datetime("tier_expires_at"),
  lsCustomerId: varchar("ls_customer_id", { length: 64 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const passwordTokens = mysqlTable("password_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  // sha256 of the raw token; only the raw token is ever sent by email.
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  purpose: mysqlEnum("purpose", ["set", "reset"]).notNull(),
  expiresAt: datetime("expires_at").notNull(),
  usedAt: datetime("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- Lemon Squeezy commerce ---

export const purchases = mysqlTable("purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  // Idempotency key for the order_created webhook.
  lsOrderId: varchar("ls_order_id", { length: 64 }).notNull(),
  lsProductId: varchar("ls_product_id", { length: 64 }).notNull(),
  lsVariantId: varchar("ls_variant_id", { length: 64 }).notNull(),
  productKey: varchar("product_key", { length: 64 }).notNull(),
  amountUsd: int("amount_usd").notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  raw: json("raw"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [uniqueIndex("purchases_ls_order_id_unique").on(table.lsOrderId)]);

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  lsSubscriptionId: varchar("ls_subscription_id", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  renewsAt: datetime("renews_at"),
  endsAt: datetime("ends_at"),
  raw: json("raw"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [uniqueIndex("subscriptions_ls_subscription_id_unique").on(table.lsSubscriptionId)]);

// --- Course content ---

export const modules = mysqlTable("modules", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sortOrder: int("sort_order").notNull().default(0),
  minTier: mysqlEnum("min_tier", ["guide", "insider"]).notNull().default("guide"),
  status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
}, (table) => [uniqueIndex("modules_slug_unique").on(table.slug)]);

export const lessons = mysqlTable("lessons", {
  id: int("id").autoincrement().primaryKey(),
  moduleId: int("module_id").notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  contentMd: longtext("content_md").notNull(),
  videoUrl: varchar("video_url", { length: 512 }),
  sortOrder: int("sort_order").notNull().default(0),
  status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
}, (table) => [uniqueIndex("lessons_module_id_slug_unique").on(table.moduleId, table.slug)]);

export const lessonProgress = mysqlTable("lesson_progress", {
  userId: int("user_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.lessonId] })]);

// --- Resources & updates ---

export const resources = mysqlTable("resources", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  fileUrl: varchar("file_url", { length: 512 }).notNull(),
  minTier: mysqlEnum("min_tier", ["guide", "insider"]).notNull().default("guide"),
  sortOrder: int("sort_order").notNull().default(0),
  status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
});

export const updatesPosts = mysqlTable("updates_posts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  contentMd: longtext("content_md").notNull(),
  minTier: mysqlEnum("min_tier", ["guide", "insider"]).notNull().default("guide"),
  publishedAt: datetime("published_at"),
  status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
  // When the "new update" notification email went out. Set once and never
  // cleared, so editing or re-publishing a post can't mail members twice.
  notifiedAt: datetime("notified_at"),
});

// --- Marketing blog ---

export const blogPosts = mysqlTable("blog_posts", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  excerpt: text("excerpt"),
  contentMd: longtext("content_md").notNull(),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: varchar("meta_description", { length: 500 }),
  publishedAt: datetime("published_at"),
  status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
}, (table) => [uniqueIndex("blog_posts_slug_unique").on(table.slug)]);

// --- Marketing leads (email capture / lead magnet) ---

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  // Always stored lowercased + trimmed (normalizeEmail in src/lib/leads.ts), so
  // the unique index below is what makes the capture form idempotent.
  email: varchar("email", { length: 255 }).notNull(),
  // Where the signup came from, e.g. "home-hero" / "guide-page".
  source: varchar("source", { length: 64 }).notNull(),
  // Null until the double opt-in link is clicked — nothing may be mailed before then.
  confirmedAt: datetime("confirmed_at"),
  // Set when a lead opts out; a later unsubscribe link writes here.
  unsubscribedAt: datetime("unsubscribed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [uniqueIndex("leads_email_unique").on(table.email)]);

export const leadTokens = mysqlTable("lead_tokens", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("lead_id").notNull(),
  // sha256 of the raw token; only the raw token is ever sent by email.
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  // Confirm tokens opt a lead in, unsubscribe tokens opt them out. Kept in one
  // table but never interchangeable: consuming one purpose only invalidates the
  // lead's other open tokens of that same purpose, so confirming an address
  // doesn't quietly break the unsubscribe link in an email already delivered.
  purpose: mysqlEnum("purpose", ["confirm", "unsubscribe"]).notNull().default("confirm"),
  expiresAt: datetime("expires_at").notNull(),
  usedAt: datetime("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * One row per nurture email actually sent to a lead. The unique index is the
 * no-double-send guarantee: the cron endpoint is safe to run twice, and a
 * crash between sending and recording can at worst re-send once, never loop.
 */
export const leadEmails = mysqlTable("lead_emails", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("lead_id").notNull(),
  // A NURTURE_STEPS key from src/lib/nurture.ts, e.g. "cost-breakdown".
  step: varchar("step", { length: 64 }).notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("lead_emails_lead_id_step_unique").on(table.leadId, table.step)]);

// --- Lemon Squeezy webhook log ---

export const webhookEvents = mysqlTable("webhook_events", {
  id: int("id").autoincrement().primaryKey(),
  lsEventId: varchar("ls_event_id", { length: 128 }).notNull(),
  eventName: varchar("event_name", { length: 64 }).notNull(),
  processedAt: datetime("processed_at"),
  error: text("error"),
  raw: json("raw"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("webhook_events_ls_event_id_unique").on(table.lsEventId)]);
