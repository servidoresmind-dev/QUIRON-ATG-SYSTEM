# PRD — Integração Front-End com Supabase
**Versão:** 2.0 — Documento final para execução no Claude Code
**Contexto:** O front-end já está construído. O objetivo deste PRD é conectá-lo ao banco de dados Supabase real, corrigir o que estiver desalinhado com o projeto e garantir que todas as telas funcionem com dados reais.

---

## 1. Contexto do Projeto

Sistema web interno para gestão operacional de **Ordens de Serviço (O.S.)** e **Orçamentos** de manutenção de geradores. O front-end já existe com as seguintes telas implementadas (com dados mockados):

- `/login` — Tela de autenticação com dois perfis
- `/dashboard` — Painel operacional com KPIs e gráfico
- `/ordens-servico` — Listagem de O.S.
- `/orcamentos` — Listagem de Orçamentos
- `/clientes` — Gestão de clientes e geradores
- `/produtos` — Catálogo de produtos
- `/servicos` — Catálogo de serviços
- `/usuarios` — Gestão de usuários (somente Admin)
- `/configuracoes` — Configurações do sistema

**O que precisa ser feito agora:** substituir os mocks por integração real com o Supabase, ajustar o front onde necessário para se adaptar ao schema real das tabelas e garantir todos os fluxos de feedback (loading, erro, vazio, sucesso).

> O Claude Code tem autonomia para alterar componentes existentes do front-end caso seja necessário para alinhar com o projeto real.

---

## 2. Configuração do Cliente Supabase

Se ainda não existir, criar o arquivo `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Variáveis de ambiente necessárias no `.env`:
```
VITE_SUPABASE_URL=<url do projeto Supabase>
VITE_SUPABASE_ANON_KEY=<chave anon pública>
```

---

## 3. Schema Real das Tabelas (fonte da verdade)

### 3.1 `public.ordens_servico`
```sql
id             uuid        PK, default gen_random_uuid()
cod_os         varchar(20) NOT NULL, UNIQUE
cliente_id     uuid        NOT NULL (sem FK por ora — campo livre)
processada     boolean     NOT NULL, default false
orcamento_id   uuid        NULL → FK → orcamentos.id (on delete set null)
tipo_erro      varchar(100) NULL (obrigatório na lógica de app quando processada = false)
criado_em      timestamptz NOT NULL, default now()
atualizado_em  timestamptz NOT NULL, default now() (atualizado via trigger)
```

### 3.2 `public.orcamentos`
```sql
id              uuid        PK, default gen_random_uuid()
cod_orcamento   varchar(20) NOT NULL, UNIQUE
cliente_id      uuid        NOT NULL (sem FK por ora — campo livre)
processada      boolean     NOT NULL, default false
os_id           uuid        NULL → FK → ordens_servico.id (on delete set null)
criado_em       timestamptz NOT NULL, default now()
atualizado_em   timestamptz NOT NULL, default now() (atualizado via trigger)
```

### 3.3 `public."Produtos"` ⚠️ nome com maiúscula — usar aspas nas queries
```sql
id              bigint      PK (identity)
created_at      timestamptz NOT NULL, default now()
cod_produto     numeric     NULL
nome_produto    text        NULL
valor_unitario  numeric     NULL
categora_item   numeric     NULL  ← atenção: "categora" sem 'i' (typo no banco, não corrigir)
"CFOP"          numeric     NULL  ← nome com maiúscula, usar aspas
```

### 3.4 `public."Serviços"` ⚠️ nome com acento e maiúscula — usar aspas nas queries
```sql
id           bigint      PK (identity)
created_at   timestamptz NOT NULL, default now()
"nCodServ"   numeric     NULL  ← aspas obrigatórias
"cDescricao" text        NULL  ← aspas obrigatórias
"nValorDesc" numeric     NULL  ← aspas obrigatórias
```

> ⚠️ **Atenção crítica:** Os nomes de tabela `"Produtos"` e `"Serviços"` e os campos com maiúsculas/acentos DEVEM ser sempre referenciados entre aspas duplas nas queries Supabase (`.from('"Produtos"')`, `.select('"nCodServ"')`), senão o Postgres retorna erro de "relation does not exist".

---

## 4. Tipos TypeScript — atualizar `src/types.ts`

```ts
// Ordens de Serviço
export interface OrdemServico {
  id: string
  cod_os: string
  cliente_id: string
  processada: boolean
  orcamento_id: string | null
  tipo_erro: string | null
  criado_em: string
  atualizado_em: string
}

// Orçamentos
export interface Orcamento {
  id: string
  cod_orcamento: string
  cliente_id: string
  processada: boolean
  os_id: string | null
  criado_em: string
  atualizado_em: string
}

// Produto
export interface Produto {
  id: number
  created_at: string
  cod_produto: number | null
  nome_produto: string | null
  valor_unitario: number | null
  categora_item: number | null  // typo intencional — igual ao banco
  CFOP: number | null
}

// Serviço
export interface Servico {
  id: number
  created_at: string
  nCodServ: number | null
  cDescricao: string | null
  nValorDesc: number | null
}

