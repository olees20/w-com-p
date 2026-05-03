function getRequiredEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const supabaseUrl: string = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey: string = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
