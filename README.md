# Paraguay Residency Guide — Membership Portal + Marketing Site

One Next.js 15 app: a marketing/sales site and a login-gated members portal selling a
$7–27 info product (tripwire) about obtaining Paraguay residency, with an "Insider"
subscription tier as the internal upsell. Payments via **Lemon Squeezy** (merchant of
record). Deployed to **Hostinger managed Node.js** with **Hostinger MySQL**.

> **Status: Planning phase complete. No application code yet.**
> Start building with Phase 0 in [docs/03-build-guide.md](docs/03-build-guide.md).

## Documentation

| Doc | What it is |
|-----|-----------|
| [docs/01-plan-and-phases.md](docs/01-plan-and-phases.md) | Master plan: build phases, which Claude model builds each phase, dependencies, and exactly when human input is needed |
| [docs/02-architecture.md](docs/02-architecture.md) | Full technical architecture: routes, DB schema, auth, tier gating, Lemon Squeezy integration, email, SEO |
| [docs/03-build-guide.md](docs/03-build-guide.md) | Phase-by-phase build instructions with ready-to-paste kickoff prompts for the builder model |
| [docs/04-launch-checklist.md](docs/04-launch-checklist.md) | Deploy runbook (Hostinger) and go-live checklist |
| [docs/05-open-questions.md](docs/05-open-questions.md) | Lemon Squeezy product-structure decisions — **resolved 2026-07-16** (guide one-time price still TBD) |
| [docs/06-fable5-review-notes.md](docs/06-fable5-review-notes.md) | Fable 5 review pass: corrections builder sessions must apply (webhook semantics, refunds, idempotency, checkout↔user linking) |

## Stack (fixed — do not renegotiate)

- Next.js 15, App Router, TypeScript, Tailwind CSS
- Drizzle ORM + mysql2 → Hostinger MySQL (single pool, `connectionLimit: 8`, `timezone: "Z"`)
- Auth: iron-session + bcrypt, httpOnly cookie sessions (no NextAuth, no social login)
- Payments: Lemon Squeezy (MoR) — hosted checkout + webhooks
- Email: Resend behind `src/lib/email.ts`
- Runs with `next start` on a single Node process (Hostinger managed Node.js).
  **No Vercel-only features, no edge runtime requirements, no serverless assumptions.**

## Required skills for builder sessions

Any Claude session writing code in this repo must first read these skills
(they exist in the owner's claude.ai skill library):

1. `nodejs-mysql-hostinger-stack` — architecture, Drizzle patterns, auth/roles rules
2. `nextjs-deploy-hostinger` — deploy constraints, env/DB pitfalls
3. `nextjs-national-lead-gen` — marketing page architecture and SEO patterns

If the skills are not available in the session, the docs in `/docs` restate every
binding rule — follow them exactly.
