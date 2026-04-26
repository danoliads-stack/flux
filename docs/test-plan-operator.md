# 🧪 Plano de Teste — Painel do Operador (FLUX)

> Checklist estruturado pra testar o `OperatorDashboard` do início ao fim.
> Marque `[x]` em cada item conforme passar. Anote bugs no final do arquivo.

**Versão**: 1.0
**Data**: 2026-04-26
**Schema validado**: migration `schema_hardening_op_lock_and_status_check` aplicada

---

## 📋 Pré-requisitos (rodar UMA vez antes de tudo)

Antes de começar a Camada 1, garanta que existe pelo menos:

- [ ] **1 setor** cadastrado (ex: "Impressão")
- [ ] **1 turno** cadastrado (ex: "Manhã 06h-14h")
- [ ] **2 máquinas** no setor (precisa de 2 pra testar OP lock depois)
- [ ] **1 operador** com matrícula + PIN (lembre o PIN!)
- [ ] **1 OP** atribuída a uma das máquinas, status `PENDENTE`, qty `100`
- [ ] **1 tipo de parada** cadastrado (ex: "Quebra mecânica")
- [ ] **1 tipo de refugo** cadastrado (ex: "Defeito de impressão")
- [ ] **Login admin funcionando** (cadastrado e confirmado no Supabase)

> 💡 Se faltar algum item, cadastre via tela de admin antes de começar.

---

# 🎯 CAMADA 1 — Smoke Test (20-30 min)

> Objetivo: garantir que os fluxos principais não estão quebrados.
> Se algo aqui falhar, **pare e reporte** — não adianta seguir.

## 1.1 — Login do operador

- [ ] Acessar tela de login
- [ ] Ver os blobs animados (background) sem travar
- [ ] Trocar pra modo "Operador" (se não estiver)
- [ ] Digitar matrícula + PIN inválidos → ver erro `Matrícula ou PIN inválido`
- [ ] Digitar matrícula correta + PIN errado → ver erro
- [ ] Digitar matrícula + PIN corretos → entrar no painel

## 1.2 — Seleção de máquina

- [ ] Ver lista de máquinas do setor do operador
- [ ] Selecionar uma máquina
- [ ] Painel principal abre, sem erros no console (F12)
- [ ] Estado inicial mostra **IDLE** ou **AGUARDANDO** (se houver OP atribuída)
- [ ] Cabeçalho mostra: nome da máquina, hora atual, nome do operador, turno

## 1.3 — Setup → Produção

- [ ] Iniciar setup → estado muda pra **SETUP**
- [ ] Timer de setup começa a contar
- [ ] Finalizar setup → estado muda pra **PRODUCAO**
- [ ] Timer reseta e começa a contar produção
- [ ] No banco (Supabase Studio): `maquinas.status_atual = 'RUNNING'` e `op_atual_id` setado

## 1.4 — Apontamento de produção

- [ ] Apontar +50 unidades boas → contador da OP atualiza
- [ ] Apontar +2 refugos com motivo → contador de refugo atualiza
- [ ] Total apontado aparece no header/KPIs
- [ ] No banco: linhas em `registros_producao` com `op_id`, `maquina_id`, `operador_id` corretos

## 1.5 — Parada (motivo OBRIGATÓRIO)

- [ ] Abrir modal de parada
- [ ] Tentar confirmar **sem motivo** → botão "Confirmar" deve estar bloqueado/cinza
- [ ] Texto do botão deve dizer "Selecione um motivo" (ou similar)
- [ ] Selecionar um motivo → botão fica vermelho/habilitado
- [ ] Confirmar → estado vai pra **PARADA**
- [ ] Timer de parada começa a contar
- [ ] No banco: linha em `paradas` com `data_fim IS NULL`, `motivo` preenchido

## 1.6 — Retomada

- [ ] Retomar produção → volta pra **PRODUCAO**
- [ ] Timer de parada para
- [ ] Tempo de parada acumulado fica salvo
- [ ] No banco: a linha em `paradas` agora tem `data_fim` preenchido

