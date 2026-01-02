-- CORREÇÃO URGENTE: Remover políticas restritivas e criar políticas permissivas

-- 1. Remover todas as políticas da tabela profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- 2. Criar política permissiva para authenticated users verem todos os profiles
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 3. Permitir que authenticated users atualizem qualquer profile (admins/supervisors estão autenticados)
CREATE POLICY "Authenticated users can update profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (true);

-- 4. Permitir que authenticated users insiram profiles
CREATE POLICY "Authenticated users can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (true);
