import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { env } from "@/lib/env";

export function isSupabaseConfigured() {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createSupabaseServiceClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service credentials are not configured.");
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    },
    realtime: {
      transport: WebSocket as never
    }
  });
}

export function createOptionalSupabaseServiceClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return createSupabaseServiceClient();
}
