# Guia de Upgrade de Infraestrutura

Checklist para migrar do plano gratuito para produção paga, quando o primeiro cliente (Kingraf) fechar contrato.

---

## Quando fazer o upgrade

Fazer upgrade **antes** de:
- Dar acesso ao cliente em produção
- Integrar com o ERP Connector
- Ter mais de 1 cliente ativo

---

## 1. Supabase Free → Pro (R$ ~150/mês)

### Verificações antes do upgrade

- [ ] Confirmar região: `sa-east-1` (São Paulo) ✅ — já está correto
- [ ] Revisar uso atual: painel → Settings → Usage
- [ ] Confirmar que não há tabelas sem RLS ✅ — já corrigido
- [ ] Testar backup manual antes de migrar (export via `pg_dump`)

### Como migrar

1. Painel Supabase → Settings → Billing → Upgrade to Pro
2. Selecionar plano **Pro** ($25/mês)
3. Confirmar que região permanece `sa-east-1`

### O que muda com o Pro

| Feature | Free | Pro |
|---|---|---|
| Backup automático | ❌ | ✅ Diário (7 dias de retenção) |
| Point-in-time recovery | ❌ | ✅ |
| Pausa automática (inatividade) | Sim (7 dias) | ❌ Nunca pausa |
| Conexões simultâneas | 50 | 200 |
| Storage | 500MB | 8GB |
| Bandwidth | 5GB | 250GB |
| Suporte | Community | Email |

### Configurar backup após upgrade

```sql
-- Verificar configuração de backup no painel:
-- Settings → Database → Backups
-- Habilitar: Daily backups + Point-in-time recovery
```

---

## 2. Vercel Hobby → Pro (R$ ~100/mês)

### Verificações antes do upgrade

- [ ] Confirmar que `vercel.json` está correto (rewrites, headers)
- [ ] Testar build de produção: `npm run build`
- [ ] Confirmar variáveis de ambiente no painel Vercel

### Como configurar domínio customizado

1. Painel Vercel → projeto → Settings → Domains
2. Adicionar `app.fluxinsights.com.br`
3. Configurar DNS no registrador:
   ```
   CNAME app → cname.vercel-dns.com
   ```
4. Aguardar propagação DNS (até 48h)
5. SSL automático via Let's Encrypt ✅

### O que muda com o Pro

| Feature | Hobby | Pro |
|---|---|---|
| Domínio customizado | ✅ | ✅ |
| Deploy preview | ✅ | ✅ |
| Bandwidth | 100GB | 1TB |
| Build minutes | 6.000/mês | Ilimitado |
| Team members | 1 | Ilimitado |
| SLA | - | 99.99% |
| Analytics | - | ✅ |

---

## 3. Variáveis de Ambiente Necessárias

Manter sempre atualizadas no Vercel (Settings → Environment Variables):

| Variável | Descrição | Onde obter |
|---|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (publishable) | Supabase → Settings → API |

> ⚠️ Nunca usar a `service_role` key no frontend — apenas no backend/agente.

---

## 4. Monitoramento de Erros em Produção

### Opção recomendada: Sentry (gratuito até 5k erros/mês)

```bash
npm install @sentry/react
```

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.2,
});
```

Adicionar ao `.env.example`:
```
VITE_SENTRY_DSN=
```

### Alertas recomendados no Sentry
- Qualquer erro não tratado (`unhandledRejection`)
- Erros de autenticação Supabase
- Falhas de conexão com banco

---

## 5. Checklist Final Pré-Go-Live

### Segurança
- [ ] `.env` não está no repositório ✅
- [ ] Chaves JWT rotacionadas ✅
- [ ] RLS ativo em todas as tabelas ✅
- [ ] Servidor em São Paulo (LGPD) ✅
- [ ] Usuário de banco read-only para ERP Connector

### Performance
- [ ] Build de produção testado sem erros
- [ ] Fontes do Google com `display=swap` (já configurado) ✅
- [ ] Imagens otimizadas em `public/assets/`
- [ ] Tailwind via CDN → substituir por build local (reduz 400KB)

### UX
- [ ] Testar login de operador em tablet físico
- [ ] Testar em modo offline (sem internet)
- [ ] Testar troca de turno completa

### Negócio
- [ ] Contrato assinado com Kingraf
- [ ] Dados reais do cliente importados
- [ ] Operadores treinados (sessão de 30min)
- [ ] Suporte definido (WhatsApp do fundador por 30 dias)
