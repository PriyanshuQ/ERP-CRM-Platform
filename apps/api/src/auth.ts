import { createClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";

const getConfig = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing");
  return { url, key };
};

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Bearer token required" } });
    return;
  }

  try {
    const { url, key } = getConfig();
    const client = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      response.status(401).json({ error: { code: "INVALID_TOKEN", message: "Invalid or expired token" } });
      return;
    }

    request.authUser = data.user;
    request.supabase = client;
    next();
  } catch (error) {
    next(error);
  }
}
