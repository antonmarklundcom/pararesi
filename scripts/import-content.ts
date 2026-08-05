import "dotenv/config";
import { readFileSync } from "fs";
import { eq, and } from "drizzle-orm";
import { db } from "../src/db";
import { modules, lessons, resources, updatesPosts, blogPosts } from "../src/db/schema";

/**
 * Bulk-imports course content from a JSON file so a full curriculum can be
 * written outside the app and loaded in one go, instead of typed into /admin
 * lesson by lesson. See docs/08-content-spec.md for the schema and the
 * generation prompt that produces a conforming file.
 *
 *   npx tsx scripts/import-content.ts content/curriculum.json --dry-run
 *   npx tsx scripts/import-content.ts content/curriculum.json
 *
 * The file is validated completely before anything is written, so one run
 * reports every problem. Idempotent: modules/lessons/blog posts match by slug,
 * resources and updates by title, so re-running an edited file updates in place
 * instead of duplicating. Nothing is ever deleted — remove content in /admin.
 */

type Status = "draft" | "published";
type MinTier = "guide" | "insider";

type ModuleRow = typeof modules.$inferInsert;
type LessonRow = Omit<typeof lessons.$inferInsert, "moduleId">;
type ResourceRow = typeof resources.$inferInsert;
type UpdateRow = typeof updatesPosts.$inferInsert;
type BlogRow = typeof blogPosts.$inferInsert;

interface ValidatedModule {
  values: ModuleRow;
  lessons: LessonRow[];
}

interface ValidatedContent {
  modules: ValidatedModule[];
  resources: ResourceRow[];
  updates: UpdateRow[];
  blogPosts: BlogRow[];
}

// --- Validation -------------------------------------------------------------
// Hand-rolled rather than pulling in a schema library: the stack is fixed, and a
// generated file fails in a handful of predictable ways. Every message names the
// exact JSON path so a fix can be pasted straight back into the generator.

const errors: string[] = [];

function fail(path: string, message: string) {
  errors.push(`${path}: ${message}`);
}

function str(value: unknown, path: string, { required = true, max = 0 } = {}): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) fail(path, "is required");
    return undefined;
  }
  if (typeof value !== "string") {
    fail(path, `must be a string, got ${typeof value}`);
    return undefined;
  }
  if (max && value.length > max) {
    fail(path, `is ${value.length} characters, max ${max}`);
    return undefined;
  }
  return value;
}

function slug(value: unknown, path: string): string {
  const s = str(value, path, { max: 255 });
  if (s === undefined) return "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) {
    fail(path, `"${s}" must be lowercase words separated by single hyphens`);
    return "";
  }
  return s;
}

function enumValue<T extends string>(value: unknown, path: string, allowed: T[], fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail(path, `must be one of ${allowed.join(" | ")}`);
    return fallback;
  }
  return value as T;
}

function int(value: unknown, path: string, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    fail(path, "must be a whole number");
    return fallback;
  }
  return value;
}

function date(value: unknown, path: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    fail(path, "must be an ISO date string");
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    fail(path, `"${value}" is not a valid date`);
    return null;
  }
  return parsed;
}

function array(value: unknown, path: string): Record<string, unknown>[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    fail(path, "must be an array");
    return [];
  }
  return value.filter((entry, i) => {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) return true;
    fail(`${path}[${i}]`, "must be an object");
    return false;
  }) as Record<string, unknown>[];
}

function assertUnique(values: string[], path: string, label: string) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (!value) return;
    if (seen.has(value)) fail(`${path}[${index}]`, `duplicate ${label} "${value}" in this file`);
    seen.add(value);
  });
}

