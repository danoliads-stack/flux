-- Migration: OP summary snapshot and idempotent production events
-- Date: 2026-01-19
-- Purpose: Centralize OP metrics in a single snapshot (op_summary) and make production inserts idempotent

-- 1) Idempotent production events
ALTER TABLE public.registros_producao
ADD COLUMN IF NOT EXISTS client_event_id UUID NULL,
ADD COLUMN IF NOT EXISTS tipo_refugo_id UUID NULL;

-- Optional FK only if tipos_refugo exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tipos_refugo'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_registros_producao_tipo_refugo'
        ) THEN
            ALTER TABLE public.registros_producao
            ADD CONSTRAINT fk_registros_producao_tipo_refugo
            FOREIGN KEY (tipo_refugo_id) REFERENCES public.tipos_refugo(id);
        END IF;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_registros_producao_op_event
    ON public.registros_producao (op_id, client_event_id)
    WHERE client_event_id IS NOT NULL;

-- 2) Snapshot table
CREATE TABLE IF NOT EXISTS public.op_summary (
    op_id UUID PRIMARY KEY REFERENCES public.ordens_producao(id) ON DELETE CASCADE,
    machine_id UUID NULL REFERENCES public.maquinas(id),
    quantidade_produzida INTEGER NOT NULL DEFAULT 0,
    quantidade_refugo INTEGER NOT NULL DEFAULT 0,
    tempo_setup_seg INTEGER NOT NULL DEFAULT 0,
    tempo_rodando_seg INTEGER NOT NULL DEFAULT 0,
    tempo_parado_seg INTEGER NOT NULL DEFAULT 0,
    qtd_paradas INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.op_summary IS 'Snapshot consolidado de métricas por OP (derivado de registros_producao e paradas).';

-- 3) Views for details
CREATE OR REPLACE VIEW public.vw_op_stop_by_reason AS
SELECT
    p.op_id,
    s.machine_id,
    p.motivo AS tipo_parada_id,
    COUNT(*) AS qtd_paradas,
    COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(p.data_fim, NOW()) - p.data_inicio))), 0)::BIGINT AS tempo_parado_seg
FROM public.paradas p
LEFT JOIN public.op_summary s ON s.op_id = p.op_id
WHERE p.op_id IS NOT NULL
GROUP BY p.op_id, s.machine_id, p.motivo;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'registros_producao' AND column_name = 'tipo_refugo_id'
    ) THEN
        EXECUTE $v$
            CREATE OR REPLACE VIEW public.vw_op_scrap_by_type AS
            SELECT
                rp.op_id,
                os.machine_id,
                rp.tipo_refugo_id,
                SUM(COALESCE(rp.quantidade_refugo, 0)) AS quantidade_refugo
            FROM public.registros_producao rp
            LEFT JOIN public.op_summary os ON os.op_id = rp.op_id
            WHERE rp.op_id IS NOT NULL
            GROUP BY rp.op_id, os.machine_id, rp.tipo_refugo_id
        $v$;
    ELSE
        EXECUTE $v$
            CREATE OR REPLACE VIEW public.vw_op_scrap_by_type AS
            SELECT
                rp.op_id,
                os.machine_id,
                NULL::UUID AS tipo_refugo_id,
                SUM(COALESCE(rp.quantidade_refugo, 0)) AS quantidade_refugo
            FROM public.registros_producao rp
            LEFT JOIN public.op_summary os ON os.op_id = rp.op_id
            WHERE rp.op_id IS NOT NULL
            GROUP BY rp.op_id, os.machine_id
        $v$;
    END IF;
END $$;

