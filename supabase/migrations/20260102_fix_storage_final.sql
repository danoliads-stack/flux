-- CORREÇÃO FINAL: Políticas permissivas para Storage

-- 1. Remover todas as políticas antigas do storage.objects
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

-- 2. Criar políticas REALMENTE permissivas

-- Permitir leitura pública de todos os objetos no bucket avatars
CREATE POLICY "Avatar bucket public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Permitir upload para qualquer usuário autenticado
CREATE POLICY "Avatar bucket authenticated insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Permitir update para qualquer usuário autenticado
CREATE POLICY "Avatar bucket authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Permitir delete para qualquer usuário autenticado
CREATE POLICY "Avatar bucket authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
