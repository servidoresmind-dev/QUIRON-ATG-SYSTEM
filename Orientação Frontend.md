# Orientação Frontend — SaaS Preditivas ATG (para Claude Code)

> Guia para construir o frontend. O backend (banco Supabase + 2 webhooks
> n8n) está sendo feito em paralelo. **Você pode construir tudo agora**
> usando os mocks de webhook descritos na seção 6 — quando os fluxos reais
> ficarem prontos, só troca a URL. Nenhum retrabalho.

---

## 1. O que é o sistema

Ferramenta interna onde a equipe da ATG revisa, corrige e valida cadastros
de geradores e suas manutenções preditivas. Cada **cliente** é um card.
Dentro do cliente ficam seus **geradores**. Cada gerador tem dois blocos de
dados: **preditiva** (manutenções + vencimentos) e **ficha de levantamento**
(dados técnicos do equipamento).

Auth: Supabase Auth já configurado. Controle de acesso por página já existe
(roles por usuário). Escrita passa pelo backend do SaaS, não direto do browser.

---

## 2. De onde ler os dados (Supabase)

| Tela | Fonte | Observação |
|---|---|---|
| Listagem de cards | view `vw_cliente_card` | 1 linha por cliente, já traz `estado` e contagens |
| Dados do cliente | tabela `omie_clientes` | por `id` |
| Geradores do cliente | tabela `geradores_atg` | filtrar `omie_cliente_id = cliente.id` |
| Preditiva do gerador | view `vw_preditivas` | filtrar `gerador_id`; já traz `status` calculado |
| Ficha do gerador | `geradores_atg.ficha_levantamento` (jsonb) | null = ainda não vinculada |
| Oxicatalisador | tabela `oxicatalisador_atg` | por `gerador_id` |

**Nunca** montar o card com N queries. A `vw_cliente_card` já entrega tudo
da listagem numa query. Detalhe (geradores, preditiva) carrega sob demanda
ao expandir.

---

## 3. Estados do card

Cada card tem um campo `estado` (vem pronto da view). Governa o selo e a ação:

| estado | selo | significado | ação disponível |
|---|---|---|---|
| `SEM_ICLASS` | 🔴 vermelho | cliente não existe no iClass | bloqueado: "cadastrar no iClass primeiro" |
| `SEM_GERADOR` | ⚪ cinza | tem iClass, nenhum gerador | botão "adicionar gerador" |
| `SEM_FICHA` | 🟡 amarelo | gerador sem ficha de levantamento | botão "vincular OS" |
| `COMPLETO` | 🟢 verde | tudo preenchido, falta validar | botão "conferido" |
| `VALIDADO` | ✅ verde+check | validado por humano | somente leitura (reabrível) |

---

## 4. Anatomia das telas

### 4.1 Listagem
Grid/lista de cards. Cada card colapsado:
```
┌─────────────────────────────────────────┐
│ RAZÃO SOCIAL                    [selo]   │
│ CNPJ: 00.000.000/0001-00                 │
│ 🔌 {n_geradores} gerador(es)  [expandir] │
└─────────────────────────────────────────┘
```
Busca por nome/CNPJ. Filtro por `estado` (mostrar só pendentes, etc).

### 4.2 Cliente expandido
Duas colunas:
- **Omie**: razão social, nome fantasia, CNPJ, código Omie
- **iClass**: iclass_id_encontrado, código do contrato, status_conferencia

Botões: **"conferido"** (valida o cliente → RPC, seção 5) e
**"ver geradores"** (expande seção 4.3) e **"adicionar gerador"** (fluxo C).

### 4.3 Gerador expandido
Cabeçalho do ativo (só leitura): descrição, fabricante, modelo, num_serie.
**`ativo_id` exibido como badge "ID iClass" — NUNCA editável** (usado nas
chamadas de API).

Abaixo, duas abas:

**Aba Preditiva** — tabela dos 7 itens (óleo, bateria, mangueira combustível,
QTA, mangueira pré-aquecimento, radiador, tanque). Colunas: item, data
realizada, data vencimento, status (badge colorido). Cada linha editável;
ao salvar → RPC `salvar_preditiva` (grava + loga). Oxicatalisador aparece
como linha especial (possui sim/não + bitola), sem datas.

**Aba Ficha** — se `ficha_levantamento` existe, renderiza por seções:
motor, bateria, filtros, gerador, alternador, mangueiras, controlador,
escapamento, bomba injetora (todos editáveis). Se null → CTA "vincular OS"
(fluxo B).

---

## 5. Ações que escrevem (via RPC do Supabase)

O backend vai expor 3 funções RPC. **Enquanto não existem, mocke o retorno.**
Todas gravam log automaticamente — o front não gerencia log.

| Ação | RPC | Parâmetros | Quando |
|---|---|---|---|
| Salvar preditiva | `salvar_preditiva` | `p_id, p_campos(jsonb), p_usuario` | botão salvar no item |
| Validar cadastro | `validar_cadastro` | `p_entidade('cliente'/'gerador'), p_id, p_usuario` | botão "conferido" |
| Criar gerador | `criar_gerador` | `p_omie_cliente_id, p_ativo_id, p_dados(jsonb), p_usuario` | fim do fluxo C |

