const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export function productJsonLd({
  name,
  description,
  url,
  priceUsd,
}: {
  name: string;
  description: string;
  url: string;
  priceUsd?: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    url: `${APP_URL}${url}`,
    brand: { "@type": "Brand", name: "Paraguay Residency Guide" },
    ...(priceUsd
      ? {
          offers: {
            "@type": "Offer",
            price: priceUsd.toFixed(2),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: `${APP_URL}${url}`,
          },
        }
      : {}),
  };
}

export function articleJsonLd({
  headline,
  description,
  url,
  datePublished,
}: {
  headline: string;
  description: string;
  url: string;
  datePublished: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    url: `${APP_URL}${url}`,
    ...(datePublished ? { datePublished } : {}),
    publisher: { "@type": "Organization", name: "Paraguay Residency Guide" },
  };
}

export function faqPageJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
