-- Migration: Implementar Hash de PINs com pgcrypto
-- Objetivo: Corrigir vulnerabilidade crítica de PINs em texto plano (Clean Version)

-- 1. Habilitar extensão pgcrypto (se não existir)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Adicionar coluna para hash do PIN
ALTER TABLE public.operadores ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- 3. Migrar PINs existentes para hash (preservando PIN original temporariamente)
-- Usando blowfish (bf) com custo 8 para boa segurança/performance
UPDATE public.operadores 
SET pin_hash = crypt(pin, gen_salt('bf', 8))
WHERE pin IS NOT NULL AND pin_hash IS NULL;

-- 4. Criar função RPC para validar operador com PIN
-- Esta função usa SECURITY DEFINER para executar com privilégios do owner
CREATE OR REPLACE FUNCTION public.validate_operator_pin(
    p_matricula TEXT,
    p_pin TEXT
)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    matricula TEXT,
    setor_id UUID,
    avatar TEXT,
    ativo BOOLEAN,
    setor_nome TEXT,
    turno_nome TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.nome,
        o.matricula,
        o.setor_id,
        o.avatar,
        o.ativo,
        s.nome AS setor_nome,
        t.nome AS turno_nome
    FROM operadores o
    LEFT JOIN setores s ON o.setor_id = s.id
    LEFT JOIN turnos t ON o.turno_id = t.id
    WHERE 
        o.matricula = p_matricula
        AND o.ativo = true
        AND o.pin_hash = crypt(p_pin, o.pin_hash);
END;
$$;

-- 5. Conceder permissão para anon e authenticated executarem a função
GRANT EXECUTE ON FUNCTION public.validate_operator_pin(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_operator_pin(TEXT, TEXT) TO authenticated;

-- 6. Criar função para hash de novo PIN (para uso em criação/edição de operadores)
CREATE OR REPLACE FUNCTION public.hash_pin(p_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN crypt(p_pin, gen_salt('bf', 8));
END;
$$;

GRANT EXECUTE ON FUNCTION public.hash_pin(TEXT) TO authenticated;

-- 7. Comentário: Após confirmar que tudo funciona, remover a coluna `pin` antiga
-- ALTER TABLE public.operadores DROP COLUMN pin;
-- Por enquanto, mantemos ambas para rollback se necessário
