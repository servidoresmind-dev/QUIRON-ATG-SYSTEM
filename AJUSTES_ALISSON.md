# Ajustes Frontend — Sistema ATG (rodada pré-produção)

> Lista dos ajustes identificados nos testes. Divididos por prioridade.
> Itens marcados **[depende do backend]** têm uma dependência de banco/n8n
> que está sendo entregue em paralelo — começar pelos demais.

---

## 1. CORRIGIR: tela branca ao abrir a Ficha de Levantamento

**Sintoma:** ao puxar a ficha (Fluxo B), a tela fica toda branca.

**Causa (erro real do console):**
```
Uncaught Error: Minified React error #31;
object with keys {qtd, codigo, fabricante}
```
O React quebrou porque um componente tentou renderizar um **objeto** como se
fosse texto. O objeto é um filtro da ficha.

**Onde:** no bloco `filtros` da `ficha_levantamento`, cada filtro é um objeto
com três campos, não um valor único:
```json
"filtros": {
  "combustivel_primario": { "qtd": "1 unidade", "codigo": "FS19732", "fabricante": "FLEETGUARD" },
  "ar_primario": { "qtd": "1 unidade", "codigo": "...", "fabricante": "CUMMINS" },
  ...
}
```
O código provavelmente faz algo como `<span>{filtro}</span>` — precisa exibir
os três campos separados: `{filtro.qtd}`, `{filtro.codigo}`, `{filtro.fabricante}`.

**Estrutura completa da ficha** (todos os blocos, para renderizar certo):
- `motor`: fabricante, modelo, num_serie, capacidade_oleo_baldes
- `gerador`: fabricante, ano, potencia, tensao, num_montagem
- `alternador`: fabricante, modelo, num_serie
- `controlador`: fabricante, modelo
- `bateria`: quantidade, capacidade_ah
- `bomba_injetora`: fabricante, modelo, numero
- `filtros`: 10 sub-objetos (combustivel/lubrificante/agua/separador/ar × primario/secundario), cada um com `{qtd, codigo, fabricante}`
- `mangueiras`: 4 sub-objetos (combustivel_alimentacao/retorno, preaquecimento_entrada/saida), cada um com `{metros, polegadas}`
- `escapamento`: diametro_pol, comprimento_m, curvas, pecas_90, pecas_45
- `outros`: **lista** de `{secao, pergunta, resposta}` — campos do iClass que
  não cabem nos blocos acima (QTA, sistema de combustível, instalação,
  oxicatalisador, placa, etc.). Renderizar como uma seção "Informações
  adicionais" agrupada por `secao`, ou ignorar — mas **não pode quebrar**.

**Importante:** o webhook `buscar-os` agora responde de verdade (não é mais
mock). A resposta **não tem mais** o campo `mocked`/`_mocked` — remover
qualquer checagem que dependia disso. A resposta real sempre vem com `ok: true`.

---

## 2. CORRIGIR: adicionar gerador grava sem confirmação

**Sintoma:** ao adicionar gerador, ele já grava direto no banco, sem o usuário
conferir.

**Ajuste:** depois que o fluxo (buscar-ativo / buscar-os) retorna, mostrar os
dados na tela para **conferência**, com um botão "Confirmar". Só grava no banco
**após** o clique de confirmação. Vale para os dois:
- Adicionar gerador (Fluxo C) — confirmar antes de criar
- Vincular ficha (Fluxo B) — confirmar antes de gravar a ficha

Nunca gravar automaticamente ao voltar do webhook.

---

## 3. NOVO: botão "Corrigir cadastro iClass" (renomear + novo fluxo)

**3a. Renomear** o botão "Corrigir cadastro Omie/iClass" → **"Corrigir cadastro iClass"**.

**3b. Desativar a edição do Omie.** Os dados do Omie (razão social, CNPJ,
código Omie) **nunca** são editados aqui — são sempre os mesmos. Remover/desabilitar
a edição desses campos. Só os campos do iClass são editáveis.

**3c. Novo fluxo de busca.** Ao clicar em "Corrigir cadastro iClass", abrir um
box onde o usuário escolhe **um** critério de busca:
- Código de contrato
- Nome
- CNPJ

Escolhido o critério e preenchido o valor, chamar o webhook **`buscar-cliente-iclass`**:
```
POST https://main-n8n.1smjgn.easypanel.host/webhook/buscar-cliente-iclass
```

**Contrato do webhook — enviar EXATAMENTE assim (senão o fluxo trava):**
```json
{
  "criterio": "codigo",          // "codigo" | "nome" | "cnpj" (só um)
  "_busca": {
    "iclassCodigoDireto": "CTR000158000077",   // preencher se criterio=codigo
    "razaoSocial": "",                          // preencher se criterio=nome
    "cnpj": ""                                  // preencher se criterio=cnpj
  },
  "gerador_id": 123,             // opcional: qual registro está corrigindo
  "cliente_id": 456              // opcional
}
```

**Resposta do webhook:**
```json
// achou (por nome pode vir mais de um — mostrar lista para o usuário escolher)
{ "ok": true, "total": 1, "encontrados": [
  {
    "iclass_id": 1031240182,
    "iclass_nome": "CONDOMINIO EDIFICIO PROVENCE APPARTEMENTS",
    "iclass_codigo": "CTR000158000077 Roteiro: 3",
    "cnpj": "01414078000115",
    "email": "...", "telefone": "..."
  }
]}

// nao achou
{ "ok": false, "motivo": "nao_encontrado" }

// front esqueceu de preencher
{ "ok": false, "motivo": "entrada_invalida" }
```

**Comportamento na tela:**
- `ok: true` com 1 resultado → mostra para conferência, usuário confirma
- `ok: true` com vários (busca por nome) → lista para o usuário escolher qual
- `ok: false` → mensagem: *"Cliente não localizado no iClass. Tente outro
  método de busca ou confira se o preenchimento está exatamente igual ao iClass."*
- Ao confirmar → gravar `iclass_id`, `iclass_nome`, `iclass_codigo` no cadastro
  (via confirmação, ver item 2 — nunca grava sem confirmar)

