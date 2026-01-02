-- Migration: Auto-Hash Trigger para Operadores
-- Objetivo: Hashear o PIN automaticamente ao inserir/atualizar, sem depender do frontend.

-- 1. Criar a função do Trigger
CREATE OR REPLACE FUNCTION public.trig_handle_operator_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se um novo PIN foi fornecido (e não é nulo/vazio)
    IF NEW.pin IS NOT NULL AND NEW.pin <> '' AND (TG_OP = 'INSERT' OR NEW.pin IS DISTINCT FROM OLD.pin) THEN
        -- Gera o hash usando pgcrypto
        NEW.pin_hash := crypt(NEW.pin, gen_salt('bf', 8));
        
        -- Opcional: Se quiser limpar o PIN original imediatamente para não salvar texto plano
        -- NEW.pin := NULL; -- Por enquanto manteremos para segurança (fallback), descomente depois se quiser
    END IF;
    RETURN NEW;
END;
$$;

-- 2. Criar o Trigger na tabela Operadores
DROP TRIGGER IF EXISTS trg_operadores_pin_hash ON public.operadores;

CREATE TRIGGER trg_operadores_pin_hash
BEFORE INSERT OR UPDATE ON public.operadores
FOR EACH ROW
EXECUTE FUNCTION public.trig_handle_operator_pin();

-- 3. Grant permissões necessárias (embora SECURITY DEFINER resolva a maioria)
GRANT EXECUTE ON FUNCTION public.trig_handle_operator_pin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trig_handle_operator_pin() TO service_role;
