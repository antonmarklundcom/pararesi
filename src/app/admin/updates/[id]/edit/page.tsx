import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { updatesPosts } from "@/db/schema";
import { EntityForm } from "@/components/admin/EntityForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { canNotifyAboutUpdate } from "@/lib/update-notify";
import type { Tier } from "@/lib/tiers";
import { NotifyButton } from "../../NotifyButton";
import {
  updateUpdatesPostAction,
  deleteUpdatesPostAction,
  notifyUpdatesPostAction,
} from "../../actions";

const NOTIFY_BLOCKED_COPY: Record<string, string> = {
  "not-published": "Publish this update to notify members.",
  "no-publish-date": "Set a publish date to notify members.",
  "publish-date-in-future": "Scheduled — members can be notified once the publish date passes.",
  "already-notified": "Members were notified. A post is only ever announced once.",
};

export const metadata: Metadata = {
  title: "Admin · Edit update",
};

export const dynamic = "force-dynamic";

export default async function EditUpdatesPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post] = await db.select().from(updatesPosts).where(eq(updatesPosts.id, Number(id)));
  if (!post) notFound();

  const notify = canNotifyAboutUpdate(
    {
      id: post.id,
      title: post.title,
      minTier: post.minTier as Tier,
      status: post.status,
      publishedAt: post.publishedAt ?? null,
      notifiedAt: post.notifiedAt ?? null,
    },
    new Date(),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy-950">Edit update</h1>
        <DeleteButton action={deleteUpdatesPostAction.bind(null, post.id)} />
      </div>

      <div className="mt-6 rounded-xl border border-brand-navy-900/10 bg-white p-4">
        <p className="text-sm font-medium text-brand-navy-900">Notify members</p>
        {notify.ok ? (
          <div className="mt-3">
            <NotifyButton
              action={notifyUpdatesPostAction.bind(null, post.id)}
              recipientLabel={post.minTier === "insider" ? "Insider members" : "all members"}
            />
          </div>
        ) : (
          <p className="mt-1 text-sm text-brand-navy-900/60">
            {NOTIFY_BLOCKED_COPY[notify.reason]}
            {post.notifiedAt ? ` (${new Date(post.notifiedAt).toLocaleString()})` : ""}
          </p>
        )}
      </div>

      <div className="mt-6">
        <EntityForm
          action={updateUpdatesPostAction.bind(null, post.id)}
          initialValues={post}
          fields={[
            { type: "text", name: "title", label: "Title", required: true },
            { type: "datetime", name: "publishedAt", label: "Published at" },
            {
              type: "select",
              name: "minTier",
              label: "Minimum tier",
              options: [
                { value: "guide", label: "Guide" },
                { value: "insider", label: "Insider" },
              ],
            },
            {
              type: "select",
              name: "status",
              label: "Status",
              options: [
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
              ],
            },
            { type: "markdown", name: "contentMd", label: "Content (Markdown)" },
          ]}
        />
      </div>
    </div>
  );
}