## 1.7 — Finalização da OP

- [ ] Finalizar OP → estado muda pra **FINALIZADA** (ou volta pra IDLE)
- [ ] No banco: `ordens_producao.status = 'FINALIZADA'` e `maquinas.op_atual_id = NULL`
- [ ] Tempos totais (`tempo_producao_segundos`, `tempo_setup_segundos`, `tempo_parada_segundos`) preenchidos

## 1.8 — Bottom navigation (4 painéis)

- [ ] **Fila OP**: abre, mostra próximas OPs, fecha
- [ ] **Checklists**: abre, marca/desmarca um item, fecha → reabre e checa se persistiu
- [ ] **Diário de bordo**: abre, escreve uma anotação, salva, fecha → reabre e confere
- [ ] **Manutenção**: abre, solicita uma manutenção (descrição), confere se aparece no painel de manutenção
- [ ] Bottom nav está **fixado no rodapé** (não flutuando no meio)
- [ ] Estado dos botões muda quando ativo (cor diferente)

## 1.9 — Logout

- [ ] Fazer logout
- [ ] Volta pra tela de login
- [ ] No banco: `maquinas.operador_atual_id = NULL` (se for o caso)
- [ ] localStorage não tem mais `flux_operator_session_v1`

---

# 🔬 CAMADA 2 — Cenários estruturados (1-2h)

> Rode SÓ se a Camada 1 passou inteira.

## 2.1 — Recuperação de estado (F5)

Em CADA estado abaixo, aperte **F5** e veja se o estado é recuperado:

- [ ] Em **SETUP**: F5 → volta pra SETUP, timer continua de onde parou
- [ ] Em **PRODUCAO**: F5 → volta pra PRODUCAO, timer continua
- [ ] Em **PARADA**: F5 → volta pra PARADA, motivo preservado
- [ ] Em **AGUARDANDO**: F5 → volta pra AGUARDANDO
- [ ] Fechar navegador inteiro → reabrir → mesmo comportamento

## 2.2 — OP lock (CRÍTICO — schema agora protege)

- [ ] Operador A na máquina M-01 inicia OP-555 (estado RUNNING)
- [ ] Em outra aba/janela anônima, login com operador B na máquina M-02
- [ ] Operador B tenta iniciar a mesma OP-555
- [ ] ✅ Esperado: alert "Esta OP já está sendo produzida na máquina X"
- [ ] ✅ Banco rejeita mesmo se o cliente burlar (UNIQUE INDEX `maquinas_op_atual_unique`)

## 2.3 — Múltiplas abas / sessões

- [ ] Abrir 2 abas com o mesmo operador → produção em uma reflete na outra (realtime)
- [ ] Logout em uma aba → outra aba também desloga? (ou fica zumbi?)

## 2.4 — Realtime (Supabase subscriptions)

- [ ] Operador na máquina M-01 em PRODUCAO
- [ ] Em outra aba (admin), cancelar a OP via banco direto
- [ ] Operador vê a mudança em tempo real OU precisa F5?

## 2.5 — Validações de input

- [ ] Apontar produção **negativa** ou **zero** → bloqueia?
- [ ] Refugo **maior** que produção boa → permite? deveria avisar?
- [ ] Apontar quantidade que estoura a meta da OP → o que acontece?
- [ ] Tentar finalizar OP **sem ter atingido a meta** → confirma ou bloqueia?

## 2.6 — Checklists obrigatórios

- [ ] Cadastrar checklist obrigatório com vencimento "agora"
- [ ] Dot vermelho aparece no botão "Checklists"?
- [ ] Marcar todos os itens → dot some?
- [ ] Pular checklist obrigatório e tentar iniciar produção → bloqueia?

---

# 🔥 CAMADA 3 — Stress / Edge cases (2-4h)

> Rode quando Camada 2 passou. Foco em condições reais de fábrica.

## 3.1 — Conexão / offline

- [ ] Iniciar produção → desconectar internet → apontar produção offline
- [ ] Reconectar → apontamentos sobem? Ou se perdem?
- [ ] Fechar aba durante setup → reabrir → estado consistente?

