-- Migration: Corrigir Login de Operadores (Drop & Recreate + Hash Fix)
-- Objetivo: Garantir que a função RPC funcione mesmo com RLS ativado e hash correto

-- 1. Habilitar extensão pgcrypto (se não existir)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Drop da função antiga para garantir recriação limpa (evitar conflito de assinatura)
DROP FUNCTION IF EXISTS public.validate_operator_pin(TEXT, TEXT);

-- 3. Recriar função RPC com SECURITY DEFINER (Bypasses RLS)
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
SECURITY DEFINER -- ⚠️ CRÍTICO: Executa como dono do banco (bypasses RLS)
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
        AND (
            -- Verifica hash (novo método)
            (o.pin_hash IS NOT NULL AND o.pin_hash = crypt(p_pin, o.pin_hash))
            OR 
            -- Fallback: Verifica texto plano (antigo método - temporário)
            (o.pin_hash IS NULL AND o.pin = p_pin)
        );
END;
$$;

-- 4. Conceder permissão EXPLICITA para anon e authenticated
GRANT EXECUTE ON FUNCTION public.validate_operator_pin(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_operator_pin(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_operator_pin(TEXT, TEXT) TO service_role;

-- 5. Garantir que novos operadores tenham hash calculado (Trigger opcional, ou no App)
-- Por enquanto, vamos confiar que o AdminDashboard já salva o hash.
-- Mas vamos rodar um update de segurança para garantir que quem tem PIN e não tem hash, ganhe hash agora.
UPDATE public.operadores 
SET pin_hash = crypt(pin, gen_salt('bf', 8))
WHERE pin IS NOT NULL AND pin_hash IS NULL;
