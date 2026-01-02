-- Verificar políticas de Storage existentes
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';
