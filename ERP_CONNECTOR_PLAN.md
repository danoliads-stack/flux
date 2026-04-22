# ERP Connector — Plano de Arquitetura

**Objetivo:** Ler dados do Metrics ERP (ePS Software) em tempo real e sincronizar com o Flux Insights, sem substituir o ERP — apenas agregar visualização e OEE.

> ⚠️ Este documento é planejamento. Não implementar até aprovação do cliente (pós-piloto Kingraf).

---

## Visão Geral

```
┌─────────────────────┐        ┌──────────────────────┐        ┌───────────────────┐
│   Metrics ERP       │  SQL   │   Flux Connector     │ HTTPS  │  Supabase         │
│   (SQL Server)      │──────▶ │   (Agente Local)     │──────▶ │  (Flux Insights)  │
│   iQuote / Planner  │ SELECT │   Node.js / Windows  │  API   │  PostgreSQL       │
│   Jobtrack Auto     │  only  │   Service            │        │  sa-east-1        │
└─────────────────────┘        └──────────────────────┘        └───────────────────┘
     Rede interna do cliente                                      Cloud (Brasil)
```

**Princípio de segurança:** o agente só faz `SELECT` no Metrics. Nunca escreve. Nunca expõe o SQL Server para a internet.

---

## Módulos do Metrics a Integrar

### iQuote (Orçamentos)
| Campo Metrics | Campo Flux | Tabela Flux |
|---|---|---|
| `job_number` | `codigo` | `ordens_producao` |
| `job_description` | `nome_produto` | `ordens_producao` |
| `quantity` | `quantidade_meta` | `ordens_producao` |
| `paper_type` | `material` | `ordens_producao` |
| `priority` | `prioridade` | `ordens_producao` |
| `due_date` | `data_emissao` | `ordens_producao` |

### Planner (Programação)
| Campo Metrics | Campo Flux | Tabela Flux |
|---|---|---|
| `machine_id` | `maquina_id` | `maquinas` |
| `scheduled_start` | `data_inicio` | `registros_producao` |
| `scheduled_end` | `data_fim` | `registros_producao` |
| `operator_id` | `operador_id` | `registros_producao` |

### Jobtrack Automático (Apontamento)
| Campo Metrics | Campo Flux | Tabela Flux |
|---|---|---|
| `good_sheets` | `quantidade_boa` | `registros_producao` |
| `waste_sheets` | `quantidade_refugo` | `registros_producao` |
| `downtime_reason` | `motivo` | `paradas` |
| `downtime_start` | `data_inicio` | `paradas` |
| `downtime_end` | `data_fim` | `paradas` |

---

## Arquitetura do Agente

### Tecnologia
- **Runtime:** Node.js 20 + TypeScript
- **Banco origem:** `mssql` (driver oficial para SQL Server)
- **Banco destino:** `@supabase/supabase-js`
- **Agendamento:** cron interno (a cada 5 minutos)
- **Deploy:** Windows Service via `node-windows` ou Docker Desktop

### Fluxo de Sincronização

```
1. A cada 5 minutos:
   a. Consulta Metrics: SELECT registros novos/modificados desde última sync
   b. Para cada registro:
      - Verifica se já existe em Flux (por código/ID externo)
      - Se novo → INSERT em Flux
      - Se alterado → UPDATE em Flux
      - Se não alterado → ignora
   c. Salva timestamp da última sync em arquivo local
   d. Loga resultado (inseridos, atualizados, erros)
```

### Estrutura de Arquivos

```
flux-connector/
├── src/
│   ├── index.ts              # Entry point + cron
│   ├── readers/
│   │   ├── iquote.ts         # Lê orçamentos do Metrics
│   │   ├── planner.ts        # Lê programação do Metrics
│   │   └── jobtrack.ts       # Lê apontamentos do Metrics
│   ├── writers/
│   │   ├── ordens.ts         # Escreve OPs no Flux
│   │   ├── registros.ts      # Escreve produção no Flux
│   │   └── paradas.ts        # Escreve paradas no Flux
│   ├── sync/
│   │   ├── engine.ts         # Lógica de diff e upsert
│   │   └── state.ts          # Persiste última timestamp de sync
│   └── lib/
│       ├── metrics-db.ts     # Conexão SQL Server (read-only)
│       └── flux-api.ts       # Conexão Supabase
├── .env.example
├── package.json
└── install-service.js        # Registra como Windows Service
```

---

## Segurança

| Preocupação | Solução |
|---|---|
| SQL Server exposto | Agente roda dentro da rede do cliente — sem exposição externa |
| Credentials do Metrics | Armazenadas em `.env` local, nunca na cloud |
| Credentials do Supabase | Usar `service_role` key (não anon) — rotacionar a cada 90 dias |
| Agente escreve no Metrics | Impossível por design — usuário DB com permissão só SELECT |
| Dados em trânsito | HTTPS obrigatório para Supabase (TLS 1.2+) |
| Dados em repouso | Supabase em `sa-east-1` (Brasil) — conformidade LGPD |

### Usuário DB recomendado no Metrics

```sql
-- Criar usuário read-only no SQL Server do cliente
CREATE LOGIN flux_reader WITH PASSWORD = '<senha-forte>';
CREATE USER flux_reader FOR LOGIN flux_reader;

-- Permissão só de leitura nas tabelas necessárias
GRANT SELECT ON dbo.jobs TO flux_reader;
GRANT SELECT ON dbo.job_operations TO flux_reader;
GRANT SELECT ON dbo.downtime_events TO flux_reader;
```

---

## Plano de Deploy no Cliente

### Opção A — Windows Service (recomendado para Kingraf)
```
1. Instalar Node.js 20 LTS no servidor/PC do cliente
2. Copiar flux-connector/ para C:\FluxConnector\
3. Preencher .env com credenciais do Metrics e Supabase
4. Rodar: node install-service.js
5. Serviço inicia automaticamente com o Windows
6. Logs em C:\FluxConnector\logs\
```

### Opção B — Docker Desktop
```
1. Instalar Docker Desktop no servidor do cliente
2. docker pull ghcr.io/flux-insights/connector:latest
3. docker run -d --env-file .env --restart always flux-connector
```

---

## Estimativa de Esforço

| Fase | Entregável | Horas | Dias |
|---|---|---|---|
| Setup | Projeto, conexão Metrics + Supabase, env | 8h | 1 |
| Readers | Leitura das 3 tabelas do Metrics | 12h | 1.5 |
| Writers | Upsert no Supabase com deduplicação | 10h | 1.5 |
| Sync engine | Diff, timestamps, idempotência | 8h | 1 |
| Deploy | Windows Service + documentação | 6h | 1 |
| Testes | Com banco real do Metrics (staging) | 8h | 1 |
| **Total** | | **52h** | **~7 dias** |

---

## Pré-requisitos do Cliente

- Acesso ao SQL Server do Metrics (IP + porta + credenciais read-only)
- PC/servidor Windows na rede interna com acesso à internet
- Node.js 20 instalado (ou Docker Desktop)
- Aprovação do responsável de TI da Kingraf

---

## Próximos Passos

1. **Validar** este plano com Kingraf após piloto de 30 dias
2. **Solicitar** acesso ao schema do banco Metrics (pedir para ePS Software ou DBA do cliente)
3. **Desenvolver** em ambiente de homologação (banco Metrics sandbox)
4. **Deploy** em produção após aprovação
