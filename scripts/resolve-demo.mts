import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth:{persistSession:false}});
const { data: artist } = await sb.from("artists").select("user_id").eq("handle","byeolbit").maybeSingle();
const { data: open } = await sb.from("requests").select("id").is("resolved_at", null).not("format","is",null).limit(3);
for (const r of open ?? []) await sb.from("requests").update({ resolved_at: new Date().toISOString(), resolved_by: artist!.user_id }).eq("id", r.id);
console.log("resolved", open?.length ?? 0, "by byeolbit");
