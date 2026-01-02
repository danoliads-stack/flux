-- Migration: FORÇAR Atualização de Hash para Todos os Operadores
-- Objetivo: Garantir que TODOS os operadores com PIN tenham um hash válido gerado agora.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Forçar atualização do hash para TODOS que têm PIN (mesmo se já tiver hash, sobrescreve para garantir)
-- Isso corrige casos onde o hash pode ter ficado inválido ou vazio
UPDATE public.operadores 
SET pin_hash = crypt(pin, gen_salt('bf', 8))
WHERE pin IS NOT NULL AND pin <> '';

-- 2. Garantir que a função de validação está correta (reforço)
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
        AND (
            -- Tenta validar pelo Hash (preferencial)
            (o.pin_hash IS NOT NULL AND o.pin_hash = crypt(p_pin, o.pin_hash))
            OR 
            -- Fallback para PIN texto plano (caso o update acima falhe por algum motivo bizarro)
            (o.pin IS NOT NULL AND o.pin = p_pin)
        );
END;
$$;

-- 3. Logs de confirmação (opcional, apenas para debug no SQL Editor se rodar manualmente)
-- SELECT count(*) as "Total Operadores Atualizados" FROM operadores WHERE pin_hash IS NOT NULL;
