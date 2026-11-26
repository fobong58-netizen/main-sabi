// Verifies Paystack payments and marks the artisan as paid.
// Two callers:
//   1. the profile page right after checkout   -> POST { reference }
//   2. Paystack's webhook (backup if the tab closed) -> POST with x-paystack-signature
// Deploy:  supabase functions deploy paystack --no-verify-jwt
// Secret:  supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SECRET = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Ask Paystack itself whether the payment really succeeded. Never trust the browser.
async function confirm(reference: string) {
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${SECRET}` } },
  );
  const out = await res.json();
  if (!out.status || out.data?.status !== "success" || out.data?.currency !== "NGN") {
    return { ok: false, reason: "notpaid" };
  }
  const { data, error } = await admin.rpc("mark_paid", {
    p_reference: reference,
    p_amount_kobo: out.data.amount,
  });
  if (error) {
    console.error("mark_paid failed:", error.message);
    return { ok: false, reason: "error" };
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  try {
    // Paystack webhook
    if (signature) {
      if (signature !== (await sign(raw))) return new Response("bad signature", { status: 401 });
      const event = JSON.parse(raw);
      if (event.event === "charge.success" && event.data?.reference) {
        await confirm(event.data.reference);
      }
      return new Response("ok", { status: 200 });
    }

    // Call from the profile page
    const { reference } = JSON.parse(raw || "{}");
    if (!reference || typeof reference !== "string") return json({ ok: false, reason: "invalid" }, 400);
    return json(await confirm(reference));
  } catch (e) {
    console.error(e);
    return json({ ok: false, reason: "error" }, 500);
  }
});