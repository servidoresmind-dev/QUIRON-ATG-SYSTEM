# Auditoria Quiron — Estado Real do Sistema (pré-produção)

**Data:** 17/07/2026
**Metodologia:** leitura direta do código-fonte em `src/` e `supabase/functions/`, mais testes ao vivo via `curl` contra a API REST/RPC do Supabase (banco de produção). Nenhum código foi alterado durante esta auditoria. Onde um teste foi feito em linha real do banco, o valor gravado foi o mesmo já existente (round-trip), sem alterar dado nenhum.

---

## 1. Botões e Ações — o que cada um faz de fato

Legenda: 🟢 Funcional (grava/lê direto no Postgres) · 🟡 Mock (função ainda não existe no backend, cai em fallback local) · 🔵 Leitura apenas

### Ordens de Serviço (`src/pages/OrdensServico.tsx`)
| Ação | Mecanismo | Status |
|---|---|---|
| Carregar lista | `supabase.from("ordens_servico").select("*")` + `supabase.from("orcamentos").select("*")` | 🔵 |
| "Salvar Alterações" (`handleSaveOS`) | `supabase.from("ordens_servico").update(updates).eq("id", selectedOS.id)` — PATCH REST direto | 🟢 |
| Exportar Excel | Geração local do arquivo, sem chamada de rede | 🔵 |

Não há checagem de perfil/role em nenhuma dessas ações — qualquer usuário autenticado pode editar qualquer O.S.

### Orçamentos (`src/pages/Orcamentos.tsx`)
| Ação | Mecanismo | Status |
|---|---|---|
| "Salvar Alterações" (`handleSaveOrcamento`) | `supabase.from("orcamentos").update(updates).eq("id", selectedOrcamento.id)` | 🟢 |
| "Faturar" (`handleSendToInvoicing`) | `supabase.from("orcamentos").update({ processada: true }).eq("id", orc.id)` | 🟢 |
| Exportar Excel | Local | 🔵 |

Idem: nenhuma checagem de role.

### Produtos (`src/components/Products/ProductList.tsx`)
| Ação | Mecanismo | Status |
|---|---|---|
| Carregar lista | `supabase.from("Produtos").select("*")` | 🔵 |
| "Atualizar Preços" (`handleUpdatePrices`) | `POST https://main-n8n.1smjgn.easypanel.host/webhook/atualiza-produto` (`triggerWebhook`, sem corpo) — dispara e não lê o resultado de volta, só confirma HTTP 200 | 🟢 (dispara), mas não confirma que os preços de fato mudaram |
| "Editar produto" → "Salvar" (`handleSaveEdit`) | `supabase.from("Produtos").update({nome_produto, valor_unitario, categora_item, CFOP}).eq("id", editingProduct.id)` | 🟢 |
| "Inativar/Reativar" (`handleToggleAtivo`) — **só aparece se `activeRole === ADMIN`** | `supabase.from("Produtos").update({ inativo: !product.inativo }).eq("id", product.id)` | 🟢 |
| Exportar Excel | Local | 🔵 |

### Serviços (`src/components/Services/ServiceList.tsx`)
Espelha Produtos, na tabela `"Serviços"`. Diferença: **não existe modal de edição de campos** para Serviços — só carregar, atualizar preços via webhook e inativar/reativar (admin).
| Ação | Mecanismo | Status |
|---|---|---|
| Carregar lista | `supabase.from("Serviços").select("*")` | 🔵 |
| "Atualizar Preços" | `POST .../webhook/atualiza-serv` | 🟢 (dispara) |
| "Inativar/Reativar" (admin) | `supabase.from("Serviços").update({ inativo: !service.inativo }).eq("id", service.id)` | 🟢 |

### Clientes (`src/pages/Clientes.tsx`)
| Ação | Mecanismo | Status |
|---|---|---|
| Carregar cards | `supabase.from("vw_cliente_card").select("*")`, depois `supabase.from("omie_clientes").select("id, inativo")` mesclado no cliente (a view não expõe `inativo`) | 🔵 |
| "Conferido" no cliente (`handleValidarCliente`) | `validarCadastro("cliente", cliente.id, usuario, true/false)` → RPC `validar_cadastro` via `src/utils/atgBackend.ts` | 🟡 **MOCK** — RPC não existe no banco (ver seção 3) |
| "Ver Geradores" | `supabase.from("geradores_atg").select("*").eq("omie_cliente_id", clienteId)` | 🔵 |
| "Inativar/Reativar Cliente" (admin only) | `supabase.from("omie_clientes").update({ inativo: !cliente.inativo }).eq("id", cliente.id)` | 🟢 |
| "Corrigir cadastro" → "Salvar Correção" (`handleSaveCliente`) | `supabase.from("omie_clientes").update({ razao_social, nome_fantasia, cnpj_raw, codigo_omie, iclass_id_encontrado, iclass_codigo_encontrado, status_conferencia }).eq("id", clienteId)` — os 7 campos editáveis | 🟢 |

