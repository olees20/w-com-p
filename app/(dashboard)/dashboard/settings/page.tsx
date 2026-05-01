import { Card } from "@/components/ui/card";
import { requireActiveSubscription } from "@/lib/stripe/guards";

export default async function SettingsPage() {
  await requireActiveSubscription();

  return (
    <div className="max-w-2xl">
      <Card
        title="Workspace settings"
        value="MVP placeholder"
        description="Add profile, billing, and team settings as your next step."
      />
    </div>
  );
}
