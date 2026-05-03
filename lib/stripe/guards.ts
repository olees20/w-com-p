import { redirect } from "next/navigation";
import { getCurrentUserSubscription } from "@/lib/stripe/subscription";

export async function requireActiveSubscription() {
  const { isActive } = await getCurrentUserSubscription();

  if (!isActive) {
    redirect("/dashboard/billing?subscription=required");
  }
}
