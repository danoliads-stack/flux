-- SOLUÇÃO DRÁSTICA: Remover TODAS as políticas de storage e criar política ultra-permissiva

-- 1. REMOVER TODAS as políticas existentes em storage.objects
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;
END $$;

-- 2. Criar UMA política que permite TUDO para usuários autenticados
CREATE POLICY "Allow all authenticated users full access"
ON storage.objects
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Criar política de leitura pública para o bucket avatars
CREATE POLICY "Public read access to avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
