import { Webhook } from "svix";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email_addresses: Array<{
      email_address: string;
      id: string;
    }>;
    image_url: string | null;
  };
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return new Response("Missing webhook secret", { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: ClerkWebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkWebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createAdminClient();

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const { id, first_name, last_name, email_addresses, image_url } = evt.data;
    const displayName = [first_name, last_name].filter(Boolean).join(" ") || "User";
    const email = email_addresses[0]?.email_address ?? null;

    const { error } = await supabase.from("profiles").upsert(
      {
        clerk_id: id,
        display_name: displayName,
        avatar_url: image_url,
        email,
      },
      { onConflict: "clerk_id" }
    );

    if (error) {
      console.error("Failed to sync profile:", error);
      return new Response("Failed to sync profile", { status: 500 });
    }
  }

  return new Response("OK", { status: 200 });
}