// Usuário (auth mockado por ora)
export type PerfilUsuario = 'administrador' | 'usuario_comum'
export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: PerfilUsuario
  ativo: boolean
}
```

---

## 5. Telas — O que integrar em cada uma

### 5.1 Login (`/login`)
**Auth:** Usar Supabase Auth (`supabase.auth.signInWithPassword`).

Fluxo:
1. Usuário preenche e-mail + senha → clica em "Entrar".
2. Chamar `supabase.auth.signInWithPassword({ email, password })`.
3. Sucesso → redirecionar para `/dashboard`, armazenar sessão no contexto global.
4. Erro → toast vermelho: *"E-mail ou senha incorretos."* (nunca especificar qual campo está errado).

Perfis de acesso:
- Administrador: acesso total a todas as rotas.
- Usuário Comum: acesso a `/dashboard`, `/ordens-servico`, `/orcamentos`, `/clientes`, `/produtos`, `/servicos`. **Bloqueado em** `/usuarios`.

Implementar `PrivateRoute` que verifica sessão ativa do Supabase em todas as rotas. Se não autenticado → redireciona para `/login`.

Validações obrigatórias:
- Campo vazio → borda vermelha + *"Campo obrigatório"*
- Formato de e-mail inválido → *"E-mail inválido"*
- Loading no botão durante requisição (spinner + "Entrando...")

---

### 5.2 Dashboard (`/dashboard`)
**Fonte de dados:** `ordens_servico` + `orcamentos` (Supabase real).

Substituir todos os mocks pelos seguintes fetches reais:

**KPIs — calcular no período selecionado (filtro Hoje/Semana/Mês/Custom):**
```ts
// O.S. Processadas com Sucesso
supabase.from('ordens_servico')
  .select('id', { count: 'exact' })
  .eq('processada', true)
  .gte('criado_em', inicioPeriodo)
  .lte('criado_em', fimPeriodo)

// O.S. Não Processadas (Erros)
supabase.from('ordens_servico')
  .select('id', { count: 'exact' })
  .eq('processada', false)
  .gte('criado_em', inicioPeriodo)

// Orçamentos Criados
supabase.from('orcamentos')
  .select('id', { count: 'exact' })
  .gte('criado_em', inicioPeriodo)

// Orçamentos Enviados p/ Faturamento
supabase.from('orcamentos')
  .select('id', { count: 'exact' })
  .eq('processada', true)
  .gte('criado_em', inicioPeriodo)
```

**Gráfico de Volumetria:**
- Buscar O.S. do período agrupadas por data (`criado_em::date`).
- Série 1 (Processadas): `processada = true`
- Série 2 (Erros): `processada = false`
- Série 3 (Fluxo Normal): linha de tendência calculada no front.

**Atividade Recente:**
- Buscar últimas 6 movimentações unindo O.S. e Orçamentos ordenados por `criado_em DESC`.
- Exibir: código, tipo (badge "O.S." ou "ORÇAMENTO"), `cliente_id` (exibir o UUID até integração com tabela de clientes), status com bolinha colorida, `tipo_erro` em badge vermelha quando houver.

**Remoção obrigatória** (se ainda existir no front):
- Card VISA/PRO OPERADOR
- Card Crédito Bloqueado
- Card Previsão Financeira / Volume Projetado
- Bloco Equipe de Suporte com avatares
- Qualquer menção a meta, contrato, saldo ou validade

---

### 5.3 Ordens de Serviço (`/ordens-servico`)
**Fetch principal:**
```ts
supabase.from('ordens_servico')
  .select('*')
  .order('criado_em', { ascending: false })
```

Colunas da tabela: Código da O.S., Cliente (cliente_id por ora), Status, Tipo de Erro, Orçamento vinculado, Data de criação.

Filtros:
- Status: Todos / Processada / Com Erro
- Período: intervalo de `criado_em`
- Busca por `cod_os`

Regras de exibição:
- `processada = true` → badge verde "Processada"
- `processada = false` e `tipo_erro` preenchido → badge vermelha com o texto do erro
- `processada = false` e `tipo_erro` null → badge cinza "Pendente"

Ações:
- Clicar na linha → modal de detalhe com todos os campos
- Dentro do modal: botão para marcar como processada (atualiza `processada = true` e limpa `tipo_erro`)
- Exportar para Excel (SheetJS) respeitando filtros ativos

---

### 5.4 Orçamentos (`/orcamentos`)
**Fetch principal:**
```ts
supabase.from('orcamentos')
  .select('*')
  .order('criado_em', { ascending: false })