Chamada RPC no Supabase: `POST /rest/v1/rpc/{nome}` com body dos parâmetros.

---

## 6. Webhooks n8n (os 2 fluxos do backend)

**Enquanto o backend não terminar, use estes contratos com respostas mockadas.**
As URLs reais serão preenchidas quando os fluxos ficarem prontos.

### 6.1 Webhook `buscar-ativo` — usado no fluxo C (adicionar gerador)
```
POST {{URL_BUSCAR_ATIVO}}
```
**Request (1ª tentativa — série):**
```json
{ "por": "serialNumber", "valor": "15049000" }
```
**Request (2ª tentativa — patrimônio, se a 1ª falhar):**
```json
{ "por": "patrimony", "valor": "15049000" }
```
**Response sucesso:**
```json
{
  "ok": true,
  "ativo_id": 117331023,
  "descricao": "GRUPO GERADOR - CRAMACO",
  "fabricante": "STEMAC",
  "modelo": "GR200",
  "status_ativo": "ATIVO"
}
```
**Response não encontrado:**
```json
{ "ok": false, "motivo": "nao_encontrado" }
```
**Response múltiplos (a API do iClass lista):**
```json
{ "ok": true, "multiplos": true, "opcoes": [ {"ativo_id":..., "descricao":...}, ... ] }
```
→ nesse caso o front mostra a lista para o usuário escolher.

### 6.2 Webhook `buscar-os` — usado no fluxo B (vincular ficha)
```
POST {{URL_BUSCAR_OS}}
```
**Request:**
```json
{ "ativo_id": 117331023, "codigo_os": "OS-12345" }
```
**Response sucesso:**
```json
{
  "ok": true,
  "codigo_os": "OS-12345",
  "checklist_pesquisa_id": 987,
  "ficha_levantamento": {
    "motor": { "modelo": "...", "num_serie": "...", "fabricante": "..." },
    "bateria": { "quantidade": "1", "capacidade_ah": "70 ah" },
    "filtros": { "...": "..." },
    "gerador": { "...": "..." },
    "alternador": { "...": "..." },
    "mangueiras": { "...": "..." },
    "controlador": { "...": "..." },
    "escapamento": { "...": "..." },
    "bomba_injetora": { "...": "..." }
  }
}
```
**Response erro:**
```json
{ "ok": false, "motivo": "os_nao_encontrada" }
```

---

## 7. Os três fluxos de trabalho

### Fluxo A — Validar cadastro (mais simples, faça primeiro)
Botão "conferido" no cliente e em cada gerador → RPC `validar_cadastro` →
selo vira VALIDADO. Reabrível (clicar de novo desvalida, com log).

### Fluxo B — Vincular ficha pela OS
1. Usuário digita o ID da OS, clica "buscar"
2. Spinner → POST `buscar-os`
3. Volta o checklist → renderiza para **conferência** (editável)
4. Usuário ajusta, clica "confirmar"
5. PATCH `geradores_atg`: grava `ficha_levantamento`,
   `codigo_os_ficha_levantamento`, `ficha_validada_por_humano=true`
6. Erro (OS não achada) → "OS não localizada, confira o ID", mantém o campo

### Fluxo C — Adicionar gerador (mais complexo, faça por último)
1. Botão "adicionar gerador" → pede **número de série**
2. POST `buscar-ativo` com `por:"serialNumber"` → spinner
3. **Sucesso** → mostra dados do ativo, segue para passo 6
4. **Falha** → novo box: "não encontrado por série, tente patrimônio" →
   pede patrimônio → POST `buscar-ativo` com `por:"patrimony"`
5. **Falha de novo** → "ativo não cadastrado no iClass. Cadastre lá primeiro."
   e **bloqueia** a criação
6. Com `ativo_id` em mãos → formulário do gerador → RPC `criar_gerador`
7. Após criar → oferece o Fluxo B (vincular ficha) para o novo gerador

**Regra dura:** não criar gerador sem `ativo_id` válido do iClass. O
`ativo_id` alimenta as APIs e nunca é digitado à mão.

---

## 8. Ordem de implementação sugerida

1. **Listagem** (`vw_cliente_card`) com selos e busca — valida a leitura.
2. **Cliente expandido + Fluxo A** (validar) — o mais simples, exercita RPC+log.
3. **Gerador expandido + aba Preditiva** editável (`vw_preditivas` + `salvar_preditiva`).
4. **Aba Ficha** (leitura do jsonb) + **Fluxo B** (webhook `buscar-os`).
5. **Fluxo C** (adicionar gerador, webhook `buscar-ativo`) — por último.

Enquanto o backend não entrega os webhooks e RPCs, todos os passos podem ser
construídos e testados com mocks (seções 5 e 6). A troca para as URLs/funções
reais é 1 linha por integração.

---

## 9. Checklist de segurança (antes de produção)
- Escrita nunca com a service key do Supabase no browser — passa pelo backend do SaaS.
- RLS revista: as policies atuais são provisórias (`authenticated using true`).
  Antes de produção, restringir escrita conforme os roles já existentes.
- Varredura de segurança geral antes do go-live.
