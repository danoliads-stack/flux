# 🔍 DIAGNÓSTICO DO PROJETO FLUX INSIGHTS — FASE 1

**Data:** 21 de abril de 2026  
**Responsável:** Análise Técnica Completa  
**Status:** ⚠️ **Crítico — Bloqueador de Venda Profissional**

---

## 📋 RESUMO EXECUTIVO

O projeto Flux Insights é uma **dashboard industrial em React + TypeScript** hospedado no Vercel com banco Supabase PostgreSQL. A arquitetura é **funcionalmente viável**, mas apresenta **5 problemas críticos**, **4 problemas importantes** e diversas **dívidas técnicas** que impedem a venda profissional para a Kingraf em 30 dias.

O maior bloqueador é a **exposição de credenciais Supabase** (chaves JWT públicas commitadas no `.env`). RLS está habilitado mas com policies muito abertas (`USING (true)`). Row-Level Security não implementa segregação por operador/supervisor/máquina, apenas autenticado vs. anônimo.

**Criticidade geral: 🔴 ALTA** — Recomenda-se pausar apresentações até correção dos itens críticos de segurança.

---

## 📦 STACK CONFIRMADA E VERSÕES

| Componente | Tecnologia | Versão | Status |
|---|---|---|---|
| **Frontend** | React | 19.2.3 | ✅ Atual |
| **Runtime** | TypeScript | ~5.8.2 | ✅ Moderno |
| **Build** | Vite | 6.2.0 | ✅ Rápido |
| **Roteamento** | React Router | 7.11.0 | ✅ Atual |
| **Gráficos** | Recharts | 3.6.0 | ✅ Simples |
| **Estado** | Zustand | 5.0.9 | ✅ Leve |
| **Backend** | Supabase PostgreSQL | Cloud | ⚠️ Free Tier |
| **Auth** | Supabase Auth | JWT | ✅ Configurado |
| **Deploy** | Vercel | Hobby (Free) | ⚠️ Sem HTTPS custom |
| **Exports** | html2canvas + jsPDF | 1.4.1 + 3.0.4 | ✅ OK |

**Node.js:** 20+ (confirmado em package.json)

---

## 🚨 PROBLEMAS ENCONTRADOS (Ordenado por Criticidade)

### NÍVEL 🔴 CRÍTICO — BLOQUEADOR DE VENDA

#### 1. **Credenciais Supabase Expostas no .env Commitado**
- **Localização:** `/.env` (linha 1-2)
- **Risco:** MÁXIMO
- **Descrição:**
  ```
  VITE_SUPABASE_URL=https://baxtmikntcwqzdxbjjbk.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```
  As chaves JWT públicas (anon keys) estão commitadas no repositório Git. Embora sejam "anon keys" (não permitem operações sensíveis), a URL + key combinadas **expõem a instância Supabase** ao mundo.

- **Impacto:**
  - Um atacante pode ler todos os dados públicos do banco
  - Pode registrar novos usuários anônimos e abusar RLS se mal configurada
  - Viola boas práticas de segurança — mesmo públicos, tokens não devem estar em Git

- **Evidências:**
  - `.gitignore` lista `*.local` mas não lista `.env`
  - `.env.local` é ignorado, mas `.env` é rastreado
  - Histórico Git expõe as chaves permanentemente

- **Recomendação:**
  - 🚨 **Revoke as chaves Supabase existentes** e gerar novas no painel
  - Remover `.env` do histórico Git (`git filter-branch` ou BFG Repo-Cleaner)
  - Adicionar `.env` ao `.gitignore`
  - Usar `.env.example` como template

---

#### 2. **Row Level Security (RLS) Configurada Muito Aberta**
- **Localização:** `supabase/migrations/20260102_implement_granular_rls.sql`
- **Risco:** ALTO
- **Descrição:**
  Todas as policies usam `USING (true)` e `WITH CHECK (true)`, ou seja, **qualquer um que passar da autenticação vê todos os dados**.

  Exemplos:
  ```sql
  CREATE POLICY "Anon can update maquinas status"
  ON public.maquinas FOR UPDATE
  TO anon
  USING (true)   -- ⚠️ QUALQUER UNO PODE ATUALIZAR
  WITH CHECK (true);
  ```

