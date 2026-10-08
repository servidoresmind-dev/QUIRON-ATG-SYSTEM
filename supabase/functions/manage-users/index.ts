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

  // ── Vínculo login ↔ vendedor (tabela `vendedores`, coluna auth_user_id) ──
  // Um vendedor tem no máximo um login e um login aponta para no máximo um
  // vendedor (índice único parcial no banco). `userId` é null quando o login
  // ainda não existe (convite).
  const checarVendedor = async (
    vendedorId: unknown,
    userId: string | null
  ): Promise<{ erro: string | null; linkAtual: string | null }> => {
    if (typeof vendedorId !== "number" || !Number.isInteger(vendedorId)) {
      return { erro: "Selecione o vendedor vinculado.", linkAtual: null };
    }
    const { data, error } = await adminClient
      .from("vendedores")
      .select("id, ativo, auth_user_id")
      .eq("id", vendedorId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { erro: "Vendedor não encontrado.", linkAtual: null };
    const jaEhDeste = userId !== null && data.auth_user_id === userId;
    if (data.auth_user_id && !jaEhDeste) {
      return { erro: "Este vendedor já está vinculado a outro usuário.", linkAtual: data.auth_user_id };
    }
    if (!data.ativo && !jaEhDeste) {
      return { erro: "Este vendedor está desativado.", linkAtual: data.auth_user_id };
    }
    return { erro: null, linkAtual: data.auth_user_id };
  };

  // Deixa o vínculo do usuário consistente com o perfil: quem não é vendedor
  // fica sem vendedor; quem é vendedor aponta só para o escolhido. Devolve a
  // mensagem de erro, ou null se deu certo.
  const sincronizarVinculo = async (
    userId: string,
    perfil: string,
    vendedorId: unknown,
    linkAtual: string | null
  ): Promise<string | null> => {
    const desfazer = adminClient.from("vendedores").update({ auth_user_id: null }).eq("auth_user_id", userId);
    const { error: unlinkErr } =
      perfil === "vendedor" ? await desfazer.neq("id", vendedorId as number) : await desfazer;
    if (unlinkErr) return unlinkErr.message;
    if (perfil !== "vendedor" || linkAtual === userId) return null;

    const { data, error } = await adminClient
      .from("vendedores")
      .update({ auth_user_id: userId })
      .eq("id", vendedorId as number)
      .is("auth_user_id", null)
      .select("id");
    if (error) return error.message;
    if (!data || data.length !== 1) return "Não foi possível vincular o vendedor.";
    return null;
  };

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

      // Qual vendedor está ligado a cada login (null para quem não é vendedor).
      const { data: vinculos, error: vinculosError } = await adminClient
        .from("vendedores")
        .select("id, auth_user_id")
        .not("auth_user_id", "is", null);
      // Se esta consulta falhar, a listagem de usuários continua funcionando sem o vínculo.
      if (vinculosError) console.error("Falha ao ler vínculos de vendedores", vinculosError.message);
      const vendedorPorUsuario = new Map<string, number>(
        (vinculos || []).map((v: { id: number; auth_user_id: string }) => [v.auth_user_id, v.id])
      );

      // A migração preguiçosa da Fase 1 foi removida de propósito: copiar de
      // user_metadata para app_metadata reabriria a brecha (um usuário poderia
      // se declarar admin em user_metadata e ser "promovido" pela cópia).
      const usuarios = data.users.map((u) => ({
        vendedor_id: vendedorPorUsuario.get(u.id) ?? null,
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

      // Vendedor precisa estar ligado a um cadastro de vendedor (senão não teria
      // nenhum cliente seu). Valida ANTES de convidar, para não criar login órfão.
      const { vendedor_id } = payload;
      if (perfil === "vendedor") {
        const { erro } = await checarVendedor(vendedor_id, null);
        if (erro) return json({ error: erro }, 400);
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

      if (perfil === "vendedor") {
        const vinculoErro = await sincronizarVinculo(data.user.id, perfil, vendedor_id, null);
        if (vinculoErro) {
          console.error("Falha ao vincular vendedor no convite", data.user.id, vinculoErro);
          return json({
            error: "Convite enviado, mas o vínculo com o vendedor falhou. Edite o usuário e salve para concluir."
          }, 500);
        }
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

      const { vendedor_id } = payload;
      let linkAtual: string | null = null;
      if (perfil === "vendedor") {
        const chk = await checarVendedor(vendedor_id, id);
        if (chk.erro) return json({ error: chk.erro }, 400);
        linkAtual = chk.linkAtual;
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

      // Mantém o vínculo coerente com o perfil (quem deixou de ser vendedor
      // perde o vínculo; quem trocou de vendedor aponta para o novo).
      const vinculoErro = await sincronizarVinculo(id, perfil, vendedor_id, linkAtual);
      if (vinculoErro) {
        console.error("Falha ao sincronizar vínculo de vendedor", id, vinculoErro);
        return json({
          error: "Perfil salvo, mas o vínculo com o vendedor falhou. Abra o usuário e salve de novo."
        }, 500);
      }

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
