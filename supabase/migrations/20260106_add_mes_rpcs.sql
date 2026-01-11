-- Migration: MES RPCs and guardrails
-- Date: 2026-01-06
-- Purpose: atomic transitions for setup/production/stop/finalize

-- Ensure status_change_at exists (used by the app as source of truth)
ALTER TABLE public.maquinas
ADD COLUMN IF NOT EXISTS status_change_at TIMESTAMPTZ;

-- Basic data consistency checks (safe: NOT VALID so existing data is not blocked)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_paradas_data_fim_after_inicio'
    ) THEN
        ALTER TABLE public.paradas
        ADD CONSTRAINT ck_paradas_data_fim_after_inicio
        CHECK (data_fim IS NULL OR data_fim >= data_inicio) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_registros_producao_data_fim_after_inicio'
    ) THEN
        ALTER TABLE public.registros_producao
        ADD CONSTRAINT ck_registros_producao_data_fim_after_inicio
        CHECK (data_fim IS NULL OR data_fim >= data_inicio) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_registros_producao_non_negative'
    ) THEN
        ALTER TABLE public.registros_producao
        ADD CONSTRAINT ck_registros_producao_non_negative
        CHECK (quantidade_boa >= 0 AND quantidade_refugo >= 0) NOT VALID;
    END IF;
END $$;

-- Helpful index for open stops lookup
CREATE INDEX IF NOT EXISTS idx_paradas_maquina_aberta
ON public.paradas (maquina_id)
WHERE data_fim IS NULL;

