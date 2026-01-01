-- Script para resetar todas as máquinas
-- Execute este script no Supabase SQL Editor

-- 1. Resetar todas as máquinas para estado AVAILABLE
UPDATE maquinas
SET 
  status_atual = 'AVAILABLE',
  op_atual_id = NULL,
  operador_atual_id = NULL,
  status_change_at = NOW()
WHERE status_atual != 'MAINTENANCE';

-- 2. Finalizar todas as atribuições de operadores pendentes
UPDATE op_operadores
SET fim = NOW()
WHERE fim IS NULL;

-- 3. Opcional: Mostrar resultado
SELECT 
  id,
  nome,
  status_atual,
  op_atual_id,
  operador_atual_id,
  status_change_at
FROM maquinas
ORDER BY nome;