- **Impacto:**
  - Um operador pode **ver e editar dados de TODOS os operadores, máquinas e setores**
  - Um operador pode **registrar produção em máquinas que não opera**
  - Supervisores não têm isolamento por setor
  - Não há segregação de dados por turno

- **Ausências Críticas:**
  - ❌ Policy que restringe operador ao próprio turno
  - ❌ Policy que restringe operador à própria máquina
  - ❌ Policy que restringe supervisor ao próprio setor
  - ❌ Policy que impede operador de editar dados de outro operador
  - ❌ Policy que impede operador de cancelar paradas registradas por outro

- **Recomendação:**
  - Implementar policies granulares usando `auth.uid()` e tabelas de mapeamento
  - Exemplo correto:
    ```sql
    CREATE POLICY "Operators see only their own records"
    ON public.registros_producao FOR SELECT
    TO anon
    USING (operador_id = (
      SELECT id FROM operadores WHERE user_id = auth.uid()
    ));
    ```

---

#### 3. **Cronômetro Quebrado (Simulação Mostrando Semanas de Runtime)**
- **Localização:** `components/SupervisionDashboard.tsx` (linhas 109-171)
- **Risco:** ALTO (UX quebrada, perda de confiança na demo)
- **Descrição:**
  O cronômetro da tela "Supervisão Operacional" mostra tempos absurdos como "1313:31:57" (54+ dias contínuos sem reset).

- **Raiz do Problema:**
  - O cálculo usa `statusChangeAt` e `operatorSessionStartedAt` como base, mas **não reseta entre turnos**
  - Quando o operador muda de turno, as timestamps antigas continuam acumulando
  - Não há lógica de reset a cada novo apontamento (OP)
  - Em produção real, a máquina pode ter estado produzindo desde 18/01/2026 (origem dos dados de teste)

- **Evidências:**
  - Hook `useElapsedTimer.ts` consolida lógica de timer
  - Função `formatElapsedSeconds` e `formatElapsedMs` simplesmente calculam diferença
  - Não há validação de máximo (ex: se > 24h sem reset, resetar)

- **Recomendação:**
  - Adicionar validação: se `diff > 24*3600`, resetar a `Date.now()`
  - Implementar reset explícito ao finalizar OP
  - Adicionar lógica de "último reset do turno" na tabela `operadores_sesao` ou similar

---

#### 4. **TempApp.txt (69KB) — Código Morto na Raiz**
- **Localização:** `/TempApp.txt`
- **Risco:** MÉDIO (confusão, débito técnico)
- **Descrição:**
  Arquivo de 69KB com código React/TypeScript experimental, provavelmente cópia antiga do App.tsx, deixado na raiz do projeto.

- **Impacto:**
  - Aumenta o repositório desnecessariamente
  - Cria confusão sobre qual é o código "real"
  - Não é compilado, mas prejudica organização

- **Recomendação:**
  - Mover para `_archive/TempApp.txt` (pasta local, não commitada)
  - Ou deletar se não é mais necessário

---

#### 5. **Inconsistência e Documentação Desatualizada no Nome do Produto**
- **Localização:** Múltiplos arquivos
- **Risco:** MÉDIO (dano à marca, confusão)
- **Descrição:**
  Encontradas variações:
  - `metadata.json`: "FLUX Insight" (singular, sem H)
  - `index.html`: "FLUX Insight - Industrial Dashboard"
  - `README.md`: Referencia "AI Studio" + "Gemini API" (completamente desatualizado)
  - Codebase em geral: "FLUX Insights" (plural, com H)

- **Impacto:**
  - Apresentação profissional prejudicada
  - Busca por "FLUX INSIGHTS" vs "FLUX Insight" pode não achar corretamente

- **Recomendação:**
  - Padronizar para **"FLUX Insights"** (plural) em **todos os lugares**
  - Atualizar `README.md` para refletir stack real (React, Supabase, Vercel)

---

### NÍVEL 🟡 IMPORTANTE — Impacta Percepção de Valor