---

## 4. NOVO: mostrar o nome do cliente no iClass

Existe agora a coluna `iclass_nome` em `omie_clientes`. Exibir esse campo no
card/detalhe do cliente, na seção iClass (ao lado do `iclass_id_encontrado` e
`iclass_codigo_encontrado`). Hoje o front não mostra porque o dado é novo.

---

## 5. NOVO: apagar (arquivar) gerador

**Decisão:** o gerador **não é apagado de verdade** — é **arquivado** (marcado
como removido). Isso permite reverter depois (item 6) e evita perda de dado.
Geradores arquivados **não aparecem** em nenhuma listagem do sistema.

**Backend (você executa no banco):**
- Adicionar em `geradores_atg` uma coluna `arquivado boolean not null default false`
  (e `arquivado_por text`, `arquivado_em timestamptz`).
- **Toda leitura de geradores passa a filtrar `where arquivado = false`.** Isso
  inclui a listagem de geradores do cliente, a `vw_cliente_card` (a contagem de
  geradores NÃO pode contar arquivados) e qualquer outra query que liste geradores.
- "Apagar" = `update geradores_atg set arquivado = true, arquivado_por = <usuario>,
  arquivado_em = now()` + registrar no log (ver item 6).
- "Reverter" = voltar `arquivado = false`.

