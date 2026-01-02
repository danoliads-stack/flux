-- DANGER: Limpeza total da tabela de Operadores
-- Objetivo: Remover todos os operadores para recadastrar do zero com a nova criptografia.

-- 1. Limpar tabela de operadores (CASCADE vai remover referências em registros se houver)
-- Se preferir não perder o histórico de produção, mude para DELETE e set null manualmente, 
-- mas TRUNCATE é o mais garantido para "começar do zero".
TRUNCATE TABLE public.operadores CASCADE;

-- 2. (Opcional) Se quiser garantir que a coluna hash existe e a antiga pin morre (futuro)
-- ALTER TABLE public.operadores DROP COLUMN IF EXISTS pin; -- Descomente se quiser ser radical e proibir PIN texto plano

-- 3. Reforçar a função de validação (apenas para garantir que o ambiente está "novo")
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
            o.pin_hash IS NOT NULL AND o.pin_hash = crypt(p_pin, o.pin_hash)
        );
END;
$$;