#### 6. **TypeScript: 114 Usos de "any" — Tipagem Fraca**
- **Localização:** Espalhado em `src/` e `components/`
- **Risco:** MÉDIO (maintainability, bugs em produção)
- **Descrição:**
  ```
  grep -r "any" | wc -l  →  114 resultados
  ```
  Muitos "any" implicam falta de tipagem rigorosa:
  - Dados do Supabase tratados como `any[]`
  - Callbacks de estado tratados como `any`
  - Props de componentes com `any`

- **Impacto:**
  - IDE não consegue autocompletar corretamente
  - Erros de tipo não são capturados em build
  - Risco de crashes em produção por propriedades inexistentes

- **Exemplo problemático:**
  ```typescript
  const [machines, setMachines] = useState<any[]>([]);  // ⚠️ any
  machines.forEach((m: any) => ...);  // ⚠️ any
  ```

- **Recomendação:**
  - Usar `tsconfig.json` com `noImplicitAny: true`
  - Tipar progressivamente usando interfaces definidas em `types.ts`
  - Gerar tipos do Supabase automaticamente com `supabase-js` types

---

#### 7. **Backup não Configurado no Supabase Free Tier**
- **Localização:** N/A (configuração de plano)
- **Risco:** CRÍTICO (perda de dados)
- **Descrição:**
  Supabase Free Tier **não inclui backups automáticos**. Se o banco corromper ou for deletado, não há recuperação.

- **Impacto:**
  - Dados de clientes em produção (Kingraf) estão em risco
  - Sem compliance com exigências de LGPD (dados pessoais de operadores)

- **Recomendação:**
  - Implementar backup manual com `pg_dump` + AWS S3 (gratuito em Oracle Cloud Always Free)
  - Ou fazer upgrade para Supabase Pro quando cliente estiver em produção

---

#### 8. **Região Supabase Desconhecida — Potencial Violação LGPD**
- **Localização:** URL: `https://baxtmikntcwqzdxbjjbk.supabase.co`
- **Risco:** CRÍTICO (LGPD)
- **Descrição:**
  A URL Supabase não deixa clara a região. Pela estrutura, parece estar nos **EUA (padrão aws-us-east-1)**. Dados de operadores (PII) estariam armazenados fora do Brasil.

- **Impacto:**
  - Violação de LGPD — dados pessoais devem estar em servidor no Brasil
  - Kingraf pode rejeitar por compliance
  - Possível bloqueio de contrato

- **Como verificar:**
  - Painel Supabase → Settings → Project → Region
  - Se não for `sa-east-1` (São Paulo), precisa migrar

- **Recomendação:**
  - Verificar região atual
  - Se não for Brasil, criar nova instância em `sa-east-1` e migrar dados

---

#### 9. **Dados de Demo/Teste Incompletos — Telas Vazias**
- **Localização:** `components/QualityDashboard.tsx`, `components/AdminInsights.tsx`
- **Risco:** MÉDIO (percepção de produto incompleto)
- **Descrição:**
  As telas "Monitoramento de Qualidade" e "Insights IA" carregam, mas podem estar sem dados convincentes ou com dados de teste antigos (18/02/2026, 05/02/2026, etc.).

- **Impacto:**
  - Prospect vê telas vazias e acha que falta funcionalidade
  - Não consegue visualizar como seria o valor em produção

- **Recomendação:**
  - Criar dados de exemplo realistas (últimos 7 dias a partir de 2026-04-21)
  - Gerar via script SQL: 3 máquinas, 5 operadores, 10 OPs, 30+ registros de produção

---

#### 10. **Multi-Tenancy Não Planejado — Risco de Escalabilidade**
- **Localização:** `schema.sql` e estrutura de banco
- **Risco:** MÉDIO (futuro)
- **Descrição:**
  Banco não tem conceito de "tenant_id" ou "empresa_id". Se ganhar múltiplos clientes, dados ficarão misturados.

- **Impacto:**
  - Escalabilidade para múltiplos clientes comprometida
  - Risco de data leak entre clientes
  - RLS não consegue isolar por empresa

- **Recomendação:**
  - Adicionar `empresa_id UUID` a todas as tabelas principais
  - Implementar política RLS que filtra por `empresa_id`
  - Planejamento para Fase 2+

