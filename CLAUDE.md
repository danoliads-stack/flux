# CLAUDE.md — FLUX Insights

> Carregado automaticamente em cada sessão. Mantenha conciso e prático.

## O que é

Sistema MES (Manufacturing Execution System) para gráficas e indústrias.
Em produção: **fluxinsights.com.br**. Repo: `danoliads-stack/flux` (branch `main`).

## Stack

- **Frontend**: React 19 + TypeScript + Vite SPA (NÃO é Next.js — não use prefixos `NEXT_PUBLIC_*`)
- **Styling**: Tailwind via npm/PostCSS (NÃO via CDN)
- **Backend**: Supabase (Postgres + Auth + Realtime)
  - Project ref: `baxtmikntcwqzdxbjjbk` (sa-east-1)
  - Env vars no Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Hosting**: Vercel (deploy automático no push pra `main`)

## Domínio (padrão MES)

A **MÁQUINA é o agregado central** — tem `op_atual_id`, `operador_atual_id`, `status_atual`. PCP atribui OP a uma máquina (`ordens_producao.maquina_id`). Operador faz login e seleciona uma máquina (não uma OP).

Hierarquia:
```
setor → maquinas (recurso permanente, com codigo UNIQUE)
              ├── op_atual_id      → ordens_producao  (UNIQUE INDEX no banco — 1 OP por máquina)
              ├── operador_atual_id → operadores
              └── status_atual     (CHECK: AVAILABLE, IN_USE, RUNNING, SETUP, STOPPED, IDLE, SUSPENDED, MAINTENANCE)

ordens_producao → maquina_id (PCP atribui)
                    ├── status (CHECK: PENDENTE, EM_ANDAMENTO, SUSPENSA, FINALIZADA, CANCELADA)
                    ├── posicao_sequencia (fila por máquina)
                    └── quantidade_meta / produzida / refugo

operadores → setor_id, turno_id, pin_hash (NUNCA pin texto puro — coluna foi dropada por segurança)

# Tabelas de fatos (apêndice imutável de eventos)
registros_producao  — apontamentos boa/refugo, idempotência via client_event_id
paradas             — interrupções, motivo NOT NULL, data_fim NULL = aberta
op_operator_sessions — quem trabalhou em qual OP (UNIQUE: 1 sessão aberta por op_id)
op_operadores       — LEGACY, não usar em código novo
```

## State machine do operador

`OPState`: `IDLE | AGUARDANDO | SETUP | PRODUCAO | PARADA | SUSPENSA | FINALIZADA | MANUTENCAO`

Mapeamento `OPState` ↔ `MachineStatus` está em `App.tsx` (handlers `handleStartProduction`, `handleResumeProduction`, etc).

Fluxo feliz: `IDLE → SETUP → PRODUCAO → (PARADA ↔ PRODUCAO)* → FINALIZADA → IDLE`.

## RPCs (todas em `public.`, SECURITY DEFINER)

| RPC | Quando usar |
|---|---|
| `validate_operator_pin(matricula, pin)` | Login de operador (matrícula + PIN bcrypt) |
| `mes_create_operator(nome, matricula, pin, setor_id, turno_id, avatar)` | Cadastro de operador (PIN é hasheado server-side) |
| `mes_update_operator_pin(operator_id, new_pin)` | Trocar PIN (gera novo hash) |
| `mes_start_setup(machine, op, operator)` | Operador inicia setup |
| `mes_start_production(machine, op, operator)` | SETUP → RUNNING |
| `mes_stop_machine(machine, reason, notes, operator, op)` | Cria parada (motivo OBRIGATÓRIO) |
| `mes_resume_machine(machine, next_status, operator, op)` | STOPPED → RUNNING/SETUP, fecha parada |
| `mes_finalize_op(...)` | Finaliza OP. **IGNORA `good`/`scrap` do cliente** — calcula da soma real de `registros_producao` (anti-fraude) |
| `mes_record_production(op, machine, operator, good, scrap, ..., client_event_id, tipo_refugo_id)` | Apontamento. Idempotente. Sincroniza `ordens_producao.quantidade_produzida`. |
| `mes_refresh_op_summary(op)` | Recalcula `op_summary` (BI) |
| `mes_switch_operator(op, operator, shift)` | Troca operador na OP + atualiza `maquinas.operador_atual_id` |