### Modal de Gerador (`src/components/Clientes/GeradorModal.tsx`)
| Ação | Mecanismo | Status |
|---|---|---|
| "Conferido" (validar gerador) | `validarCadastro("gerador", gerador.id, usuario, ...)` → RPC `validar_cadastro` | 🟡 **MOCK** |

### Aba Preditiva (`src/components/Clientes/PreditivaTab.tsx`)
| Ação | Mecanismo | Status |
|---|---|---|
| Carregar | `supabase.from("vw_preditivas")...` + `supabase.from("oxicatalisador_atg")...` | 🔵 |
| "Salvar" item preditiva | `salvarPreditiva(item.id, {data_realizada, data_vencimento}, usuario)` → RPC `salvar_preditiva` | 🟡 **MOCK** |
| "Salvar" Oxicatalisador | `oxi?.id ? .update(payload).eq("id", oxi.id) : .insert(payload)` na tabela `oxicatalisador_atg` | 🟢 mas **bloqueado por RLS para usuário anônimo** — funciona só autenticado (ver seção 5) |

### Aba Ficha (`src/components/Clientes/FichaTab.tsx`)
| Ação | Mecanismo | Status |
|---|---|---|
| "Salvar Ficha" | `supabase.from("geradores_atg").update({ ficha_levantamento: form }).eq("id", gerador.id)` — PATCH direto, **não é RPC** | 🟢 |

### Fluxo B — Vincular O.S. (`src/components/Clientes/VincularOsWizard.tsx`)
| Ação | Mecanismo | Status |
|---|---|---|
| "Buscar" | `buscarOs(gerador.ativo_id, codigoOs)` → `POST https://main-n8n.1smjgn.easypanel.host/webhook/buscar-os` | 🟡 URL real, mas o n8n hoje só responde `{"message":"Workflow was started"}` (ack assíncrono) — sem corpo JSON esperado, cai no mock |
| "Confirmar e Vincular Ficha" | `supabase.from("geradores_atg").update({ ficha_levantamento, codigo_os_ficha_levantamento, checklist_pesquisa_id, ficha_validada_por_humano: true }).eq("id", gerador.id)` | 🟢, mas **o botão fica desabilitado no front quando o resultado da busca é mock** (`{preview && !preview.mocked && (...)}`) — proteção deliberada para não gravar dado fake |

### Fluxo C — Adicionar Gerador (`src/components/Clientes/AdicionarGeradorWizard.tsx`)
| Ação | Mecanismo | Status |
|---|---|---|
| "Buscar" (série/patrimônio) | `buscarAtivo(por, valor)` → `POST .../webhook/buscar-ativo` | 🟡 mesma situação do buscar-os — cai no mock |
| "Criar Gerador" | `criarGerador(cliente.id, ativo.ativo_id, dados, usuario)` → RPC `criar_gerador` | 🟡 **MOCK total** — a RPC não existe, então **nenhuma linha é de fato inserida em `geradores_atg`**; o objeto "novo gerador" que aparece na tela é só estado local do React (some se a página for recarregada) |

### Usuários (`src/pages/Usuarios.tsx`)
Todas as escritas passam pela Edge Function `manage-users`, nunca acesso direto à tabela.
| Ação | Mecanismo | Status |
|---|---|---|
| Listar | `supabase.functions.invoke("manage-users", {body:{action:"list"}})` → usa `service_role` **só no servidor** | 🟢 |
| "Enviar Convite" | action `invite` → `adminClient.auth.admin.inviteUserByEmail` | 🟢 |
| "Salvar Permissões" (perfil/páginas) | action `updateProfile` → `adminClient.auth.admin.updateUserById` | 🟢 |
| "Desativar/Reativar" | action `toggleActive` → `ban_duration` | 🟢 |

