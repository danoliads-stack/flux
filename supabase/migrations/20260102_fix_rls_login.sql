-- Migration: Reforçar Políticas RLS para Login
-- Objetivo: Garantir que o usuário anon (tela de login) consiga ler a tabela de operadores sem bloqueios.

-- 1. Remover políticas antigas para evitar duplicidade ou conflito
DROP POLICY IF EXISTS "Anon can view operadores" ON public.operadores;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.operadores;

-- 2. Criar política explícita de Leitura Pública (necessária para validação de login e exibição de nome/avatar)
CREATE POLICY "Public Read Access for Operators"
ON public.operadores FOR SELECT
TO anon, authenticated
USING (true);

-- 3. Garantir Grant de Select
GRANT SELECT ON public.operadores TO anon;
GRANT SELECT ON public.operadores TO authenticated;
