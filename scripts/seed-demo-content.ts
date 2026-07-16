import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "../src/db";
import { modules, lessons, resources, updatesPosts, blogPosts } from "../src/db/schema";

async function upsertModule(mod: typeof modules.$inferInsert) {
  const [existing] = await db.select().from(modules).where(eq(modules.slug, mod.slug));
  if (existing) {
    await db.update(modules).set(mod).where(eq(modules.id, existing.id));
    return existing.id;
  }
  const [inserted] = await db.insert(modules).values(mod).$returningId();
  return inserted.id;
}

async function upsertLesson(lesson: typeof lessons.$inferInsert) {
  const [existing] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.moduleId, lesson.moduleId), eq(lessons.slug, lesson.slug)));
  if (existing) {
    await db.update(lessons).set(lesson).where(eq(lessons.id, existing.id));
    return;
  }
  await db.insert(lessons).values(lesson);
}

async function upsertResource(resource: typeof resources.$inferInsert) {
  const [existing] = await db.select().from(resources).where(eq(resources.title, resource.title));
  if (existing) {
    await db.update(resources).set(resource).where(eq(resources.id, existing.id));
    return;
  }
  await db.insert(resources).values(resource);
}

async function upsertUpdatesPost(post: typeof updatesPosts.$inferInsert) {
  const [existing] = await db.select().from(updatesPosts).where(eq(updatesPosts.title, post.title));
  if (existing) {
    await db.update(updatesPosts).set(post).where(eq(updatesPosts.id, existing.id));
    return;
  }
  await db.insert(updatesPosts).values(post);
}

async function upsertBlogPost(post: typeof blogPosts.$inferInsert) {
  const [existing] = await db.select().from(blogPosts).where(eq(blogPosts.slug, post.slug));
  if (existing) {
    await db.update(blogPosts).set(post).where(eq(blogPosts.id, existing.id));
    return;
  }
  await db.insert(blogPosts).values(post);
}

async function main() {
  const module1Id = await upsertModule({
    slug: "getting-started",
    title: "Getting Started",
    description: "Orientation: what Paraguay residency is, who it's for, and how the process works.",
    sortOrder: 1,
    minTier: "guide",
    status: "published",
  });

  const module2Id = await upsertModule({
    slug: "paperwork-and-filing",
    title: "Paperwork & Filing",
    description: "Document checklist, apostilles, translations, and the filing appointment.",
    sortOrder: 2,
    minTier: "guide",
    status: "published",
  });

  const lessonSeeds: Array<typeof lessons.$inferInsert> = [
    {
      moduleId: module1Id,
      slug: "why-paraguay",
      title: "Why Paraguay",
      contentMd: "# Why Paraguay\n\n[PLACEHOLDER] Overview of Paraguay residency as an information topic.",
      sortOrder: 1,
      status: "published",
    },
    {
      moduleId: module1Id,
      slug: "residency-options-overview",
      title: "Residency Options Overview",
      contentMd: "# Residency Options Overview\n\n[PLACEHOLDER] The different residency categories at a glance.",
      sortOrder: 2,
      status: "published",
    },
    {
      moduleId: module1Id,
      slug: "costs-and-timeline",
      title: "Costs & Timeline",
      contentMd: "# Costs & Timeline\n\n[PLACEHOLDER] What to budget and how long each step takes.",
      sortOrder: 3,
      status: "published",
    },
    {
      moduleId: module2Id,
      slug: "document-checklist",
      title: "Document Checklist",
      contentMd: "# Document Checklist\n\n[PLACEHOLDER] Every document you'll need, in order.",
      sortOrder: 1,
      status: "published",
    },
    {
      moduleId: module2Id,
      slug: "apostilles-and-translations",
      title: "Apostilles & Translations",
      contentMd: "# Apostilles & Translations\n\n[PLACEHOLDER] How to get documents legalized and translated.",
      sortOrder: 2,
      status: "published",
    },
    {
      moduleId: module2Id,
      slug: "the-filing-appointment",
      title: "The Filing Appointment",
      contentMd: "# The Filing Appointment\n\n[PLACEHOLDER] What to expect on the day.",
      sortOrder: 3,
      status: "published",
    },
  ];

  for (const lesson of lessonSeeds) {
    await upsertLesson(lesson);
  }

  const resourceSeeds: Array<typeof resources.$inferInsert> = [
    {
      title: "Document Checklist (PDF)",
      description: "[PLACEHOLDER] Printable checklist of every required document.",
      fileUrl: "https://example.com/placeholder/document-checklist.pdf",
      minTier: "guide",
      sortOrder: 1,
      status: "published",
    },
    {
      title: "Cost Breakdown Spreadsheet",
      description: "[PLACEHOLDER] Editable spreadsheet template for budgeting the process.",
      fileUrl: "https://example.com/placeholder/cost-breakdown.xlsx",
      minTier: "guide",
      sortOrder: 2,
      status: "published",
    },
    {
      title: "Insider Contact Template Pack",
      description: "[PLACEHOLDER] Email/message templates for Insider members.",
      fileUrl: "https://example.com/placeholder/insider-templates.zip",
      minTier: "insider",
      sortOrder: 3,
      status: "published",
    },
  ];

  for (const resource of resourceSeeds) {
    await upsertResource(resource);
  }

  const updateSeeds: Array<typeof updatesPosts.$inferInsert> = [
    {
      title: "[PLACEHOLDER] Fee Schedule Update",
      contentMd: "[PLACEHOLDER] Summary of a recent fee change.",
      minTier: "guide",
      publishedAt: new Date(),
      status: "published",
    },
    {
      title: "[PLACEHOLDER] Processing Time Update (Insider)",
      contentMd: "[PLACEHOLDER] Insider-only note on current processing times.",
      minTier: "insider",
      publishedAt: new Date(),
      status: "published",
    },
  ];

  for (const post of updateSeeds) {
    await upsertUpdatesPost(post);
  }

  const blogSeeds: Array<typeof blogPosts.$inferInsert> = [
    {
      slug: "how-much-does-paraguay-residency-cost",
      title: "How Much Does Paraguay Residency Cost?",
      excerpt: "[PLACEHOLDER] A breakdown of typical costs.",
      contentMd: "# How Much Does Paraguay Residency Cost?\n\n[PLACEHOLDER] Article body.",
      metaTitle: "How Much Does Paraguay Residency Cost?",
      metaDescription: "[PLACEHOLDER] Meta description.",
      publishedAt: new Date(),
      status: "published",
    },
    {
      slug: "paraguay-residency-timeline",
      title: "Paraguay Residency Timeline: What to Expect",
      excerpt: "[PLACEHOLDER] A realistic timeline overview.",
      contentMd: "# Paraguay Residency Timeline\n\n[PLACEHOLDER] Article body.",
      metaTitle: "Paraguay Residency Timeline: What to Expect",
      metaDescription: "[PLACEHOLDER] Meta description.",
      publishedAt: new Date(),
      status: "published",
    },
  ];

  for (const post of blogSeeds) {
    await upsertBlogPost(post);
  }

  console.log("Demo content seeded: 2 modules, 6 lessons, 3 resources, 2 updates posts, 2 blog posts.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
