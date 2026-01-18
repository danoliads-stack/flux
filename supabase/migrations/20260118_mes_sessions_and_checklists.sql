-- MES operator sessions and checklist integrity

-- Table: op_operator_sessions
CREATE TABLE IF NOT EXISTS public.op_operator_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    op_id UUID NOT NULL REFERENCES public.ordens_producao(id),
    operator_id UUID NOT NULL REFERENCES public.operadores(id),
    shift_id UUID NULL REFERENCES public.turnos(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one open session per OP
CREATE UNIQUE INDEX IF NOT EXISTS idx_op_operator_sessions_op_open
    ON public.op_operator_sessions (op_id)
    WHERE ended_at IS NULL;

-- Checklist events integrity
ALTER TABLE public.checklist_eventos
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS session_id UUID NULL REFERENCES public.op_operator_sessions(id);

ALTER TABLE public.checklist_eventos
    ALTER COLUMN operador_id SET NOT NULL,
    ALTER COLUMN op_id SET NOT NULL;

-- RPC: mes_switch_operator
DROP FUNCTION IF EXISTS public.mes_switch_operator(UUID, UUID, UUID);
CREATE OR REPLACE FUNCTION public.mes_switch_operator(
    p_op_id UUID,
    p_operator_id UUID,
    p_shift_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_session_id UUID;
BEGIN
    IF p_op_id IS NULL OR p_operator_id IS NULL THEN
        RAISE EXCEPTION 'MES: missing_op_or_operator';
    END IF;

    -- Close previous session for this OP
    UPDATE public.op_operator_sessions
    SET ended_at = NOW()
    WHERE op_id = p_op_id AND ended_at IS NULL;

    -- Open new session
    INSERT INTO public.op_operator_sessions (op_id, operator_id, shift_id, started_at)
    VALUES (p_op_id, p_operator_id, p_shift_id, NOW())
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
END;
$$;

-- RPC: mes_insert_checklist
CREATE OR REPLACE FUNCTION public.mes_insert_checklist(
    p_op_id UUID,
    p_maquina_id UUID,
    p_setor_id UUID,
    p_checklist_id UUID,
    p_status TEXT,
    p_observacao TEXT DEFAULT NULL,
    p_session_id UUID DEFAULT NULL
) RETURNS public.checklist_eventos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_session public.op_operator_sessions%ROWTYPE;
    v_event public.checklist_eventos%ROWTYPE;
BEGIN
    IF p_op_id IS NULL THEN
        RAISE EXCEPTION 'MES: checklist_missing_op';
    END IF;

    -- Resolve session
    IF p_session_id IS NOT NULL THEN
        SELECT * INTO v_session
        FROM public.op_operator_sessions
        WHERE id = p_session_id
          AND op_id = p_op_id
        LIMIT 1;
        IF NOT FOUND OR v_session.ended_at IS NOT NULL THEN
            RAISE EXCEPTION 'MES: invalid_or_closed_session';
        END IF;
    ELSE
        SELECT * INTO v_session
        FROM public.op_operator_sessions
        WHERE op_id = p_op_id AND ended_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'MES: no_active_session';
        END IF;
    END IF;

    INSERT INTO public.checklist_eventos (
        checklist_id,
        op_id,
        operador_id,
        maquina_id,
        setor_id,
        status,
        observacao,
        created_at,
        session_id
    ) VALUES (
        p_checklist_id,
        p_op_id,
        v_session.operator_id,
        p_maquina_id,
        p_setor_id,
        p_status,
        p_observacao,
        NOW(),
        v_session.id
    )
    RETURNING * INTO v_event;

    RETURN v_event;
END;
$$;
