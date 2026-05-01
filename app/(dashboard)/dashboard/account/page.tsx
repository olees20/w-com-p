import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { changePassword, deleteAccount, updateAccountDetails } from "@/app/(dashboard)/dashboard/account/actions";

export default async function AccountPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  const supabase = await createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("name,business_type,address,postcode,current_waste_provider")
    .eq("user_id", user.id)
    .maybeSingle<{
      name: string | null;
      business_type: string | null;
      address: string | null;
      postcode: string | null;
      current_waste_provider: string | null;
    }>();

  return (
    <div className="space-y-4">
      <section className="app-panel p-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Account</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Manage your account details, password, and access.</p>
      </section>

      {searchParams.success ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{searchParams.success}</div>
      ) : null}

      {searchParams.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{searchParams.error}</div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <form action={updateAccountDetails} className="app-panel space-y-4 p-6">
          <h2 className="text-lg font-bold text-[#111827]">Business details</h2>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#111827]">Email</label>
            <input value={user.email ?? ""} disabled className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#6B7280]" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#111827]">Business name</label>
            <input name="name" defaultValue={business?.name ?? ""} required className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#111827]">Business type</label>
            <input name="business_type" defaultValue={business?.business_type ?? ""} required className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#111827]">Address</label>
            <input name="address" defaultValue={business?.address ?? ""} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-[#111827]">Postcode</label>
              <input name="postcode" defaultValue={business?.postcode ?? ""} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-[#111827]">Waste provider</label>
              <input name="current_waste_provider" defaultValue={business?.current_waste_provider ?? ""} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
            </div>
          </div>

          <button type="submit" className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-bold text-white hover:bg-[#1a3279]">
            Save details
          </button>
        </form>

        <div className="space-y-4">
          <form action={changePassword} className="app-panel space-y-4 p-6">
            <h2 className="text-lg font-bold text-[#111827]">Change password</h2>
            <div>
              <label className="mb-1 block text-sm font-semibold text-[#111827]">New password</label>
              <input
                name="new_password"
                type="password"
                required
                minLength={8}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              />
            </div>
            <button type="submit" className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-bold text-[#111827] hover:bg-[#F9FAFB]">
              Update password
            </button>
          </form>

          <form action={deleteAccount} className="app-panel space-y-3 p-6">
            <h2 className="text-lg font-bold text-[#111827]">Delete account</h2>
            <p className="text-sm text-[#6B7280]">This permanently deletes your account and all related data.</p>
            <button type="submit" className="rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-bold text-white hover:bg-[#b91c1c]">
              Delete account
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
