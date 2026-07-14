# Catálogo de Implementação — Orientação Frontend (SaaS Preditivas ATG)

> Referência do que foi implementado a partir de `Orientação Frontend.md`.
> Não cobre nada além do que esse documento pediu — para o resto da
> integração (O.S., Orçamentos, Produtos, Serviços, Usuários, etc.), ver o
> PRD original.

**Data:** 2026-07-13
**Status geral:** Fluxos A, B e C implementados e navegáveis. RPCs mockadas
(backend ainda não as expõe). Webhooks apontando para as URLs reais, com
fallback mockado enquanto o n8n não responde no contrato síncrono.

---

## 1. O que mudou

A aba **Clientes & Geradores** (antes mockada com dados fictícios) foi
substituída pela implementação real descrita no documento. Rota `#/clientes`,
arquivo [src/pages/Clientes.tsx](src/pages/Clientes.tsx).

A aba **Geradores** que eu tinha criado antes (tabela `geradores` flat +
busca na tabela `omie`) **foi mantida como está**, sem nenhuma alteração —
por decisão sua, já que são fontes de dados diferentes e sem relação com
este documento.

---

## 2. Leitura de dados (seção 2 do documento)

| Tela | Fonte usada | Situação |
|---|---|---|
| Listagem de cards | `vw_cliente_card` | ✅ implementado, 1 query só |
| Geradores do cliente | `geradores_atg` filtrado por `omie_cliente_id` | ✅ implementado, carregado sob demanda ao clicar "Ver Geradores" |
| Preditiva do gerador | `vw_preditivas` filtrado por `gerador_id` | ✅ implementado, carregado ao abrir o gerador |
| Ficha do gerador | `geradores_atg.ficha_levantamento` (jsonb) | ✅ implementado |
| Oxicatalisador | `oxicatalisador_atg` filtrado por `gerador_id` | ✅ implementado como linha especial na aba Preditiva |
| Dados do cliente (`omie_clientes`) | — | **Não usado.** A `vw_cliente_card` já traz razão social, nome fantasia, CNPJ, código Omie, iclass_id, código do contrato e status_conferencia — exatamente os campos que a seção 4.2 pede para o "cliente expandido". Buscar em `omie_clientes` seria uma segunda query redundante, o que o próprio documento pede para evitar ("nunca montar o card com N queries"). |

Confirmei via chamada direta à API que `vw_cliente_card`, `geradores_atg` e
`vw_preditivas` existem e retornam dados reais (659+ geradores, várias
preditivas). `oxicatalisador_atg` existe mas está vazia até agora.

---

## 3. Estados do card (seção 3)

Implementado em [src/pages/Clientes.tsx](src/pages/Clientes.tsx) (`ESTADO_INFO`), com os 5 selos e cores exatamente como especificado:
`SEM_ICLASS` (vermelho), `SEM_GERADOR` (cinza), `SEM_FICHA` (amarelo),
`COMPLETO` (verde), `VALIDADO` (verde+check).

---

## 4. Anatomia das telas (seção 4)

- **4.1 Listagem:** grid de cards colapsados com razão social, selo, CNPJ e
  contagem de geradores. Busca por nome/CNPJ e filtro por estado.
- **4.2 Cliente expandido:** duas colunas (Omie / iClass), botões
  "Conferido" (Fluxo A), "Ver Geradores" e "Adicionar Gerador" (Fluxo C).
- **4.3 Gerador expandido:** modal com cabeçalho somente-leitura
  (descrição, fabricante, modelo, num_serie) + badge "ID iClass" travado
  (nunca editável — `ativo_id` só é definido pelo Fluxo C). Duas abas:
  - **Preditiva** ([PreditivaTab.tsx](src/components/Clientes/PreditivaTab.tsx)): tabela dos itens com datas editáveis
    por linha, badge de status colorido, salva via RPC `salvar_preditiva`.
    Oxicatalisador como linha especial (possui sim/não + bitola, sem datas).
  - **Ficha** ([FichaTab.tsx](src/components/Clientes/FichaTab.tsx)): se `ficha_levantamento` existe, renderiza cada
    seção do jsonb (motor, bateria, filtros, gerador, alternador,
    mangueiras, controlador, escapamento, bomba_injetora) como campos
    editáveis — genericamente, a partir das próprias chaves do jsonb (não
    fixei os nomes dos campos internos, já que o documento mostra `"..."`
    para eles). Se `null`, mostra a CTA "Vincular OS" (Fluxo B).

---

## 5. Ações que escrevem (seção 5 — RPCs)

Todas as 3 RPCs foram testadas diretamente contra o Supabase e **não
existem ainda** (retornam `PGRST202 — function not found`). Implementei
uma camada central em [src/utils/atgBackend.ts](src/utils/atgBackend.ts) que:

1. Sempre tenta a chamada real primeiro (`supabase.rpc(nome, params)`).
2. Se a função não existir, cai automaticamente numa resposta mockada
   (`{ ok: true }` ou similar) para o fluxo continuar testável.
3. **Quando o backend publicar as funções reais, nada no front precisa
   mudar** — a chamada real passa a funcionar sozinha assim que a RPC
   existir no schema.

| RPC | Onde é chamada | Mock atual |
|---|---|---|
| `validar_cadastro` | Botão "Conferido" no cliente e no gerador | `{ ok: true }` |
| `salvar_preditiva` | Botão salvar em cada item da aba Preditiva | `{ ok: true }` |
| `criar_gerador` | Fim do Fluxo C | `{ ok: true, id: <negativo aleatório> }` |