## 3.2 — Tempo

- [ ] Deixar em PARADA por 1h → timer continua somando?
- [ ] Bater fim do turno (configurar turno até hora atual + 5min, esperar) → sistema faz transição?
- [ ] Vira meia-noite → algum bug de data?

## 3.3 — Dados sujos

- [ ] OP com `quantidade_meta = 0` (vazio)
- [ ] OP sem máquina associada (`maquina_id = NULL`)
- [ ] Máquina sem setor
- [ ] Operador sem turno
- [ ] Pra cada um: o painel quebra com erro? mostra mensagem amigável?

## 3.4 — Carga

- [ ] Cadastrar 50 OPs na fila → fila renderiza tudo? scrolla bem?
- [ ] 1000 apontamentos numa OP → histórico carrega rápido (< 3s)?

## 3.5 — Concorrência (depois do schema hardening)

- [ ] Operador A inicia OP, Operador B (em paralelo) tenta finalizar — race condition?
- [ ] 2 operadores apontando produção simultaneamente na mesma OP → conta certo?

---

# 🐞 Template de bug report

Quando achar um bug, copie pra seção `## Bugs encontrados` no final deste arquivo:

```markdown
### [BUG-XXX] Título curto e descritivo
- **Severidade**: 🔴 crítico / 🟡 médio / 🟢 cosmético
- **Camada**: 1 / 2 / 3
- **Onde**: ex. OperatorDashboard / modal de parada / bottom nav
- **Estado da máquina**: SETUP / PRODUCAO / PARADA / etc
- **Passos pra reproduzir**:
  1. ...
  2. ...
  3. ...
- **Esperado**: o que deveria acontecer
- **Atual**: o que aconteceu
- **Console (F12)**: <colar erro ou print>
- **Browser/device**: Chrome 130 desktop / iPhone 15 Safari / etc
- **Screenshot**: <caminho ou anexo>
```

---

# 📊 Bugs encontrados

> Use o template acima. Numere sequencialmente: BUG-001, BUG-002, etc.

---

## 🤖 Auditoria automatizada (Claude — 2026-04-26)

**Método**: análise estática do código + simulação de cada RPC via SQL no banco real.
**Escopo**: `OperatorDashboard.tsx`, `App.tsx`, todas as RPCs `mes_*` e `validate_operator_pin`.

---

### [BUG-001] mes_record_production NÃO atualiza `ordens_producao.quantidade_produzida`

- **Severidade**: 🔴 CRÍTICO
- **Camada**: 1 (afeta toda apontamento de produção)
- **Onde**: RPC `mes_record_production` (versão de 10 args, a usada pelo frontend)
- **Repro SQL**:
  ```sql
  -- Após chamar mes_record_production(...) com 30 boas e 2 refugo:
  SELECT quantidade_produzida FROM ordens_producao WHERE id = '<op_id>';
  -- Retorna: 0
  SELECT SUM(quantidade_boa) FROM registros_producao WHERE op_id = '<op_id>';
  -- Retorna: 30
  ```
- **Esperado**: `ordens_producao.quantidade_produzida` reflete a soma dos apontamentos
- **Atual**: fica em 0 durante toda a produção. Só `op_summary` é atualizada.
- **Impacto**: queries de admin/relatórios que leem `ordens_producao.quantidade_produzida` mostram 0 para OPs ativas. Inconsistente com o que o operador vê.
- **Fix sugerido**: a v2 do RPC deveria, além de chamar `mes_refresh_op_summary`, atualizar `ordens_producao` igual a v1 fazia. OU remover a coluna `quantidade_produzida` de `ordens_producao` (deixar só em `op_summary`).

---

### [BUG-002] mes_finalize_op aceita qualquer quantidade do cliente (sem validar)

