import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, firstName, password, action, clerkUserId } = await req.json();

    const CLERK_SECRET_KEY = Deno.env.get("CLERK_SECRET_KEY");
    if (!CLERK_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: "CLERK_SECRET_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== CRIAR usuário no Clerk =====
    if (action === "create") {
      const clerkRes = await fetch("https://api.clerk.com/v1/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: [email],
          first_name: firstName,
          password: password,
          skip_password_checks: false,
          skip_password_requirement: false,
        }),
      });

      const clerkData = await clerkRes.json();

      if (!clerkRes.ok) {
        const message =
          clerkData?.errors?.[0]?.long_message ||
          clerkData?.errors?.[0]?.message ||
          "Erro ao criar usuário no Clerk";
        return new Response(
          JSON.stringify({ error: message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ clerkId: clerkData.id, success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== DELETAR usuário no Clerk =====
    if (action === "delete" && clerkUserId) {
      // Só deleta se o ID não for temporário (começa com "temp-")
      if (clerkUserId.startsWith("temp-")) {
        return new Response(
          JSON.stringify({ success: true, skipped: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const clerkRes = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        },
      });

      if (!clerkRes.ok && clerkRes.status !== 404) {
        return new Response(
          JSON.stringify({ error: "Erro ao excluir usuário no Clerk" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== REDEFINIR SENHA no Clerk =====
    if (action === "reset_password" && clerkUserId && password) {
      const clerkRes = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const clerkData = await clerkRes.json();

      if (!clerkRes.ok) {
        const message =
          clerkData?.errors?.[0]?.long_message || "Erro ao redefinir senha";
        return new Response(
          JSON.stringify({ error: message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida ou parâmetros ausentes" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
