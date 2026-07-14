import { createClient } from "@supabase/supabase-js";

const supabaseUrl = ((import.meta as any).env.VITE_SUPABASE_URL as string) || "";
const supabaseAnonKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY as string) || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create the supabase client. If keys are missing, we don't crash but return null.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