- **Severidade**: 🔴 CRÍTICO
- **Camada**: 1
- **Onde**: RPC `mes_finalize_op`
- **Repro SQL**:
  ```sql
  -- Apontamentos reais somam 70 boas, 3 refugo
  SELECT mes_finalize_op('<machine>', '<op>', '<op>', 9999, 0, 60, 300, 52);
  SELECT quantidade_produzida FROM ordens_producao WHERE id = '<op>';
  -- Retorna: 9999  (cliente mentiu, banco aceitou)
  ```
- **Esperado**: validar contra a soma real de `registros_producao.quantidade_boa`
- **Atual**: sobrescreve com qualquer valor passado pelo cliente
- **Impacto**: bug do cliente OU má-fé do operador destrói histórico de produção. Um `good=0` bug zera tudo.
- **Fix sugerido**: `mes_finalize_op` deve calcular `quantidade_produzida` a partir de `registros_producao` (igual `op_summary` faz), ignorando os parâmetros `p_good_qty` / `p_scrap_qty` ou usando-os apenas como sanity check.

---

### [BUG-003] STOPPED → SETUP deixa parada órfã (tempo distorcido)

- **Severidade**: 🔴 CRÍTICO (afeta OEE)
- **Camada**: 2
- **Onde**: RPC `mes_start_setup` + handler do app
- **Repro SQL**:
  ```sql
  SELECT mes_stop_machine(<m1>, 'Quebra', null, <op>, <op>);
  -- ...tempo passa...
  SELECT mes_start_setup(<m1>, <op>, <op>);
  -- Maquina vai pra SETUP MAS a parada anterior continua aberta:
  SELECT COUNT(*) FROM paradas WHERE maquina_id = <m1> AND data_fim IS NULL;
  -- Retorna: 1 (deveria ser 0)
  ```
- **Esperado**: ao iniciar setup, a parada aberta deve ser fechada
- **Atual**: parada fica aberta. Quando o operador inicia produção depois, `mes_resume_machine` fecha a parada com `data_fim = NOW()`, **incluindo o tempo de SETUP no tempo de PARADA**.
- **Impacto**: OEE/relatórios contam tempo de SETUP como PARADA. Indicadores ficam distorcidos.
- **Fix sugerido**: `mes_start_setup` deve fechar paradas abertas da mesma máquina (`UPDATE paradas SET data_fim = NOW() WHERE maquina_id = p_machine_id AND data_fim IS NULL`).

---

### [BUG-004] PIN texto puro como fallback de auth (vazamento de credencial)

- **Severidade**: 🔴 CRÍTICO (segurança)
- **Camada**: 1 (auth)
- **Onde**: `validate_operator_pin`
- **Trecho do código**:
  ```sql
  WHERE o.matricula = p_matricula AND o.ativo = true
    AND (
      (o.pin_hash IS NOT NULL AND o.pin_hash = crypt(p_pin, o.pin_hash))
      OR
      (o.pin IS NOT NULL AND o.pin = p_pin)  -- ❌ FALLBACK PLAINTEXT
    );
  ```
- **Esperado**: usar apenas `pin_hash`. Coluna `pin` não deveria existir.
- **Atual**: PIN em texto puro funciona como auth secundário
- **Impacto**: dump de DB ou leak da tabela `operadores` expõe TODOS os PINs de operadores
- **Fix sugerido**:
  1. Confirmar que todo operador ativo tem `pin_hash`
  2. Remover o `OR (o.pin = p_pin)` da função
  3. `ALTER TABLE operadores DROP COLUMN pin`

---

### [BUG-005] mes_record_production tem 2 versões (overload duplicado)

- **Severidade**: 🟡 MÉDIO
- **Onde**: banco — função existe em 2 assinaturas (8 args e 10 args)
- **Detalhes**:
  - v1 (8 args): atualiza `ordens_producao.quantidade_produzida` inline, sem idempotência
  - v2 (10 args): com idempotência via `client_event_id`, mas **não** atualiza `ordens_producao` (BUG-001)
- **Atual**: todos os 9 callsites do frontend usam v2 (10 args). v1 é dead code.
- **Risco**: alguém escrever novo código com 8 args pega comportamento diferente sem perceber
- **Fix sugerido**: `DROP FUNCTION mes_record_production(uuid,uuid,uuid,int,int,timestamptz,timestamptz,text)` (a versão de 8 args)