### Página antiga "Geradores" (`src/pages/Geradores.tsx` — mantida intacta, tabela `geradores`, separada de `geradores_atg`)
| Ação | Mecanismo | Status |
|---|---|---|
| Carregar | `supabase.from("geradores").select("*")` | 🔵 |
| "Salvar Alterações" (`handleSave`) | `supabase.from("geradores").update(editable).eq("id", selected.id)` | 🟢 |
| Busca Omie (`OmieSearchModal`) | `supabase.from("omie").select("nome, cnpj, cod_omie").or(...)` — só preenche campo local, não grava | 🔵 |

---

## 2. Operações Destrutivas

**Busquei em todo `src/` por `.delete(`, `DELETE`, `handleDelete`, "Excluir", "Apagar", "Deletar", "Trash", "remover" — não existe nenhum botão de deletar/excluir linha do banco em lugar nenhum do sistema.** A única ocorrência de `.delete(` no projeto é `Set.delete()` em `src/utils/mockData.ts`, que é manipulação de uma estrutura de dados em memória, sem relação com o banco.

**"Inativar cliente" não deleta nada.** É um `UPDATE` que apenas vira uma flag booleana:
```ts
// src/pages/Clientes.tsx — handleToggleAtivoCliente
const { error } = await supabase
  .from("omie_clientes")
  .update({ inativo: !cliente.inativo })
  .eq("id", cliente.id);
```
O mesmo padrão vale para "Inativar produto/serviço" (`Produtos`/`"Serviços"`, campo `inativo`). A linha permanece no banco, visível e recuperável a qualquer momento reativando.

**Não existe um "delete-gerador"** em nenhuma das duas telas de Geradores (nem a nova `geradores_atg`, nem a antiga `geradores`).

---

## 3. Funções RPC do Supabase

O único lugar do front-end que chama `supabase.rpc(...)` é `src/utils/atgBackend.ts`, através do wrapper `callRpc`:
```ts
export async function callRpc<T extends Mockable>(
  name: string,
  params: Record<string, unknown>,
  mockResponse: () => Omit<T, "_mocked">
): Promise<T> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase.rpc(name, params);
  if (!error) return data as T;
  if (error.code === "PGRST202") {
    warnMocked(`Função "${name}" ainda não existe no banco — usando resposta simulada.`);
    return { ...mockResponse(), _mocked: true } as T;
  }
  throw error;
}
```
Ou seja: **o front tenta chamar a RPC de verdade primeiro, sempre.** Só cai no mock quando o Postgres responde `PGRST202` (função inexistente).

Testei as três agora, ao vivo, contra o banco:
```
curl .../rest/v1/rpc/validar_cadastro -d '{...}' → PGRST202: "Could not find the function..."
curl .../rest/v1/rpc/salvar_preditiva  -d '{...}' → PGRST202: "Could not find the function..."
curl .../rest/v1/rpc/criar_gerador     -d '{...}' → PGRST202: "Could not find the function..."
```
**Nenhuma das três RPCs (`validar_cadastro`, `salvar_preditiva`, `criar_gerador`) existe no banco hoje.** Consequência prática:
- `validar_cadastro` → "Conferido" em cliente/gerador é 100% cosmético (mock), não persiste.
- `salvar_preditiva` → salvar item de preditiva é 100% cosmético (mock), não persiste.
- `criar_gerador` → **o Fluxo C inteiro não grava nada em `geradores_atg`**; o gerador "criado" existe só no state do React.

Fora essas três, **todo o resto do sistema escreve via PATCH/POST/UPDATE direto** na tabela (`.from(...).update(...)`), não via RPC — inclusive `FichaTab`, `VincularOsWizard` (parte de confirmação), `PreditivaTab` (Oxicatalisador), `Clientes.tsx` (correção de cadastro e inativar), `ProductList`/`ServiceList`, `OrdensServico`, `Orcamentos`.

---

## 4. Webhooks n8n

Chamados apenas em `src/utils/atgBackend.ts`:
```ts
const WEBHOOK_URLS = {
  buscarAtivo: "https://main-n8n.1smjgn.easypanel.host/webhook/buscar-ativo",
  buscarOs: "https://main-n8n.1smjgn.easypanel.host/webhook/buscar-os"
};

async function callWebhook<T extends { ok: boolean } & Mockable>(
  url: string, body: unknown, mockResponse: () => Omit<T, "_mocked">
): Promise<T> {
  try {
    const response = await fetch(url, { method: "POST", body: JSON.stringify(body) });
    const data = await response.json();
    if (data && typeof data.ok === "boolean") return data as T;
    warnMocked(`Webhook "${url}" não retornou o contrato esperado — usando resposta simulada.`);
    return { ...mockResponse(), _mocked: true } as T;
  } catch {
    warnMocked(`Falha ao chamar webhook "${url}" — usando resposta simulada.`);
    return { ...mockResponse(), _mocked: true } as T;
  }
}
```
`buscarAtivo` é chamado pelo Fluxo C (`AdicionarGeradorWizard.tsx`), `buscarOs` pelo Fluxo B (`VincularOsWizard.tsx`).