⚠️ **Atenção para quando `criar_gerador` for publicada:** hoje, como não
existe RPC real, uso um `id` negativo temporário só para a sessão atual
funcionar visualmente. Confirme que a RPC real devolve o `id` verdadeiro do
registro criado em `geradores_atg` — meu código já está preparado para usar
esse valor assim que vier.

---

## 6. Webhooks n8n (seção 6)

Você me passou as URLs reais depois que comecei:
- `https://main-n8n.1smjgn.easypanel.host/webhook/buscar-ativo`
- `https://main-n8n.1smjgn.easypanel.host/webhook/buscar-os`

**Testei as duas direto.** Ambas respondem `200 OK`, CORS liberado — mas o
corpo da resposta hoje é `{"message":"Workflow was started"}` (o ack
assíncrono padrão do n8n), não o contrato síncrono `{"ok":true,...}` descrito
no documento. Ou seja: **o workflow dispara, mas ainda não devolve o
resultado da busca na mesma requisição.**

Minha implementação em `atgBackend.ts` já lida com isso: chama a URL real
e, se a resposta não vier no formato esperado (`ok` presente), cai no mock
local (mesmo comportamento das RPCs) — assim o fluxo continua testável e,
quando o node "Respond to Webhook" do n8n for configurado para devolver o
resultado de fato, a integração passa a funcionar automaticamente, sem
nenhuma mudança de código.

**Isso é algo para repassar ao time de backend/n8n:** falta configurar o nó
de resposta do workflow para retornar o JSON síncrono (`ok`, `ativo_id`,
`descricao`, etc.) em vez do ack padrão.

---

## 7. Os três fluxos de trabalho (seção 7)

- **Fluxo A — Validar cadastro:** ✅ botão "Conferido" no cliente
  ([Clientes.tsx](src/pages/Clientes.tsx)) e no gerador ([GeradorModal.tsx](src/components/Clientes/GeradorModal.tsx)). Reabrível
  (clicar de novo desvalida). RPC mockada conforme seção 5.
- **Fluxo B — Vincular ficha pela OS:** ✅ [VincularOsWizard.tsx](src/components/Clientes/VincularOsWizard.tsx). Busca
  via webhook real `buscar-os` (com fallback mockado), mostra o checklist
  para conferência, confirma com PATCH direto em `geradores_atg`
  (`ficha_levantamento`, `codigo_os_ficha_levantamento`,
  `ficha_validada_por_humano=true`) — exatamente como o passo 5 da seção 7
  manda. Erro de OS não encontrada mantém o campo para nova tentativa.
- **Fluxo C — Adicionar gerador:** ✅ [AdicionarGeradorWizard.tsx](src/components/Clientes/AdicionarGeradorWizard.tsx). Pede
  número de série → `buscar-ativo` (real, com fallback mockado) → se falhar,
  pede patrimônio → se falhar de novo, bloqueia com a mensagem exata do
  documento ("ativo não cadastrado no iClass. Cadastre lá primeiro.").
  Trata também o caso de múltiplos resultados (lista para escolha). Depois
  de criar (RPC `criar_gerador`, mockada), abre automaticamente o gerador
  recém-criado para seguir direto para o Fluxo B, como o passo 7 pede.
  **Regra dura respeitada:** não existe nenhum campo para digitar `ativo_id`
  manualmente — ele só chega pela resposta do webhook.

---

## 8. Ordem de implementação

Segui exatamente a ordem sugerida na seção 8 do documento (1 → 5).

---

## 9. Checklist de segurança (seção 9)

- Nenhuma service key no browser — só a `anon key` pública, como em todo o
  resto do projeto.
- RLS: confirmei na prática que `oxicatalisador_atg` já está com policy
  restrita (recebi `42501 — row-level security policy` ao tentar escrever
  com a anon key, sem sessão). Isso bate com o que o documento descreve
  ("authenticated using true") — funciona normalmente para um usuário
  logado de verdade, só não funciona por fora da aplicação.
- Este item da seção 9 ("revisar RLS antes de produção") continua sendo
  responsabilidade do backend/DBA, não algo que eu resolvo pelo front.

---

## 10. Riscos e pendências conhecidas (para você e o líder de projeto)

1. **Webhooks n8n não retornam o contrato síncrono ainda** — ver seção 6
   acima. Front já pronto, falta configurar a resposta no n8n.
2. **As 3 RPCs não existem no Supabase ainda** — front mockando conforme
   documento pediu. Nenhuma mudança de código será necessária quando forem
   publicadas.
3. **Colunas de `oxicatalisador_atg`** (`gerador_id`, `possui`, `bitola`)
   foram inferidas pela descrição do documento — a tabela está vazia, então
   não consegui confirmar 100% os nomes exatos via leitura. Validar no
   primeiro uso real (login de verdade); se algum nome estiver errado, o
   erro do Postgres aparece direto no toast e é rápido de corrigir.
4. **`omie_clientes` não foi integrada** — decisão deliberada, ver seção 2
   acima. Avise se havia algum campo específico dessa tabela que a
   `vw_cliente_card` não cobre e que a tela precisa mostrar.
5. Não consegui testar visualmente esta tela no navegador porque exige
   login real (não tenho credenciais de um usuário válido neste ambiente).
   Typecheck e build passam limpos; as queries foram validadas uma a uma
   direto na API. Recomendo um teste ponta-a-ponta com login real antes de
   considerar pronto.
