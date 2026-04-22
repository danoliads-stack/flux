# FLUX Insights — Plataforma de Controle de Produção Industrial

Dashboard em tempo real para gráficas de médio porte: OEE, paradas, refugo e checklists de qualidade — tudo que o ERP não entrega de forma visual.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Backend / Banco | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth (admin/supervisor) + PIN hash (operador) |
| Deploy | Vercel |
| Gráficos | Recharts |
| Estado global | Zustand |

---

## Pré-requisitos

- Node.js 20+
- Conta Supabase com projeto configurado
- Variáveis de ambiente (ver `.env.example`)

---

## Instalação

```bash
npm install
```

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-chave-publica>
```

---

## Rodar localmente

```bash
npm run dev
```

Acesse `http://localhost:5173`

---

## Build para produção

```bash
npm run build
```

---

## Banco de dados

As migrations estão em `supabase/migrations/`. Aplique na ordem cronológica pelo painel Supabase ou via CLI:

```bash
supabase db push
```

Para popular dados de demonstração:
```bash
# Aplique a migration de seed
supabase/migrations/20260422_seed_demo_kingraf.sql
```

---

## Perfis de acesso

| Perfil | Login | Permissões |
|---|---|---|
| Operador | Matrícula + PIN (4 dígitos) | Painel da máquina, apontamentos, checklists |
| Supervisor | Email + Senha | Supervisão operacional, relatórios |
| Admin | Email + Senha | Configuração completa do sistema |

---

## Estrutura de pastas

```
├── components/          # Componentes React (dashboards, modais, painéis)
├── src/
│   ├── hooks/           # Hooks customizados (timer, sessão, etc.)
│   ├── lib/             # Clientes externos (Supabase com retry)
│   ├── services/        # Lógica de negócio (insights, kaizen)
│   ├── store/           # Estado global (Zustand)
│   └── utils/           # Logger, realtime, storage
├── supabase/
│   └── migrations/      # Histórico de schema e seeds
├── public/
│   └── assets/          # Logo e imagens
├── App.tsx              # Roteamento principal
├── AuthContext.tsx      # Contexto de autenticação
├── types.ts             # Types TypeScript
└── index.html           # Entry point
```

---

## Segurança

- Credenciais nunca commitadas (`.env` no `.gitignore`)
- Row Level Security (RLS) ativo em todas as tabelas
- PINs de operadores armazenados com hash (bcrypt via Supabase)
- Servidor em `sa-east-1` (São Paulo) — conformidade LGPD

---

## Roadmap

- **Fase 1** ✅ — Painel do Operador, Supervisão, Checklists, OEE
- **Fase 2** 🔄 — ERP Connector (leitura do Metrics ERP via agente local)
- **Fase 3** — Integração WhatsApp + SDR automatizado
- **Fase 4** — Multi-tenancy (múltiplos clientes)
