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

const PERFIS_VALIDOS = ["administrador", "usuario_comum", "vendedor"];

// Vendedor sem checklist enviada começa só com Clientes & Geradores (nunca "tudo").
function paginasFor(perfil: string, paginas: unknown) {
  if (perfil === "administrador") return null;
  if (Array.isArray(paginas)) return paginas;
  return perfil === "vendedor" ? ["clientes"] : [];
}

type MetaUser = {
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
};

// Perfil oficial do usuário. `app_metadata` só pode ser escrito aqui no servidor
// (com a service_role); já `user_metadata` o próprio usuário logado consegue
// alterar pelo navegador — por isso a decisão de "quem é admin" NUNCA lê dele.
// Usuário sem perfil em app_metadata (ex.: conta criada fora do app) falha
// fechado: não é admin e não tem página nenhuma até um admin editar o cadastro.
function perfilOf(u: MetaUser): string {
  const raw = u.app_metadata?.perfil;
  return PERFIS_VALIDOS.includes(raw) ? raw : "usuario_comum";
}

function paginasOf(u: MetaUser): string[] | null {
  if (u.app_metadata?.perfil === undefined) return [];
  const src = u.app_metadata.paginas_permitidas;
  // null = administrador, ou comum legado criado antes da checklist (acesso total antigo).
  return Array.isArray(src) ? src : null;
}

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

  if (perfilOf(callerData.user) !== "administrador") {
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

      // A migração preguiçosa da Fase 1 foi removida de propósito: copiar de
      // user_metadata para app_metadata reabriria a brecha (um usuário poderia
      // se declarar admin em user_metadata e ser "promovido" pela cópia).
      const usuarios = data.users.map((u) => ({
        id: u.id,
        nome: (u.user_metadata?.nome as string) || u.email || "Sem nome",
        email: u.email,
        perfil: perfilOf(u),
        // null = usuário criado antes da checklist por página existir (mantém acesso total antigo).
        paginas_permitidas: paginasOf(u),
        ativo: !u.banned_until || new Date(u.banned_until) <= new Date(),
        criado_em: u.created_at
      }));

      return json({ usuarios });
    }

    if (action === "invite") {
      const { nome, email, perfil, paginas_permitidas } = payload;
      if (!nome || !email || !perfil) {
        return json({ error: "Nome, e-mail e perfil são obrigatórios." }, 400);
      }
      if (!PERFIS_VALIDOS.includes(perfil)) {
        return json({ error: "Perfil inválido." }, 400);
      }

      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          nome,
          perfil,
          // Administrador nunca usa checklist (acesso total). Usuário Comum
          // recebe a lista marcada — array vazio é uma escolha válida (sem
          // nenhuma página liberada), então só cai no "null legado" se nem
          // foi enviada. Vendedor sem lista enviada começa só com "clientes".
          paginas_permitidas: paginasFor(perfil, paginas_permitidas)
        }
      });
      if (error) throw error;

      // inviteUserByEmail só aceita user_metadata; o perfil "oficial" vai em
      // app_metadata num segundo passo. Se este falhar, o usuário já existe mas
      // sem perfil (falha fechado: sem nenhum acesso) — avisa para o admin
      // abrir o cadastro e salvar de novo, o que grava o perfil.
      const { error: appMetaError } = await adminClient.auth.admin.updateUserById(data.user.id, {
        app_metadata: { perfil, paginas_permitidas: paginasFor(perfil, paginas_permitidas) }
      });
      if (appMetaError) {
        console.error("Falha ao gravar app_metadata no convite", data.user.id, appMetaError.message);
        return json({
          error: "Convite enviado, mas as permissões não foram gravadas. Edite o usuário e salve para concluir."
        }, 500);
      }

      return json({ user: data.user });
    }

    if (action === "updateProfile") {
      const { id, nome, perfil, paginas_permitidas } = payload;
      if (!id) return json({ error: "ID do usuário é obrigatório." }, 400);
      if (!PERFIS_VALIDOS.includes(perfil)) {
        return json({ error: "Perfil inválido." }, 400);
      }

      if (id === callerData.user.id && perfil !== "administrador") {
        return json({ error: "Você não pode remover o seu próprio nível de acesso de administrador." }, 400);
      }

      const { data, error } = await adminClient.auth.admin.updateUserById(id, {
        // user_metadata segue sendo gravado só por compatibilidade com o front antigo
        // (publicado), que ainda lê o perfil dele. Esta função NÃO lê mais daqui.
        user_metadata: {
          nome,
          perfil,
          paginas_permitidas: paginasFor(perfil, paginas_permitidas)
        },
        app_metadata: {
          perfil,
          paginas_permitidas: paginasFor(perfil, paginas_permitidas)
        }
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