```

Colunas da tabela: Código do Orçamento, Cliente (cliente_id), Status, O.S. vinculada, Data de criação.

Filtros:
- Status: Todos / Faturado / Pendente
- Período
- Busca por `cod_orcamento`

Regras de exibição:
- `processada = true` → badge azul "Enviado p/ Faturamento"
- `processada = false` → badge amarela "Pendente"

Ações:
- Modal de detalhe com todos os campos
- Botão "Enviar para Faturamento" → atualiza `processada = true`
- Exportar para Excel

---

### 5.5 Clientes (`/clientes`)
**Status desta fase:** manter com dados mockados conforme combinado com Rafael. A tabela de clientes será criada posteriormente.

Não integrar com Supabase ainda. Manter o front existente funcional com os mocks.

---

### 5.6 Produtos (`/produtos`)
**Fetch principal:**
```ts
// ATENÇÃO: nome da tabela entre aspas duplas
supabase.from('"Produtos"')
  .select('id, cod_produto, nome_produto, valor_unitario, categora_item, "CFOP"')
  .order('nome_produto', { ascending: true })
```

Colunas da tabela: Código, Nome do Produto, Valor Unitário, Categoria, CFOP.

Regras de exibição:
- `valor_unitario = 0` ou `null` → exibir "Sob consulta" (não R$ 0,00)
- `categora_item = null` → badge neutra "Não informado"
- `CFOP = null` → badge neutra "Não informado"

Funcionalidades:
- Busca local por `nome_produto` (sem re-fetch)
- Filtro por `categora_item` (dropdown com valores únicos extraídos dos dados)
- Paginação: 20 itens por página
- Exportação Excel (SheetJS) com filtros ativos
- **Edição inline ou modal:** permitir editar `nome_produto`, `valor_unitario`, `categora_item`, `CFOP` via `supabase.from('"Produtos"').update(...).eq('id', id)`
- Toast de sucesso ao salvar, toast de erro em caso de falha

---

### 5.7 Serviços (`/servicos`)
**Fetch principal:**
```ts
// ATENÇÃO: nome da tabela e campos entre aspas duplas
supabase.from('"Serviços"')
  .select('id, "nCodServ", "cDescricao", "nValorDesc"')
  .order('"cDescricao"', { ascending: true })
```

Colunas da tabela: Código do Serviço (`nCodServ`), Descrição (`cDescricao`), Valor (`nValorDesc`).

Regras de exibição:
- `nValorDesc = 0` ou `null` → exibir "Sob consulta"

Funcionalidades:
- Busca local por `cDescricao`
- Paginação: 20 itens por página
- Exportação Excel (SheetJS)

---

### 5.8 Usuários (`/usuarios`) — somente Admin
**Auth:** rota protegida por perfil. Se usuário comum tentar acessar → redirecionar para `/dashboard` com toast: *"Acesso restrito a administradores."*

Nesta fase: manter gestão de usuários via Supabase Auth Dashboard ou mockada. Não é prioridade desta entrega — o importante é a proteção de rota funcionar.

---

### 5.9 Configurações (`/configuracoes`)
Manter tela existente sem integração por ora.

---

## 6. Padrões Globais de Feedback (aplicar em todas as telas)

| Situação | Comportamento |
|---|---|
| Carregando dados | Skeleton loader nas linhas/cards (nunca spinner de tela cheia) |
| Dados carregados | Renderizar normalmente |
| Nenhum resultado | Ilustração + texto: *"Nenhum registro encontrado para os filtros aplicados."* |
| Erro de API | Toast vermelho persistente + botão "Tentar novamente" que re-executa o fetch |
| Salvo com sucesso | Toast verde, auto-dismiss em 4s |
| Erro ao salvar | Toast vermelho, não some automaticamente |
| Ação destrutiva | Modal de confirmação antes de executar |
| Sair com alterações não salvas | Modal: *"Você tem alterações não salvas. Deseja sair mesmo assim?"* |

---

## 7. Prioridade de Execução

Seguir esta ordem para garantir entrega incremental testável:

1. **Configuração do Supabase client** (`src/lib/supabase.ts` + variáveis de ambiente)
2. **Autenticação** (login real com Supabase Auth + PrivateRoute em todas as rotas)
3. **Produtos e Serviços** (tabelas já populadas, integração mais simples, retorno rápido)
4. **Dashboard** (KPIs e gráfico com dados reais de O.S. e Orçamentos)
5. **Ordens de Serviço** (listagem, filtros, modal de detalhe, ação de processar)
6. **Orçamentos** (listagem, filtros, modal, ação de enviar para faturamento)
7. **Clientes** (manter mockado — integração na próxima fase)
8. **Testes de fluxo completo** (login → dashboard → O.S. → Orçamento → exportação Excel)

---

## 8. Restrições e Observações Finais

- **Não criar tabelas novas** no Supabase — trabalhar apenas com as que já existem.
- **Não alterar o schema do banco** — adaptar o front ao schema real.
- **Clientes permanecem mockados** nesta fase.
- O campo `cliente_id` em `ordens_servico` e `orcamentos` é um UUID sem FK por ora — exibir o valor bruto ou um placeholder até a tabela de clientes existir.
- O design system existente (paleta azul petróleo `#0B5577` / laranja `#F2701C` / taupe / Inter) deve ser mantido. Ajustes visuais só se necessários para alinhamento com o projeto real.
- RLS está desabilitado no banco (ambiente de desenvolvimento) — não configurar políticas agora.
