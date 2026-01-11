-- Manual validation of MES constraints
-- Run after cleaning/aligning legacy data.

ALTER TABLE public.paradas VALIDATE CONSTRAINT ck_paradas_data_fim_after_inicio;
ALTER TABLE public.registros_producao VALIDATE CONSTRAINT ck_registros_producao_data_fim_after_inicio;
ALTER TABLE public.registros_producao VALIDATE CONSTRAINT ck_registros_producao_non_negative;