## Constraints / triggers no banco

- `maquinas_op_atual_unique` — uma OP só pode estar em 1 máquina (UNIQUE INDEX parcial)
- `maquinas_status_check` — só 8 valores válidos
- `maquinas_running_needs_op` — RUNNING/SETUP exige `op_atual_id NOT NULL`
- `ordens_producao_status_check` — só 5 valores válidos
- `trg_op_status_change` — OP vira CANCELADA/FINALIZADA → reseta máquina automaticamente

## Convenções de código

### UI / UX
- **NÃO usar `alert()` ou `confirm()` nativos.** Use:
  - `notify.success(msg)` / `notify.error(msg)` / `notify.warn(msg)` / `notify.info(msg)` — de `src/utils/notify`
  - `await confirmDialog({ message, danger?, confirmText?, cancelText? })` — de `src/utils/confirmDialog`
  - O componente `<FluxNotifications />` está montado em `App.tsx` (raiz). Listeners globais.
- Layout das páginas: `h-full flex flex-col overflow-hidden` no wrapper. Header com `shrink-0`, conteúdo `flex-1 min-h-0 overflow-y-auto custom-scrollbar`. Bottom nav usa `<div className="flex-1" />` como spacer pra ir pro rodapé.
- Cores: classes Tailwind do design system — `primary`, `secondary`, `danger`, `warning`, `surface-dark`, `border-dark`, `text-main-dark`, `text-sub-dark`. Definidas em `tailwind.config.js`.

### Código
- TypeScript strict. Nada de `any` implícito.
- `async`/`await` sempre. Erros tratados com try/catch + `logger.error`.
- Logger: `src/utils/logger.ts` (NÃO `console.log` em código novo).
- Estado global: Zustand em `src/store/useAppStore.ts`.
- Realtime: `src/utils/realtimeManager.ts`.
- Idempotência de apontamentos: SEMPRE passar `client_event_id` (UUID) em `mes_record_production`.

### Comentários
- Em **português**, mensagens de log também (facilita debug pro usuário).
- Nomes de funções/variáveis em **inglês**.

## Armadilhas conhecidas (não cair nelas de novo)

1. **Antes de dropar coluna**, verificar triggers que referenciam ela:
   ```sql
   SELECT trigger_name, action_statement FROM information_schema.triggers
   WHERE event_object_schema = 'public' AND event_object_table = '<tabela>';
   ```
   Já queimou uma vez — drop da coluna `pin` deixou trigger `trig_handle_operator_pin` zumbi.

2. **`gen_salt`/`crypt`** estão no schema `extensions`, não `public`. Em RPCs com `SECURITY DEFINER`, qualificar: `extensions.crypt(p_pin, extensions.gen_salt('bf'))`.

3. **`mes_record_production`** tem 10 argumentos. A versão de 8 args foi DROPADA — não recriar.

4. **OP lock**: existe defesa em 3 camadas:
   - Frontend: `handleStartProduction` checa máquinas RUNNING/SETUP com mesma OP (UX)
   - RPC: `mes_start_setup` checa via `op_in_use_on_machine`
   - Banco: `maquinas_op_atual_unique` UNIQUE INDEX (defesa final)

5. **Pasta `flux/`** dentro do repo é backup antigo — não editar, não comitar mudanças lá.

6. **Vercel env vars**: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` precisam estar marcadas pra **Production**. Não use prefixo `NEXT_PUBLIC_*` (não funciona com Vite).

## Documentação adicional

- `docs/test-plan-operator.md` — plano de teste do painel do operador (3 camadas + template de bug + relatório de auditoria de 2026-04-26 com 10 bugs encontrados e corrigidos)
- `supabase/migrations/` — histórico completo de migrations

## Comandos úteis

```bash
npm run dev          # dev server (port 3000)
npm run build        # build de produção (deploy automático no push)
npm run preview      # preview do build local
```

## Para próximas sessões

- Antes de mexer no banco, sempre rode `mcp__supabase__list_tables` ou queries do schema pra confirmar estado atual.
- Para reproduzir bugs: criar OP de teste com prefixo `TEST-` (sempre limpar no final via `DELETE WHERE codigo LIKE 'TEST-%'`).
- Quando aplicar migration, **sempre testar antes** com SQL que reproduz o cenário esperado.