-- 4) Refresh function
CREATE OR REPLACE FUNCTION public.mes_refresh_op_summary(p_op_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_exists UUID;
    v_min_start TIMESTAMPTZ;
    v_max_end TIMESTAMPTZ;
    v_run BIGINT := 0;
    v_stop BIGINT := 0;
    v_setup BIGINT := 0;
    v_count_stop INTEGER := 0;
    v_prod INTEGER := 0;
    v_scrap INTEGER := 0;
    v_machine UUID;
BEGIN
    IF p_op_id IS NULL THEN
        RAISE EXCEPTION 'MES: missing_op';
    END IF;

    SELECT id INTO v_exists FROM public.ordens_producao WHERE id = p_op_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MES: op_not_found';
    END IF;

    -- Production aggregates
    SELECT
        COALESCE(SUM(quantidade_boa), 0),
        COALESCE(SUM(quantidade_refugo), 0),
        COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(data_fim, NOW()) - data_inicio))), 0)::BIGINT,
        MAX(maquina_id::text)::uuid -- uuid doesn't have max aggregate, cast to text for deterministic pick
    INTO v_prod, v_scrap, v_run, v_machine
    FROM public.registros_producao
    WHERE op_id = p_op_id;

    -- Stops aggregates
    SELECT
        COALESCE(COUNT(*), 0),
        COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(data_fim, NOW()) - data_inicio))), 0)::BIGINT
    INTO v_count_stop, v_stop
    FROM public.paradas
    WHERE op_id = p_op_id;

    -- Time span to backfill setup (total span - running - stopped)
    SELECT
        LEAST(
            COALESCE((SELECT MIN(data_inicio) FROM public.registros_producao WHERE op_id = p_op_id), NOW()),
            COALESCE((SELECT MIN(data_inicio) FROM public.paradas WHERE op_id = p_op_id), NOW())
        ) AS min_start,
        GREATEST(
            COALESCE((SELECT MAX(COALESCE(data_fim, NOW())) FROM public.registros_producao WHERE op_id = p_op_id), NOW()),
            COALESCE((SELECT MAX(COALESCE(data_fim, NOW())) FROM public.paradas WHERE op_id = p_op_id), NOW()),
            NOW()
        ) AS max_end
    INTO v_min_start, v_max_end;

    IF v_min_start IS NOT NULL AND v_max_end IS NOT NULL THEN
        v_setup := GREATEST(0, EXTRACT(EPOCH FROM (v_max_end - v_min_start))::BIGINT - v_run - v_stop);
    END IF;

    INSERT INTO public.op_summary (
        op_id,
        machine_id,
        quantidade_produzida,
        quantidade_refugo,
        tempo_setup_seg,
        tempo_rodando_seg,
        tempo_parado_seg,
        qtd_paradas,
        updated_at
    ) VALUES (
        p_op_id,
        v_machine,
        v_prod,
        v_scrap,
        COALESCE(v_setup, 0),
        v_run,
        v_stop,
        v_count_stop,
        NOW()
    )
    ON CONFLICT (op_id) DO UPDATE SET
        machine_id = EXCLUDED.machine_id,
        quantidade_produzida = EXCLUDED.quantidade_produzida,
        quantidade_refugo = EXCLUDED.quantidade_refugo,
        tempo_setup_seg = EXCLUDED.tempo_setup_seg,
        tempo_rodando_seg = EXCLUDED.tempo_rodando_seg,
        tempo_parado_seg = EXCLUDED.tempo_parado_seg,
        qtd_paradas = EXCLUDED.qtd_paradas,
        updated_at = EXCLUDED.updated_at;
END;
$$;

-- 5) Triggers to keep snapshot fresh
CREATE OR REPLACE FUNCTION public.tg_refresh_op_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_op UUID;
BEGIN
    v_op := COALESCE(NEW.op_id, OLD.op_id);
    IF v_op IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    PERFORM public.mes_refresh_op_summary(v_op);
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_registros_producao_op_summary ON public.registros_producao;
CREATE TRIGGER trg_registros_producao_op_summary
AFTER INSERT OR UPDATE OR DELETE ON public.registros_producao
FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_op_summary();

DROP TRIGGER IF EXISTS trg_paradas_op_summary ON public.paradas;
CREATE TRIGGER trg_paradas_op_summary
AFTER INSERT OR UPDATE OR DELETE ON public.paradas
FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_op_summary();

-- 6) Update RPC to accept client_event_id and stop mutating ordens_producao totals
CREATE OR REPLACE FUNCTION public.mes_record_production(
    p_op_id UUID,
    p_machine_id UUID,
    p_operator_id UUID,
    p_good_qty INTEGER,
    p_scrap_qty INTEGER,
    p_data_inicio TIMESTAMPTZ DEFAULT NOW(),
    p_data_fim TIMESTAMPTZ DEFAULT NULL,
    p_turno TEXT DEFAULT NULL,
    p_client_event_id UUID DEFAULT NULL,
    p_tipo_refugo_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF COALESCE(p_good_qty, 0) < 0 OR COALESCE(p_scrap_qty, 0) < 0 THEN
        RAISE EXCEPTION 'MES: negative_quantities_not_allowed';
    END IF;

    INSERT INTO public.registros_producao (
        op_id,
        maquina_id,
        operador_id,
        quantidade_boa,
        quantidade_refugo,
        data_inicio,
        data_fim,
        turno,
        client_event_id,
        tipo_refugo_id
    )
    VALUES (
        p_op_id,
        p_machine_id,
        p_operator_id,
        COALESCE(p_good_qty, 0),
        COALESCE(p_scrap_qty, 0),
        p_data_inicio,
        p_data_fim,
        p_turno,
        p_client_event_id,
        p_tipo_refugo_id
    )
    ON CONFLICT (op_id, client_event_id) WHERE client_event_id IS NOT NULL DO NOTHING;

    PERFORM public.mes_refresh_op_summary(p_op_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mes_refresh_op_summary(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mes_record_production(UUID, UUID, UUID, INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, UUID) TO anon, authenticated;
