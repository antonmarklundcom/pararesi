export interface FaqItem {
  question: string;
  answer: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-brand-navy-900/10 rounded-xl border border-brand-navy-900/10 bg-white">
      {items.map((item) => (
        <details key={item.question} className="group p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-brand-navy-950 [&::-webkit-details-marker]:hidden">
            {item.question}
            <span className="ml-4 shrink-0 text-brand-navy-900/40 transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-3 text-sm leading-6 text-brand-navy-900/70">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