---

### [BUG-006] Cancelar OP em produção deixa máquina em estado inconsistente

- **Severidade**: 🟡 MÉDIO
- **Camada**: 2 (admin x operador)
- **Repro SQL**:
  ```sql
  -- M-1 está RUNNING com OP-X
  UPDATE ordens_producao SET status = 'CANCELADA' WHERE id = <op-x>;
  SELECT m.status_atual, o.status FROM maquinas m JOIN ordens_producao o ON o.id = m.op_atual_id WHERE m.codigo = 'M-1';
  -- Retorna: status_atual=RUNNING, status=CANCELADA  (estado inconsistente)
  ```
- **Esperado**: cancelar OP que está em uma máquina deveria:
  1. Bloquear (RAISE EXCEPTION) **OU**
  2. Automaticamente colocar a máquina em `AVAILABLE` e zerar `op_atual_id`
- **Atual**: máquina fica zumbi
- **Fix sugerido**: trigger BEFORE UPDATE em `ordens_producao` que verifica se a OP está em alguma máquina ativa. Se sim, faz reset da máquina junto.

---

### [BUG-007] Insert direto em `op_operadores` + `mes_switch_operator` (duplicação)

- **Severidade**: 🟡 MÉDIO (tech debt)
- **Onde**: `App.tsx` linha ~1430 (handler do SetupModal)
- **Detalhes**:
  - Insere em `op_operadores` (tabela legada)
  - Logo depois chama `mes_switch_operator` que insere em `op_operator_sessions`
  - As duas tabelas agora têm dados redundantes mas não-sincronizados
- **Fix sugerido**: remover o insert direto em `op_operadores`, usar só a RPC. Depois migrar dados antigos e dropar `op_operadores`.

---

### [BUG-008] mes_switch_operator não atualiza `maquinas.operador_atual_id`

- **Severidade**: 🟡 MÉDIO
- **Onde**: RPC `mes_switch_operator`
- **Detalhes**: ao trocar operador na OP (ex: troca de turno), só fecha sessão antiga e abre nova. **Não atualiza `maquinas.operador_atual_id`**. Resultado: máquina mostra operador antigo no painel até alguém forçar update.
- **Fix sugerido**: dentro do `mes_switch_operator`, adicionar `UPDATE maquinas SET operador_atual_id = p_operator_id WHERE op_atual_id = p_op_id`.

---

### [BUG-009] Client-side OP lock só checa status='RUNNING'

- **Severidade**: 🟡 MÉDIO (UX)
- **Onde**: `App.tsx` linha 1057 (`handleStartProduction`)
- **Detalhes**: a query check só busca máquinas em RUNNING com a mesma OP. Se outra máquina estiver em SETUP com a mesma OP, não detecta. O UNIQUE INDEX que aplicamos na migration anterior protege o banco, mas a mensagem amigável não aparece.
- **Fix sugerido**: usar `.in('status_atual', ['RUNNING', 'SETUP'])` no client check.

---

### [BUG-010] mes_finalize_op aceita finalizar com `op_atual_id IS NULL`

- **Severidade**: 🟡 MÉDIO
- **Onde**: RPC `mes_finalize_op`
- **Detalhes**: o check é `IF v_machine.op_atual_id IS NOT NULL AND v_machine.op_atual_id <> p_op_id` — só rejeita se houver mismatch. Se a máquina não tem OP (`op_atual_id IS NULL`), aceita "finalizar" qualquer OP.
- **Fix sugerido**: mudar para `IF v_machine.op_atual_id IS NULL OR v_machine.op_atual_id <> p_op_id`.

---

## ✅ O que PASSOU (auditoria + simulação)