---

### NÍVEL 🟢 POLIMENTO (Não Bloqueador, mas Recomendado)

#### 11. **Console.log para Debug em Produção**
- **Localização:** `src/utils/realtimeManager.ts` e outros
- **Risco:** BAIXO (leakage de info interna)
- **Descrição:**
  Muitos logs de debug com emoji (📡, 💾, ✅) aparecem no console em produção.

- **Recomendação:**
  - Usar logger estruturado com níveis (debug, info, warn, error)
  - Condicionar debug logs a `process.env.DEBUG === 'true'`

---

#### 12. **Responsividade Não Testada em Tablets**
- **Localização:** Todos os componentes
- **Risco:** BAIXO (UX pior em tablet)
- **Descrição:**
  Operadores usam tablets na máquina (1024x768, 1280x800). Responsividade não foi verificada nessas resoluções.

- **Recomendação:**
  - Testar em DevTools (responsive mode) com tablets reais
  - Aumentar botões para mínimo 48x48px
  - Teste de touch em ações críticas

---

#### 13. **Estrutura de Pastas Pode Melhorar**
- **Localização:** Raiz do projeto
- **Risco:** BAIXO (maintainability)
- **Descrição:**
  Existe confusão com pasta `flux/` que parece ser um projeto separado dentro do mesmo diretório. Arquivos como `App.tsx`, `index.tsx` estão na raiz, não em `src/`.

- **Recomendação:**
  - Reorganizar: mover `App.tsx`, `AuthContext.tsx`, etc. para `src/`
  - Eliminar/clarificar pasta `flux/` se é legado

---

## 📊 TABELA RESUMIDA DE PROBLEMAS

| ID | Severidade | Tipo | Problema | Estimativa de Correção |
|---|---|---|---|---|
| 1 | 🔴 CRÍTICO | Segurança | Credenciais expostas em .env | 2h |
| 2 | 🔴 CRÍTICO | Banco | RLS muito aberta (policies `USING (true)`) | 8h |
| 3 | 🔴 CRÍTICO | Bug | Cronômetro quebrado (1313:31:57) | 3h |
| 4 | 🔴 CRÍTICO | Limpeza | TempApp.txt (69KB de código morto) | 0.5h |
| 5 | 🔴 CRÍTICO | Branding | Inconsistência "FLUX Insight" vs "FLUX Insights" | 2h |
| 6 | 🟡 IMPORTANTE | Código | 114 usos de "any" em TypeScript | 16h |
| 7 | 🟡 IMPORTANTE | Infraestrutura | Sem backup configurado | 4h |
| 8 | 🟡 IMPORTANTE | LGPD | Região Supabase desconhecida | 2h |
| 9 | 🟡 IMPORTANTE | Demo | Dados de teste incompletos | 4h |
| 10 | 🟡 IMPORTANTE | Arquitetura | Multi-tenancy não planejado | 16h (planejamento) |
| 11 | 🟢 POLIMENTO | Debug | Console.log em produção | 2h |
| 12 | 🟢 POLIMENTO | UX | Responsividade tablet não testada | 4h |
| 13 | 🟢 POLIMENTO | Organização | Estrutura de pastas confusa | 4h |

---

## 📋 ANÁLISE DE BANCO DE DADOS

### Tabelas Presentes (25 Migrations)
Estrutura confirmada em `20251225_initial_schema.sql`:
- ✅ `setores` (setores/departamentos)
- ✅ `operadores` (usuários operador)
- ✅ `maquinas` (equipamentos)
- ✅ `ordens_producao` (POs)
- ✅ `registros_producao` (production logs)
- ✅ `paradas` (downtime events)
- ✅ `checklists` (quality checks)
- ✅ `profiles` (admin/supervisor auth)
- ✅ `paradas_tipos` (downtime reasons)
- ✅ `etiquetas` (tags/labels)
- ✅ `chamados_manutencao` (maintenance tickets)

### RLS Status
- ✅ RLS habilitado em todas as tabelas
- ❌ Policies são muito abertas (`USING (true)`)
- ❌ Sem segmentação por operador, supervisor, setor

