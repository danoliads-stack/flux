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

<!-- Cole os bugs aqui -->

---

# ✅ Resumo de execução

| Camada | Status | Bugs | Data |
|---|---|---|---|
| Pré-requisitos | ⬜ | — | — |
| Camada 1 — Smoke | ⬜ | — | — |
| Camada 2 — Cenários | ⬜ | — | — |
| Camada 3 — Stress | ⬜ | — | — |

> Legenda: ⬜ não iniciado / 🟡 em andamento / ✅ passou / ❌ falhou