**Front:**
- Botão "Remover gerador" no detalhe do gerador
- Confirmação obrigatória ("Tem certeza? O gerador será arquivado e esta ação
  ficará registrada.")
- Ao confirmar → executa o arquivamento + grava log

---

## 6. NOVO: página de Histórico (log de alterações) + reverter

Toda alteração relevante é registrada com: quem fez, qual ação, o que era antes,
o que virou depois.

**Backend (você executa no banco):**
- Já existe a tabela `log_edicoes`. Ela precisa guardar o **antes e depois**.
  Se ainda não tiver, adicionar colunas `valor_antes jsonb` e `valor_depois jsonb`
  (além das que já existem: `entidade`, `entidade_id`, `acao`, `usuario`, `criado_em`).
- **Toda** operação de escrita (editar campo, validar, criar gerador, arquivar
  gerador, vincular ficha, corrigir iClass) grava uma linha em `log_edicoes` com:
  - `entidade` (ex: 'gerador', 'cliente', 'preditiva', 'ficha')
  - `entidade_id`
  - `acao` (ex: 'editou', 'arquivou', 'criou', 'vinculou_ficha', 'corrigiu_iclass')
  - `usuario`
  - `valor_antes` (o registro/campo como estava — jsonb)
  - `valor_depois` (como ficou — jsonb)
- **Reverter** = pegar o `valor_antes` do log e gravá-lo de volta na tabela de
  origem, e então registrar uma NOVA linha de log com `acao='reverteu'` (o
  reverter também é auditado). Nunca apagar linhas do log.

**Front:**
- Uma **página/aba separada** "Histórico"
- Tabela clara: usuário · data · ação · entidade · valor antes · valor depois
- Botão **"Reverter"** em cada linha (visível só para admin)
- Ao reverter → executa a gravação do valor antigo + registra a reversão no log
- Confirmação antes de reverter ("Reverter esta alteração? O estado anterior
  será restaurado.")

**Observação de escrita (importante para consistência):** hoje o front escreve
de duas formas diferentes (PATCH direto na tabela em alguns lugares, RPC em
outros). Para o log ser confiável, **toda escrita deve passar a gravar o log
junto** — seja via as funções RPC (`salvar_preditiva`, `validar_cadastro`,
`criar_gerador`, e as novas de arquivar/reverter/corrigir-iclass), seja
garantindo o insert no log em cada PATCH. O ideal é centralizar: toda escrita
passa por uma função que grava o dado E o log na mesma operação, para nunca
gravar um sem o outro.

---

## Resumo de prioridade

| # | Ajuste | Bloqueia produção? | Tipo |
|---|---|---|---|
| 1 | Tela branca da ficha | **Sim** | front |
| 2 | Confirmar antes de gravar | **Sim** | front |
| 3 | Botão "Corrigir cadastro iClass" + busca | Sim | front (webhook pronto ✅) |
| 4 | Mostrar `iclass_nome` | Não | front |
| 5 | Arquivar gerador | Sim | banco + front |
| 6 | Página de histórico + reverter | Não (logo após) | banco + front |

**Comece por 1, 2 e 4** — são só front, não dependem de banco. O 3 já tem o
webhook pronto. O 5 e o 6 envolvem mexer no banco (colunas + garantir o log em
toda escrita), você faz direto.

---

## Webhooks disponíveis (todos síncronos, respondem `{ ok: ... }`)

Base: `https://main-n8n.1smjgn.easypanel.host/webhook/`

| Webhook | Usado em | Envia | Recebe |
|---|---|---|---|
| `buscar-ativo` | Adicionar gerador | `{ por:"serialNumber", valor }` | `{ ok, ativo_id, cliente, codigo, descricao, fabricante, modelo, status_ativo }` |
| `buscar-os` | Vincular ficha | `{ codigo_os }` | `{ ok, ficha_levantamento, checklist_pesquisa_id }` |
| `buscar-cliente-iclass` | Corrigir cadastro iClass | ver item 3 | ver item 3 |

Todos respondem de forma síncrona — o problema antigo do
`{"message":"Workflow was started"}` foi corrigido. Se algum voltar a cair em
mock, é sinal de que o workflow foi desativado no n8n.

---

## Lembrete de segurança (antes de produção)

A auditoria apontou que as tabelas principais (`omie_clientes`, `geradores_atg`,
`Produtos`) hoje aceitam escrita anônima — a RLS está desligada nelas, só
`oxicatalisador_atg` está protegida. Antes do go-live, revisar as políticas RLS
para que a escrita respeite os roles já existentes (não só esconder botões na UI).
Não bloqueia os testes da cliente, mas é item obrigatório antes de produção real.

---

## O que foi alterado (execução dos ajustes acima)

Todos os itens 1–6 foram implementados no front. `tsc --noEmit` e `vite build`
rodam limpos. Dois itens (5 e 6) dependem de colunas/tabela que ainda não
existem no banco — o SQL exato está no final desta seção, marcado como
**pendente de execução**.

### 1. Tela branca da Ficha de Levantamento — corrigido

Causa confirmada: `filtros` e `mangueiras` têm sub-objetos (`{qtd, codigo,
fabricante}` / `{metros, polegadas}`), e o código antigo tentava renderizar
esses objetos direto como texto (`{valor}`), o que o React recusa (erro #31).

- `src/types.ts`: `FichaLevantamento` agora distingue seção simples
  (`Record<string,string>`) de seção aninhada (`Record<string,
  Record<string,string>>`), e ganhou `outros?: {secao,pergunta,resposta}[]`.
- `src/components/Clientes/FichaTab.tsx`: renderiza (e permite editar) campos
  simples normalmente, campos aninhados como um mini-grid dentro da seção, e
  `outros` como uma seção "Informações adicionais" agrupada por `secao`
  (somente leitura).
- `src/components/Clientes/VincularOsWizard.tsx`: mesmo tratamento na tela de
  conferência (preview) antes de confirmar.
- Removida a checagem de `_mocked`/`mocked` que bloqueava a confirmação nessa
  tela — o webhook `buscar-os` agora responde de verdade, então a confirmação
  fica sempre disponível quando a busca retorna um resultado válido. (O
  fallback mock em `atgBackend.ts` continua existindo como rede de segurança —
  se o n8n voltar a cair no ack assíncrono, o toast de aviso ainda aparece.)

### 2. Confirmar antes de gravar — corrigido/reforçado

- **Fluxo B (Vincular O.S.)**: já não gravava automaticamente (busca só
  preenche uma prévia; só o clique em "Confirmar e Vincular Ficha" grava) —
  mantido, só foi destravado do bloqueio por `_mocked` acima.
- **Fluxo C (Adicionar Gerador)**: adicionado um passo novo de revisão. Antes
  o botão do formulário criava direto; agora ele leva a uma tela "Revisar e
  Confirmar" somente leitura com fabricante/modelo/série/descrição/ID iClass,
  e só o clique em "Confirmar Criação" chama a RPC `criar_gerador`. Dá para
  voltar e editar antes de confirmar. (`AdicionarGeradorWizard.tsx`)

### 3. Botão "Corrigir cadastro iClass" — novo fluxo

- Componente novo: `src/components/Clientes/CorrigirIclassWizard.tsx`.
- Botão renomeado para "Corrigir cadastro iClass" (`Clientes.tsx`).
- Os campos do Omie deixaram de ser editáveis nessa tela — agora é só
  visualização (Razão Social, Nome Fantasia, CNPJ, Código Omie).
- Fluxo novo: escolher critério (código de contrato / nome / CNPJ), buscar via
  `buscarClienteIclass()` (novo, em `src/utils/atgBackend.ts`), que chama
  `POST /webhook/buscar-cliente-iclass` com o contrato exato pedido
  (`criterio` + `_busca.{iclassCodigoDireto,razaoSocial,cnpj}` +
  `cliente_id`). Trata os 3 casos: 1 resultado → prévia de confirmação; vários
  → lista para escolher; `ok:false` → mensagem "Cliente não localizado no
  iClass...". Só grava (`iclass_id_encontrado`, `iclass_nome`,
  `iclass_codigo_encontrado`) depois do clique em "Confirmar e Salvar".

### 4. Mostrar `iclass_nome` — feito

- `ClienteCard` e `OmieClienteDetalhe` (`types.ts`) ganharam o campo
  `iclass_nome`.
- `Clientes.tsx`: a `vw_cliente_card` não expõe essa coluna (confirmado ao
  vivo), então ela é buscada na mesma query que já mescla `inativo` a partir
  de `omie_clientes`, e mostrada no painel iClass do card, ao lado de "ID
  Encontrado" e "Código do Contrato".

### 5. Arquivar (remover) gerador — feito no front, **SQL pendente**

- `GeradorModal.tsx`: botão "Remover Gerador" com confirmação obrigatória
  ("Tem certeza?..."). Ao confirmar, grava `arquivado=true, arquivado_por,
  arquivado_em` em `geradores_atg` e registra no log (item 6).
- `Clientes.tsx`: a listagem de geradores do cliente (`fetchGeradores`) agora
  filtra `arquivado = false`. Gerador removido some da lista na hora, sem
  precisar recarregar a página.
- **Confirmado ao vivo que a coluna `arquivado` ainda não existe em
  `geradores_atg`** — enquanto o SQL abaixo não rodar, a listagem de geradores
  vai dar erro (toast "Erro ao carregar geradores"), não vai ficar em branco,
  mas o recurso não funciona. Rodar o SQL abaixo primeiro.
- **Pendência que eu não resolvi:** os contadores do card (`n_geradores`,
  `n_com_ficha`, `n_validados`, `primeiro_gerador`) vêm da view
  `vw_cliente_card`, e eu não tenho o SQL de definição dela — não dá pra
  garantir que ela vai parar de contar geradores arquivados sem arriscar
  quebrar a view. Alguém com acesso ao SQL da view precisa adicionar o filtro
  de `arquivado = false` no `JOIN`/subquery que conta geradores. Rodando
  `SELECT pg_get_viewdef('public.vw_cliente_card'::regclass, true);` no SQL
  Editor do Supabase mostra a definição atual, se quiser que eu ajuste depois
  de ver o texto.

### 6. Histórico de alterações + reverter — feito no front, **SQL pendente**

- Página nova: `src/pages/Historico.tsx`, rota `#/historico`, item novo no
  menu lateral e na lista de páginas com permissão por checkbox
  (`utils/pages.ts`). Mostra usuário · data · ação · entidade · antes · depois,
  com filtro por entidade e busca. Botão "Reverter" só aparece para
  Administrador.
- `src/utils/logEdicoes.ts` (novo): `registrarLog()` grava uma linha em
  `log_edicoes` (não trava a ação principal se o log falhar, só avisa no
  console); `reverterLog()` regrava `valor_antes` na tabela de origem e grava
  uma nova linha de log com `acao='reverteu'` (nunca apaga log).
- **`valor_antes`/`valor_depois` guardam só os campos que mudaram** (não a
  linha inteira) — reverter é reaplicar esse pedaço como update parcial.
- Log foi ligado em **todo write real que já existia**: corrigir cadastro
  iClass, inativar/reativar cliente, editar ficha, vincular ficha (Fluxo B),
  arquivar gerador, editar oxicatalisador.
- **Não foi ligado** em: "Conferido" (cliente/gerador), salvar item de
  preditiva, criar gerador (Fluxo C) — essas três ainda dependem das RPCs
  `validar_cadastro`/`salvar_preditiva`/`criar_gerador`, que **continuam não
  existindo no banco** (confirmado ao vivo nesta sessão, todas retornam
  `PGRST202`). Não fazia sentido logar uma escrita que ainda é só mock. Quando
  essas RPCs existirem de verdade, o ideal é que elas mesmas gravem o log
  (é mais confiável que depender do front chamar de novo depois da RPC).
- **Confirmado ao vivo que `log_edicoes` já existe** (colunas `id, entidade,
  entidade_id, acao, usuario, criado_em`), mas **ainda não tem as colunas
  `valor_antes`/`valor_depois`** — sem elas, `registrarLog()` vai falhar
  silenciosamente (só um `console.warn`, não trava a tela) até o SQL abaixo
  rodar.

### SQL — executado ✅

Todos os 3 blocos já rodaram no SQL Editor do Supabase Studio e foram
reconfirmados ao vivo (via curl, leitura/round-trip, sem deixar dado alterado):

```sql
-- Ajuste #5 — arquivar gerador
alter table geradores_atg
  add column if not exists arquivado boolean not null default false,
  add column if not exists arquivado_por text,
  add column if not exists arquivado_em timestamptz;

-- Ajuste #6 — log de edições (antes/depois)
alter table log_edicoes
  add column if not exists valor_antes jsonb,
  add column if not exists valor_depois jsonb;
```

E a `vw_cliente_card` foi atualizada (`CREATE OR REPLACE VIEW`, mesmas colunas,
só com `where g.arquivado = false` adicionado no CTE `ger`) para os contadores
do card pararem de incluir geradores arquivados.

**Verificação ao vivo (round-trip num gerador real, id 131, cliente 547,
depois restaurado ao estado original):**
- Antes de arquivar: `n_geradores: 1, estado: "SEM_FICHA"`
- Depois de arquivar: `n_geradores: 0, estado: "SEM_GERADOR"` — confirma que a
  view já filtra corretamente.
- Depois de reverter: `n_geradores: 1, estado: "SEM_FICHA"` — de volta ao
  estado original, nada ficou alterado no banco.

Os itens 5 e 6 estão concluídos de ponta a ponta (front + banco).

---

## Ajuste extra — Criar Cliente (Omie + iClass)

Implementado a partir do documento "Criar Cliente (Omie + iClass) —
Orientação Frontend + Banco", enviado à parte.

- **Botão "Novo Cliente"** no topo da página Clientes (`Clientes.tsx`), aberto
  para qualquer usuário com acesso à página (mesmo padrão do "Adicionar
  Gerador" — não é admin-only, o documento não pediu restrição de perfil).
- Componente novo: `src/components/Clientes/CriarClienteWizard.tsx` — um
  formulário só, todos os campos obrigatórios exceto Observação (validação no
  front antes de chamar o webhook, e também trata o `campos_faltando` que o
  fluxo devolve, destacando os campos em vermelho).
- `src/utils/atgBackend.ts`: novo `criarCliente()`, chama `POST
  /webhook/criar-cliente`. **Testei o webhook ao vivo nesta sessão** (chamada
  vazia) e ele já responde de forma síncrona com o contrato exato do
  documento (`{"ok":false,"status":"campos_faltando","faltando":[...]}`) — não
  está mais no modo assíncrono antigo, então não deveria cair no mock na
  prática.
- Trata os 4 cenários do documento, mais o `iclass_sem_id` mencionado no
  resumo:
  - `completo` → grava tudo em `omie_clientes`, toast verde.
  - `iclass_sem_id` → grava tudo (Omie + o que veio do iClass), toast âmbar
    avisando para conferir e completar o ID via "Corrigir cadastro iClass".
  - `iclass_pendente` → grava só os dados do Omie (`codigo_omie`), com os
    campos de iClass nulos e `iclass_pendente = true`; toast âmbar "finalize
    manualmente no iClass". **O dado do Omie nunca é perdido**, como pedido.
  - `falha_omie` → não grava nada no banco, mensagem vermelha, formulário
    continua preenchido para tentar de novo.
  - `campos_faltando` → não chama o banco, destaca os campos que faltam.
- **Card do cliente**: badge âmbar "Pendente iClass" ao lado do badge de
  estado, quando `iclass_pendente = true`.
- **Log**: toda criação bem-sucedida (completo/iclass_sem_id/iclass_pendente)
  grava em `log_edicoes` via `registrarLog()`, com `acao = 'criou_cliente'` (ou
  `'criou_cliente_iclass_pendente'` no caso 3b) e `valor_antes = null` (é
  criação — por isso não aparece botão "Reverter" para essas linhas no
  Histórico; desfazer uma criação seria um delete, que o sistema
  deliberadamente não tem, ver Auditoria-Quiron.md).
- **Campos do formulário que não são gravados no nosso banco**: email,
  telefones, endereço, cidade, estado, CEP, observação — o documento só pediu
  para gravar em `omie_clientes` os campos de identificação/match (razão
  social, nome fantasia, CNPJ, código Omie, dados do iClass). O resto só vai
  para o Omie/iClass via webhook, não fica duplicado aqui.

### SQL pendente — mais uma coluna em `omie_clientes`

Confirmei ao vivo que a coluna ainda não existe. Rodar no SQL Editor do
Supabase Studio:

```sql
alter table omie_clientes
  add column if not exists iclass_pendente boolean not null default false;
```

Sem isso, a página de Clientes quebra ao carregar — não só a criação de
cliente. Isso acontece porque o front já busca `iclass_pendente` na mesma
query que já buscava `inativo` e `iclass_nome` (é uma query só, mais barata
que uma por card); se uma coluna dessa consulta não existe, a consulta
inteira falha. **Recomendo rodar esse SQL antes do próximo deploy**, mesmo
que a criação de cliente ainda não vá ser testada — senão a página de
Clientes para de carregar o status ativo/inativo e o nome iClass que já
funcionavam.

---

## Ajuste extra 2 — Ativar/Inativar Gerador (implementado e depois **revertido**)

Motivado pelo diagnóstico (`docs/diagnostico-sistema.md`, achado principal),
esse toggle leve de ativo/inativo (mesmo padrão de Clientes/Produtos/Serviços)
chegou a ser implementado em `GeradorModal.tsx`, `Clientes.tsx` (lista "Ver
Geradores") e na página legada `Geradores.tsx`.

**Removido a pedido do Alisson**: gera peso desnecessário no banco sem uso
real — o arquivamento (item 5, soft-delete via `arquivado`) já cobre a
necessidade de "remover" um gerador, e é reversível pelo Histórico. Mantém-se
**só** o arquivamento para Gerador. O toggle ativo/inativo de
Cliente/Produtos/Serviços **não foi tocado** (fora de escopo, continua como
estava).

- Removido de `GeradorModal.tsx`, `Clientes.tsx` e `Geradores.tsx` (e o prop
  `activeRole`/`currentUserEmail` que só existia por causa disso em
  `Geradores.tsx`/`App.tsx`).
- Campo `inativo` removido das interfaces `GeradorAtg` e `GeradorFicha`
  (`types.ts`).
- **A coluna `inativo` nunca chegou a ser criada no banco** (confirmado ao
  vivo na época — não existia nem em `geradores_atg` nem em `geradores`), então
  não há nenhum `DROP COLUMN` pendente nem dado a perder.
- `tsc --noEmit` e `vite build` rodam limpos após a reversão.

---

## Ajuste extra 3 — Adicionar Gerador pelo número da O.S. (front pronto, **webhook pendente**)

Nova opção pedida junto com a reversão do item acima: adicionar um gerador ao
cliente localizando o ativo no iClass pelo **número da O.S.**, em vez de por
série/patrimônio (fluxo que já existia, "Adicionar Gerador").

- **Botão novo** "Adicionar Gerador por O.S." em `Clientes.tsx`, ao lado do
  "Adicionar Gerador" existente (mesma regra de visibilidade: escondido só
  quando `cliente.estado === "SEM_ICLASS"`).
- **Componente novo**: `src/components/Clientes/AdicionarGeradorPorOsWizard.tsx`
  — mesma estrutura do `AdicionarGeradorWizard.tsx` (busca → seleção se houver
  múltiplos ativos pra mesma O.S. → formulário editável → revisão →
  confirmação explícita antes de gravar, mesmo padrão do item 2 acima), só que
  com uma única etapa de busca (pelo código da O.S.) em vez das etapas
  série/patrimônio/bloqueado.
- **`src/utils/atgBackend.ts`**: função nova `buscarAtivoPorOs(codigoOs)`,
  tipos `BuscarAtivoPorOsResult*` (sucesso / múltiplos / falha, mesmo
  formato do `buscarAtivo` existente). Usa `classificarErroWebhook` para as
  mensagens de rate limit/comunicação, igual aos outros fluxos.
- Criação em si continua usando a RPC `criar_gerador` já existente — só a
  **busca do ativo** usa o webhook novo.

### Webhook — pronto e testado ao vivo ✅

URL real: `https://main-n8n.1smjgn.easypanel.host/webhook/gerador-por-os`
(já configurada em `WEBHOOK_URLS.buscarAtivoPorOs`, `atgBackend.ts`).

Testado ao vivo nesta sessão via curl, com a O.S. real `1353908811`
(passou por 4 iterações até o workflow ficar certo — histórico rápido: 1º
erro foi falta de nó "Respond to Webhook"; 2º foi o nó de resposta devolvendo
o JSON cru do iClass em vez do contrato combinado; 3º foi o nó de mapeamento
ligado no nó errado, `objects` vinha vazio mesmo com o ativo existindo).
Resposta final confirmada:
```json
{"ok":true,"ativo_id":117331087,"descricao":"GRUPO GERADOR - NEGRINI - U","fabricante":"DIAMOND","modelo":null,"status_ativo":"ATIVO"}
```
Bate com o contrato esperado pelo front. Dois detalhes menores, não
bloqueantes: `num_serie` não vem no JSON (front trata como opcional, campo
fica vazio pra preencher na mão) e `modelo` vem `null` em vez de string vazia
(front converte pra vazio antes de mostrar). Se quiser trazer `num_serie`
também (o iClass devolve como `numeroSerie` no objeto do ativo), é só
completar o mapeamento no nó Code do workflow.

**Contrato confirmado do webhook:**
```json
// envia
{ "codigo_os": "OS-12345" }

// recebe — um ativo encontrado
{ "ok": true, "ativo_id": 123, "descricao": "...", "fabricante": "...", "modelo": "...", "status_ativo": "...", "num_serie": "..." }

// recebe — mais de um ativo vinculado à mesma O.S.
{ "ok": true, "multiplos": true, "opcoes": [{ "ativo_id": 123, "descricao": "..." }] }

// recebe — não encontrado / rate limit / erro
{ "ok": false, "motivo": "nao_encontrado" | "rate_limit_excedido" | "erro_comunicacao" }
```

### Não testado em navegador

`tsc --noEmit` e `vite build` rodam limpos, e o webhook em si foi validado
ao vivo via curl (acima). Não testei o fluxo completo clicando pela UI no
navegador (sem login de teste configurado no ambiente) — recomendo um teste
manual do botão "Adicionar Gerador por O.S." antes de liberar pro time.

---

## Ajuste extra 4 — "Remover Gerador" agora é exclusão real (a pedido do líder de projeto)

Pedido explícito do líder de projeto: o botão de remover gerador deve **apagar
de verdade** do banco, sem possibilidade de recuperação — diferente do item 5
original (arquivamento reversível), que era a decisão anterior.

**Confirmado com o Alisson antes de mexer** (mudança irreversível de dado):
escopo é **só Gerador** (Cliente/Produtos/Serviços continuam com
inativar/arquivar como estão, sem alteração); o Histórico **continua
registrando** a exclusão (com uma cópia completa do gerador em `valor_antes`,
pra consulta/auditoria), mas **sem botão "Reverter"**, já que não existe mais
linha no banco pra restaurar com um update.

- `GeradorModal.tsx`: `handleArquivar` → `handleExcluir`, agora faz
  `supabase.from("geradores_atg").delete().eq("id", gerador.id)` em vez de
  `update({arquivado:true})`. Botão renomeado "Remover Gerador" → **"Excluir
  Gerador"** (ícone trocado de `Archive` para `Trash2`), e o texto de
  confirmação agora avisa claramente: *"O gerador será apagado definitivamente
  do banco de dados, sem possibilidade de recuperação."* — sem mais nenhuma
  menção a "arquivado"/"reverter".
- Log: grava `acao: "excluiu_definitivamente"`, `valor_antes` = cópia completa
  do gerador (todos os campos, pra ficar registrado o que existia antes de
  apagar), `valor_depois: null`.
- `Historico.tsx`: a condição que mostra o botão "Reverter" agora exclui
  explicitamente `acao === "excluiu_definitivamente"` (além do já existente
  `"reverteu"`) — mesmo que `valor_antes` esteja preenchido, não mostra
  Reverter pra essa ação, porque reverter faria um `UPDATE` numa linha que já
  não existe (não daria erro, só não faria nada — por isso a exclusão
  explícita, pra não induzir o admin a achar que "reverteu" quando na
  verdade não fez nada).
- Prop/handler renomeados por clareza (mesmo comportamento): `onArchived` →
  `onDeleted` em `GeradorModal.tsx`/`Clientes.tsx`, `handleGeradorArchived` →
  `handleGeradorDeleted`.
- **A coluna `arquivado`/`arquivado_por`/`arquivado_em` de `geradores_atg` não
  foi removida do banco nem do código** — só parou de ser usada por esse botão.
  Não tinha pedido pra limpar isso agora; se quiser que eu remova de vez
  (coluna + campos do tipo `GeradorAtg` + filtro `eq("arquivado", false)` em
  `Clientes.tsx`), é só falar.

### Atenção — segurança (RLS)

Isso é mais sensível que o arquivamento que existia antes: um `DELETE` real
apaga a linha de vez, e a auditoria de segurança já registrada neste mesmo
documento (seção "Lembrete de segurança") apontou que `geradores_atg` **aceita
escrita anônima hoje** (RLS desligada). Antes desse botão ir pra produção,
vale confirmar que a política de RLS/permissão de `DELETE` nessa tabela está
restrita a quem realmente deveria poder excluir (ex: só usuários
autenticados/admin) — sem isso, qualquer requisição com a anon key consegue
apagar um gerador, não só quem clica no botão pela UI.

### Não testado em navegador

`tsc --noEmit` e `vite build` rodam limpos. Não fiz teste interativo (exclusão
real de dado em produção não é algo pra testar "só pra ver" sem combinar
antes) — recomendo testar com um gerador de teste/descartável antes de usar
em um registro real.

---

## Ajuste extra 5 — "Inativar Cliente" também virou exclusão real

Mesmo pedido do ajuste anterior, agora pro botão de Cliente: **"Inativar
Cliente"/"Reativar Cliente" foi removido** e virou **"Excluir Cliente"**, com
o mesmo padrão de aviso e irreversibilidade do "Excluir Gerador" (ver Ajuste
extra 4). Escopo confirmado com o Alisson: **só Cliente** — Produtos e
Serviços não foram tocados, continuam com inativar/reativar como sempre
estiveram.

- `Clientes.tsx`: `handleToggleAtivoCliente` (fazia
  `update({inativo: !cliente.inativo})`) → `handleExcluirCliente` +
  `handleConfirmarExclusaoCliente`, que fazem
  `supabase.from("omie_clientes").delete().eq("id", cliente.id)`. Botão
  "Inativar/Reativar Cliente" → **"Excluir Cliente"** (ícone `Ban` trocado por
  `Trash2`), com painel de confirmação inline (mesmo texto do gerador: *"será
  apagado definitivamente do banco de dados, sem possibilidade de
  recuperação"*).
- **Proteção contra exclusão com geradores vinculados** (decisão tomada com o
  Alisson antes de implementar, pra não arriscar deixar geradores órfãos ou
  bater numa constraint de FK sem explicação): antes de mostrar a
  confirmação, checa `cliente.n_geradores` (já vem pronto da
  `vw_cliente_card`, sem precisar de query extra) — se for maior que zero,
  **bloqueia** com um toast explicando que precisa excluir os geradores desse
  cliente primeiro, e nem chega a abrir a confirmação.
- Log: mesmo padrão do gerador — `acao: "excluiu_definitivamente"`,
  `valor_antes` = cópia do cliente (campos do `ClienteCard`), `valor_depois:
  null`. `Historico.tsx` já trata essa ação genericamente (a condição do
  botão "Reverter" checa o nome da ação, não a entidade), então não precisou
  de nenhuma mudança lá.
- **O campo `inativo` de `omie_clientes` não foi removido** do banco nem do
  tipo `ClienteCard`/`OmieCliente` — clientes antigos que já estavam
  marcados como inativos antes dessa mudança continuam aparecendo com a
  badge "INATIVO" e opacidade reduzida no card (comportamento antigo,
  preservado só pra não esconder informação histórica); só não tem mais
  como marcar um cliente **novo** como inativo pela UI.

### Atenção — segurança (RLS) e FK

Mesmo alerta do Ajuste extra 4: `omie_clientes` também aceita escrita anônima
hoje (RLS desligada, conforme a auditoria já registrada neste documento) —
vale revisar a política de `DELETE` antes de produção. Além disso, a
proteção "bloqueia se tiver gerador" é feita **no front**, a partir do
`n_geradores` da view — se por algum motivo essa contagem estiver
desatualizada (cache local, view não recalculada), o `DELETE` pode ainda
esbarrar numa constraint de chave estrangeira no banco (se existir uma
`FOREIGN KEY` de `geradores_atg.omie_cliente_id` pra `omie_clientes.id`) e
retornar um erro do Postgres — o toast de erro mostra a mensagem crua do
Supabase nesse caso, então não trava silenciosamente, mas vale confirmar
com quem administra o banco se essa constraint existe e qual o comportamento
dela (`RESTRICT` é o que a checagem do front pressupõe).

### Não testado em navegador

`tsc --noEmit` e `vite build` rodam limpos. Não fiz teste interativo (mesma
razão do ajuste anterior — exclusão real de cliente em produção).

---

## Correção de bug — "Adicionar Gerador" dava erro mesmo criando com sucesso

**Reportado em produção pelo Douglas (30/07/2026, ~14:48–15:02)**: ao tentar
cadastrar um gerador (cliente "707 AUTO-SERVICO DE ALIMENTOS LTDA"), o front
sempre mostrava *"Erro ao criar gerador. A criação não foi confirmada pelo
backend."* — mas, ao investigar (logs do Supabase + consulta direta na
tabela), descobrimos que **a criação estava funcionando toda vez**. O Douglas
tentou de novo várias vezes pensando que tinha falhado, o que gerou **4
linhas duplicadas** do mesmo ativo (`geradores_atg.id` 489, 490, 491, 492 —
`ativo_id 117331192`, cliente `omie_cliente_id 747`).

**Causa raiz**: a RPC `criar_gerador` **retorna o tipo `geradores_atg`** (a
linha inteira recém-criada), confirmado ao vivo via
`pg_get_function_result()` no SQL Editor — não um envelope `{ok, id}` como o
front esperava desde que essa RPC ainda nem existia de verdade (o
`atgBackend.ts` original foi escrito antes da RPC existir, com um contrato
adivinhado). Como a resposta real não tem campo `ok`, `result.ok` sempre
dava `undefined`/falso, e o front achava que tinha falhado mesmo com o
`insert` acontecendo normalmente no banco.

**Correção** (`src/utils/atgBackend.ts`, `AdicionarGeradorWizard.tsx`,
`AdicionarGeradorPorOsWizard.tsx`): `CriarGeradorResult` agora reflete o
retorno real (`{id: number, ...resto da linha}`), e o sucesso passa a ser
checado por `typeof result.id === "number"` em vez de `result.ok`. Afeta os
dois fluxos de criação de gerador (por série/patrimônio e por O.S.), já que
os dois chamam a mesma `criarGerador()`.

**Pendência para você**: as 4 linhas duplicadas continuam no banco (o bug
era só na mensagem de erro do front, os dados gravados estão corretos). Depois
que essa correção subir, recomendo excluir 3 das 4 pela própria tela (botão
"Excluir Gerador", que já fica registrado no Histórico) — sugiro manter a
mais recente (**id 492**) e excluir 489, 490 e 491.

### Não testado em navegador

`tsc --noEmit` e `vite build` rodam limpos. A causa raiz foi confirmada via
consulta direta no banco (as 4 linhas duplicadas provam que a RPC sempre
teve sucesso) e via `pg_get_function_result()` (confirma o tipo de retorno
real da função) — não precisei recriar o erro eu mesmo. Recomendo pedir pro
Douglas testar de novo assim que subir, só pra confirmar visualmente que a
mensagem de sucesso aparece agora.

---

## Novo — Cadastro manual de preditiva (pra geradores sem item nenhum)

**Motivado por dúvida real do Douglas**: ele tentou ver a aba "Preditiva" de
um gerador recém-cadastrado e viu a mensagem "nenhum item encontrado" — que
já é comportamento correto (itens de preditiva vêm de um processo externo de
importação/planilha, que "casa" equipamentos com a planilha; um gerador
cadastrado na hora pela tela ainda não passou por esse processo). Só que não
existia nenhum jeito de cadastrar isso manualmente enquanto isso não
acontece. Você decidiu: para geradores sem preditiva, dar a opção de
cadastrar os campos padrão manualmente.

**Correção que veio junto (importante)**: descobri, investigando isso, que a
RPC `salvar_preditiva` (usada ao editar data pelo lápis na tela) tinha
**exatamente o mesmo bug do `criar_gerador`** (ver correção acima) — ela já
existe de verdade no banco e retorna a linha (`preditivas_atg`), não
`{ok:...}`. Se eu não tivesse corrigido isso também, qualquer data que o
Douglas preenchesse manualmente nos itens novos pareceria salvar mas não
salvaria de verdade. Corrigido do mesmo jeito (`atgBackend.ts`,
`PreditivaTab.tsx`): sucesso reconhecido pela presença de um `id` na
resposta.

**O que foi implementado** (`src/components/Clientes/PreditivaTab.tsx`):
quando um gerador não tem nenhum item de preditiva, aparece um botão
**"Cadastrar itens padrão de preditiva"** logo abaixo do aviso. Ao clicar,
busca o catálogo fixo de itens em `preditiva_itens` (hoje são 7: Óleo e
Filtros, Bateria, Mangueira de Combustível, Limpeza do QTA, Mangueira de
Pré-Aquecimento, Limpeza do Radiador, Limpeza do Tanque) e insere uma linha
por item em `preditivas_atg`, vinculada ao gerador, com `data_realizada`
e `data_vencimento` em branco — prontas pra editar pelo mesmo lápis que já
existia. Marca `editado_manual = true` em cada linha, pra diferenciar de
uma linha que veio da importação de planilha de verdade.

**Sobre as colunas exclusivas da planilha** (`linha_planilha`,
`cliente_planilha`, `match_status`, etc.) — são obrigatórias na tabela
(`NOT NULL`) mas não fazem sentido pra um cadastro manual. Preenchi com
valores neutros só pra satisfazer a constraint: `linha_planilha = 0`,
`cliente_planilha` = razão social do cliente, `match_status` fica no valor
padrão da tabela (`sem_match`). Se você quiser um critério diferente pra
identificar essas linhas depois (num relatório, por exemplo), é só usar o
`editado_manual = true` — já dá pra filtrar por isso.

**Proteção contra duplicidade — resolvida direto no banco.** Em vez de
depender do processo externo de importação se comportar bem, adicionamos uma
constraint `UNIQUE` que torna duplicidade estruturalmente impossível,
não importa a origem (nosso botão, a importação de planilha, ou um clique
duplo):

```sql
alter table preditivas_atg
  add constraint preditivas_atg_gerador_item_unique unique (gerador_id, item_codigo);
```

**Confirmado ao vivo antes de aplicar** que não existia nenhuma duplicata
real (só havia várias linhas com `gerador_id = NULL` — linhas da planilha
que nunca foram casadas com nenhum cliente; `UNIQUE` no Postgres não
considera dois `NULL` como iguais, então isso nunca seria um problema).
Constraint já aplicada com sucesso.

Do lado do front, troquei o `insert()` em lote por um `upsert(...,
{onConflict: "gerador_id,item_codigo", ignoreDuplicates: true})` — assim, se
algum dos 7 itens já existir pra aquele gerador, só aquele item é ignorado
silenciosamente, em vez de a constraint derrubar o lote inteiro (um insert
comum falharia todo se um único item batesse na constraint).

**Efeito colateral pro processo externo de importação**: se ele tentar
inserir um item que já existe pra um gerador (porque foi cadastrado manual
por aqui, ou porque a planilha rodou duas vezes), a inserção dele vai falhar
com erro de constraint — a não ser que esse processo já use `ON CONFLICT`/
upsert também. Vale avisar quem mantém esse processo sobre a constraint nova.

### Não testado em navegador

`tsc --noEmit` e `vite build` rodam limpos. Não testei interativamente
(precisa de um gerador real sem preditiva pra testar, e a criação grava no
banco de verdade) — recomendo você mesmo testar num gerador de teste antes
de liberar pro Douglas, conferindo se os 7 itens aparecem e se o lápis
salva a data de verdade (o bug do `salvar_preditiva` era silencioso, então
vale essa conferência).

---

## Correção — erro ao salvar Oxicatalisador em gerador sem linha ainda

**Reportado pelo Douglas** (mesmo gerador STEMAC GTA testado antes, os 7
itens de preditiva salvaram normal): ao informar o diâmetro do
Oxicatalisador, veio o erro `null value in column "import_id" of relation
"oxicatalisador_atg" violates not-null constraint`.

**Causa**: `oxicatalisador_atg` tem exatamente a mesma estrutura de
`preditivas_atg` — colunas obrigatórias exclusivas da importação de planilha
(`import_id uuid not null`, `linha_planilha integer not null`,
`cliente_planilha text not null`, confirmado via `information_schema.columns`).
O código que salva o Oxicatalisador (`PreditivaTab.tsx`, escrito antes de
sabermos dessa estrutura) só preenchia `gerador_id`, `possui`, `bitola` — não
dava problema em geradores que já tinham uma linha (a planilha já tinha
preenchido essas colunas antes), só aparecia na primeira vez que alguém
tentava salvar o Oxicatalisador de um gerador sem nenhuma linha ainda
(exatamente o caso de um gerador recém-cadastrado manualmente).

**Correção**: `handleSaveOxi` agora preenche `import_id` (gerado na hora),
`linha_planilha = 0` e `cliente_planilha` (razão social do cliente) **só no
insert** (quando ainda não existe linha pra esse gerador) — no update, essas
colunas já têm valor de antes e não precisam ser reenviadas. De brinde,
passou a marcar `editado_manual = true` tanto no insert quanto no update,
já que é sempre uma edição feita por humano na tela, nunca pela importação.

### Não testado em navegador

`tsc --noEmit` e `vite build` rodam limpos. Recomendo pedir pro Douglas
testar de novo no mesmo gerador (STEMAC GTA) informando o diâmetro do
Oxicatalisador de novo, já que o erro anterior não chegou a gravar nada
(o insert falhou antes de qualquer coisa ser salva).

---

## Correção — data de preditiva aparecia um dia antes do digitado

**Reportado pelo Douglas**: digitava 02/03/2026 numa data de preditiva e,
depois de salvar, a tela mostrava 01/03/2026 — em todos os campos de data.

**Causa**: bug clássico de fuso horário do JavaScript, em `formatDate()`
(`src/utils/date.ts`), usado em várias telas. `data_realizada`/
`data_vencimento` são datas "puras" (tipo `date` do Postgres, sem hora) —
mas `formatDate()` fazia `new Date("2026-03-02")`, e o JavaScript interpreta
uma data sem hora como meia-noite UTC. Convertendo pra horário de Brasília
(UTC-3) pra extrair dia/mês/ano, o relógio volta pra 21h do dia anterior —
por isso sempre aparecia um dia a menos. **Era só um bug de exibição**: o
valor gravado no banco sempre esteve certo (o campo de input não passa pelo
`formatDate`, só a tabela de leitura), então não há nenhum dado pra corrigir
retroativamente.

**Correção**: `formatDate()` agora detecta strings no formato `YYYY-MM-DD`
(sem hora) e extrai dia/mês/ano direto da string, sem nenhuma conversão de
fuso. Datas com hora completa (ex: os registros do Histórico) continuam
formatando exatamente como antes.

### Não testado em navegador

`tsc --noEmit` e `vite build` rodam limpos.

---

### Não testado em navegador (ajustes 1-6 originais)

Rodei `tsc --noEmit` e `vite build` (ambos limpos), subi o dev server para
confirmar que a página inicial carrega sem erro de bundle, e validei o
comportamento de banco por trás dos itens 5/6 via curl (acima). Não fiz teste
interativo completo dos 6 fluxos no navegador porque não há login de teste
configurado no ambiente. Recomendo um teste manual passando por cada um dos 6
itens antes de liberar para o cliente.