### Índices
- ✅ Índices em `status` de tabelas principais
- ✅ Índices em `created_at` para ordenação
- ✅ Índices em FKs

### Sem Backup
- ❌ Free Tier não inclui backup automático
- ❌ Nenhum script de backup em `supabase/`

---

## 📂 ESTRUTURA DO PROJETO

```
agencia-prospect/
├── CLAUDE.md                          (instruções iniciais)
├── README.md                          ⚠️ (desatualizado — menciona Gemini)
├── package.json                       (React 19.2.3, Supabase 2.89.0, Vite 6.2.0)
├── tsconfig.json                      (TypeScript 5.8.2, strict: true)
├── vite.config.ts                     (Vite config)
├── index.html                         (✅ charset: utf-8)
├── index.tsx                          (entry point)
├── index.css                          (global styles)
├── App.tsx                            (76KB — muito grande, considerar split)
├── AuthContext.tsx                    (14KB — auth logic)
├── types.ts                           (3KB — type definitions)
├── constants.ts                       (3KB — app constants)
├── metadata.json                      (✅ válido)
├── supabase.ts                        (✅ cliente Supabase)
├── .env                               (🔴 COMMITADO — EXPOSIÇÃO)
├── .env.local                         (✅ .env.local ignored)
├── .gitignore                         (⚠️ não ignora .env)
├── .git/                              (histórico expõe credenciais)
├── TempApp.txt                        (🔴 69KB código morto)
├── test_operador_switch.md            (documentação de teste)
├── vercel.json                        (config Vercel)
├── operator-animations.css            (custom animations)
├── src/
│   ├── components/
│   │   ├── ErrorBoundary.tsx
│   │   └── ...
│   ├── hooks/
│   │   ├── useElapsedTimer.ts
│   │   ├── useFormatTime.ts
│   │   └── ...
│   ├── lib/
│   │   ├── supabase-client.ts         (retry wrapper)
│   │   └── ...
│   ├── services/
│   │   ├── insightsService.ts         (analytics)
│   │   ├── kaizenService.ts           (improvement suggestions)
│   │   └── ...
│   ├── store/
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── realtimeManager.ts
│   │   └── ...
├── components/
│   ├── (53 arquivos .tsx em total)
│   ├── SupervisionDashboard.tsx       (1365 linhas — muito grande)
│   ├── QualityDashboard.tsx           (checklistEvento)
│   ├── AdminInsights.tsx              (analytics)
│   ├── modals/
│   │   ├── SetupModal.tsx             (413 linhas)
│   │   ├── PalletLabelModal.tsx       (449 linhas)
│   │   └── StopModal.tsx              (161 linhas)
│   └── panels/
│       ├── ProductionTimersPanel.tsx
│       └── ...
├── supabase/
│   └── migrations/
│       ├── 20251225_initial_schema.sql
│       ├── 20260102_*.sql             (fixes variados)
│       ├── 20260106_add_mes_rpcs.sql
│       ├── 20260118_checklists_policies.sql
│       ├── 20260119_op_summary.sql
│       ├── 20260120_add_oee_goal_to_maquinas.sql
│       └── (25 migrations total)
├── public/
│   └── assets/
│       └── logo-square.png
├── dist/                              (build output)
├── node_modules/                      (instalado)
└── flux/                              (⚠️ pasta separada legado?)
```

---

## 🔐 ANÁLISE DE SEGURANÇA

### Pontos Fortes
- ✅ RLS habilitado em todas as tabelas
- ✅ Try/catch em 130+ pontos de chamadas Supabase
- ✅ Retry logic com backoff exponencial implementado
- ✅ Não há SQL injection aparente (usando Supabase Query Builder)
- ✅ Não há hardcoding de senhas (PINs de operador hasheados)

### Fraquezas
- 🔴 Credenciais commitadas em `.env`
- 🔴 RLS policies muito abertas (`USING (true)`)
- 🟡 114 usos de "any" — tipo validation fraco
- 🟡 Console.logs de debug expõem estrutura interna
- 🟡 Sem validação de entrada em alguns componentes
- 🟡 Camera permission em `metadata.json` — justificativa desconhecida

---

