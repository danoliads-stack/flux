-- ==============================================
-- Migration: Implementar Políticas RLS Granulares
-- Data: 2026-01-02
-- Objetivo: Definir políticas de acesso explícitas para Admins e Operadores (Anon)
-- ==============================================

-- 1. TABELA MAQUINAS
ALTER TABLE public.maquinas ENABLE ROW LEVEL SECURITY;

-- Admin: Acesso total
CREATE POLICY "Admins have full access on maquinas"
ON public.maquinas
TO authenticated
USING (true)
WITH CHECK (true);

-- Anon (Operadores): Leitura permitida (necessário para seleção de máquina)
CREATE POLICY "Anon can view maquinas"
ON public.maquinas FOR SELECT
TO anon
USING (true);

-- Anon (Operadores): Atualizar status da máquina (necessário para operação)
CREATE POLICY "Anon can update maquinas status"
ON public.maquinas FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);


-- 2. TABELA OPERADORES
ALTER TABLE public.operadores ENABLE ROW LEVEL SECURITY;

-- Admin: Acesso total
CREATE POLICY "Admins have full access on operadores"
ON public.operadores
TO authenticated
USING (true)
WITH CHECK (true);

-- Anon (Operadores): Leitura permitida para login
CREATE POLICY "Anon can view operadores"
ON public.operadores FOR SELECT
TO anon
USING (true);

-- Anon NÃO pode inserir/atualizar/deletar operadores (apenas Admin)


-- 3. TABELA ORDENS_PRODUCAO
ALTER TABLE public.ordens_producao ENABLE ROW LEVEL SECURITY;

-- Admin: Acesso total
CREATE POLICY "Admins have full access on ordens_producao"
ON public.ordens_producao
TO authenticated
USING (true)
WITH CHECK (true);

-- Anon: Leitura permitida
CREATE POLICY "Anon can view ordens_producao"
ON public.ordens_producao FOR SELECT
TO anon
USING (true);


-- 4. TABELA REGISTROS_PRODUCAO
ALTER TABLE public.registros_producao ENABLE ROW LEVEL SECURITY;

-- Admin: Acesso total
CREATE POLICY "Admins have full access on registros_producao"
ON public.registros_producao
TO authenticated
USING (true)
WITH CHECK (true);

-- Anon: Inserir produção
CREATE POLICY "Anon can insert registros_producao"
ON public.registros_producao FOR INSERT
TO anon
WITH CHECK (true);

-- Anon: Ler seus registros (opcional, por enquanto aberto para dashboard)
CREATE POLICY "Anon can view registros_producao"
ON public.registros_producao FOR SELECT
TO anon
USING (true);


-- 5. TABELA PARADAS
ALTER TABLE public.paradas ENABLE ROW LEVEL SECURITY;

-- Admin: Acesso total
CREATE POLICY "Admins have full access on paradas"
ON public.paradas
TO authenticated
USING (true)
WITH CHECK (true);

-- Anon: Inserir/Atualizar paradas
CREATE POLICY "Anon can insert paradas"
ON public.paradas FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can update paradas"
ON public.paradas FOR UPDATE
TO anon
USING (true);

CREATE POLICY "Anon can view paradas"
ON public.paradas FOR SELECT
TO anon
USING (true);


-- 6. TABELA SETORES (Apenas leitura para Anon)
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access on setores" ON public.setores TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Everyone can view setores" ON public.setores FOR SELECT USING (true);
