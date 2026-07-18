import { createCheckoutAction } from "@/lib/checkout-action";
import { Button } from "@/components/ui/Button";
import type { ProductKey } from "@/lib/lemonsqueezy";

export function BuyButton({
  productKey,
  children,
  variant = "primary",
  className = "",
}: {
  productKey: ProductKey;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <form action={createCheckoutAction.bind(null, productKey)}>
      <Button type="submit" variant={variant} className={`w-full ${className}`}>
        {children}
      </Button>
    </form>
  );
}
