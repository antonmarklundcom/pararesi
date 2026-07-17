"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { createCheckoutUrl, type ProductKey } from "./lemonsqueezy";

export async function createCheckoutAction(productKey: ProductKey) {
  const user = await getCurrentUser();
  const url = await createCheckoutUrl({ productKey, email: user?.email, userId: user?.id });
  redirect(url);
}
