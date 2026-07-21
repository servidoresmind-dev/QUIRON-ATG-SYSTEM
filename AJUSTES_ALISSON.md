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

### Não testado em navegador

Rodei `tsc --noEmit` e `vite build` (ambos limpos), subi o dev server para
confirmar que a página inicial carrega sem erro de bundle, e validei o
comportamento de banco por trás dos itens 5/6 via curl (acima). Não fiz teste
interativo completo dos 6 fluxos no navegador porque não há login de teste
configurado no ambiente. Recomendo um teste manual passando por cada um dos 6
itens antes de liberar para o cliente.
