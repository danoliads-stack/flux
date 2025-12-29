-- Migration: Add persistent state fields to ordens_producao
-- Date: 2025-12-28
-- Purpose: Enable robust MES functionality with OP state persistence

-- Add accumulated state fields to ordens_producao
ALTER TABLE public.ordens_producao 
ADD COLUMN IF NOT EXISTS quantidade_produzida INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantidade_refugo INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tempo_producao_segundos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tempo_setup_segundos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tempo_parada_segundos INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN public.ordens_producao.quantidade_produzida IS 'Quantidade total produzida acumulada (peças boas)';
COMMENT ON COLUMN public.ordens_producao.quantidade_refugo IS 'Quantidade total de refugo acumulada';
COMMENT ON COLUMN public.ordens_producao.tempo_producao_segundos IS 'Tempo total em produção (segundos)';
COMMENT ON COLUMN public.ordens_producao.tempo_setup_segundos IS 'Tempo total em setup (segundos)';
COMMENT ON COLUMN public.ordens_producao.tempo_parada_segundos IS 'Tempo total de paradas (segundos)';