-- =========================================================
-- RPC: Start Setup
-- =========================================================
CREATE OR REPLACE FUNCTION public.mes_start_setup(
    p_machine_id UUID,
    p_op_id UUID,
    p_operator_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_machine public.maquinas%ROWTYPE;
    v_op_status TEXT;
    v_conflict_machine UUID;
BEGIN
    SELECT * INTO v_machine
    FROM public.maquinas
    WHERE id = p_machine_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MES: machine_not_found';
    END IF;

    SELECT status INTO v_op_status
    FROM public.ordens_producao
    WHERE id = p_op_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MES: op_not_found';
    END IF;

    IF v_op_status = 'FINALIZADA' THEN
        RAISE EXCEPTION 'MES: op_finalizada';
    END IF;

    SELECT id INTO v_conflict_machine
    FROM public.maquinas
    WHERE op_atual_id = p_op_id
      AND id <> p_machine_id
    LIMIT 1;

    IF v_conflict_machine IS NOT NULL THEN
        RAISE EXCEPTION 'MES: op_in_use_on_machine %', v_conflict_machine;
    END IF;

    IF v_machine.op_atual_id IS NOT NULL AND v_machine.op_atual_id <> p_op_id THEN
        RAISE EXCEPTION 'MES: machine_has_different_op';
    END IF;

    UPDATE public.maquinas
    SET status_atual = 'SETUP',
        op_atual_id = p_op_id,
        operador_atual_id = p_operator_id,
        status_change_at = NOW()
    WHERE id = p_machine_id;

    UPDATE public.ordens_producao
    SET status = 'EM_ANDAMENTO'
    WHERE id = p_op_id AND status = 'PENDENTE';
END;
$$;

-- =========================================================
-- RPC: Start Production
-- =========================================================
CREATE OR REPLACE FUNCTION public.mes_start_production(
    p_machine_id UUID,
    p_op_id UUID,
    p_operator_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_machine public.maquinas%ROWTYPE;
BEGIN
    SELECT * INTO v_machine
    FROM public.maquinas
    WHERE id = p_machine_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MES: machine_not_found';
    END IF;

    IF v_machine.op_atual_id IS NULL THEN
        RAISE EXCEPTION 'MES: machine_without_op';
    END IF;

    IF v_machine.op_atual_id <> p_op_id THEN
        RAISE EXCEPTION 'MES: machine_op_mismatch';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.paradas
        WHERE maquina_id = p_machine_id AND data_fim IS NULL
    ) THEN
        RAISE EXCEPTION 'MES: machine_has_open_stop';
    END IF;

    UPDATE public.maquinas
    SET status_atual = 'RUNNING',
        status_change_at = NOW(),
        operador_atual_id = p_operator_id
    WHERE id = p_machine_id;

    UPDATE public.ordens_producao
    SET status = 'EM_ANDAMENTO'
    WHERE id = p_op_id AND status IN ('PENDENTE', 'SUSPENSA');
END;
$$;

-- =========================================================
-- RPC: Stop Machine
-- =========================================================
CREATE OR REPLACE FUNCTION public.mes_stop_machine(
    p_machine_id UUID,
    p_reason TEXT,
    p_notes TEXT,
    p_operator_id UUID,
    p_op_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_machine public.maquinas%ROWTYPE;
    v_op_id UUID;
BEGIN
    SELECT * INTO v_machine
    FROM public.maquinas
    WHERE id = p_machine_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MES: machine_not_found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.paradas
        WHERE maquina_id = p_machine_id AND data_fim IS NULL
    ) THEN
        RAISE EXCEPTION 'MES: open_stop_exists';
    END IF;

    v_op_id := COALESCE(p_op_id, v_machine.op_atual_id);

    IF p_op_id IS NOT NULL
       AND v_machine.op_atual_id IS NOT NULL
       AND v_machine.op_atual_id <> p_op_id THEN
        RAISE EXCEPTION 'MES: machine_op_mismatch';
    END IF;

    INSERT INTO public.paradas (
        maquina_id,
        operador_id,
        op_id,
        motivo,
        notas,
        data_inicio
    )
    VALUES (
        p_machine_id,
        p_operator_id,
        v_op_id,
        p_reason,
        p_notes,
        NOW()
    );

    UPDATE public.maquinas
    SET status_atual = 'STOPPED',
        status_change_at = NOW(),
        operador_atual_id = COALESCE(p_operator_id, v_machine.operador_atual_id),
        op_atual_id = v_op_id
    WHERE id = p_machine_id;
END;
$$;

-- =========================================================
-- RPC: Resume Machine
-- =========================================================
CREATE OR REPLACE FUNCTION public.mes_resume_machine(
    p_machine_id UUID,
    p_next_status TEXT,
    p_operator_id UUID DEFAULT NULL,
    p_op_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_machine public.maquinas%ROWTYPE;
    v_stop_id UUID;
BEGIN
    SELECT * INTO v_machine
    FROM public.maquinas
    WHERE id = p_machine_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MES: machine_not_found';
    END IF;

    IF p_next_status NOT IN ('SETUP', 'RUNNING') THEN
        RAISE EXCEPTION 'MES: invalid_next_status';
    END IF;

    UPDATE public.paradas
    SET data_fim = NOW()
    WHERE id = (
        SELECT id FROM public.paradas
        WHERE maquina_id = p_machine_id AND data_fim IS NULL
        ORDER BY data_inicio DESC
        LIMIT 1
    )
    RETURNING id INTO v_stop_id;

    IF v_stop_id IS NULL THEN
        RAISE EXCEPTION 'MES: no_open_stop';
    END IF;

    UPDATE public.maquinas
    SET status_atual = p_next_status,
        status_change_at = NOW(),
        operador_atual_id = COALESCE(p_operator_id, v_machine.operador_atual_id),
        op_atual_id = COALESCE(p_op_id, v_machine.op_atual_id)
    WHERE id = p_machine_id;
END;
$$;

-- =========================================================
-- RPC: Record Production
-- =========================================================
CREATE OR REPLACE FUNCTION public.mes_record_production(
    p_op_id UUID,
    p_machine_id UUID,
    p_operator_id UUID,
    p_good_qty INTEGER,
    p_scrap_qty INTEGER,
    p_data_inicio TIMESTAMPTZ DEFAULT NOW(),
    p_data_fim TIMESTAMPTZ DEFAULT NULL,
    p_turno TEXT DEFAULT NULL
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
        turno
    )
    VALUES (
        p_op_id,
        p_machine_id,
        p_operator_id,
        COALESCE(p_good_qty, 0),
        COALESCE(p_scrap_qty, 0),
        p_data_inicio,
        p_data_fim,
        p_turno
    );

    UPDATE public.ordens_producao
    SET quantidade_produzida = COALESCE(quantidade_produzida, 0) + COALESCE(p_good_qty, 0),
        quantidade_refugo = COALESCE(quantidade_refugo, 0) + COALESCE(p_scrap_qty, 0),
        status = CASE WHEN status = 'PENDENTE' THEN 'EM_ANDAMENTO' ELSE status END
    WHERE id = p_op_id;
END;
$$;

-- =========================================================
-- RPC: Finalize OP
-- =========================================================
CREATE OR REPLACE FUNCTION public.mes_finalize_op(
    p_machine_id UUID,
    p_op_id UUID,
    p_operator_id UUID,
    p_good_qty INTEGER,
    p_scrap_qty INTEGER,
    p_tempo_setup INTEGER,
    p_tempo_producao INTEGER,
    p_tempo_parada INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_machine public.maquinas%ROWTYPE;
BEGIN
    SELECT * INTO v_machine
    FROM public.maquinas
    WHERE id = p_machine_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MES: machine_not_found';
    END IF;

    IF v_machine.op_atual_id IS NOT NULL AND v_machine.op_atual_id <> p_op_id THEN
        RAISE EXCEPTION 'MES: machine_op_mismatch';
    END IF;

    UPDATE public.ordens_producao
    SET status = 'FINALIZADA',
        quantidade_produzida = COALESCE(p_good_qty, 0),
        quantidade_refugo = COALESCE(p_scrap_qty, 0),
        tempo_setup_segundos = COALESCE(p_tempo_setup, 0),
        tempo_producao_segundos = COALESCE(p_tempo_producao, 0),
        tempo_parada_segundos = COALESCE(p_tempo_parada, 0)
    WHERE id = p_op_id;

    -- Close any open stop to avoid dangling downtime
    UPDATE public.paradas
    SET data_fim = NOW()
    WHERE maquina_id = p_machine_id AND data_fim IS NULL;

    UPDATE public.maquinas
    SET status_atual = 'AVAILABLE',
        status_change_at = NOW(),
        op_atual_id = NULL,
        operador_atual_id = COALESCE(p_operator_id, v_machine.operador_atual_id)
    WHERE id = p_machine_id;
END;
$$;

-- =========================================================
-- Grants (operators use anon role)
-- =========================================================
GRANT EXECUTE ON FUNCTION public.mes_start_setup(UUID, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mes_start_production(UUID, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mes_stop_machine(UUID, TEXT, TEXT, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mes_resume_machine(UUID, TEXT, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mes_record_production(UUID, UUID, UUID, INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mes_finalize_op(UUID, UUID, UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO anon, authenticated;