**As URLs são reais** (não são placeholders), mas testei ambas agora via `curl` e o n8n responde só:
```json
{"message":"Workflow was started"}
```
Isso não tem o campo `ok` que o front espera — então **as duas sempre caem no fallback mock hoje**, mesmo com a URL certa configurada. É um problema do lado do workflow n8n (que parece estar rodando em modo assíncrono/"respond immediately"), não do front.

Separadamente, existe um segundo par de webhooks, em `src/utils/webhooks.ts`, usados só pelos botões "Atualizar Preços" de Produtos/Serviços — **esses não têm mock fallback**, apenas disparam e checam o status HTTP:
```ts
export const WEBHOOK_URLS = {
  atualizarProdutos: "https://main-n8n.1smjgn.easypanel.host/webhook/atualiza-produto",
  atualizarServicos: "https://main-n8n.1smjgn.easypanel.host/webhook/atualiza-serv"
} as const;

export async function triggerWebhook(url: string): Promise<void> {
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) throw new Error(`Webhook respondeu com status ${response.status}`);
}
```
Esses eu não recategorizo como mock — cumprem o que prometem (disparar o workflow), mas o front **não confirma se os preços de fato foram atualizados**, só que o n8n aceitou a chamada.

---

## 5. Segurança / Acesso ao Banco

**O front usa exclusivamente a chave `anon`, nunca a `service_role`.**
```ts
// src/utils/supabase.ts
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string;
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
```
A única chave `service_role` do projeto vive em `supabase/functions/manage-users/index.ts`, roda no runtime Deno da Edge Function (servidor), e nunca é enviada ao browser. Essa function também é a única que checa explicitamente o perfil do chamador antes de agir:
```ts
const { data: { user } } = await callerClient.auth.getUser(jwt);
const callerPerfil = user?.user_metadata?.perfil;
if (callerPerfil !== "administrador") {
  return new Response(JSON.stringify({ error: "Apenas administradores podem gerenciar usuários." }), { status: 403 });
}
```

**⚠️ Achado crítico:** fiz testes de escrita reais (round-trip UPDATE em linha existente, gravando de volta o mesmo valor, sem autenticação — só com a chave `anon` pública, a mesma embutida no bundle JS que qualquer visitante do site pode ler) contra as tabelas principais que o front escreve via PATCH direto. Resultado:

| Tabela | Anon consegue escrever? | Como testei |
|---|---|---|
| `omie_clientes` | **SIM** | UPDATE em linha real, resposta veio com o registro completo (200 + corpo) |
| `geradores_atg` | **SIM** | idem |
| `geradores` (tabela antiga) | **SIM** | idem — testado agora: `PATCH .../geradores?id=eq.44` sem token de sessão, resposta trouxe a linha inteira de volta |
| `Produtos` | **SIM** | idem |
| `oxicatalisador_atg` | **NÃO** — bloqueado | INSERT anônimo retorna erro `42501 row-level security policy` |
| `ordens_servico` | **Não testável hoje** | tabela está vazia no momento (`Content-Range: */0`), então não há linha real para o round-trip; um teste com ID falso é inconclusivo (UPDATE bloqueado por RLS e "nenhuma linha encontrada" retornam a mesma resposta vazia) |
| `orcamentos` | **Não testável hoje** | mesma limitação — tabela vazia agora |
| `Serviços` | Não testei individualmente, mas segue o mesmo padrão de `Produtos` (mesmo tipo de política, sem RLS restritiva conhecida) — **recomendo testar antes de produção** |

**Isso significa que, hoje, qualquer pessoa que tenha a chave `anon` (pública, visível no bundle JS entregue ao navegador) consegue alterar diretamente — via chamada REST, sem nunca logar no sistema — qualquer linha de `omie_clientes`, `geradores_atg`, `geradores` e `Produtos`, desde que saiba ou adivinhe um ID real.** Isso vale tanto para leitura quanto escrita nessas tabelas: não há RLS habilitado restringindo por usuário/sessão.