function validate(parsed: Record<string, unknown>): ValidatedContent {
  const validatedModules = array(parsed.modules, "modules").map((mod, i): ValidatedModule => {
    const path = `modules[${i}]`;
    const values: ModuleRow = {
      slug: slug(mod.slug, `${path}.slug`),
      title: str(mod.title, `${path}.title`, { max: 255 }) ?? "",
      description: str(mod.description, `${path}.description`, { required: false }) ?? null,
      sortOrder: int(mod.sortOrder, `${path}.sortOrder`, i + 1),
      minTier: enumValue<MinTier>(mod.minTier, `${path}.minTier`, ["guide", "insider"], "guide"),
      status: enumValue<Status>(mod.status, `${path}.status`, ["draft", "published"], "draft"),
    };

    const lessonRows = array(mod.lessons, `${path}.lessons`).map((lesson, j): LessonRow => {
      const lessonPath = `${path}.lessons[${j}]`;
      return {
        slug: slug(lesson.slug, `${lessonPath}.slug`),
        title: str(lesson.title, `${lessonPath}.title`, { max: 255 }) ?? "",
        contentMd: str(lesson.contentMd, `${lessonPath}.contentMd`) ?? "",
        videoUrl: str(lesson.videoUrl, `${lessonPath}.videoUrl`, { required: false, max: 512 }) ?? null,
        sortOrder: int(lesson.sortOrder, `${lessonPath}.sortOrder`, j + 1),
        status: enumValue<Status>(lesson.status, `${lessonPath}.status`, ["draft", "published"], "draft"),
      };
    });

    assertUnique(lessonRows.map((l) => l.slug), `${path}.lessons`, "lesson slug");
    return { values, lessons: lessonRows };
  });

  assertUnique(validatedModules.map((m) => m.values.slug), "modules", "module slug");

  const validatedResources = array(parsed.resources, "resources").map((resource, i): ResourceRow => {
    const path = `resources[${i}]`;
    return {
      title: str(resource.title, `${path}.title`, { max: 255 }) ?? "",
      description: str(resource.description, `${path}.description`, { required: false }) ?? null,
      fileUrl: str(resource.fileUrl, `${path}.fileUrl`, { max: 512 }) ?? "",
      minTier: enumValue<MinTier>(resource.minTier, `${path}.minTier`, ["guide", "insider"], "guide"),
      sortOrder: int(resource.sortOrder, `${path}.sortOrder`, i + 1),
      status: enumValue<Status>(resource.status, `${path}.status`, ["draft", "published"], "draft"),
    };
  });
  assertUnique(validatedResources.map((r) => r.title), "resources", "resource title");

  const validatedUpdates = array(parsed.updates, "updates").map((post, i): UpdateRow => {
    const path = `updates[${i}]`;
    return {
      title: str(post.title, `${path}.title`, { max: 255 }) ?? "",
      contentMd: str(post.contentMd, `${path}.contentMd`) ?? "",
      minTier: enumValue<MinTier>(post.minTier, `${path}.minTier`, ["guide", "insider"], "guide"),
      publishedAt: date(post.publishedAt, `${path}.publishedAt`),
      status: enumValue<Status>(post.status, `${path}.status`, ["draft", "published"], "draft"),
    };
  });
  assertUnique(validatedUpdates.map((u) => u.title), "updates", "update title");

  const validatedPosts = array(parsed.blogPosts, "blogPosts").map((post, i): BlogRow => {
    const path = `blogPosts[${i}]`;
    return {
      slug: slug(post.slug, `${path}.slug`),
      title: str(post.title, `${path}.title`, { max: 255 }) ?? "",
      excerpt: str(post.excerpt, `${path}.excerpt`, { required: false }) ?? null,
      contentMd: str(post.contentMd, `${path}.contentMd`) ?? "",
      metaTitle: str(post.metaTitle, `${path}.metaTitle`, { required: false, max: 255 }) ?? null,
      metaDescription:
        str(post.metaDescription, `${path}.metaDescription`, { required: false, max: 500 }) ?? null,
      publishedAt: date(post.publishedAt, `${path}.publishedAt`),
      status: enumValue<Status>(post.status, `${path}.status`, ["draft", "published"], "draft"),
    };
  });
  assertUnique(validatedPosts.map((p) => p.slug), "blogPosts", "blog slug");

  return {
    modules: validatedModules,
    resources: validatedResources,
    updates: validatedUpdates,
    blogPosts: validatedPosts,
  };
}

// --- Writing ----------------------------------------------------------------

async function write(content: ValidatedContent) {
  let lessonCount = 0;

  for (const mod of content.modules) {
    const [existing] = await db.select().from(modules).where(eq(modules.slug, mod.values.slug));
    let moduleId: number;
    if (existing) {
      await db.update(modules).set(mod.values).where(eq(modules.id, existing.id));
      moduleId = existing.id;
    } else {
      const [inserted] = await db.insert(modules).values(mod.values).$returningId();
      moduleId = inserted.id;
    }

    for (const lesson of mod.lessons) {
      const values = { ...lesson, moduleId };
      const [existingLesson] = await db
        .select()
        .from(lessons)
        .where(and(eq(lessons.moduleId, moduleId), eq(lessons.slug, lesson.slug)));

      if (existingLesson) {
        await db.update(lessons).set(values).where(eq(lessons.id, existingLesson.id));
      } else {
        await db.insert(lessons).values(values);
      }
      lessonCount += 1;
    }
  }

  for (const resource of content.resources) {
    const [existing] = await db.select().from(resources).where(eq(resources.title, resource.title));
    if (existing) {
      await db.update(resources).set(resource).where(eq(resources.id, existing.id));
    } else {
      await db.insert(resources).values(resource);
    }
  }

  for (const post of content.updates) {
    const [existing] = await db.select().from(updatesPosts).where(eq(updatesPosts.title, post.title));
    if (existing) {
      await db.update(updatesPosts).set(post).where(eq(updatesPosts.id, existing.id));
    } else {
      await db.insert(updatesPosts).values(post);
    }
  }

  for (const post of content.blogPosts) {
    const [existing] = await db.select().from(blogPosts).where(eq(blogPosts.slug, post.slug));
    if (existing) {
      await db.update(blogPosts).set(post).where(eq(blogPosts.id, existing.id));
    } else {
      await db.insert(blogPosts).values(post);
    }
  }

  return lessonCount;
}

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  const dryRun = flags.includes("--dry-run");

  if (!file) {
    console.error("Usage: npx tsx scripts/import-content.ts <file.json> [--dry-run]");
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`Could not read ${file}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.error(`${file} must contain a JSON object with modules/resources/updates/blogPosts keys.`);
    process.exit(1);
  }

  const content = validate(parsed as Record<string, unknown>);

  if (errors.length) {
    console.error(`\n${errors.length} problem(s) in ${file} — nothing was written:\n`);
    for (const error of errors) console.error(`  • ${error}`);
    console.error("\nFix these in the source file (or the generator prompt) and re-run.");
    process.exit(1);
  }

  const lessonCount = dryRun
    ? content.modules.reduce((total, mod) => total + mod.lessons.length, 0)
    : await write(content);

  const summary =
    `${content.modules.length} modules, ${lessonCount} lessons, ` +
    `${content.resources.length} resources, ${content.updates.length} updates, ` +
    `${content.blogPosts.length} blog posts`;

  console.log(dryRun ? `Valid. Would import: ${summary}` : `Imported: ${summary}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