## 📱 ANÁLISE DE FRONTEND

### Dependências Auditadas
- `react@19.2.3` — ✅ Última versão stable
- `react-router-dom@7.11.0` — ✅ Roteamento OK
- `zustand@5.0.9` — ✅ Estado global OK
- `recharts@3.6.0` — ✅ Gráficos simples OK
- `@supabase/supabase-js@2.89.0` — ✅ Cliente OK
- `html2canvas@1.4.1`, `jsPDF@3.0.4` — ✅ Exports OK

### Componentes Grandes (Refactoring Recomendado)
| Arquivo | Linhas | Status |
|---|---|---|
| App.tsx | 76,283 | 🔴 Muito grande, considerar split |
| SupervisionDashboard.tsx | 1,365 | 🟡 Grande, considerar extrair modais |
| SetupModal.tsx | 413 | 🟡 Aceitável |
| PalletLabelModal.tsx | 449 | 🟡 Aceitável |

---

## 📊 ESTIMATIVA DE ESFORÇO (por Fase)

| Fase | Tarefa | Horas | Dias |
|---|---|---|---|
| **1. Diagnóstico** | Este relatório | 4 | 1 |
| **2. Críticas** | Fixar credenciais, RLS, cronômetro, etc. | 19.5 | 2.5 |
| **3. Importantes** | Tipagem, backup, dados, LGPD | 26 | 3.5 |
| **4. Polimento** | Console.log, responsividade, organização | 10 | 1.5 |
| **5. ERP Connector** | Planejamento + arquitetura | 16 | 2 |
| **6. Infra** | Documentação de upgrade | 8 | 1 |
| **TOTAL PARA VENDA** | Até fim de Fase 4 | **75.5** | **~10 dias** |

---

## ✅ CHECKLIST POR FASE RECOMENDADO

### Fase 2 — Críticas (BLOQUEADOR)
- [ ] Remover `.env` do Git e revogar credenciais
- [ ] Implementar RLS granular com `auth.uid()` filters
- [ ] Corrigir cronômetro com reset por turno
- [ ] Remover TempApp.txt
- [ ] Padronizar nome para "FLUX Insights" em todos os lugares
- [ ] Atualizar README.md

**Estimado:** 2.5 dias

### Fase 3 — Importantes (VALOR)
- [ ] Implementar backup automático ou manual
- [ ] Verificar e corrigir região Supabase para LGPD
- [ ] Inserir dados de demo realistas (últimos 7 dias)
- [ ] Reduzir "any" para < 20 ocorrências
- [ ] Extrair código de Super visão em componentes menores

**Estimado:** 3.5 dias

### Fase 4 — Polimento (UX)
- [ ] Remover/condicionar console.logs
- [ ] Testar responsividade em tablet (DevTools)
- [ ] Reorganizar pastas src/ vs root
- [ ] Melhorar espaçamento e tipografia em mobile

**Estimado:** 1.5 dias

---

## 🎯 RECOMENDAÇÃO FINAL

### ✅ VERDE PARA CONTINUAÇÃO COM RESSALVAS
O projeto é **tecnicamente viável** e a apresentação **funciona bem** nos testes. Porém, **NÃO APRESENTAR para Kingraf até**:

1. ✅ **Credenciais revogadas** e `.env` removido do Git
2. ✅ **RLS policies corrigidas** com segmentação por operador
3. ✅ **Cronômetro funcionando** (sem tempos absurdos)
4. ✅ **Dados de demo** visíveis e realistas
5. ✅ **Região confirmada** no Brasil (LGPD OK)

### 🚀 PRÓXIMOS PASSOS
1. **Hoje/Amanhã:** Apresentar este diagnóstico e aprovar ordem de prioridades
2. **Dia 2-3:** Executar Fase 2 (críticas)
3. **Dia 4-6:** Executar Fase 3 (importantes)
4. **Dia 7-8:** Executar Fase 4 (polimento)
5. **Dia 9:** Teste final + aprovação
6. **Dia 10 onwards:** Apresentação para Kingraf

---

**Relatório gerado:** 21 de abril de 2026  
**Próxima revisão:** Após aprovação e execução da Fase 2