**Nenhuma operação destrutiva ou de escrita no front, fora da Edge Function de Usuários, faz checagem de permissão/role no servidor.** As checagens de `activeRole === PerfilUsuario.ADMIN` que existem (botões de inativar Produto/Serviço/Cliente) são **só de UI** — o botão não aparece na tela para quem não é admin, mas a chamada REST subjacente (`supabase.from(...).update(...)`) não tem nenhuma política de banco impedindo que a mesma chamada seja feita manualmente por qualquer usuário (ou por alguém sem sessão nenhuma, como mostrado acima).

Resumindo a pergunta do líder: **os writes não passam por nenhuma barreira real de RLS nas tabelas principais do fluxo Cliente/Gerador — a única tabela com RLS efetivamente bloqueando é `oxicatalisador_atg`.**

---

## 6. Estrutura Geral

**A lista de cards de cliente é lida da view `vw_cliente_card`, sim:**
```ts
// src/pages/Clientes.tsx — fetchClientes
const { data, error } = await supabase.from("vw_cliente_card").select("*");
```
Como essa view não expõe a coluna `inativo` (ela é de `omie_clientes`, não da view), o front faz uma segunda leitura e mescla client-side:
```ts
const { data: statusData } = await supabase.from("omie_clientes").select("id, inativo");
// merge por id em memória, no React
```
Isso é uma fragilidade pontual: duas fontes de verdade lidas em momentos ligeiramente diferentes (dois round-trips separados), então existe uma janela pequena onde a lista de "ativos" pode estar dessincronizada da view se algo mudar entre as duas chamadas. Não é grave, mas não é atômico.

**Inconsistências/fragilidades gerais identificadas na forma como o sistema escreve no banco:**
1. **Duas tabelas de gerador coexistindo** (`geradores_atg`, usada pelo fluxo novo, e `geradores`, usada pela página antiga) — sem nenhuma ligação entre elas no código que eu vi. Se as duas representam os mesmos ativos físicos, há risco de divergência de dados entre as duas telas.
2. **Padrão de escrita inconsistente**: parte do sistema escreve via RPC (ainda que hoje mockada), parte via PATCH direto na tabela (`FichaTab`, `VincularOsWizard`, `Clientes.tsx`, `ProductList`, etc.). Não há uma camada única de acesso a dados — cada componente monta sua própria chamada Supabase.
3. **`oxicatalisador_atg`**: o código evita `.upsert()` deliberadamente e faz `if (oxi?.id) update else insert`, porque não foi possível confirmar se existe uma constraint UNIQUE em `gerador_id`. Isso é uma decisão defensiva registrada em código, não um bug, mas indica que o esquema do banco não foi totalmente documentado/confirmado no momento da implementação.
4. **RPCs e webhooks "documentados" no `Orientação Frontend.md` não existem/não funcionam ainda no backend** (seção 3 e 4 acima) — o front foi construído todo com fallback mock para não travar a UI, mas isso significa que **partes inteiras do fluxo (Fluxo C completo, todas as validações "Conferido", todos os saves de preditiva) hoje não persistem nada de verdade no banco**, mesmo parecendo funcionar na tela (toast de sucesso é do mock, com aviso `_mocked`/`toast.warning` visível no canto da tela).
5. **Sem RLS nas tabelas principais** (seção 5) é, na minha avaliação, o ponto mais urgente antes de produção — mais até que os RPCs faltantes, porque aqueles pelo menos falham de forma visível (mock + aviso), enquanto a ausência de RLS é silenciosa e não aparece em lugar nenhum da UI.

---

### Resumo executivo (o que falta para produção, na minha leitura)
- Criar as 3 RPCs no Postgres (`validar_cadastro`, `salvar_preditiva`, `criar_gerador`) — sem isso, validações e o Fluxo C inteiro não persistem.
- Ajustar os workflows n8n de `buscar-ativo`/`buscar-os` para responder de forma síncrona com o contrato JSON esperado (`{ok, ...}`), em vez do ack assíncrono atual.
- Habilitar/configurar RLS em `omie_clientes`, `geradores_atg`, `geradores`, `Produtos` e (a confirmar) `Serviços`/`ordens_servico`/`orcamentos`, hoje todas escreváveis anonimamente via a chave pública do front.
- Decidir o que fazer com a duplicidade `geradores` vs `geradores_atg`.
