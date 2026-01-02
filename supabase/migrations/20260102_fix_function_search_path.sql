-- Migration: Corrigir Search Path da Função validate_operator_pin
-- Problema: A função não consegue encontrar crypt() porque está no schema extensions
-- Solução: Atualizar o search_path da função para incluir extensions

-- Recriar a função com search_path correto
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
SET search_path = public, extensions  -- ⚠️ CRUCIAL: Incluir extensions para achar crypt()
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

-- Atualizar a função hash_pin também
CREATE OR REPLACE FUNCTION public.hash_pin(p_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions  -- ⚠️ CRUCIAL: Incluir extensions
AS $$
BEGIN
    RETURN crypt(p_pin, gen_salt('bf', 8));
END;
$$;

-- Atualizar o trigger também
CREATE OR REPLACE FUNCTION public.trig_handle_operator_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions  -- ⚠️ CRUCIAL: Incluir extensions
AS $$
BEGIN
    IF NEW.pin IS NOT NULL AND NEW.pin <> '' AND (TG_OP = 'INSERT' OR NEW.pin IS DISTINCT FROM OLD.pin) THEN
        NEW.pin_hash := crypt(NEW.pin, gen_salt('bf', 8));
    END IF;
    RETURN NEW;
END;
$$;
