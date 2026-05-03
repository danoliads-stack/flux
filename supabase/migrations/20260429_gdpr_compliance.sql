-- GDPR Compliance: Consentimento, Retenção e Anônimização

-- 1. Tabela de consentimento de política de privacidade
CREATE TABLE IF NOT EXISTS gdpr_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid REFERENCES operadores(id) ON DELETE CASCADE NOT NULL,
  accepted_at timestamptz DEFAULT now(),
  policy_version int DEFAULT 1,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX ON gdpr_consents(operator_id, accepted_at DESC);
CREATE INDEX ON gdpr_consents(operator_id, policy_version);

-- 2. Tabela de auditoria de deleções GDPR
CREATE TABLE IF NOT EXISTS gdpr_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL,
  operator_name text NOT NULL,
  deleted_by uuid REFERENCES operadores(id) ON DELETE SET NULL,
  reason text,
  anonymized_at timestamptz DEFAULT now()
);

CREATE INDEX ON gdpr_deletions(operator_id);
CREATE INDEX ON gdpr_deletions(anonymized_at DESC);

-- 3. RPC para anônimizar operador (direito ao esquecimento)
CREATE OR REPLACE FUNCTION gdpr_anonymize_operator(
  p_operator_id uuid,
  p_reason text DEFAULT 'Solicitação GDPR'
)
RETURNS jsonb AS $$
DECLARE
  v_operator_name text;
  v_deleted_by uuid := auth.uid();
BEGIN
  -- Captura nome antes de deletar
  SELECT nome INTO v_operator_name FROM operadores WHERE id = p_operator_id;

  IF v_operator_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Operador não encontrado'
    );
  END IF;

  -- Log de deleção
  INSERT INTO gdpr_deletions (operator_id, operator_name, deleted_by, reason)
  VALUES (p_operator_id, v_operator_name, v_deleted_by, p_reason);

  -- Anônimiza dados pessoais (mantém histórico de produção)
  UPDATE operadores
  SET
    nome = 'Anônimo',
    avatar = NULL
  WHERE id = p_operator_id;

  -- Limpa consentimentos antigos (manter apenas último)
  DELETE FROM gdpr_consents
  WHERE operator_id = p_operator_id
    AND created_at < (
      SELECT MAX(created_at) FROM gdpr_consents
      WHERE operator_id = p_operator_id
    );

  RETURN jsonb_build_object(
    'success', true,
    'operator_id', p_operator_id,
    'anonymized_at', now(),
    'message', 'Operador anônimizado com sucesso'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION gdpr_anonymize_operator(uuid, text) TO authenticated;

-- 4. Enable pg_cron extension (se não estiver habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 5. Schedule retenção automática (delete registros > 2 anos)
-- Executa toda segunda-feira às 3:00 AM
SELECT cron.schedule(
  'cleanup_old_production_records',
  '0 3 * * 1',
  'DELETE FROM registros_producao WHERE created_at < now() - interval ''2 years'''
);

-- 6. Schedule limpeza de paradas antigas (> 1 ano, já finalizadas)
SELECT cron.schedule(
  'cleanup_old_stops',
  '0 3 * * 2',
  'DELETE FROM paradas WHERE data_fim IS NOT NULL AND data_fim < now() - interval ''1 year'''
);

-- 7. RPC para verificar dados pessoais do operador (portabilidade)
CREATE OR REPLACE FUNCTION gdpr_export_operator_data(p_operator_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_operator_data jsonb;
  v_sessions jsonb;
  v_production jsonb;
BEGIN
  -- Dados do operador
  SELECT jsonb_build_object(
    'id', id,
    'matricula', matricula,
    'nome', nome,
    'setor_id', setor_id,
    'turno_id', turno_id,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_operator_data FROM operadores WHERE id = p_operator_id;

  IF v_operator_data IS NULL THEN
    RETURN jsonb_build_object('error', 'Operador não encontrado');
  END IF;

  -- Sessões (quem trabalhou em qual OP)
  SELECT jsonb_agg(jsonb_build_object(
    'op_id', op_id,
    'started_at', started_at,
    'ended_at', ended_at,
    'status', status
  )) INTO v_sessions FROM op_operator_sessions
  WHERE operator_id = p_operator_id
  ORDER BY started_at DESC;

  -- Apontamentos de produção
  SELECT jsonb_agg(jsonb_build_object(
    'op_id', op_id,
    'machine_id', machine_id,
    'good', good,
    'scrap', scrap,
    'recorded_at', created_at
  )) INTO v_production FROM registros_producao
  WHERE operator_id = p_operator_id
  ORDER BY created_at DESC
  LIMIT 100;

  RETURN jsonb_build_object(
    'operator', v_operator_data,
    'sessions', COALESCE(v_sessions, '[]'::jsonb),
    'production_records', COALESCE(v_production, '[]'::jsonb),
    'export_date', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION gdpr_export_operator_data(uuid) TO authenticated;

-- 8. RLS policies para gdpr_consents e gdpr_deletions
ALTER TABLE gdpr_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operadores podem ler seus próprios consentimentos"
  ON gdpr_consents FOR SELECT
  USING (
    (SELECT id FROM operadores WHERE auth_user_id = auth.uid()) = operator_id
  );

CREATE POLICY "Admin pode ler todos os consentimentos"
  ON gdpr_consents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM operadores
      WHERE id = (SELECT id FROM operadores WHERE auth_user_id = auth.uid())
        AND role IN ('admin', 'supervisor')
    )
  );

CREATE POLICY "Admin pode ler deletions"
  ON gdpr_deletions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM operadores
      WHERE id = (SELECT id FROM operadores WHERE auth_user_id = auth.uid())
        AND role IN ('admin', 'supervisor')
    )
  );
