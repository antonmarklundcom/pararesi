// Renders nothing when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is unset — no script tag,
// no request, no cookie. Set it in env to point at a Plausible site.
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;

  return <script defer data-domain={domain} src="https://plausible.io/js/script.js" />;
}
