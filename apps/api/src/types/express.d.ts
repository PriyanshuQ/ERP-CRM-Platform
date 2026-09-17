import type { SupabaseClient, User } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      authUser?: User;
      supabase?: SupabaseClient;
    }
  }
}

export {};
