import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Course",
};

// Module list (published, tier-gated) lands in Phase 4.
export const dynamic = "force-dynamic";

export default function PortalCourseIndexPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-navy-950">Course</h1>
      <p className="mt-2 text-sm text-brand-navy-900/60">
        [PLACEHOLDER] Module list lands in Phase 4.
      </p>
    </div>
  );
}