- ✅ Idempotência de `mes_record_production` v2 — chamadas duplicadas com mesmo `client_event_id` não duplicam registro
- ✅ OP lock no UNIQUE INDEX — bypass via UPDATE direto é bloqueado pelo banco
- ✅ OP lock na RPC `mes_start_setup` — bloqueia setup em 2 máquinas com mesma OP
- ✅ `mes_start_production` checa parada aberta — não permite iniciar com parada pendente
- ✅ `mes_stop_machine` valida que não há parada já aberta — não cria parada duplicada
- ✅ Schema constraints aplicadas (CHECK status, RUNNING precisa OP, OP única por máquina)

---

## 🔥 Plano de fix sugerido (ordem)

| # | Bug | Tipo de fix | Esforço |
|---|---|---|---|
| 1 | BUG-001 | Migration: ajustar v2 do `mes_record_production` | 5 min |
| 2 | BUG-003 | Migration: `mes_start_setup` fecha parada aberta | 5 min |
| 3 | BUG-002 | Migration: `mes_finalize_op` calcula a partir de `registros_producao` | 10 min |
| 4 | BUG-005 | Migration: drop v1 de `mes_record_production` | 1 min |
| 5 | BUG-004 | Migration: dropar fallback PIN texto puro + drop column | 5 min |
| 6 | BUG-008 | Migration: `mes_switch_operator` atualiza `maquinas.operador_atual_id` | 3 min |
| 7 | BUG-010 | Migration: ajustar check em `mes_finalize_op` | 2 min |
| 8 | BUG-006 | Migration: trigger pra cancelar OP resetar máquina | 10 min |
| 9 | BUG-009 | Edit no `App.tsx` | 2 min |
| 10 | BUG-007 | Refactor: remover insert direto em `op_operadores` | 5 min |

**Total estimado**: ~50 min pra ter o painel do operador robusto.

---

## 🛠️ Fixes aplicados (2026-04-26)

Todos os 10 bugs foram corrigidos. 3 migrations aplicadas + 2 fixes no `App.tsx`:

| # | Bug | Fix aplicado | Validação |
|---|---|---|---|
| 001 | quantidade_produzida fora de sync | Migration `fix_pack_1_rpc_hardening` | ✅ Simulado: 30 boas → ordens_producao mostra 30 |
| 002 | finalize aceita qualquer qtd | Migration: `mes_finalize_op` calcula soma real | ✅ Simulado: passei 9999, gravou 70 (real) |
| 003 | STOPPED → SETUP deixa parada órfã | Migration: `mes_start_setup` fecha paradas | ✅ Simulado: parada fechou ao iniciar setup |
| 004 | PIN texto puro como auth fallback | Migration `fix_pack_2_pin_security` | ✅ Coluna `pin` dropada, função sem fallback |
| 005 | 2 versões de mes_record_production | Migration: drop versão 8-args | ✅ Só v2 existe agora |
| 006 | Cancel OP deixa máquina zumbi | Migration `fix_pack_3_op_cancel_trigger` | ✅ Simulado: cancelei OP, máquina virou AVAILABLE |
| 007 | Insert duplicado op_operadores | Edit em `App.tsx` (2 lugares) | ✅ Removido |
| 008 | switch_operator não atualiza máquina | Migration: switch_operator atualiza maquinas | ✅ Adicionado UPDATE no fim da função |
| 009 | client lock só checa RUNNING | Edit em `App.tsx` linha 1057 | ✅ Agora `.in([RUNNING, SETUP])` |
| 010 | finalize aceita op_atual_id NULL | Migration: rejeita IS NULL | ✅ Check estrito |

**Migrations aplicadas no Supabase** (em ordem):
1. `20260426_schema_hardening_op_lock_and_status_check`
2. `20260426_fix_pack_1_rpc_hardening`
3. `20260426_fix_pack_2_pin_security`
4. `20260426_fix_pack_3_op_cancel_trigger`

---

# ✅ Resumo de execução

| Camada | Status | Bugs | Data |
|---|---|---|---|
| Pré-requisitos | ⬜ | — | — |
| Camada 1 — Smoke | ⬜ | — | — |
| Camada 2 — Cenários | ⬜ | — | — |
| Camada 3 — Stress | ⬜ | — | — |

> Legenda: ⬜ não iniciado / 🟡 em andamento / ✅ passou / ❌ falhou
