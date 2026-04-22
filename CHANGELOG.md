# CHANGELOG — Flux Insights

---

## [Unreleased] — 2026-04-22

### Segurança
- Removido `.env` do rastreamento Git (`git rm --cached`)
- `.gitignore` atualizado para ignorar `.env` e `.env.*`
- Criado `.env.example` como template seguro
- Chave JWT antiga revogada no Supabase (`disabled: true`)
- Novo par de publishable keys gerado e configurado

### Banco de Dados
- **RLS completamente reescrito:** 40+ policies duplicadas e abertas substituídas por 68 policies mínimas prefixadas `flux_`
- Regra: tabelas de configuração → `anon` só lê; tabelas de produção → `anon` nunca deleta
- RLS habilitado em 3 tabelas que estavam desprotegidas: `op_operator_sessions`, `op_summary`, `diario_de_maquina_eventos`
- Máquina `M.D.A` travada em `RUNNING` desde 26/02/2026 resetada para `AVAILABLE`
- Sessões de operador abertas há mais de 24h fechadas automaticamente

### Correções
- **Cronômetro quebrado:** adicionada validação — se tempo > 24h sem reset, exibe `--:--:--` em vez de "1313:31:57"
- `TempApp.txt` (69KB de código morto) movido para `_archive/`

### Branding
- Nome do produto padronizado para **"FLUX Insights"** em todos os arquivos ativos:
  - `components/Header.tsx`
  - `components/Preloader.tsx`
  - `components/modals/LabelModal.tsx`
  - `components/modals/PalletLabelModal.tsx`
  - `index.html`
  - `metadata.json`

### Dados de Demo
- Adicionadas 2 máquinas: Heidelberg CD 74 (M-2), Komori Lithrone S29 (M-3)
- Adicionadas 5 OPs realistas com status variado (15–22/abr/2026)
- Adicionados 15 registros de produção com qualidade 91–97%
- Adicionadas 8 paradas com motivos reais (refeição, limpeza, manutenção, troca de acetato)
- Checklist_eventos: 50 registros atualizados para datas dos últimos 7 dias

### Documentação
- `README.md` reescrito (estava com conteúdo de AI Studio / Gemini)
- `DIAGNOSTICO.md` criado com auditoria técnica completa
- `ERP_CONNECTOR_PLAN.md` criado com arquitetura do conector Metrics ERP
- `INFRA_UPGRADE.md` criado com checklist de migração para planos pagos
- `supabase/migrations/20260421_fix_rls_secure_policies.sql` adicionado
- `supabase/migrations/20260422_seed_demo_kingraf.sql` adicionado

### Região Supabase
- Confirmado: `sa-east-1` (São Paulo, Brasil) — sem violação LGPD ✅

---

## [0.1.0] — 2026-01-22

### Adicionado
- Painel do Operador com apontamento de produção e refugo
- Supervisão Operacional com cards de status em tempo real
- Dashboard Administrativo com métricas de OEE
- Sistema de checklists de qualidade
- Login por PIN para operadores
- Login email/senha para admin e supervisor
- Realtime via Supabase broadcast
- Export de etiquetas (LabelModal, PalletLabelModal)
- Sistema de paradas com tipos configuráveis
- Hooks: `useElapsedTimer`, `useOperatorSession`, `useFormatTime`
- RPC segura `validate_operator_pin` (PIN nunca exposto em query)
- 25 migrations de banco de dados
