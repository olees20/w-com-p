"use client";

import { useFormState, useFormStatus } from "react-dom";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/app/(auth)/actions";

type AuthFormProps = {
  mode: "login" | "signup";
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
};

const initialState: AuthActionState = {};

function SubmitButton({ mode }: { mode: "login" | "signup" }) {
  const { pending } = useFormStatus();

  return (
    <LoadingButton
      type="submit"
      isLoading={pending}
      loadingText={mode === "login" ? "Logging in..." : "Creating account..."}
      className="w-full"
    >
      {mode === "login" ? "Log in" : "Create account"}
    </LoadingButton>
  );
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Input name="email" type="email" placeholder="Email" autoComplete="email" required />
      <Input
        name="password"
        type="password"
        placeholder="Password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required
      />

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      {state.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</p>
      ) : null}

      <SubmitButton mode={mode} />
    </form>
  );
}
