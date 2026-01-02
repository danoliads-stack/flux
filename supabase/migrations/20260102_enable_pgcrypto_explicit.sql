-- Migration: Habilitar Extensão PGCRYPTO (CRÍTICO)
-- O erro "function crypt(text, text) does not exist" ocorre porque esta extensão não está ativa.

-- Tenta habilitar a extensão no schema 'extensions' (melhor prática no Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Se falhar ou se o schema extensions não estiver no path, tenta no public mesmo
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- Garante que o schema 'extensions' (se usado) está no search_path
ALTER DATABASE postgres SET search_path TO public, extensions;

-- Teste simples para ver se funcionou (vai retornar um hash se deu certo)
SELECT crypt('teste123', gen_salt('bf'));
