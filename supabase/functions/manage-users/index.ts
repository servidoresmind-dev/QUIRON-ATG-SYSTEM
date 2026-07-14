// Supabase Edge Function: manage-users
//
// Runs server-side with access to the service_role key (never exposed to the browser).
// The front-end calls this via `supabase.functions.invoke("manage-users", { body: {...} })`,
// which forwards the caller's JWT in the Authorization header. This function verifies that
// JWT belongs to an "administrador" before performing any privileged Auth Admin operation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");

  // Client scoped to the caller's JWT, used only to identify who is calling.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: callerData, error: callerError } = await callerClient.auth.getUser(jwt);
  if (callerError || !callerData?.user) {
    return json({ error: "Não autenticado." }, 401);
  }

  const callerPerfil = callerData.user.user_metadata?.perfil;
  if (callerPerfil !== "administrador") {
    return json({ error: "Acesso restrito a administradores." }, 403);
  }

  // Admin client with the service_role key — full Auth Admin access.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corpo da requisição inválido." }, 400);
  }

  const { action } = payload;

  try {
    if (action === "list") {
      const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;

      const usuarios = data.users.map((u) => ({
        id: u.id,
        nome: (u.user_metadata?.nome as string) || u.email || "Sem nome",
        email: u.email,
        perfil: u.user_metadata?.perfil === "administrador" ? "administrador" : "usuario_comum",
        ativo: !u.banned_until || new Date(u.banned_until) <= new Date(),
        criado_em: u.created_at
      }));

      return json({ usuarios });
    }

    if (action === "invite") {
      const { nome, email, perfil } = payload;
      if (!nome || !email || !perfil) {
        return json({ error: "Nome, e-mail e perfil são obrigatórios." }, 400);
      }

      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { nome, perfil }
      });
      if (error) throw error;

      return json({ user: data.user });
    }

    if (action === "updateProfile") {
      const { id, nome, perfil } = payload;
      if (!id) return json({ error: "ID do usuário é obrigatório." }, 400);

      if (id === callerData.user.id && perfil !== "administrador") {
        return json({ error: "Você não pode remover o seu próprio nível de acesso de administrador." }, 400);
      }

      const { data, error } = await adminClient.auth.admin.updateUserById(id, {
        user_metadata: { nome, perfil }
      });
      if (error) throw error;

      return json({ user: data.user });
    }

    if (action === "toggleActive") {
      const { id, ativo } = payload;
      if (!id) return json({ error: "ID do usuário é obrigatório." }, 400);

      if (id === callerData.user.id) {
        return json({ error: "Você não pode desativar a sua própria conta." }, 400);
      }

      const { data, error } = await adminClient.auth.admin.updateUserById(id, {
        // ativo=true means we're re-enabling → clear the ban. ativo=false → ban for ~100 years.
        ban_duration: ativo ? "none" : "876000h"
      });
      if (error) throw error;

      return json({ user: data.user });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (err: any) {
    return json({ error: err.message || "Erro interno." }, 500);
  }
});
