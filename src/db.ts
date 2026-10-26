import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

if (!rawUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_KEY in environment variables.");
}

// Accept URLs that include the REST path or a trailing slash.
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");

export const supabase = createClient(supabaseUrl, supabaseKey);
