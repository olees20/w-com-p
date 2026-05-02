"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveBusinessOnboarding, type OnboardingState } from "@/app/onboarding/actions";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";

const initialState: OnboardingState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <LoadingButton type="submit" isLoading={pending} loadingText="Saving..." className="w-full">
      Continue to dashboard
    </LoadingButton>
  );
}

function CheckboxField({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
      <input type="checkbox" name={name} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600" />
      <span>{label}</span>
    </label>
  );
}

export function BusinessOnboardingForm() {
  const [state, formAction] = useFormState(saveBusinessOnboarding, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Input name="business_name" placeholder="Business name" required />
      <Input name="business_type" placeholder="Business type" required />
      <Input name="address" placeholder="Address" required />
      <Input name="postcode" placeholder="Postcode" required />
      <Input name="employee_count" type="number" min={1} placeholder="Employee count" required />
      <Input name="current_waste_provider" placeholder="Current waste provider (optional)" />

      <div className="space-y-2">
        <CheckboxField name="produces_food_waste" label="We produce food waste" />
        <CheckboxField name="produces_hazardous_waste" label="We produce hazardous waste" />
        <CheckboxField name="sells_packaged_goods" label="We sell packaged goods" />
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
